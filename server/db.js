// Conexion: con DATABASE_URL usa Postgres normal (pg); sin ella, PGlite (Postgres embebido en ./data).
import { mkdirSync } from 'node:fs'
import * as schema from './schema.js'

let db
let exec // (sqlText) => Promise<void>, para el DDL inicial

if (process.env.DATABASE_URL) {
  const pg = (await import('pg')).default
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  db = drizzle(pool, { schema })
  exec = async (text) => {
    await pool.query(text)
  }
} else {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  mkdirSync('data', { recursive: true })
  const client = new PGlite('data/pglite')
  db = drizzle(client, { schema })
  exec = async (text) => {
    await client.exec(text)
  }
}

export { db, exec }
