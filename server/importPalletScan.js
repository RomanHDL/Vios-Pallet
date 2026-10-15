// Importacion unica de los pallets reales de PalletScan (2026-10-15, pedido de Roman: "que VIOS tenga los pallets y
// piezas exactos desde el primer escaneo, sin duplicados"). Datos en server/imports/palletscan-import.json (descarga
// de solo lectura del Firestore de PalletScan: pallets + items + faltantes, y rechazos; horas en UTC).
//
// Se corre al arrancar, despues de migrate() y ensureSeed(), UNA sola vez (sync_flags 'import_palletscan'), en una
// transaccion. Reglas:
//  - Pallets con source = 'palletscan', creados/cerrados/escaneados por el usuario inactivo "PalletScan", con sus
//    fechas originales. item_count = piezas reales (103874-S decia 103 con 95 piezas).
//  - Si VIOS ya tiene un pallet con el mismo ID:
//      * con las MISMAS teles (o un subconjunto): es el mismo pallet re-escaneado en VIOS (443527, 7-oct). Se queda
//        el escaneo mas antiguo (PalletScan) y se borra la copia de VIOS, igual que 305362 (v1.38.1).
//      * con OTRAS teles (141452: etiqueta reutilizada el 8-oct): el de PalletScan entra como PS-<id> / PS-<id>-S.
//  - Un serial cuenta una sola vez en toda la produccion (server/output.js toma su primer escaneo). Si un serial de
//    PalletScan ya esta en otro pallet o en Produccion por linea de VIOS, se avisa en el log.
//  - production_history: se borran los renglones de PalletScan (EL-32" HY 11 al 25-sep, EL-43" SILO 1 y 2-oct);
//    ahora los cubren los pallets reales. Los 79 del 11-sep y 100 del 14-sep eran seriales de relleno
//    (HIST-L0914-...) = las 179 teles de 505427, 766694 y 8 de 157868, que no se escanearon en linea.
//  - Rechazos de PalletScan: uno por serial, solo si VIOS no tiene ya un rechazo de ese serial (historico o VIOS).
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { hashPassword } from './auth.js'
import { db } from './db.js'

const FLAG = 'import_palletscan'
const USERNAME = 'palletscan'
const DATA = new URL('./imports/palletscan-import.json', import.meta.url)

const HISTORY_ROWS = sql`source = 'PalletScan' and (
  (model = 'EL-32"' and brand = 'HY' and date between '2026-09-11' and '2026-09-25') or
  (model = 'EL-43"' and brand = 'SILO' and date in ('2026-10-01', '2026-10-02')))`

const list = (r) => r.rows || r

