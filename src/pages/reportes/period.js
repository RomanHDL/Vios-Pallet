// Periodos del Centro de reportes (2026-10-10): dia / semana (lunes a domingo) / mes, con fecha ancla.
// Fechas de turno YYYY-MM-DD de la planta: el Turno 2 (22:00 a 07:00) cuenta en el dia en que empieza, igual que
// en los reportes completos, asi que un rango de fechas nunca parte la noche.
import { addDays } from '@shared/shift.js'
import { fmtYmd } from '@/lib/utils'

const MON = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const dow = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
const monthEnd = (ymd) => {
  const [y, m] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}
const addMonths = (ymd, n) => {
  const [y, m] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10)
}

// Rango completo del periodo que contiene `anchor`.
export function periodRange(mode, anchor) {
  if (mode === 'semana') {
    const from = addDays(anchor, -((dow(anchor) + 6) % 7))
    return { from, to: addDays(from, 6) }
  }
  if (mode === 'mes') {
    const from = `${anchor.slice(0, 7)}-01`
    return { from, to: monthEnd(from) }
  }
  return { from: anchor, to: anchor }
}

// Rango para consultar: no pasa de hoy.
export function queryRange(mode, anchor, today) {
  const r = periodRange(mode, anchor)
  return { from: r.from, to: r.to > today ? today : r.to }
}

// Ancla del periodo anterior / siguiente.
export function stepAnchor(mode, anchor, dir) {
  if (mode === 'semana') return addDays(anchor, 7 * dir)
  if (mode === 'mes') return addMonths(anchor, dir)
  return addDays(anchor, dir)
}

export function periodLabel(mode, anchor) {
  const r = periodRange(mode, anchor)
  if (mode === 'mes') {
    const [y, m] = r.from.split('-').map(Number)
    return `${MON[m - 1]} ${y}`
  }
  if (mode === 'semana') return `${fmtYmd(r.from, { dow: false })} – ${fmtYmd(r.to, { dow: false })}`
  return fmtYmd(anchor)
}

export const PREV_LABEL = { dia: 'vs. día anterior', semana: 'vs. semana anterior', mes: 'vs. mes anterior' }

// Comparacion justa con el periodo anterior: si el actual sigue en curso (incluye hoy) se comparan solo los dias
// ya cerrados contra los mismos dias del periodo anterior; un dia en curso no se compara (devuelve null).
export function comparableRanges(mode, anchor, today) {
  const r = periodRange(mode, anchor)
  if (r.from > today) return null
  const prev = periodRange(mode, stepAnchor(mode, anchor, -1))
  if (r.to < today) return { cur: r, prev }
  const lastClosed = addDays(today, -1)
  if (lastClosed < r.from) return null
  const days = Math.round((Date.parse(lastClosed) - Date.parse(r.from)) / 86400000)
  const prevTo = addDays(prev.from, days)
  return {
    cur: { from: r.from, to: lastClosed },
    prev: { from: prev.from, to: prevTo > prev.to ? prev.to : prevTo },
    partial: true,
  }
}

// Cambio relativo; sin base (0) no hay porcentaje.
export const change = (cur, prev) => (prev > 0 ? (cur - prev) / prev : null)

export function eachDay(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}
