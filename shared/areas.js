// Areas de trabajo de la cuenta Planta (pantalla de entrada, 2026-10-08): cada acceso solo ve y solo puede hacer
// lo de su area. Admin (con contrasena) no tiene area: ve todo. Compartido entre servidor y cliente.
//   entrada: entrada de pallets + calidad
//   salida:  salida de pallets + calidad
//   lineas:  solo Produccion por linea (escaneo TV + caja y personal por linea)

export const AREAS = {
  entrada: { label: 'Entrada', home: '/pallets/entrada' },
  salida: { label: 'Salida', home: '/pallets/salida' },
  lineas: { label: 'Producción por línea', home: '/pallets/lineas' },
}
export const isArea = (a) => Object.hasOwn(AREAS, a)

const PALLET = /^\/pallets\/\d{6}$/ // detalle de una entrada
const SALIDA = /^\/pallets\/\d{6}-S(\/reporte)?$/ // detalle o reporte de una salida
const CALIDAD = (p) => p === '/calidad' || p.startsWith('/calidad/')

// Paginas permitidas por area.
export function areaAllowsPage(area, path) {
  if (!isArea(area)) return true
  if (area === 'entrada') return path === '/pallets/entrada' || PALLET.test(path) || CALIDAD(path)
  if (area === 'salida') return path === '/pallets/salida' || SALIDA.test(path) || PALLET.test(path) || CALIDAD(path)
  return path === '/pallets/lineas'
}

// Acciones que escriben (POST/PUT/PATCH/DELETE en /api) permitidas por area. Las lecturas (GET) no se limitan.
export function areaAllowsWrite(area, method, path) {
  if (!isArea(area)) return true
  if (path.startsWith('/auth/')) return true
  const m = method.toUpperCase()
  const quality = (m === 'POST' && path === '/rejections') || (m === 'DELETE' && /^\/rejections\/\d+$/.test(path))
  const items = path.match(/^\/pallets\/([^/]+)\/items(\/[^/]+)?$/)
  if (area === 'entrada')
    return (
      quality ||
      (m === 'POST' && path === '/pallets/entrada') ||
      (items && !items[1].endsWith('-S') && (m === 'POST' || m === 'DELETE')) ||
      (m === 'POST' && /^\/pallets\/\d{6}\/close$/.test(path))
    )
  if (area === 'salida')
    return (
      quality ||
      (m === 'POST' && path === '/pallets/salida') ||
      (items && items[1].endsWith('-S') && (m === 'POST' || m === 'DELETE')) ||
      (m === 'POST' && /^\/pallets\/[^/]+-S\/reconcile$/.test(path)) ||
      (m === 'POST' && /^\/pallets\/\d{6}\/remove-duplicate$/.test(path))
    )
  return (
    (m === 'POST' && path === '/production') ||
    (m === 'DELETE' && /^\/production\/\d+$/.test(path)) ||
    (m === 'PUT' && path === '/staffing')
  )
}
