import { existsSync } from 'node:fs'
import { join } from 'node:path'
import cookieParser from 'cookie-parser'
import express from 'express'
import { migrate } from './migrate.js'
import authRoutes from './routes/auth.js'
import catalogRoutes from './routes/catalogs.js'
import palletRoutes from './routes/pallets.js'
import productionRoutes from './routes/production.js'
import qualityRoutes from './routes/quality.js'
import reportRoutes from './routes/reports.js'
import { ensureSeed } from './seed.js'
import { HttpError } from './util.js'

await migrate()
await ensureSeed()

const app = express()
app.disable('x-powered-by')
// Detras del proxy HTTPS de Coolify: necesario para cookies `secure`.
app.set('trust proxy', 1)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ ok: true }))
for (const r of [authRoutes, catalogRoutes, palletRoutes, productionRoutes, qualityRoutes, reportRoutes])
  app.use('/api', r)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }))

// Frontend compilado (npm run build) en produccion.
const dist = join(process.cwd(), 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }))
  app.get(/.*/, (_req, res) => res.sendFile(join(dist, 'index.html')))
}

// Express 5 manda aqui los errores de handlers async.
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra })
  console.error(err)
  res.status(500).json({ error: 'Error del servidor.' })
})

const port = Number(process.env.PORT) || 3001
// 0.0.0.0: requisito de Coolify (no solo localhost).
app.listen(port, '0.0.0.0', () => console.log(`VIOS Pallet en el puerto ${port}`))
