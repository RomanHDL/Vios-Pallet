import { and, eq, sql } from 'drizzle-orm'
import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { db } from '../db.js'
import { brands, models, palletItems, palletMissing, pallets } from '../schema.js'
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
    select i.code, i.scanned_at, ${userName(sql`i.scanned_by`)} as scanned_by_name
    from pallet_items i where i.pallet_id = ${id} order by i.scanned_at desc`)
  const out = { pallet: p, items }
  if (p.type === 'salida') {
    out.reconciliation = await reconciliation({ id: p.id, linkedPalletId: p.linked_pallet_id })
    out.missingReasons = await rows(sql`
      select m.code, m.reason, m.noted_at, ${userName(sql`m.noted_by`)} as noted_by_name
      from pallet_missing m where m.pallet_id = ${id}`)
  } else {
    const [s] = await db.select().from(pallets).where(eq(pallets.linkedPalletId, id))
    out.salida = s || null
  }
  res.json(out)
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
  const existing = await getPallet(id)
  if (existing) {
    if (existing.status === 'cerrado') throw conflict(`La salida ${id} ya está cerrada.`, { pallet: existing })
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
  const [m] = await db.select().from(models).where(eq(models.code, p.model || ''))
  if (m && !c.startsWith(m.prefix))
    throw bad(`El serial debe empezar con ${m.prefix} (modelo ${m.code}).`)
  if (!m && !/^(EL|J0)/.test(c)) throw bad('El serial debe empezar con EL o J0.')
  let extra = false
  if (p.type === 'salida') {
    const [hit] = await db
      .select()
      .from(palletItems)
      .where(and(eq(palletItems.palletId, p.linkedPalletId), eq(palletItems.code, c)))
    extra = !hit
  }
  const inserted = await db
    .insert(palletItems)
    .values({ palletId: p.id, code: c, scannedBy: req.user.id })
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
  res.status(201).json({ code: c, count: n, extra, otherPallets })
})

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