export async function importPalletScan() {
  const done = list(await db.execute(sql`select 1 from sync_flags where key = ${FLAG}`))
  if (done.length) return null
  const data = JSON.parse(readFileSync(DATA, 'utf8'))
  const hash = await hashPassword(randomBytes(24).toString('hex'))
  const report = await db.transaction(async (tx) => {
    const q = async (query) => list(await tx.execute(query))
    // Un solo proceso a la vez (por si arrancan dos).
    await q(sql`select pg_advisory_xact_lock(7311015)`)
    if ((await q(sql`select 1 from sync_flags where key = ${FLAG}`)).length) return null
    const out = {
      pallets: 0,
      items: 0,
      missing: 0,
      replaced: [],
      renamed: [],
      skipped: [],
      overlaps: [],
      rejections: 0,
      rejectionsSkipped: [],
      historyDeleted: 0,
    }

    await q(sql`insert into users (username, name, role, password_hash, active)
      values (${USERNAME}, 'PalletScan', 'operador', ${hash}, false) on conflict (username) do nothing`)
    const [{ id: uid }] = await q(sql`select id from users where username = ${USERNAME}`)

    const codesOf = async (id) =>
      new Set((await q(sql`select code from pallet_items where pallet_id = ${id}`)).map((x) => x.code))
    const exists = async (id) => (await q(sql`select id, source from pallets where id = ${id}`))[0] || null
    const idMap = new Map()

    for (const e of data.pallets.filter((p) => p.type === 'entrada')) {
      const s = data.pallets.find((p) => p.type === 'salida' && p.linked === e.id)
      const group = [e, s].filter(Boolean)
      let base = e.id
      const live = [await exists(e.id), s ? await exists(s.id) : null].filter(Boolean)
      if (live.some((x) => x.source === 'palletscan')) {
        out.skipped.push(`${e.id}: ya importado`)
        continue
      }
      if (live.length) {
        const liveE = await codesOf(e.id)
        const liveS = s ? await codesOf(s.id) : new Set()
        const psE = new Set(e.items.map(([c]) => c))
        const psS = new Set((s?.items || []).map(([c]) => c))
        const same =
          liveE.size > 0 && [...liveE].every((c) => psE.has(c)) && [...liveS].every((c) => psS.has(c))
        if (same) {
          const ids = group.map((p) => p.id)
          for (const t of ['pallet_items', 'pallet_missing', 'pallets'])
            await q(
              sql`delete from ${sql.identifier(t)} where ${sql.identifier(t === 'pallets' ? 'id' : 'pallet_id')} in (${sql.join(
                ids.map((x) => sql`${x}`),
                sql`, `,
              )})`,
            )
          out.replaced.push(
            `${e.id}: mismo pallet re-escaneado en VIOS (${liveE.size} teles); se queda el de PalletScan`,
          )
        } else {
          base = `PS-${e.id}`
          if ((await exists(base)) || (await exists(`${base}-S`))) {
            out.skipped.push(`${e.id}: el ID ${base} tambien existe`)
            continue
          }
          out.renamed.push(`${e.id} -> ${base}: VIOS ya tiene ${e.id} con otras teles`)
        }
      }
      idMap.set(e.id, base)
      for (const p of group) {
        const id = p.type === 'salida' ? `${base}-S` : base
        await q(sql`insert into pallets (id, type, status, linked_pallet_id, model, brand, expected_item_count, item_count,
            missing_count, extras_count, created_by, created_at, closed_by, closed_at, source)
          values (${id}, ${p.type}, 'cerrado', ${p.type === 'salida' ? base : null}, ${p.model}, ${p.brand}, ${p.expected},
            ${p.items.length}, ${p.missingCount}, ${p.extrasCount}, ${uid}, ${p.createdAt}, ${uid}, ${p.closedAt}, 'palletscan')`)
        for (let i = 0; i < p.items.length; i += 1000) {
          const chunk = p.items.slice(i, i + 1000)
          await q(
            sql`insert into pallet_items (pallet_id, code, scanned_by, scanned_at) values ${sql.join(
              chunk.map(([c, at]) => sql`(${id}, ${c}, ${uid}, ${at})`),
              sql`, `,
            )}`,
          )
        }
        for (const m of p.missing)
          await q(sql`insert into pallet_missing (pallet_id, code, reason, noted_by, noted_at)
            values (${id}, ${m.code}, ${m.reason || 'Sin motivo (PalletScan)'}, ${uid}, ${m.notedAt}) on conflict do nothing`)
        out.pallets++
        out.items += p.items.length
        out.missing += p.missing.length
      }
    }

    // Seriales de PalletScan que VIOS ya tenia en otros pallets o en Produccion por linea (cuentan una vez: el primero).
    out.overlaps = await q(sql`
      select i.code, string_agg(distinct x.pallet_id, ', ') as vios
      from pallet_items i join pallets p on p.id = i.pallet_id and p.source = 'palletscan'
      join (select pi.code, pi.pallet_id from pallet_items pi join pallets v on v.id = pi.pallet_id and v.source <> 'palletscan'
            union all select serial, 'linea' from production) x on x.code = i.code
      group by i.code`)

    // Rechazos (uno por serial, sin repetir los que VIOS ya tiene).
    await q(
      sql`select setval(pg_get_serial_sequence('rejections', 'id'), greatest((select max(id) from rejections), 1))`,
    )
    for (const r of data.rejections) {
      const [prev] = await q(
        sql`select id, source, pallet_id from rejections where serial = ${r.serial} limit 1`,
      )
      if (prev) {
        out.rejectionsSkipped.push(`${r.serial} (${r.palletId}): ya existe #${prev.id} ${prev.source}`)
        continue
      }
      await q(sql`insert into rejections (serial, pallet_id, model, brand, defects, comments, in_production, shift_date,
          shift, registered_by, registered_at, source)
        values (${r.serial}, ${idMap.get(r.palletId) || r.palletId}, ${r.model}, ${r.brand}, ${JSON.stringify(r.defects)}::jsonb,
          ${r.comments}, ${r.inProduction}, ${r.shiftDate}, ${r.shift}, ${uid}, ${r.registeredAt}, 'palletscan')`)
      out.rejections++
    }

    out.historyDeleted = (
      await q(sql`delete from production_history where ${HISTORY_ROWS} returning date`)
    ).length
    await q(sql`insert into sync_flags (key) values (${FLAG}) on conflict do nothing`)
    return out
  })
  if (report) console.log('Importacion PalletScan:', JSON.stringify(report))
  return report
}
