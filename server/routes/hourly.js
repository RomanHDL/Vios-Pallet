// Tablero Hora por Hora: piezas por hora del turno (salidas de pallet + producto registrado) contra la meta
// del turno, con tiempo por pieza y proyeccion al fin del turno. Sin division por linea.
import { sql } from 'drizzle-orm'
import { Router } from 'express'
import { pace, shiftWindow } from '../../shared/pace.js'
import { hourOfShift, SHIFTS, shiftOf } from '../../shared/shift.js'
import { requireAuth } from '../auth.js'
import { db } from '../db.js'
import { BRANDS, GOAL_SCOPE, rawBrandCount, shiftAdjustments, shiftBrandSplit, shiftGoal, shiftOutput } from '../output.js'
import { hourlyGoals } from '../schema.js'
import { bad, clean, isYmd, rows } from '../util.js'

const r = Router()

function params(q) {
  const now = shiftOf()
  return {
    shiftDate: isYmd(q.shiftDate) ? q.shiftDate : now.shiftDate,
    shift: SHIFTS.some((s) => s.key === q.shift) ? q.shift : now.shift,
  }
}

r.get('/hourly', requireAuth(), async (req, res) => {
  const { shiftDate, shift } = params(req.query)
  const output = await shiftOutput(shiftDate, shift)
  const hours = SHIFTS.find((s) => s.key === shift).hours
  const perHour = Array.from({ length: hours }, () => 0)
  for (const x of output) {
    const h = hourOfShift(new Date(x.at), shift)
    if (h >= 0 && h < hours) perHour[h] += 1
  }
  const { goal, manual, since } = await shiftGoal(shiftDate, shift)
  // Ultimo escaneo del turno (salidas, abiertas o cerradas, y escaneo por linea): "desde ultimo scan".
  const { start, end } = shiftWindow(shiftDate, shift)
  const [{ last }] = await rows(sql`
    select greatest(
      (select max(i.scanned_at) from pallet_items i join pallets p on p.id = i.pallet_id
        where p.type = 'salida' and i.scanned_at >= ${start.toISOString()} and i.scanned_at < ${end.toISOString()}),
      (select max(registered_at) from production where shift_date = ${shiftDate} and shift = ${shift})) as last`)
  const now = new Date()
  res.json({
    shiftDate,
    shift,
    now: now.toISOString(),
    current: shiftOf(now),
    goal,
    manual,
    goalSince: since,
    perHour,
    total: output.length,
    brands: await shiftBrandSplit(shiftDate, shift),
    adjustments: await shiftAdjustments(shiftDate, shift),
    lastAt: output.at(-1)?.at || null,
    lastScanAt: last || null,
    pace: pace({ shiftDate, shift, count: output.length, goal, firstAt: output[0]?.at, now }),
  })
})

// Produccion por linea del turno: piezas escaneadas en la estacion (TV + caja) de cada linea, desde
// Pallets -> Produccion por linea (tabla production). No suma a la produccion del turno (esa es solo salidas
// cerradas); es el avance por linea, con el personal capturado por linea.
r.get('/production/by-line', requireAuth(), async (req, res) => {
  const { shiftDate, shift } = params(req.query)
  const brand = req.query.brand ? clean(req.query.brand, 20) : null
  const out = await rows(sql`
    select line, count(*)::int as pieces, count(distinct model)::int as models, max(registered_at) as last_at
    from production
    where shift_date = ${shiftDate} and shift = ${shift} and ${brand ? sql`brand = ${brand}` : sql`true`}
    group by 1`)
  const staff = await rows(sql`
    select line, people from staffing where shift_date = ${shiftDate} and shift = ${shift} and people > 0`)
  const names = new Set([...out.map((x) => x.line), ...staff.map((x) => x.line)])
  const list = [...names]
    .map((line) => {
      const o = out.find((x) => x.line === line)
      const people = staff.find((x) => x.line === line)?.people ?? null
      const pieces = o?.pieces || 0
      return {
        line: line || null,
        pieces,
        models: o?.models || 0,
        lastAt: o?.last_at || null,
        people,
        perPerson: people ? pieces / people : null,
      }
    })
    .sort((a, b) => (a.line === null) - (b.line === null) || String(a.line).localeCompare(String(b.line)))
  const { goal } = await shiftGoal(shiftDate, shift)
  res.json({
    shiftDate,
    shift,
    current: shiftOf(),
    goal,
    total: list.reduce((a, x) => a + x.pieces, 0),
    people: staff.reduce((a, x) => a + x.people, 0),
    lines: list,
  })
})

