// Produccion del turno = SOLO piezas de pallets de SALIDA CERRADOS, a la hora en que se escanearon.
// Un serial cuenta una sola vez. Sin dividir por linea. No cuenta Produccion -> Registrar ni salidas abiertas.
// (2026-10-07, a peticion del usuario: "no quiero que lo dividas por linea, debe ser meta diaria 765" y
// "solamente se cuentan las piezas de salidas cerradas, no todas").
import { sql } from 'drizzle-orm'
import { DEFAULT_DAILY_GOAL, shiftWindow } from '../shared/pace.js'
import { rows } from './util.js'

// Meta total del turno en hourly_goals. Clave nueva: las metas capturadas antes (por linea/plan) ya no aplican.
export const GOAL_SCOPE = 'total'

// [{ serial, at }] del turno, ordenado por hora.
export async function shiftOutput(shiftDate, shift) {
  const { start, end } = shiftWindow(shiftDate, shift)
  return rows(sql`
    select i.code as serial, min(i.scanned_at) as at
    from pallet_items i join pallets p on p.id = i.pallet_id
    where p.type = 'salida' and p.status = 'cerrado'
      and i.scanned_at >= ${start.toISOString()} and i.scanned_at < ${end.toISOString()}
    group by i.code order by 2`)
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
