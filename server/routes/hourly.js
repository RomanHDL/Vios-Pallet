// Tablero Hora por Hora: piezas por hora del turno (salidas de pallet + producto registrado) contra la meta
// del turno, con tiempo por pieza y proyeccion al fin del turno. Sin division por linea.
import { sql } from 'drizzle-orm'
import { Router } from 'express'
import { pace, shiftWindow } from '../../shared/pace.js'
import { hourOfShift, SHIFTS, shiftOf } from '../../shared/shift.js'
import { requireAuth } from '../auth.js'
import { db } from '../db.js'
import { GOAL_SCOPE, shiftGoal, shiftOutput } from '../output.js'
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
  // Ultimo escaneo en cualquier salida del turno (abierta o cerrada): "desde ultimo scan".
  const { start, end } = shiftWindow(shiftDate, shift)
  const [{ last }] = await rows(sql`
    select max(i.scanned_at) as last from pallet_items i join pallets p on p.id = i.pallet_id
    where p.type = 'salida' and i.scanned_at >= ${start.toISOString()} and i.scanned_at < ${end.toISOString()}`)
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
    lastAt: output.at(-1)?.at || null,
    lastScanAt: last || null,
    pace: pace({ shiftDate, shift, count: output.length, goal, firstAt: output[0]?.at, now }),
  })
})

// Produccion por linea del turno: piezas de salidas CERRADAS agrupadas por la linea de la salida, mas el
// personal capturado por linea. Misma regla que Hora por Hora (las piezas cuentan en la hora del escaneo).
r.get('/production/by-line', requireAuth(), async (req, res) => {
  const { shiftDate, shift } = params(req.query)
  const brand = req.query.brand ? clean(req.query.brand, 20) : null
  const { start, end } = shiftWindow(shiftDate, shift)
  const out = await rows(sql`
    select coalesce(p.line, '') as line, count(distinct i.code)::int as pieces,
           count(distinct p.id)::int as pallets, max(i.scanned_at) as last_at
    from pallet_items i join pallets p on p.id = i.pallet_id
    where p.type = 'salida' and p.status = 'cerrado' and ${brand ? sql`p.brand = ${brand}` : sql`true`}
      and i.scanned_at >= ${start.toISOString()} and i.scanned_at < ${end.toISOString()}
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
        pallets: o?.pallets || 0,
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

export default r
