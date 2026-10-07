// Datos iniciales: catalogos de PalletScan y un administrador.
// La contrasena inicial del admin se genera al azar y se guarda en data/initial-admin.txt (no se imprime).
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { hashPassword } from './auth.js'
import { db } from './db.js'
import { brands, defects, lines, models, users } from './schema.js'

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
  const [{ u }] = (await db.execute(sql`select count(*)::int u from users`)).rows
  if (u === 0) {
    const password = randomBytes(6).toString('base64url')
    await db.insert(users).values({
      username: 'admin',
      name: 'Administrador',
      role: 'admin',
      passwordHash: await hashPassword(password),
    })
    writeFileSync(
      'data/initial-admin.txt',
      `Usuario: admin\nContraseña inicial: ${password}\nCámbiala en Perfil después de entrar.\n`,
    )
    console.log('Administrador creado. Credenciales iniciales en data/initial-admin.txt')
  }
}
