// Drizzle Kit (consulta/inspeccion). Las tablas se crean al arrancar con server/migrate.js
// (DDL idempotente), asi no hace falta correr drizzle-kit en el servidor.
export default {
  dialect: 'postgresql',
  schema: './server/schema.js',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL || 'postgres://localhost:5432/vios_pallet' },
}
