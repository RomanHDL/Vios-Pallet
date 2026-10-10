// Proyeccion de produccion (Reporte por modelo y Centro de reportes): regresion lineal de los ultimos 10 dias con
// produccion, para los siguientes 5 dias habiles despues de hoy, topada a 2 turnos de meta. Compartido entre
// servidor y cliente para que la tarjeta del Centro de reportes use exactamente la misma formula.
import { addDays, isWorkday } from './shift.js'

export function projectProduction(totals, capacity, today, count = 5) {
  const recent = totals.slice(-10)
  const projection = []
  if (recent.length < 2) return projection
  const n = recent.length
  const xs = recent.map((_, i) => i)
  const mx = (n - 1) / 2
  const my = recent.reduce((a, y) => a + y, 0) / n
  const slope =
    xs.reduce((a, x, i) => a + (x - mx) * (recent[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  let d = today
  let k = 1
  while (projection.length < count) {
    d = addDays(d, 1)
    if (!isWorkday(d)) continue
    const y = Math.round(my + slope * (n - 1 - mx + k))
    projection.push({ date: d, value: Math.max(0, Math.min(capacity * 2, y)) })
    k++
  }
  return projection
}
