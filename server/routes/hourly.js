// Tablero Hora por Hora: piezas por hora del turno contra la meta del turno.
import { sql } from 'drizzle-orm'
import { Router } from 'express'
import { hourOfShift, SHIFTS, shiftOf } from '../../shared/shift.js'
import { requireAuth } from '../auth.js'
import { db } from '../db.js'
import { hourlyGoals } from '../schema.js'
import { bad, clean, isYmd, rows } from '../util.js'

const r = Router()
const ALL = '*'

function params(q) {
  const now = shiftOf()
  return {
    shiftDate: isYmd(q.shiftDate) ? q.shiftDate : now.shiftDate,
    shift: SHIFTS.some((s) => s.key === q.shift) ? q.shift : now.shift,
    scope: q.line ? clean(q.line, 40) : ALL,
  }
}

r.get('/hourly', requireAuth(), async (req, res) => {
  const { shiftDate, shift, scope } = params(req.query)
  const one = scope !== ALL
  const records = await rows(sql`
    select registered_at from production
    where shift_date = ${shiftDate} and shift = ${shift} ${one ? sql`and line = ${scope}` : sql``}`)
  const hours = SHIFTS.find((s) => s.key === shift).hours
  const perHour = Array.from({ length: hours }, () => 0)
  for (const x of records) {
    const h = hourOfShift(new Date(x.registered_at), shift)
    if (h >= 0 && h < hours) perHour[h] += 1
  }

  // Plan del turno: plan capturado por linea o, sin captura, la meta de la linea (igual que Lineas en vivo).
  const [{ plan }] = await rows(sql`
    select coalesce(sum(coalesce(p.planned, l.goal)), 0)::int as plan
    from lines l
    left join plans p on p.line = l.name and p.shift_date = ${shiftDate} and p.shift = ${shift}
    where l.active ${one ? sql`and l.name = ${scope}` : sql``}`)
  // Igual que Centro de Trabajo: la meta guardada sigue vigente los dias siguientes hasta que se cambie.
  const [manual] = await rows(sql`
    select shift_date, goal from hourly_goals
    where shift_date <= ${shiftDate} and shift = ${shift} and scope = ${scope}
    order by shift_date desc limit 1`)

  res.json({
    shiftDate,
    shift,
    line: one ? scope : null,
    now: new Date().toISOString(),
    current: shiftOf(),
    plan,
    goal: manual ? manual.goal : plan,
    manual: Boolean(manual),
    goalSince: manual?.shift_date || null,
    perHour,
    total: records.length,
  })
})

// Cambiar la meta del turno (desde esa fecha en adelante).
r.put('/hourly/goal', requireAuth(['supervisor']), async (req, res) => {
  const { shiftDate, shift, scope } = params(req.body || {})
  const value = req.body?.goal
  const goal = Math.round(Number(value))
  if (!Number.isInteger(goal) || goal < 1 || goal > 100000) throw bad('Meta inválida.')
  await db
    .insert(hourlyGoals)
    .values({ shiftDate, shift, scope, goal, updatedBy: req.user.id })
    .onConflictDoUpdate({
      target: [hourlyGoals.shiftDate, hourlyGoals.shift, hourlyGoals.scope],
      set: { goal, updatedBy: req.user.id, updatedAt: new Date() },
    })
  res.json({ ok: true })
})

export default r
