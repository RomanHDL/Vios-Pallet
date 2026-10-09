import { and, eq, sql } from 'drizzle-orm'
import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { db } from '../db.js'
import { brands, lines, models, palletItems, palletMissing, pallets } from '../schema.js'
import { bad, clean, code, conflict, isYmd, notFound, rows } from '../util.js'

const r = Router()
const PALLET_ID = /^\d{6}$/
const SUPERVISOR = ['supervisor']

const userName = (col) => sql`(select name from users where users.id = ${col})`

async function getPallet(id) {
  const [p] = await db.select().from(pallets).where(eq(pallets.id, id))
  return p || null
}

async function itemCodes(palletId) {
  const list = await db
    .select({ code: palletItems.code })
    .from(palletItems)
    .where(eq(palletItems.palletId, palletId))
  return list.map((x) => x.code)
}

// Comparacion entrada vs salida.
async function reconciliation(salida) {
  const expected = await itemCodes(salida.linkedPalletId)
  const scanned = await itemCodes(salida.id)
  const exp = new Set(expected)
  const got = new Set(scanned)
  return {
    expected: expected.length,
    confirmed: scanned.filter((c) => exp.has(c)),
    missing: expected.filter((c) => !got.has(c)),
    extras: scanned.filter((c) => !exp.has(c)),
  }
}

r.get('/pallets/summary', requireAuth(), async (_req, res) => {
  const list = await rows(sql`
    select type, count(*)::int n from pallets where status = 'abierto' group by type`)
  const by = Object.fromEntries(list.map((x) => [x.type, x.n]))
  res.json({ entradaAbiertos: by.entrada || 0, salidaAbiertos: by.salida || 0 })
})

// Pendientes de cada area (Entrada / Salida), de cualquier dia.
r.get('/pallets/pending', requireAuth(), async (req, res) => {
  const area = req.query.area === 'salida' ? 'salida' : 'entrada'
  const list =
    area === 'entrada'
      ? await rows(sql`
          select e.id, e.model, e.brand, e.created_at as since, 'entrada_abierta' as kind,
            (select count(*)::int from pallet_items i where i.pallet_id = e.id) as total, 0 as done
          from pallets e where e.type = 'entrada' and e.status = 'abierto' order by e.created_at`)
      : await rows(sql`
          select e.id, e.model, e.brand,
            coalesce(s.created_at, e.closed_at, e.created_at) as since,
            case when s.id is null then 'sin_salida' else 'salida_abierta' end as kind,
            coalesce(s.expected_item_count, e.item_count,
              (select count(*)::int from pallet_items i where i.pallet_id = e.id)) as total,
            (select count(*)::int from pallet_items i where i.pallet_id = s.id) as done
          from pallets e left join pallets s on s.linked_pallet_id = e.id and s.type = 'salida'
          where e.type = 'entrada' and e.status = 'cerrado' and (s.id is null or s.status = 'abierto')
          order by since`)
  res.json({ area, pallets: list })
})

// Un escaneo a la vez por serial: si dos pantallas escanean la misma tele al mismo tiempo en pallets distintos,
// la segunda espera a la primera y sus revisiones ya la ven (no puede quedar en dos pallets).
const codeLocks = new Map()
async function withCodeLock(key, fn) {
  const prev = codeLocks.get(key) || Promise.resolve()
  let release
  const mine = new Promise((r) => (release = r))
  const chain = prev.then(() => mine)
  codeLocks.set(key, chain)
  await prev
  try {
    return await fn()
  } finally {
    release()
    if (codeLocks.get(key) === chain) codeLocks.delete(key)
  }
}

// Lista / historial. Filtros: type, status, missing=1, q (id), from/to (YYYY-MM-DD, fecha de creacion en MTY).
r.get('/pallets', requireAuth(), async (req, res) => {
  const { type, status, missing, q, from, to } = req.query
  const limit = Math.min(500, Number(req.query.limit) || 200)
  const conds = [sql`true`]
  if (type === 'entrada' || type === 'salida') conds.push(sql`p.type = ${type}`)
  if (status === 'abierto' || status === 'cerrado') conds.push(sql`p.status = ${status}`)
  if (missing === '1') conds.push(sql`p.missing_count > 0`)
  if (q) conds.push(sql`p.id ilike ${`%${clean(q, 20)}%`}`)
  if (isYmd(from)) conds.push(sql`(p.created_at at time zone 'America/Monterrey')::date >= ${from}::date`)
  if (isYmd(to)) conds.push(sql`(p.created_at at time zone 'America/Monterrey')::date <= ${to}::date`)
  const list = await rows(sql`
    select p.*, ${userName(sql`p.created_by`)} as created_by_name,
           ${userName(sql`p.closed_by`)} as closed_by_name,
           (select count(*)::int from pallet_items i where i.pallet_id = p.id) as live_count
    from pallets p
    where ${sql.join(conds, sql` and `)}
    order by p.created_at desc
    limit ${limit}`)
  res.json({ pallets: list })
})

