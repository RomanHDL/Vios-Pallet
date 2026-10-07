import { asc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { db } from '../db.js'
import { brands, defects, lines, models } from '../schema.js'
import { bad, clean, conflict, isUniqueViolation, notFound } from '../util.js'

const r = Router()

const KINDS = {
  lines: {
    table: lines,
    order: [asc(lines.sort), asc(lines.name)],
    read: (b) => ({
      name: clean(b.name, 40),
      goal: Math.max(0, Math.round(Number(b.goal) || 0)),
      sort: Math.round(Number(b.sort) || 0),
    }),
    required: 'name',
  },
  models: {
    table: models,
    order: [asc(models.sort), asc(models.code)],
    read: (b) => ({
      code: clean(b.code, 40),
      prefix: clean(b.prefix, 10).toUpperCase(),
      targetMty: Math.max(0, Math.round(Number(b.targetMty) || 0)),
      targetTexas: Math.max(0, Math.round(Number(b.targetTexas) || 0)),
      sort: Math.round(Number(b.sort) || 0),
    }),
    required: 'code',
  },
  brands: {
    table: brands,
    order: [asc(brands.code)],
    read: (b) => ({ code: clean(b.code, 20).toUpperCase() }),
    required: 'code',
  },
  defects: {
    table: defects,
    order: [asc(defects.sort), asc(defects.name)],
    read: (b) => ({ name: clean(b.name, 80), sort: Math.round(Number(b.sort) || 0) }),
    required: 'name',
  },
}

r.get('/catalogs', requireAuth(), async (_req, res) => {
  const out = {}
  for (const [k, def] of Object.entries(KINDS))
    out[k] = await db
      .select()
      .from(def.table)
      .orderBy(...def.order)
  res.json(out)
})

function kindOf(req) {
  const def = KINDS[req.params.kind]
  if (!def) throw notFound('Catálogo no encontrado.')
  return def
}

r.post('/catalogs/:kind', requireAuth(['admin']), async (req, res) => {
  const def = kindOf(req)
  const values = def.read(req.body || {})
  if (!values[def.required]) throw bad('Falta el nombre.')
  if (req.params.kind === 'models' && !values.prefix) throw bad('Falta el prefijo del serial.')
  try {
    const [row] = await db.insert(def.table).values(values).returning()
    res.status(201).json({ item: row })
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict('Ya existe.')
    throw e
  }
})

r.patch('/catalogs/:kind/:id', requireAuth(['admin']), async (req, res) => {
  const def = kindOf(req)
  const body = req.body || {}
  const read = def.read({ ...body })
  const set = {}
  for (const k of Object.keys(read)) if (body[k] !== undefined) set[k] = read[k]
  if (body.active !== undefined) set.active = Boolean(body.active)
  try {
    const [row] = await db
      .update(def.table)
      .set(set)
      .where(eq(def.table.id, Number(req.params.id)))
      .returning()
    if (!row) throw notFound()
    res.json({ item: row })
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict('Ya existe.')
    throw e
  }
})

export default r
