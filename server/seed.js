// Datos iniciales: catalogos de PalletScan y un administrador.
// Contrasena inicial del admin: ADMIN_INITIAL_PASSWORD si existe; si no, al azar. En local se guarda en
// data/initial-admin.txt; en produccion (sin disco persistente) se escribe una sola vez en el log.
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { hashPassword } from './auth.js'
import { db } from './db.js'
import { brands, defects, lines, models, users } from './schema.js'

export const GUEST_USERNAME = 'planta'

const LINES = ['Línea 1', 'Línea 2', 'Línea 3']
const MODELS = [
  { code: 'EL-32"', prefix: 'EL', targetMty: 2703, targetTexas: 0 },
  { code: 'J0-43"', prefix: 'J0', targetMty: 1585, targetTexas: 1865 },
  { code: 'EL-43"', prefix: 'EL', targetMty: 1314, targetTexas: 0 },
  { code: 'EL-50"', prefix: 'EL', targetMty: 1044, targetTexas: 0 },
]
const BRANDS = ['HY', 'SILO']
const DEFECTS = [
  'Pantalla Estrellada',
  'Fuga de Luz',
  'No Enciende',
  'Se Apaga',
  'Sin Control',
  'Sin Bases',
  'Sin Tornillos',
  'Sin Cable de Alimentación',
  'Rayada',
  'Mal Procesada',
  'Chasis Golpeado',
]

export async function ensureSeed() {
  const [{ n }] = (await db.execute(sql`select count(*)::int n from lines`)).rows
  if (n === 0) {
    await db.insert(lines).values(LINES.map((name, i) => ({ name, goal: 400, sort: i })))
    await db.insert(models).values(MODELS.map((m, i) => ({ ...m, sort: i })))
    await db.insert(brands).values(BRANDS.map((code) => ({ code })))
    await db.insert(defects).values(DEFECTS.map((name, i) => ({ name, sort: i })))
  }
  // Cuenta compartida del boton "Entrar" (sin contrasena usable: solo se entra por /api/auth/guest).
  await db
    .insert(users)
    .values({
      username: GUEST_USERNAME,
      name: 'Planta',
      role: 'supervisor',
      passwordHash: await hashPassword(randomBytes(24).toString('hex')),
    })
    .onConflictDoNothing()
  const [{ u }] = (await db.execute(sql`select count(*)::int u from users where username <> ${GUEST_USERNAME}`)).rows
  if (u === 0) {
    const password = process.env.ADMIN_INITIAL_PASSWORD || randomBytes(6).toString('base64url')
    await db.insert(users).values({
      username: 'admin',
      name: 'Administrador',
      role: 'admin',
      passwordHash: await hashPassword(password),
    })
    if (process.env.ADMIN_INITIAL_PASSWORD) {
      console.log('Administrador "admin" creado con ADMIN_INITIAL_PASSWORD.')
    } else if (process.env.NODE_ENV === 'production') {
      console.log(`Administrador "admin" creado. Contraseña inicial: ${password} (cámbiala al entrar).`)
    } else {
      mkdirSync('data', { recursive: true })
      writeFileSync(
        'data/initial-admin.txt',
        `Usuario: admin\nContraseña inicial: ${password}\nCámbiala en Mi cuenta después de entrar.\n`,
      )
      console.log('Administrador creado. Credenciales iniciales en data/initial-admin.txt')
    }
  }
}
