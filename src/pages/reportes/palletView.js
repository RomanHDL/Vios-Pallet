// Logica del carrusel de Progreso visual de pallets (sin React, para poder probarla sola).

export const isPending = (p) => p.state !== 'consolidado'

// Orden: pendientes de menor a mayor avance; consolidados del mas reciente al mas viejo.
export function orderPallets(list) {
  // Todos los pallets del tablero: los que no tienen salida (entrada abierta o sin salida) tambien son pendientes.
  const withExit = list
  const pending = withExit
    .filter(isPending)
    .sort((a, b) => a.progress - b.progress || String(a.salida_created_at).localeCompare(String(b.salida_created_at)))
  const done = withExit
    .filter((p) => !isPending(p))
    .sort((a, b) => String(b.salida_closed_at || '').localeCompare(String(a.salida_closed_at || '')))
  return { pending, done }
}

// Ventana circular de `size` elementos empezando en `offset` (sin repetir si hay menos que `size`).
function windowOf(list, offset, size) {
  if (list.length <= size) return list.map((x, i) => ({ x, i }))
  return Array.from({ length: size }, (_, k) => {
    const i = (((offset + k) % list.length) + list.length) % list.length
    return { x: list[i], i }
  })
}

// Que se ve: { cards: [{ pallet, index, fixed }], rotating, mode }. `index` es la posicion en [pendientes, consolidados].
export function buildView(pending, done, slots, page) {
  if (pending.length >= slots) {
    // Todos los lugares son de pendientes: rotan entre ellos por paginas.
    const rotating = pending.length > slots
    const cards = windowOf(pending, page * slots, slots).map(({ x, i }) => ({ pallet: x, index: i, fixed: false }))
    return { cards, rotating, mode: 'pending' }
  }
  const free = slots - pending.length
  const rotating = done.length > free
  const fixed = pending.map((x, i) => ({ pallet: x, index: i, fixed: true }))
  const rest = windowOf(done, page * free, free).map(({ x, i }) => ({ pallet: x, index: pending.length + i, fixed: false }))
  return { cards: [...fixed, ...rest], rotating, mode: 'done' }
}

// "1–3, 8–11" a partir de las posiciones visibles.
export function rangesText(indexes) {
  const sorted = [...indexes].sort((a, b) => a - b)
  const parts = []
  for (const n of sorted) {
    const last = parts.at(-1)
    if (last && n === last[1] + 1) last[1] = n
    else parts.push([n, n])
  }
  return parts.map(([a, b]) => (a === b ? `${a + 1}` : `${a + 1}–${b + 1}`)).join(', ')
}


// Cajas llenas: 0 si no hay avance, todas solo al 100% (nunca se ve llena si falta algo).
export function filledSlots(progress, slots) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0))
  if (p >= 1) return slots
  if (p <= 0) return 0
  return Math.min(slots - 1, Math.max(1, Math.round(p * slots)))
}

