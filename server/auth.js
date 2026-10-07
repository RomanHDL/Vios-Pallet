// Sesion con cookie firmada (HMAC). Sin dependencias extra: token = base64url(json).firma
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { users } from './schema.js'

const COOKIE = 'vp_session'
const MAX_AGE_MS = 12 * 60 * 60 * 1000 // 12 h (un turno largo)

function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  const file = 'data/session-secret'
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  const s = randomBytes(32).toString('hex')
  writeFileSync(file, s)
  return s
}
const SECRET = loadSecret()

const sign = (payload) => createHmac('sha256', SECRET).update(payload).digest('base64url')

export function issueSession(res, user) {
  const payload = Buffer.from(JSON.stringify({ uid: user.id, exp: Date.now() + MAX_AGE_MS })).toString(
    'base64url',
  )
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
  })
}

export function clearSession(res) {
  res.clearCookie(COOKIE)
}

export async function readUser(req) {
  const token = req.cookies?.[COOKIE]
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const a = Buffer.from(sig)
  const b = Buffer.from(sign(payload))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let data
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return null
  }
  if (!data.uid || data.exp < Date.now()) return null
  const [u] = await db.select().from(users).where(eq(users.id, data.uid))
  if (!u || !u.active) return null
  return publicUser(u)
}

export function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role }
}

export const hashPassword = (p) => bcrypt.hash(p, 10)
export const checkPassword = (p, h) => bcrypt.compare(p, h)

// Middleware: exige sesion. roles = lista de roles permitidos (admin siempre pasa).
export function requireAuth(roles) {
  return async (req, res, next) => {
    const user = await readUser(req)
    if (!user) return res.status(401).json({ error: 'Inicia sesión.' })
    if (roles && user.role !== 'admin' && !roles.includes(user.role))
      return res.status(403).json({ error: 'No tienes permiso para esta acción.' })
    req.user = user
    next()
  }
}