// Busca en que pallets esta un serial.
r.get('/pallets/find/:code', requireAuth(), async (req, res) => {
  const c = code(req.params.code)
  const list = await rows(sql`
    select i.pallet_id, i.scanned_at, p.type, p.status, p.model, p.brand, p.linked_pallet_id
    from pallet_items i join pallets p on p.id = i.pallet_id
    where i.code = ${c} order by i.scanned_at desc`)
  res.json({ code: c, matches: list })
})

r.get('/pallets/:id', requireAuth(), async (req, res) => {
  const id = clean(req.params.id, 20)
  const [p] = await rows(sql`
    select p.*, ${userName(sql`p.created_by`)} as created_by_name, ${userName(sql`p.closed_by`)} as closed_by_name
    from pallets p where p.id = ${id}`)
  if (!p) throw notFound('Pallet no encontrado.')
  const items = await rows(sql`
    select i.code, i.scanned_at, i.different, ${userName(sql`i.scanned_by`)} as scanned_by_name
    from pallet_items i where i.pallet_id = ${id} order by i.scanned_at desc`)
  const out = { pallet: p, items }
  if (p.type === 'salida') {
    out.reconciliation = await reconciliation({ id: p.id, linkedPalletId: p.linked_pallet_id })
    // Para buscar rapido un faltante: en que otros pallets esta (fuera de esta entrada y esta salida).
    const missing = out.reconciliation.missing
    out.missingElsewhere = {}
    if (missing.length) {
      const found = await rows(sql`
        select i.code, x.id as pallet_id, x.type, x.status, i.scanned_at
        from pallet_items i join pallets x on x.id = i.pallet_id
        where i.code in (${sql.join(missing.map((c) => sql`${c}`), sql`, `)})
          and x.id <> ${p.id} and x.id <> ${p.linked_pallet_id}
        order by i.scanned_at desc`)
      for (const f of found) (out.missingElsewhere[f.code] ||= []).push({ id: f.pallet_id, type: f.type, status: f.status })
    }
    out.missingReasons = await rows(sql`
      select m.code, m.reason, m.noted_at, ${userName(sql`m.noted_by`)} as noted_by_name
      from pallet_missing m where m.pallet_id = ${id}`)
  } else {
    const [s] = await db.select().from(pallets).where(eq(pallets.linkedPalletId, id))
    out.salida = s || null
  }
  res.json(out)
})

// Reporte de SALIDA para imprimir. Solo si es una salida cerrada con fecha de salida (closed_at) y su
// entrada existe; si no, 409 y la pagina del reporte no se genera (no basta con ocultar el boton).
export function exitReportBlock(p, entrada) {
  if (!p) return 'Pallet no encontrado.'
  if (p.type !== 'salida') return 'El reporte es de salida: este pallet es de entrada.'
  if (p.status !== 'cerrado') return 'La salida sigue abierta. El reporte se imprime al cerrarla.'
  if (!p.closed_at || Number.isNaN(new Date(p.closed_at).getTime())) return 'La salida no tiene fecha y hora de cierre.'
  if (!entrada) return 'No se encontró el pallet de entrada de esta salida.'
  return null
}

r.get('/pallets/:id/report', requireAuth(), async (req, res) => {
  const id = clean(req.params.id, 20)
  const [p] = await rows(sql`select * from pallets where id = ${id}`)
  const [entrada] = p?.linked_pallet_id ? await rows(sql`select * from pallets where id = ${p.linked_pallet_id}`) : []
  const block = exitReportBlock(p, entrada)
  if (block) return res.status(p ? 409 : 404).json({ error: block, palletId: id })
  const items = await rows(sql`select code, scanned_at, different from pallet_items where pallet_id = ${id} order by scanned_at, code`)
  const rec = await reconciliation({ id: p.id, linkedPalletId: p.linked_pallet_id })
  const reasons = await rows(sql`select code, reason from pallet_missing where pallet_id = ${id}`)
  res.json({
    pallet: { id: p.id, status: p.status, model: p.model, brand: p.brand, closedAt: p.closed_at },
    entrada: { id: entrada.id, createdAt: entrada.created_at },
    items: items.map((i) => i.code),
    different: items.filter((i) => i.different).map((i) => i.code),
    expected: rec.expected,
    extras: rec.extras,
    missing: rec.missing.map((code) => ({ code, reason: reasons.find((x) => x.code === code)?.reason || null })),
  })
})

