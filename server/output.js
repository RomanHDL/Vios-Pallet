// Produccion del turno = piezas escaneadas en pallets de SALIDA (a la hora en que se escanean), mas lo que
// se haya registrado en Produccion -> Registrar. Un serial cuenta una sola vez. Sin dividir por linea.
// (2026-10-07, a peticion del usuario: "ya se cerro uno de salida pero no veo las piezas... no quiero que lo
// dividas por linea, debe ser meta diaria 765 que se pueda ajustar").
import { sql } from 'drizzle-orm'
import { DEFAULT_DAILY_GOAL, shiftWindow } from '../shared/pace.js'
import { rows } from './util.js'

// Meta total del turno en hourly_goals. Clave nueva: las metas capturadas antes (por linea/plan) ya no aplican.
export const GOAL_SCOPE = 'total'

// [{ serial, at }] del turno, ordenado por hora.
export async function shiftOutput(shiftDate, shift) {
  const { start, end } = shiftWindow(shiftDate, shift)
  return rows(sql`
    select serial, min(at) as at from (
      select i.code as serial, i.scanned_at as at
      from pallet_items i join pallets p on p.id = i.pallet_id
      where p.type = 'salida' and i.scanned_at >= ${start.toISOString()} and i.scanned_at < ${end.toISOString()}
      union all
      select serial, registered_at from production where shift_date = ${shiftDate} and shift = ${shift}
    ) x group by serial order by 2`)
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
