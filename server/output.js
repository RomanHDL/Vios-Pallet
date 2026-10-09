// Produccion del turno = piezas de pallets de SALIDA CERRADOS (a la hora en que se escanearon) + piezas
// escaneadas TV + caja en Pallets -> Produccion por linea (tabla production). Un serial cuenta una sola vez
// (la primera vez que aparece). Sin dividir por linea. No cuentan las salidas abiertas.
// Historia: 2026-10-07 "solo salidas cerradas"; 2026-10-08 "la produccion de hora por hora que ya empiece a
// contar... ese area es el de produccion por linea".
import { sql } from 'drizzle-orm'
import { DEFAULT_DAILY_GOAL, shiftWindow } from '../shared/pace.js'
import { shiftOf } from '../shared/shift.js'
import { rows } from './util.js'

// Meta total del turno en hourly_goals. Clave nueva: las metas capturadas antes (por linea/plan) ya no aplican.
export const GOAL_SCOPE = 'total'

// Fecha de turno de un timestamp (T2 de 22:00 a 07:00 cuenta para el dia en que empezo).
const shiftDay = (col) => sql`((${col} at time zone 'America/Monterrey') - interval '7 hours')::date`

// Todas las piezas producidas: salidas cerradas + escaneo por linea. Columnas: serial, at, model, brand.
// 2026-10-08 (Roman): no cuentan las piezas de un pallet de entrada que aun no tiene salida cerrada, y un pallet
// cuya entrada es de otro dia cuenta en el dia de su entrada ("los pallets de ayer" no suman a hoy, van a ayer).
const PRODUCED = sql`(
  select * from (
    select i.code as serial,
      case when e.id is not null and ${shiftDay(sql`e.created_at`)} <> ${shiftDay(sql`i.scanned_at`)}
        then coalesce(ei.scanned_at, e.created_at) else i.scanned_at end as at,
      p.model, p.brand, p.id as pallet
    from pallet_items i join pallets p on p.id = i.pallet_id
    left join pallets e on e.id = p.linked_pallet_id and e.type = 'entrada'
    left join pallet_items ei on ei.pallet_id = e.id and ei.code = i.code
    where p.type = 'salida' and p.status = 'cerrado'
    union all
    select serial, registered_at, model, brand, null from production
  ) u
  where not exists (
    select 1 from pallet_items ei join pallets e on e.id = ei.pallet_id
    where e.type = 'entrada' and ei.code = u.serial
      and not exists (
        select 1 from pallets s where s.type = 'salida' and s.status = 'cerrado' and s.linked_pallet_id = e.id
      )
  )
)`

// Una fila por serial (la primera vez que se produjo), dentro de [desde, hasta) y marca opcional.
const firstTimes = (startIso, endIso, brand) => sql`
  select distinct on (serial) serial, at, model, brand, pallet from ${PRODUCED} x
  where ${brand ? sql`x.brand = ${brand}` : sql`true`}
    ${startIso ? sql`and x.at >= ${startIso}` : sql``} ${endIso ? sql`and x.at < ${endIso}` : sql``}
  order by serial, at`

// [{ serial, at }] del turno, ordenado por hora.
export async function shiftOutput(shiftDate, shift) {
  const { start, end } = shiftWindow(shiftDate, shift)
  return rows(
    sql`select serial, at, brand from (${firstTimes(start.toISOString(), end.toISOString())}) t order by at`,
  )
}

export const BRANDS = ['HY', 'SILO']

// Produccion dividida por marca entre dos instantes: [{ brand, pieces, pallets }] (HY y SILO siempre).
// Piezas = mismo conteo que el total (una vez por serial); pallets = salidas cerradas con piezas en el rango.
export async function brandSplit(startIso, endIso) {
  const pieces = await rows(sql`
    select brand, count(*)::int n from (${firstTimes(startIso, endIso)}) t group by brand`)
  const pallets = await rows(sql`
    select brand, count(distinct pallet)::int n from ${PRODUCED} x
    where pallet is not null and x.at >= ${startIso} and x.at < ${endIso} group by brand`)
  const names = [...new Set([...BRANDS, ...pieces.map((x) => x.brand), ...pallets.map((x) => x.brand)])]
  return names
    .filter(Boolean)
    .map((brand) => ({
      brand,
      pieces: pieces.find((x) => x.brand === brand)?.n || 0,
      pallets: pallets.find((x) => x.brand === brand)?.n || 0,
    }))
}

// Division por marca de un turno.
export async function shiftBrandSplit(shiftDate, shift) {
  const { start, end } = shiftWindow(shiftDate, shift)
  return brandSplit(start.toISOString(), end.toISOString())
}

// Piezas por turno entre dos fechas de turno: { 'YYYY-MM-DD|T1': n }. `brand` opcional.
export async function outputByShift(from, to, brand = null) {
  const list = await rows(
    firstTimes(shiftWindow(from, 'T1').start.toISOString(), shiftWindow(to, 'T2').end.toISOString(), brand),
  )
  const count = {}
  for (const x of list) {
    const { shiftDate, shift } = shiftOf(new Date(x.at))
    const k = `${shiftDate}|${shift}`
    count[k] = (count[k] || 0) + 1
  }
  return count
}

// Todas las piezas producidas, una por serial: [{ serial, at, model, brand }].
export async function closedExitItems(brand = null) {
  return rows(firstTimes(null, null, brand))
}

// ¿Ya se produjo este serial? Salida cerrada o escaneo por linea (tabla production).
export async function producedInfo(serial) {
  const [exit] = await rows(sql`
    select p.id as pallet_id, p.model, p.brand, i.scanned_at as at
    from pallet_items i join pallets p on p.id = i.pallet_id
    where i.code = ${serial} and p.type = 'salida' and p.status = 'cerrado'
    order by i.scanned_at limit 1`)
  if (exit) return { source: 'salida', ...exit }
  const [reg] = await rows(
    sql`select line, model, brand, registered_at as at from production where serial = ${serial}`,
  )
  return reg ? { source: 'registro', ...reg } : null
}

// Meta del turno: la ultima capturada (sigue vigente los dias siguientes) o 765.
export async function shiftGoal(shiftDate, shift) {
  const [manual] = await rows(sql`
    select shift_date, goal from hourly_goals
    where shift_date <= ${shiftDate} and shift = ${shift} and scope = ${GOAL_SCOPE}
    order by shift_date desc limit 1`)
  return {
    goal: manual ? manual.goal : DEFAULT_DAILY_GOAL,
    manual: Boolean(manual),
    since: manual?.shift_date || null,
  }
}