// Crear (o retomar) un pallet de entrada.
r.post('/pallets/entrada', requireAuth(), async (req, res) => {
  const id = code(req.body?.id)
  if (!PALLET_ID.test(id)) throw bad('El ID del pallet debe tener exactamente 6 dígitos.')
  const existing = await getPallet(id)
  if (existing) {
    if (existing.status === 'cerrado')
      throw conflict(`El pallet ${id} ya está cerrado. Un supervisor puede reabrirlo.`, { pallet: existing })
    return res.json({ pallet: existing, resumed: true })
  }
  const model = clean(req.body?.model, 40)
  const brand = clean(req.body?.brand, 20)
  const [m] = await db.select().from(models).where(and(eq(models.code, model), eq(models.active, true)))
  if (!m) throw bad('Selecciona un modelo válido.')
  const [b] = await db.select().from(brands).where(and(eq(brands.code, brand), eq(brands.active, true)))
  if (!b) throw bad('Selecciona una marca válida.')
  const [p] = await db
    .insert(pallets)
    .values({ id, type: 'entrada', model, brand, createdBy: req.user.id })
    .returning()
  res.status(201).json({ pallet: p, resumed: false })
})

// Crear (o retomar) la salida de un pallet de entrada.
r.post('/pallets/salida', requireAuth(), async (req, res) => {
  const entradaId = code(req.body?.entradaId).replace(/-S$/, '')
  if (!PALLET_ID.test(entradaId)) throw bad('Escanea el ID del pallet de entrada (6 dígitos).')
  const entrada = await getPallet(entradaId)
  if (!entrada) throw notFound(`No existe el pallet de entrada ${entradaId}.`)
  if (entrada.type !== 'entrada') throw bad('Ese ID no es un pallet de entrada.')
  if (entrada.status !== 'cerrado') throw conflict(`El pallet ${entradaId} sigue abierto en Entrada. Ciérralo primero.`)
  const id = `${entradaId}-S`
  // Linea de la salida (opcional; la produccion por linea sale de Produccion por linea -> escaneo TV + caja).
  const lineName = clean(req.body?.line, 40)
  let line = null
  if (lineName) {
    const [l] = await db.select().from(lines).where(and(eq(lines.name, lineName), eq(lines.active, true)))
    if (!l) throw bad('Elige una línea válida.')
    line = l.name
  }
  const existing = await getPallet(id)
  if (existing) {
    if (existing.status === 'cerrado') throw conflict(`La salida ${id} ya está cerrada.`, { pallet: existing })
    if (!existing.line && line) {
      const [upd] = await db.update(pallets).set({ line }).where(eq(pallets.id, id)).returning()
      return res.json({ pallet: upd, resumed: true })
    }
    return res.json({ pallet: existing, resumed: true })
  }
  const [p] = await db
    .insert(pallets)
    .values({
      id,
      type: 'salida',
      linkedPalletId: entradaId,
      model: entrada.model,
      brand: entrada.brand,
      line,
      expectedItemCount: entrada.itemCount,
      createdBy: req.user.id,
    })
    .returning()
  res.status(201).json({ pallet: p, resumed: false })
})

// Escanear una pieza.
r.post('/pallets/:id/items', requireAuth(), async (req, res) => {
  const p = await getPallet(clean(req.params.id, 20))
  if (!p) throw notFound('Pallet no encontrado.')
  if (p.status !== 'abierto') throw conflict('El pallet está cerrado.')
  const c = code(req.body?.code)
  if (!c) throw bad('Código vacío.')
  if (c === p.id || c === p.linkedPalletId) throw bad('Ese es el ID del pallet, no una pieza.')
  return withCodeLock(c, () => addItem(req, res, p, c))
})

