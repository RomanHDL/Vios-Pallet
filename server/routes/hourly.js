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
import { bad, isYmd, rows } from '../util.js'

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
