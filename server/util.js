import { db } from './db.js'

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export const bad = (msg, extra) => new HttpError(400, msg, extra)
export const notFound = (msg = 'No encontrado.') => new HttpError(404, msg)
export const conflict = (msg, extra) => new HttpError(409, msg, extra)

export const clean = (v, max = 120) => {
  const s = String(v ?? '').trim()
  return s ? s.slice(0, max) : ''
}

// Codigos escaneados: sin espacios, en mayusculas (las pistolas a veces agregan espacios / minusculas).
export const code = (v) => clean(v, 80).replace(/\s+/g, '').toUpperCase()

export const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))

// Postgres devuelve timestamptz como texto ("2026-10-07 12:38:53.5-06") en consultas crudas: se pasan a ISO.
const PG_TS = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2})(?::?(\d{2}))?$/
function normalize(row) {
  for (const k of Object.keys(row)) {
    const v = row[k]
    if (v instanceof Date) row[k] = v.toISOString()
    else if (typeof v === 'string') {
      const m = PG_TS.exec(v)
      if (m) row[k] = new Date(`${m[1]}T${m[2]}${m[3]}:${m[4] || '00'}`).toISOString()
    }
  }
  return row
}

export async function rows(query) {
  const r = await db.execute(query)
  return (r.rows || r).map(normalize)
}

export const isUniqueViolation = (e) => e?.code === '23505' || e?.cause?.code === '23505'