async function addItem(req, res, p, c) {
  // En una salida, la pieza que ya venia en su entrada pasa aunque sea de otro modelo ("tele diferente").
  let hit = null
  if (p.type === 'salida')
    [hit] = await db
      .select()
      .from(palletItems)
      .where(and(eq(palletItems.palletId, p.linkedPalletId), eq(palletItems.code, c)))
  // Regla (2026-10-08): las teles de una entrada solo pueden ir en SU salida. Si la pieza no viene en la
  // entrada de esta salida no se acepta, y se avisa en que pallet de entrada esta.
  if (p.type === 'salida' && !hit) {
    const [other] = await rows(sql`
      select i.pallet_id from pallet_items i join pallets x on x.id = i.pallet_id
      where i.code = ${c} and x.type = 'entrada' order by i.scanned_at desc limit 1`)
    throw conflict(
      other
        ? `${c} es del pallet ${other.pallet_id}, no de ${p.linkedPalletId}. Solo entran piezas de su entrada.`
        : `${c} no viene en la entrada ${p.linkedPalletId}. Solo entran piezas de su entrada.`,
      { notInEntrada: true, belongsTo: other?.pallet_id || null },
    )
  }
  // Regla (2026-10-08): una tele pertenece a UN solo pallet de entrada. Si ya esta en otro pallet ID, no se
  // puede dar entrada en este (aplica tambien a "tele diferente").
  if (p.type === 'entrada') {
    const [other] = await rows(sql`
      select i.pallet_id from pallet_items i join pallets x on x.id = i.pallet_id
      where i.code = ${c} and x.type = 'entrada' and i.pallet_id <> ${p.id} order by i.scanned_at desc limit 1`)
    if (other)
      throw conflict(`${c} ya es del pallet ${other.pallet_id}. Una tele solo puede estar en un pallet.`, {
        otherPallet: other.pallet_id,
      })
  }
  // "Agregar tele diferente": se acepta cualquier prefijo y queda marcada (no es error del proceso).
  const different = req.body?.different === true || Boolean(hit?.different)
  if (!different && !hit) {
    const [m] = await db.select().from(models).where(eq(models.code, p.model || ''))
    if (m && !c.startsWith(m.prefix))
      throw bad(`El serial debe empezar con ${m.prefix} (modelo ${m.code}).`, { prefix: m.prefix, wrongPrefix: true })
    if (!m && !/^(EL|J0)/.test(c)) throw bad('El serial debe empezar con EL o J0.', { wrongPrefix: true })
  }
  const extra = p.type === 'salida' && !hit
  const inserted = await db
    .insert(palletItems)
    .values({ palletId: p.id, code: c, different, scannedBy: req.user.id })
    .onConflictDoNothing()
    .returning()
  if (!inserted.length) throw conflict(`${c} ya está escaneado en este pallet.`, { duplicate: true })
  const [{ n }] = await rows(sql`select count(*)::int n from pallet_items where pallet_id = ${p.id}`)
  await db.update(pallets).set({ itemCount: n }).where(eq(pallets.id, p.id))
  // Aviso: la misma pieza en otro pallet de entrada.
  let otherPallets = []
  if (p.type === 'entrada')
    otherPallets = (
      await rows(sql`
        select i.pallet_id from pallet_items i join pallets x on x.id = i.pallet_id
        where i.code = ${c} and x.type = 'entrada' and i.pallet_id <> ${p.id}`)
    ).map((x) => x.pallet_id)
  res.status(201).json({ code: c, count: n, extra, different, otherPallets })
}

// Quitar una pieza escaneada (corregir error) mientras el pallet esta abierto.
r.delete('/pallets/:id/items/:code', requireAuth(), async (req, res) => {
  const p = await getPallet(clean(req.params.id, 20))
  if (!p) throw notFound('Pallet no encontrado.')
  if (p.status !== 'abierto') throw conflict('El pallet está cerrado.')
  await db
    .delete(palletItems)
    .where(and(eq(palletItems.palletId, p.id), eq(palletItems.code, code(req.params.code))))
  const [{ n }] = await rows(sql`select count(*)::int n from pallet_items where pallet_id = ${p.id}`)
  await db.update(pallets).set({ itemCount: n }).where(eq(pallets.id, p.id))
  res.json({ count: n })
})

// Cerrar entrada.
r.post('/pallets/:id/close', requireAuth(), async (req, res) => {
  const p = await getPallet(clean(req.params.id, 20))
  if (!p) throw notFound('Pallet no encontrado.')
  if (p.type !== 'entrada') throw bad('La salida se cierra con la conciliación.')
  if (p.status !== 'abierto') throw conflict('El pallet ya está cerrado.')
  const [{ n }] = await rows(sql`select count(*)::int n from pallet_items where pallet_id = ${p.id}`)
  if (!n) throw bad('No puedes cerrar un pallet sin piezas.')
  const [out] = await db
    .update(pallets)
    .set({ status: 'cerrado', itemCount: n, closedBy: req.user.id, closedAt: new Date() })
    .where(eq(pallets.id, p.id))
    .returning()
  res.json({ pallet: out })
})

