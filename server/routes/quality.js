import { eq, sql } from 'drizzle-orm'
import { Router } from 'express'
import { shiftOf } from '../../shared/shift.js'
import { requireAuth } from '../auth.js'
import { db } from '../db.js'
import { rejections } from '../schema.js'
import { bad, clean, code, isYmd, notFound, rows } from '../util.js'

const r = Router()
const userName = (col) => sql`(select name from users where users.id = ${col})`

// Datos del serial antes de rechazarlo: pallet de entrada, modelo, marca y si ya esta en produccion.
r.get('/rejections/lookup/:serial', requireAuth(), async (req, res) => {
  const s = code(req.params.serial)
  const [pal] = await rows(sql`
    select p.id, p.model, p.brand from pallet_items i join pallets p on p.id = i.pallet_id
    where i.code = ${s} and p.type = 'entrada' order by i.scanned_at desc limit 1`)
  const [prod] = await rows(sql`select line, model, brand, registered_at from production where serial = ${s}`)
  const previous = await rows(sql`
    select id, defects, registered_at from rejections where serial = ${s} order by registered_at desc`)
  res.json({
    serial: s,
    pallet: pal || null,
    production: prod || null,
    model: pal?.model || prod?.model || null,
    brand: pal?.brand || prod?.brand || null,
    previous,
  })
})

r.get('/rejections', requireAuth(), async (req, res) => {
  const conds = [sql`true`]
  if (isYmd(req.query.from)) conds.push(sql`r.shift_date >= ${req.query.from}`)
  if (isYmd(req.query.to)) conds.push(sql`r.shift_date <= ${req.query.to}`)
  if (req.query.q) conds.push(sql`r.serial ilike ${`%${code(req.query.q)}%`}`)
  const list = await rows(sql`
    select r.*, ${userName(sql`r.registered_by`)} as registered_by_name
    from rejections r where ${sql.join(conds, sql` and `)}
    order by r.registered_at desc limit 1000`)
  res.json({ rejections: list })
})

r.post('/rejections', requireAuth(['supervisor', 'calidad']), async (req, res) => {
  const s = code(req.body?.serial)
  if (!/^(EL|J0)/.test(s)) throw bad('El serial debe empezar con EL o J0.')
  const defects = [...new Set((req.body?.defects || []).map((d) => clean(d, 80)).filter(Boolean))]
  if (!defects.length) throw bad('Selecciona al menos un defecto.')
  const [pal] = await rows(sql`
    select p.id, p.model, p.brand from pallet_items i join pallets p on p.id = i.pallet_id
    where i.code = ${s} and p.type = 'entrada' order by i.scanned_at desc limit 1`)
  const [prod] = await rows(sql`select model, brand from production where serial = ${s}`)
  const { shiftDate, shift } = shiftOf()
  const [row] = await db
    .insert(rejections)
    .values({
      serial: s,
      palletId: pal?.id || null,
      model: pal?.model || prod?.model || clean(req.body?.model, 40) || null,
      brand: pal?.brand || prod?.brand || clean(req.body?.brand, 20) || null,
      defects,
      comments: clean(req.body?.comments, 500) || null,
      inProduction: Boolean(prod),
      shiftDate,
      shift,
      registeredBy: req.user.id,
    })
    .returning()
  res.status(201).json({ rejection: row })
})

r.delete('/rejections/:id', requireAuth(['supervisor']), async (req, res) => {
  const [row] = await db
    .delete(rejections)
    .where(eq(rejections.id, Number(req.params.id)))
    .returning()
  if (!row) throw notFound('Rechazo no encontrado.')
  res.json({ ok: true })
})

export default r
