// Pareto de defectos (Calidad, 2026-10-10). Sin React para poder probarlo solo.
// Cuenta INCIDENCIAS: un rechazo con 2 defectos suma 1 a cada defecto (el numero de rechazos se cuenta aparte).
// Orden: frecuencia desc y, en empate, nombre (orden estable). Porcentajes con precision completa; se redondea al
// mostrar. "Vitales" = los defectos hasta incluir el primero cuyo acumulado alcanza o pasa el 80%.

export const PARETO_CUT = 0.8

export function computePareto(rejections) {
  const by = new Map()
  for (const r of rejections) for (const d of r.defects || []) by.set(d, (by.get(d) || 0) + 1)
  const total = [...by.values()].reduce((a, n) => a + n, 0)
  const sorted = [...by]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'es'))
  let acc = 0
  let reached = false
  const rows = sorted.map((x) => {
    acc += x.n
    const cum = total ? acc / total : 0
    const vital = !reached
    if (cum >= PARETO_CUT) reached = true
    return { ...x, pct: total ? x.n / total : 0, cum, vital }
  })
  // El ultimo acumulado es exactamente 100% (evita 99.999...% por redondeo binario).
  if (rows.length) rows[rows.length - 1].cum = 1
  return { total, rows }
}
