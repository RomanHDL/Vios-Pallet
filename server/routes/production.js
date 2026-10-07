import { and, eq, sql } from 'drizzle-orm'
import { Router } from 'express'
import { hourOfShift, shiftOf, SHIFTS } from '../../shared/shift.js'
import { requireAuth } from '../auth.js'
import { db } from '../db.js'
import { brands, lines, models, plans, production, rejections, staffing } from '../schema.js'
import {
  bad,
  clean,
  code,
  conflict,
  isUniqueViolation,
  isYmd,
  notFound,
  rows,
} from '../util.js'

const r = Router()
const userName = (col) => sql`(select name from users where users.id = ${col})`
const shiftParam = (q) => {
  const now = shiftOf()
  return {
    shiftDate: isYmd(q.shiftDate) ? q.shiftDate : now.shiftDate,
    shift: SHIFTS.some((s) => s.key === q.shift) ? q.shift : now.shift,
  }
}

// Registro de producto terminado: serial de la TV = serial de la caja.
r.post('/production', requireAuth(['supervisor', 'operador']), async (req, res) => {
  const tv = code(req.body?.serialTv)
  const box = code(req.body?.serialBox)
  const line = clean(req.body?.line, 40)
  const model = clean(req.body?.model, 40)
  const brand = clean(req.body?.brand, 20)
  if (!tv || !box) throw bad('Escanea el serial de la TV y el de la caja.')
  if (tv !== box) throw bad('Los seriales no coinciden.', { mismatch: true })
  const [l] = await db.select().from(lines).where(and(eq(lines.name, line), eq(lines.active, true)))
  if (!l) throw bad('Selecciona la línea de la estación.')
  const [m] = await db.select().from(models).where(and(eq(models.code, model), eq(models.active, true)))
  if (!m) throw bad('Selecciona el modelo de la estación.')
  if (!tv.startsWith(m.prefix)) throw bad(`El serial debe empezar con ${m.prefix} (modelo ${m.code}).`)
  const [b] = await db.select().from(brands).where(and(eq(brands.code, brand), eq(brands.active, true)))
  if (!b) throw bad('Selecciona la marca de la estación.')
  const [rej] = await db.select().from(rejections).where(eq(rejections.serial, tv)).limit(1)
  if (rej) throw conflict('Serial rechazado por Calidad. No se puede registrar.', { rejected: true })
  const { shiftDate, shift } = shiftOf()
  try {
    const [row] = await db
      .insert(production)
      .values({ serial: tv, line, model, brand, shiftDate, shift, registeredBy: req.user.id })
      .returning()
    const [{ n }] = await rows(
      sql`select count(*)::int n from production where shift_date = ${shiftDate} and shift = ${shift} and line = ${line}`,
    )
    res.status(201).json({ record: row, lineCount: n, goal: l.goal })
  } catch (e) {
    if (isUniqueViolation(e)) {
      const [prev] = await rows(sql`
        select p.*, ${userName(sql`p.registered_by`)} as registered_by_name from production p where serial = ${tv}`)
      throw conflict('Serial ya registrado.', { duplicate: true, previous: prev })
    }
    throw e
  }
})

r.get('/production', requireAuth(), async (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 100)
  const conds = [sql`true`]
  if (req.query.line) conds.push(sql`p.line = ${clean(req.query.line, 40)}`)
  if (isYmd(req.query.shiftDate)) conds.push(sql`p.shift_date = ${req.query.shiftDate}`)
  if (req.query.shift) conds.push(sql`p.shift = ${clean(req.query.shift, 4)}`)
  if (req.query.q) conds.push(sql`p.serial ilike ${`%${code(req.query.q)}%`}`)
  const list = await rows(sql`
    select p.*, ${userName(sql`p.registered_by`)} as registered_by_name
    from production p where ${sql.join(conds, sql` and `)}
    order by p.registered_at desc limit ${limit}`)
  res.json({ records: list })
})

r.delete('/production/:id', requireAuth(['supervisor']), async (req, res) => {
  const [row] = await db
    .delete(production)
    .where(eq(production.id, Number(req.params.id)))
    .returning()
  if (!row) throw notFound('Registro no encontrado.')
  res.json({ ok: true })
})

