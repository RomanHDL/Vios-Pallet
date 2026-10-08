// Horario productivo, ritmo (tiempo por pieza) y proyeccion al fin del turno. Compartido servidor/cliente.
//  - Dia (T1): 07:00 a 17:00; comida 11-12 y 12-13 cuentan a la mitad.
//  - Noche (T2): 22:00 a 07:00; descanso 2-3 no cuenta.
// Monterrey usa UTC-6 todo el ano (Mexico quito el horario de verano en 2022).
import { addDays } from './shift.js'

export const DEFAULT_DAILY_GOAL = 765

export const SCHEDULE = {
  T1: { start: 7, blocks: 10, extra: 5, factor: { 11: 0.5, 12: 0.5 }, range: '07:00 a 17:00' },
  T2: { start: 22, blocks: 9, extra: 0, factor: { 2: 0 }, range: '22:00 a 07:00' },
}

const pad = (n) => String(n).padStart(2, '0')

// Inicio del turno (instante) y fin del conteo (T1 incluye tiempo extra hasta las 22:00).
export function shiftWindow(shiftDate, shift) {
  const start = new Date(`${shiftDate}T${pad(SCHEDULE[shift].start)}:00:00-06:00`)
  const end =
    shift === 'T1'
      ? new Date(`${shiftDate}T22:00:00-06:00`)
      : new Date(`${addDays(shiftDate, 1)}T07:00:00-06:00`)
  return { start, end }
}

const factorOf = (shift, i) => SCHEDULE[shift].factor[(SCHEDULE[shift].start + i) % 24] ?? 1

export function productiveHours(shift) {
  let h = 0
  for (let i = 0; i < SCHEDULE[shift].blocks; i++) h += factorOf(shift, i)
  return h
}

// Horas productivas del inicio del turno hasta `now`.
function elapsedProductive(shiftDate, shift, now) {
  const { start } = shiftWindow(shiftDate, shift)
  const hours = (now - start) / 3_600_000
  if (hours <= 0) return 0
  let h = 0
  for (let i = 0; i < SCHEDULE[shift].blocks; i++)
    h += factorOf(shift, i) * Math.min(1, Math.max(0, hours - i))
  return h
}

/**
 * Ritmo del turno:
 *  secPerPiece      tiempo real por pieza: tiempo productivo desde la PRIMERA pieza del turno / piezas
 *                   (si arrancaron tarde no se cuenta el tiempo sin trabajar)
 *  goalSecPerPiece  tiempo por pieza que pide la meta
 *  projection       piezas al fin del turno si se sigue al mismo ritmo
 *  projectionExtra  igual pero con tiempo extra (Dia: hasta las 22:00); null si el turno no tiene extra
 *  perHour          piezas por hora productiva al ritmo actual
 */
export function pace({ shiftDate, shift, count, goal, firstAt = null, now = new Date() }) {
  const total = productiveHours(shift)
  const elapsed = Math.min(total, elapsedProductive(shiftDate, shift, now))
  const remaining = total - elapsed
  const worked = firstAt
    ? Math.max(0, elapsed - Math.min(total, elapsedProductive(shiftDate, shift, new Date(firstAt))))
    : elapsed
  // Con muy poco tiempo trabajado el ritmo no es confiable: minimo 5 minutos.
  const basis = Math.max(worked, Math.min(elapsed, 5 / 60))
  const rate = basis > 0 ? count / basis : 0 // piezas por hora productiva
  // Tiempo extra que queda (Dia: 17:00 a 22:00).
  const cfg = SCHEDULE[shift]
  const sinceRegularEnd = (now - shiftWindow(shiftDate, shift).start) / 3_600_000 - cfg.blocks
  const extraLeft = cfg.extra ? Math.min(cfg.extra, Math.max(0, cfg.extra - Math.max(0, sinceRegularEnd))) : 0
  return {
    perHour: rate,
    projectionExtra: cfg.extra ? Math.round(count + rate * (remaining + extraLeft)) : null,
    elapsedHours: elapsed,
    remainingHours: remaining,
    secPerPiece: count > 0 && basis > 0 ? (basis * 3600) / count : null,
    goalSecPerPiece: goal > 0 ? (total * 3600) / goal : null,
    projection: Math.round(count + rate * remaining),
    expectedNow: goal > 0 ? Math.round((goal * elapsed) / total) : 0,
  }
}
