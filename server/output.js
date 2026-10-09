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
// cuya entrada es de otro dia cuenta completo en el dia de su entrada ("los pallets de ayer" no suman a hoy, van a
// ayer), aunque alguna tele se haya agregado a la entrada despues.
const PRODUCED = sql`(
  select * from (
    select i.code as serial,
      case when e.id is not null and ${shiftDay(sql`e.created_at`)} <> ${shiftDay(sql`i.scanned_at`)}
        then (case when ${shiftDay(sql`ei.scanned_at`)} = ${shiftDay(sql`e.created_at`)} then ei.scanned_at
          else e.created_at end)
        else i.scanned_at end as at,
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

// Ajustes manuales por turno y marca (tabla production_adjustments): "SILO hoy se hicieron 23". Un ajuste
// negativo quita las ultimas piezas de esa marca en el turno; uno positivo agrega piezas sin serial.
async function produced(startIso, endIso, brand = null) {
  const list = await rows(firstTimes(startIso, endIso, brand))
  const adj = await rows(sql`
    select shift_date, shift, brand, delta, updated_at from production_adjustments
    where delta <> 0 ${brand ? sql`and brand = ${brand}` : sql``}`)
  if (!adj.length) return list.sort((a, b) => new Date(a.at) - new Date(b.at))
  const keyOf = (x) => {
    const s = shiftOf(new Date(x.at))
    return `${s.shiftDate}|${s.shift}|${x.brand}`
  }
  const drop = new Set()
  const extra = []
  for (const a of adj) {
    const w = shiftWindow(a.shift_date, a.shift)
    if ((startIso && w.end <= new Date(startIso)) || (endIso && w.start >= new Date(endIso))) continue
    const k = `${a.shift_date}|${a.shift}|${a.brand}`
    const group = list.filter((x) => keyOf(x) === k).sort((x, y) => new Date(y.at) - new Date(x.at))
    if (a.delta < 0) for (const x of group.slice(0, -a.delta)) drop.add(x.serial)
    else {
      const at = new Date(Math.min(Math.max(new Date(a.updated_at), w.start), w.end - 1))
      const model = group[0]?.model || null
      for (let i = 0; i < a.delta; i++)
        extra.push({ serial: `AJUSTE-${k}-${i}`, at: at.toISOString(), model, brand: a.brand, pallet: null })
    }
  }
  return [...list.filter((x) => !drop.has(x.serial)), ...extra].sort((a, b) => new Date(a.at) - new Date(b.at))
}

// Ajuste vigente de un turno: { HY: delta, SILO: delta }.
export async function shiftAdjustments(shiftDate, shift) {
  const list = await rows(
    sql`select brand, delta from production_adjustments where shift_date = ${shiftDate} and shift = ${shift}`,
  )
  return Object.fromEntries(list.map((x) => [x.brand, x.delta]))
}

// Piezas reales (sin ajuste) de una marca en un turno.
export async function rawBrandCount(shiftDate, shift, brand) {
  const { start, end } = shiftWindow(shiftDate, shift)
  const [{ n }] = await rows(
    sql`select count(*)::int n from (${firstTimes(start.toISOString(), end.toISOString(), brand)}) t`,
  )
  return n
}

// [{ serial, at, brand }] del turno, ordenado por hora.
export async function shiftOutput(shiftDate, shift) {
  const { start, end } = shiftWindow(shiftDate, shift)
  return produced(start.toISOString(), end.toISOString())
}

export const BRANDS = ['HY', 'SILO']

// Produccion dividida por marca entre dos instantes: [{ brand, pieces, pallets }] (HY y SILO siempre).
// Piezas = mismo conteo que el total (una vez por serial, con ajustes); pallets = salidas cerradas en el rango.
export async function brandSplit(startIso, endIso) {
  const list = await produced(startIso, endIso)
  const pallets = await rows(sql`
    select brand, count(distinct pallet)::int n from ${PRODUCED} x
    where pallet is not null and x.at >= ${startIso} and x.at < ${endIso} group by brand`)
  const names = [...new Set([...BRANDS, ...list.map((x) => x.brand), ...pallets.map((x) => x.brand)])]
  return names
    .filter(Boolean)
    .map((brand) => ({
      brand,
      pieces: list.filter((x) => x.brand === brand).length,
      pallets: pallets.find((x) => x.brand === brand)?.n || 0,
    }))
}

// Pallets de salida cerrados por dia de turno y marca: [{ date, brand, n }] (mismo criterio que brandSplit).
export async function palletsByDay(brand = null) {
  return rows(sql`
    select ${shiftDay(sql`x.at`)}::text as date, brand, count(distinct pallet)::int n from ${PRODUCED} x
    where pallet is not null ${brand ? sql`and x.brand = ${brand}` : sql``} group by 1, 2`)
}

// Division por marca de un turno.
export async function shiftBrandSplit(shiftDate, shift) {
  const { start, end } = shiftWindow(shiftDate, shift)
  return brandSplit(start.toISOString(), end.toISOString())
}

// Piezas por turno entre dos fechas de turno: { 'YYYY-MM-DD|T1': n }. `brand` opcional.
export async function outputByShift(from, to, brand = null) {
  const list = await produced(
    shiftWindow(from, 'T1').start.toISOString(),
    shiftWindow(to, 'T2').end.toISOString(),
    brand,
  )
  const count = {}
  for (const x of list) {
    const { shiftDate, shift } = shiftOf(new Date(x.at))
    const k = `${shiftDate}|${shift}`
    count[k] = (count[k] || 0) + 1
  }
  return count
}

// Todas las piezas producidas, una por serial (con ajustes): [{ serial, at, model, brand }].
export async function closedExitItems(brand = null) {
  return produced(null, null, brand)
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
