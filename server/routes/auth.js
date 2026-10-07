import { asc, eq } from 'drizzle-orm'
import { Router } from 'express'
import {
  checkPassword,
  clearSession,
  hashPassword,
  issueSession,
  publicUser,
  readUser,
  requireAuth,
} from '../auth.js'
import { db } from '../db.js'
import { users } from '../schema.js'
import { GUEST_USERNAME } from '../seed.js'
import { bad, clean, conflict, isUniqueViolation, notFound } from '../util.js'

export const ROLES = ['admin', 'supervisor', 'operador', 'calidad']
const r = Router()

r.post('/auth/login', async (req, res) => {
  const username = clean(req.body?.username, 60).toLowerCase()
  const password = String(req.body?.password || '')
  const [u] = await db.select().from(users).where(eq(users.username, username))
  if (!u || !u.active || !(await checkPassword(password, u.passwordHash)))
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
  issueSession(res, u)
  res.json({ user: publicUser(u) })
})

// Entrada directa (boton "Entrar", a peticion del usuario: "que nomas le des clic en entrar"):
// sesion con la cuenta compartida "Planta". Siempre activa: la pantalla de inicio es solo ese boton
// (2026-10-07, "quiero que quites el login... que solo sea un boton de entrar").
r.post('/auth/guest', async (_req, res) => {
  const [u] = await db.select().from(users).where(eq(users.username, GUEST_USERNAME))
  if (!u || !u.active) return res.status(403).json({ error: 'La cuenta Planta está desactivada.' })
  issueSession(res, u)
  res.json({ user: publicUser(u) })
})

r.post('/auth/logout', (_req, res) => {
  clearSession(res)
  res.json({ ok: true })
})

r.get('/auth/me', async (req, res) => {
  res.json({ user: await readUser(req) })
})

r.post('/auth/password', requireAuth(), async (req, res) => {
  const { current, next } = req.body || {}
  if (String(next || '').length < 6) throw bad('La nueva contraseña debe tener al menos 6 caracteres.')
  const [u] = await db.select().from(users).where(eq(users.id, req.user.id))
  if (!(await checkPassword(String(current || ''), u.passwordHash)))
    throw bad('La contraseña actual no es correcta.')
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(String(next)) })
    .where(eq(users.id, u.id))
  res.json({ ok: true })
})

// Usuarios (solo admin)
r.get('/users', requireAuth(['admin']), async (_req, res) => {
  const list = await db.select().from(users).orderBy(asc(users.name))
  res.json({ users: list.map((u) => ({ ...publicUser(u), active: u.active, createdAt: u.createdAt })) })
})

r.post('/users', requireAuth(['admin']), async (req, res) => {
  const username = clean(req.body?.username, 60).toLowerCase()
  const name = clean(req.body?.name, 120)
  const role = ROLES.includes(req.body?.role) ? req.body.role : 'operador'
  const password = String(req.body?.password || '')
  if (!/^[a-z0-9._-]{3,}$/.test(username))
    throw bad('Usuario: mínimo 3 caracteres (letras, números, punto, guion).')
  if (!name) throw bad('Escribe el nombre.')
  if (password.length < 6) throw bad('La contraseña debe tener al menos 6 caracteres.')
  try {
    const [u] = await db
      .insert(users)
      .values({ username, name, role, passwordHash: await hashPassword(password) })
      .returning()
    res.status(201).json({ user: publicUser(u) })
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict('Ese usuario ya existe.')
    throw e
  }
})

r.patch('/users/:id', requireAuth(['admin']), async (req, res) => {
  const id = Number(req.params.id)
  const set = {}
  if (req.body?.name !== undefined) set.name = clean(req.body.name, 120)
  if (req.body?.role !== undefined && ROLES.includes(req.body.role)) set.role = req.body.role
  if (req.body?.active !== undefined) set.active = Boolean(req.body.active)
  if (req.body?.password) {
    if (String(req.body.password).length < 6) throw bad('La contraseña debe tener al menos 6 caracteres.')
    set.passwordHash = await hashPassword(String(req.body.password))
  }
  if (id === req.user.id && (set.active === false || (set.role && set.role !== 'admin')))
    throw bad('No puedes quitarte el acceso de administrador a ti mismo.')
  const [u] = await db.update(users).set(set).where(eq(users.id, id)).returning()
  if (!u) throw notFound('Usuario no encontrado.')
  res.json({ user: { ...publicUser(u), active: u.active } })
})

export default r
