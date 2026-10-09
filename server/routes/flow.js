// Control de Pallet, vista de administrador: en que etapa va cada pallet activo (Entrada -> Produccion por linea
// -> Salida). Solo admin (requireAuth([]) deja pasar unicamente al rol admin).
//
// Cada pallet de entrada esta en UNA sola etapa, segun hechos registrados:
// - salida:     tiene salida (pallet "<id>-S", ligado por linked_pallet_id) abierta.
// - produccion: sin salida, y al menos una de sus piezas de entrada se escaneo en Produccion por linea (tabla
//               production, mismo serial exacto). La tabla production no guarda el pallet: se une por serial.
// - entrada:    sin salida y sin escaneos en linea (entrada abierta, o cerrada esperando).
// Los pallets con salida cerrada ya terminaron y no son activos.
// Detenido: solo si el administrador capturo un umbral para esa etapa y el ultimo movimiento es mas viejo.
import { sql } from 'drizzle-orm'
import { Router } from 'express'
import { shiftOf } from '../../shared/shift.js'
import { requireAuth } from '../auth.js'
import { bad, rows } from '../util.js'

const r = Router()
const ADMIN = []
export const STAGES = ['entrada', 'produccion', 'salida']

async function thresholds() {
  const list = await rows(sql`select stage, minutes from pallet_stage_thresholds`)
  return Object.fromEntries(STAGES.map((s) => [s, list.find((x) => x.stage === s)?.minutes ?? null]))
}

r.get('/pallet-flow', requireAuth(ADMIN), async (req, res) => {
  const shift = ['T1', 'T2'].includes(req.query.shift) ? req.query.shift : null
  const list = await rows(sql`
    select e.id, e.model, e.brand, e.status as entrada_status, e.created_at as entrada_at,
      (select count(*)::int from pallet_items i where i.pallet_id = e.id) as pieces,
      (select max(i.scanned_at) from pallet_items i where i.pallet_id = e.id) as entrada_last,
      pr.n as prod_n, pr.first_at as prod_first, pr.last_at as prod_last,
      (select p.line from pallet_items i join production p on p.serial = i.code
        where i.pallet_id = e.id order by p.registered_at desc limit 1) as prod_line,
      s.id as salida_id, s.created_at as salida_at, s.expected_item_count,
      (select count(*)::int from pallet_items i where i.pallet_id = s.id) as salida_n,
      (select max(i.scanned_at) from pallet_items i where i.pallet_id = s.id) as salida_last
    from pallets e
    left join pallets s on s.linked_pallet_id = e.id and s.type = 'salida'
    left join lateral (
      select count(distinct i.code)::int n, min(p.registered_at) first_at, max(p.registered_at) last_at
      from pallet_items i join production p on p.serial = i.code where i.pallet_id = e.id
    ) pr on true
    where e.type = 'entrada' and (s.id is null or s.status = 'abierto')
    order by e.created_at desc`)

  const limits = await thresholds()
  const now = Date.now()
  const all = list.map((x) => {
    let stage
    let since
    let last
    let event
    if (x.salida_id) {
      stage = 'salida'
      since = x.salida_at
      last = x.salida_last && x.salida_last > x.salida_at ? x.salida_last : x.salida_at
      event = x.salida_n ? 'Escaneando salida' : 'Salida iniciada'
    } else if (x.prod_n > 0 && x.entrada_status !== 'abierto') {
      stage = 'produccion'
      since = x.prod_first
      last = x.prod_last
      event = `Escaneado en ${x.prod_line || 'línea'}`
    } else {
      stage = 'entrada'
      since = x.entrada_at
      last = x.entrada_last && x.entrada_last > x.entrada_at ? x.entrada_last : x.entrada_at
      event = x.entrada_status === 'abierto' ? 'Registrando en entrada' : 'Entrada cerrada, en espera'
    }
    const idleMin = Math.max(0, Math.floor((now - new Date(last).getTime()) / 60000))
    const limit = limits[stage]
    const at = shiftOf(new Date(since))
    return {
      id: x.id,
      salidaId: x.salida_id,
      model: x.model,
      brand: x.brand,
      stage,
      entradaOpen: x.entrada_status === 'abierto',
      pieces: x.pieces,
      producedPieces: x.prod_n,
      line: x.prod_line,
      salidaPieces: x.salida_n,
      expected: x.expected_item_count ?? x.pieces,
      since,
      last,
      event,
      shift: at.shift,
      shiftDate: at.shiftDate,
      idleMin,
      detained: limit !== null && idleMin > limit,
    }
  })
  const pallets = shift ? all.filter((x) => x.shift === shift) : all
  const count = (s) => pallets.filter((x) => x.stage === s).length
  res.json({
    now: new Date(now).toISOString(),
    current: shiftOf(),
    shift: shift || 'todos',
    pallets,
    counts: {
      entrada: count('entrada'),
      produccion: count('produccion'),
      salida: count('salida'),
      detenidos: pallets.filter((x) => x.detained).length,
    },
    thresholds: limits,
  })
})

// Umbrales de "detenido" por etapa (minutos sin movimiento). Vacio = sin umbral (no se marca ninguno).
r.put('/pallet-flow/thresholds', requireAuth(ADMIN), async (req, res) => {
  const body = req.body || {}
  for (const stage of STAGES) {
    if (!(stage in body)) continue
    const v = body[stage]
    const minutes = v === null || v === '' ? null : Math.round(Number(v))
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 100000))
      throw bad('Minutos inválidos.')
    await rows(sql`
      insert into pallet_stage_thresholds (stage, minutes, updated_by) values (${stage}, ${minutes}, ${req.user.id})
      on conflict (stage) do update set minutes = excluded.minutes, updated_by = excluded.updated_by, updated_at = now()`)
  }
  res.json({ thresholds: await thresholds() })
})

export default r