// Historial dia por dia de Produccion por linea (solo admin): piezas por fecha de turno, turno y linea.
// Los escaneos nunca se borran; la pantalla de la linea solo muestra el turno en curso.
r.get('/production/history', requireAuth([]), async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
  const list = await rows(sql`
    select shift_date, shift, line, count(*)::int pieces,
      count(distinct model)::int models, min(registered_at) as first_at, max(registered_at) as last_at
    from production
    where shift_date >= to_char((now() at time zone 'America/Monterrey')::date - ${days}::int, 'YYYY-MM-DD')
    group by 1, 2, 3 order by 1 desc, 2 desc, 3`)
  const byShift = new Map()
  for (const x of list) {
    const k = `${x.shift_date}|${x.shift}`
    if (!byShift.has(k)) byShift.set(k, { shiftDate: x.shift_date, shift: x.shift, total: 0, lines: [] })
    const g = byShift.get(k)
    g.total += x.pieces
    g.lines.push({ line: x.line, pieces: x.pieces, models: x.models, firstAt: x.first_at, lastAt: x.last_at })
  }
  res.json({ days, shifts: [...byShift.values()] })
})

// Cambiar la meta del turno (desde esa fecha en adelante).
r.put('/hourly/goal', requireAuth(['supervisor']), async (req, res) => {
  const { shiftDate, shift } = params(req.body || {})
  const goal = Math.round(Number(req.body?.goal))
  if (!Number.isInteger(goal) || goal < 1 || goal > 100000) throw bad('Meta inválida.')
  await db
    .insert(hourlyGoals)
    .values({ shiftDate, shift, scope: GOAL_SCOPE, goal, updatedBy: req.user.id })
    .onConflictDoUpdate({
      target: [hourlyGoals.shiftDate, hourlyGoals.shift, hourlyGoals.scope],
      set: { goal, updatedBy: req.user.id, updatedAt: new Date() },
    })
  res.json({ ok: true })
})

// Ajuste por marca: "SILO hoy se hicieron 23". Guarda la diferencia contra lo escaneado del turno; piezas vacio = quitar.
r.put('/hourly/brand-count', requireAuth(['supervisor']), async (req, res) => {
  const { shiftDate, shift } = params(req.body || {})
  const brand = String(req.body?.brand || '')
  if (!BRANDS.includes(brand)) throw bad('Marca inválida.')
  const raw = await rawBrandCount(shiftDate, shift, brand)
  const clear = req.body?.pieces === null || req.body?.pieces === ''
  const pieces = Math.round(Number(req.body?.pieces))
  if (!clear && (!Number.isInteger(pieces) || pieces < 0 || pieces > 100000)) throw bad('Cantidad inválida.')
  const delta = clear ? 0 : pieces - raw
  await rows(sql`
    insert into production_adjustments (shift_date, shift, brand, delta, updated_by)
    values (${shiftDate}, ${shift}, ${brand}, ${delta}, ${req.user.id})
    on conflict (shift_date, shift, brand) do update set delta = excluded.delta,
      updated_by = excluded.updated_by, updated_at = now()`)
  res.json({ ok: true, brand, raw, delta, pieces: raw + delta })
})

export default r