// Conciliar y cerrar salida: cada faltante necesita motivo.
r.post('/pallets/:id/reconcile', requireAuth(), async (req, res) => {
  const p = await getPallet(clean(req.params.id, 20))
  if (!p) throw notFound('Pallet no encontrado.')
  if (p.type !== 'salida') throw bad('Solo las salidas se concilian.')
  if (p.status !== 'abierto') throw conflict('La salida ya está cerrada.')
  const rec = await reconciliation(p)
  const reasons = req.body?.reasons || {}
  const lacking = rec.missing.filter((c) => !clean(reasons[c], 200))
  if (lacking.length) throw bad(`Falta el motivo de ${lacking.length} pieza(s) faltante(s).`, { lacking })
  const out = await db.transaction(async (tx) => {
    await tx.delete(palletMissing).where(eq(palletMissing.palletId, p.id))
    if (rec.missing.length)
      await tx.insert(palletMissing).values(
        rec.missing.map((c) => ({
          palletId: p.id,
          code: c,
          reason: clean(reasons[c], 200),
          notedBy: req.user.id,
        })),
      )
    const [row] = await tx
      .update(pallets)
      .set({
        status: 'cerrado',
        itemCount: rec.confirmed.length + rec.extras.length,
        expectedItemCount: rec.expected,
        missingCount: rec.missing.length,
        extrasCount: rec.extras.length,
        closedBy: req.user.id,
        closedAt: new Date(),
      })
      .where(eq(pallets.id, p.id))
      .returning()
    return row
  })
  res.json({ pallet: out, reconciliation: rec })
})

// Quitar de una ENTRADA cerrada una tele repetida (2026-10-08): solo si esa tele tambien esta en otro pallet
// de entrada (se colo antes del bloqueo) y la salida de esta entrada sigue abierta. La salida deja de esperarla.
r.post('/pallets/:id/remove-duplicate', requireAuth(SUPERVISOR), async (req, res) => {
  const p = await getPallet(clean(req.params.id, 20))
  if (!p) throw notFound('Pallet no encontrado.')
  if (p.type !== 'entrada') throw bad('Solo se quita de un pallet de entrada.')
  const c = code(req.body?.code)
  const [own] = await rows(sql`select 1 as ok from pallet_items where pallet_id = ${p.id} and code = ${c}`)
  if (!own) throw notFound(`${c} no está en el pallet ${p.id}.`)
  const [other] = await rows(sql`
    select i.pallet_id from pallet_items i join pallets x on x.id = i.pallet_id
    where i.code = ${c} and x.type = 'entrada' and i.pallet_id <> ${p.id} limit 1`)
  if (!other) throw conflict(`${c} no está en otro pallet: no se puede quitar como repetida.`)
  const [s] = await db.select().from(pallets).where(eq(pallets.linkedPalletId, p.id))
  if (s && s.status !== 'abierto') throw conflict(`La salida ${s.id} ya está cerrada.`)
  await db.delete(palletItems).where(and(eq(palletItems.palletId, p.id), eq(palletItems.code, c)))
  const [{ n }] = await rows(sql`select count(*)::int n from pallet_items where pallet_id = ${p.id}`)
  await db.update(pallets).set({ itemCount: n }).where(eq(pallets.id, p.id))
  if (s) await db.update(pallets).set({ expectedItemCount: n }).where(eq(pallets.id, s.id))
  res.json({ code: c, count: n, belongsTo: other.pallet_id })
})

r.post('/pallets/:id/reopen', requireAuth(SUPERVISOR), async (req, res) => {
  const p = await getPallet(clean(req.params.id, 20))
  if (!p) throw notFound('Pallet no encontrado.')
  if (p.type === 'entrada') {
    const [s] = await db.select().from(pallets).where(eq(pallets.linkedPalletId, p.id))
    if (s) throw conflict(`No se puede reabrir: ya tiene salida ${s.id}.`)
  }
  const [out] = await db
    .update(pallets)
    .set({ status: 'abierto', closedAt: null, closedBy: null })
    .where(eq(pallets.id, p.id))
    .returning()
  res.json({ pallet: out })
})

r.delete('/pallets/:id', requireAuth([]), async (req, res) => {
  const p = await getPallet(clean(req.params.id, 20))
  if (!p) throw notFound('Pallet no encontrado.')
  if (p.type === 'entrada') {
    const [s] = await db.select().from(pallets).where(eq(pallets.linkedPalletId, p.id))
    if (s) throw conflict(`Primero elimina su salida ${s.id}.`)
  }
  await db.transaction(async (tx) => {
    await tx.delete(palletItems).where(eq(palletItems.palletId, p.id))
    await tx.delete(palletMissing).where(eq(palletMissing.palletId, p.id))
    await tx.delete(pallets).where(eq(pallets.id, p.id))
  })
  res.json({ ok: true })
})

export default r