// Tablero en vivo por linea para un turno.
r.get('/production/live', requireAuth(), async (req, res) => {
  const { shiftDate, shift } = shiftParam(req.query)
  const allLines = await db.select().from(lines).where(eq(lines.active, true)).orderBy(lines.sort, lines.name)
  const records = await rows(sql`
    select line, registered_at from production
    where shift_date = ${shiftDate} and shift = ${shift} order by registered_at`)
  const planRows = await rows(
    sql`select line, planned from plans where shift_date = ${shiftDate} and shift = ${shift}`,
  )
  const staffRows = await rows(
    sql`select line, people from staffing where shift_date = ${shiftDate} and shift = ${shift}`,
  )
  const planBy = Object.fromEntries(planRows.map((x) => [x.line, x.planned]))
  const staffBy = Object.fromEntries(staffRows.map((x) => [x.line, x.people]))
  const hours = SHIFTS.find((s) => s.key === shift).hours
  const out = allLines.map((l) => {
    const recs = records.filter((x) => x.line === l.name)
    const perHour = Array.from({ length: hours }, () => 0)
    for (const x of recs) {
      const h = hourOfShift(new Date(x.registered_at), shift)
      if (h >= 0 && h < hours) perHour[h] += 1
    }
    const first = recs[0]?.registered_at || null
    const last = recs.at(-1)?.registered_at || null
    return {
      line: l.name,
      goal: planBy[l.name] ?? l.goal,
      planned: planBy[l.name] ?? null,
      count: recs.length,
      people: staffBy[l.name] ?? null,
      first,
      last,
      perHour,
    }
  })
  res.json({ shiftDate, shift, now: new Date().toISOString(), lines: out })
})

// Personal por linea y turno.
r.get('/staffing', requireAuth(), async (req, res) => {
  const { shiftDate, shift } = shiftParam(req.query)
  const list = await rows(sql`
    select s.*, ${userName(sql`s.updated_by`)} as updated_by_name from staffing s
    where shift_date = ${shiftDate} and shift = ${shift}`)
  res.json({ shiftDate, shift, staffing: list })
})

r.put('/staffing', requireAuth(['supervisor']), async (req, res) => {
  const { shiftDate, shift } = shiftParam(req.body || {})
  const byLine = req.body?.lines || {}
  for (const [line, value] of Object.entries(byLine)) {
    const people = Math.max(0, Math.round(Number(value) || 0))
    await db
      .insert(staffing)
      .values({ shiftDate, shift, line: clean(line, 40), people, updatedBy: req.user.id })
      .onConflictDoUpdate({
        target: [staffing.shiftDate, staffing.shift, staffing.line],
        set: { people, updatedBy: req.user.id, updatedAt: new Date() },
      })
  }
  res.json({ ok: true })
})

// Plan (materiales disponibles) por linea y turno.
r.get('/plans', requireAuth(), async (req, res) => {
  const { shiftDate, shift } = shiftParam(req.query)
  const list = await rows(sql`select * from plans where shift_date = ${shiftDate} and shift = ${shift}`)
  res.json({ shiftDate, shift, plans: list })
})

r.put('/plans', requireAuth(['supervisor']), async (req, res) => {
  const { shiftDate, shift } = shiftParam(req.body || {})
  const byLine = req.body?.lines || {}
  for (const [line, value] of Object.entries(byLine)) {
    if (value === null || value === '') {
      await db
        .delete(plans)
        .where(and(eq(plans.shiftDate, shiftDate), eq(plans.shift, shift), eq(plans.line, line)))
      continue
    }
    const planned = Math.max(0, Math.round(Number(value) || 0))
    await db
      .insert(plans)
      .values({ shiftDate, shift, line: clean(line, 40), planned, updatedBy: req.user.id })
      .onConflictDoUpdate({
        target: [plans.shiftDate, plans.shift, plans.line],
        set: { planned, updatedBy: req.user.id, updatedAt: new Date() },
      })
  }
  res.json({ ok: true })
})

export default r
