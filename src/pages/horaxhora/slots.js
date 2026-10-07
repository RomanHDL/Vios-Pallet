// Bloques del tablero Hora por Hora y meta por hora. Mismas reglas que Centro de Trabajo (hrXHrFft):
//  - Dia (T1): 07:00 a 17:00, 10 bloques; comida 11-12 y 12-13 cuentan a la mitad.
//  - Noche (T2): 22:00 a 07:00, 9 bloques; descanso 2-3 sin meta.
//  - Meta por hora = meta del turno / horas productivas, redondeada hacia arriba en cada bloque.
// Las horas de tiempo extra del dia (17 a 22) solo aparecen si hubo produccion, sin meta.
import { hourOfShift } from '@shared/shift.js'

const CONFIG = {
  T1: { start: 7, blocks: 10, extra: 5, factor: { 11: 0.5, 12: 0.5 }, range: '07:00 a 17:00' },
  T2: { start: 22, blocks: 9, extra: 0, factor: { 2: 0 }, range: '22:00 a 07:00' },
}

export const shiftRange = (shift) => CONFIG[shift].range

const shiftKey = (date, shift) => `${date}|${shift === 'T1' ? 1 : 2}`

export function buildSlots({ shiftDate, shift, goal, perHour, current, now }) {
  const cfg = CONFIG[shift]
  const productive = Array.from(
    { length: cfg.blocks },
    (_, i) => cfg.factor[(cfg.start + i) % 24] ?? 1,
  ).reduce((a, f) => a + f, 0)
  const hourly = productive > 0 && goal > 0 ? goal / productive : 0

  // Bloque en curso (indice desde el inicio del turno) segun el turno pedido vs. el actual.
  const here = shiftKey(shiftDate, shift)
  const cur = shiftKey(current.shiftDate, current.shift)
  const nowIdx = here === cur ? hourOfShift(new Date(now), shift) : here < cur ? Infinity : -1

  const slots = []
  const total = cfg.blocks + cfg.extra
  for (let i = 0; i < total; i++) {
    const hour = (cfg.start + i) % 24
    const extra = i >= cfg.blocks
    const real = perHour[i] || 0
    if (extra && real === 0 && nowIdx !== i) continue
    const factor = extra ? 0 : (cfg.factor[hour] ?? 1)
    slots.push({
      key: `${hour}-${(hour + 1) % 24}`,
      hour,
      real,
      plan: Math.ceil(hourly * factor - 1e-9),
      extra,
      status: i < nowIdx ? 'done' : i === nowIdx ? 'current' : 'future',
    })
  }
  return { slots, hourly }
}

export const COLORS = { met: '#16A34A', below: '#DC2626', current: '#2563EB', extra: '#6B7280' }

export function barKind(s) {
  if (s.status === 'future') return 'future'
  if (s.status === 'current') return 'current'
  if (!(s.plan > 0)) return 'extra'
  return s.real >= s.plan ? 'met' : 'below'
}

// Meta "base" (la de las horas completas, la mas comun) y tramos con meta reducida (comida).
export function goalLines(slots) {
  const counts = new Map()
  for (const s of slots) if (s.plan > 0 && !s.extra) counts.set(s.plan, (counts.get(s.plan) || 0) + 1)
  let base = null
  for (const [plan, n] of counts)
    if (base === null || n > counts.get(base) || (n === counts.get(base) && plan > base)) base = plan
  const runs = []
  slots.forEach((s, i) => {
    if (!(s.plan > 0) || base === null || s.plan >= base) return
    const last = runs.at(-1)
    if (last && last.plan === s.plan && last.to === i - 1) last.to = i
    else runs.push({ plan: s.plan, from: i, to: i })
  })
  return { base, runs }
}
