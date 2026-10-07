// Manual de desarrollador. El modelo de datos se genera del esquema real de Drizzle (server/schema.js),
// asi siempre coincide con la base de datos.
import { getTableConfig } from 'drizzle-orm/pg-core'
import * as schema from '../../../server/schema.js'
import { Badge, Card, CardHeader, PageHeader, Table, Td, Th } from '@/components/ui'
import { BackLink } from './Cambios'

const TABLE_INFO = {
  users: 'Usuarios y rol (admin, supervisor, operador, calidad). Las columnas *_by de otras tablas apuntan a users.id.',
  lines: 'Líneas de producción y su meta por turno.',
  models: 'Modelos de TV, prefijo obligatorio del serial y objetivos MTY/Texas.',
  brands: 'Marcas (HY, SILO).',
  defects: 'Catálogo de defectos de Calidad.',
  pallets: 'Pallets de entrada (6 dígitos) y salida (ID-S). linked_pallet_id de una salida = id de su entrada.',
  pallet_items: 'Piezas escaneadas por pallet. PK (pallet_id, code).',
  pallet_missing: 'Motivo de cada pieza faltante al conciliar una salida.',
  production: 'Producto terminado. serial único. shift_date + shift = turno.',
  rejections: 'Rechazos de Calidad. defects = arreglo JSON. in_production = el serial ya estaba en production.',
  staffing: 'Personas por línea y turno.',
  plans: 'Plan (materiales disponibles) por línea y turno. Sin registro = meta de la línea.',
  hourly_goals: "Meta del tablero Hora por Hora por turno; scope '*' = todas las líneas. La última captura (shift_date <=) sigue vigente.",
}

const tables = Object.values(schema)
  .filter((t) => t && typeof t === 'object' && Symbol.for('drizzle:IsDrizzleTable') in t)
  .map((t) => getTableConfig(t))

const API = [
  ['POST', '/api/auth/login', 'Inicia sesión con usuario (administrador, en /?admin; cookie httpOnly firmada, 12 h).'],
  ['POST', '/api/auth/guest', 'Entrada directa con la cuenta compartida Planta (botón Entrar).'],
  ['GET', '/api/auth/me', 'Usuario actual.'],
  ['POST', '/api/auth/password', 'Cambiar contraseña propia.'],
  ['GET/POST/PATCH', '/api/users', 'Usuarios (admin).'],
  ['GET', '/api/catalogs', 'Líneas, modelos, marcas y defectos.'],
  ['POST/PATCH', '/api/catalogs/:kind', 'Catálogos (admin).'],
  ['GET', '/api/pallets', 'Lista con filtros type, status, missing, q, from, to.'],
  ['GET', '/api/pallets/:id', 'Detalle; en salidas incluye la conciliación.'],
  ['POST', '/api/pallets/entrada | salida', 'Crear o retomar pallet.'],
  ['POST/DELETE', '/api/pallets/:id/items', 'Escanear / quitar pieza.'],
  ['POST', '/api/pallets/:id/close | reconcile | reopen', 'Cerrar entrada, conciliar salida, reabrir (supervisor).'],
  ['GET', '/api/pallets/find/:code', 'En qué pallets está un serial.'],
  ['POST/GET/DELETE', '/api/production', 'Registro de producto terminado.'],
  ['GET', '/api/production/live', 'Tablero por línea de un turno.'],
  ['GET/PUT', '/api/plans · /api/staffing', 'Plan y personal por línea y turno.'],
  ['GET/POST/DELETE', '/api/rejections', 'Rechazos de Calidad; /lookup/:serial antes de rechazar.'],
  ['GET', '/api/reports/day | models | staffing | pallets', 'Reportes.'],
  ['GET', '/api/dashboard', 'Resumen del inicio.'],
  ['GET', '/api/hourly', 'Hora por Hora: piezas por hora del turno, plan y meta (shiftDate, shift, line).'],
  ['PUT', '/api/hourly/goal', 'Guardar la meta del turno para Hora por Hora (supervisor).'],
]

export default function Desarrollador() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader back={<BackLink />} title="Manual de desarrollador" subtitle="Arquitectura, modelo de datos y API" />

      <Card className="p-5 text-[14px] leading-relaxed">
        <h2 className="text-[17px] font-bold">Arquitectura</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li><b>Frontend</b>: React 19 + Vite + Tailwind (src/). Rutas en src/App.jsx, componentes base en src/components/ui.jsx, escáner en src/components/Scanner.jsx.</li>
          <li><b>Backend</b>: Express 5 (server/index.js), rutas en server/routes/*, Drizzle ORM (server/schema.js). En producción sirve también el frontend compilado (dist/).</li>
          <li><b>Base de datos</b>: PostgreSQL con DATABASE_URL; sin ella, PGlite en data/pglite (solo desarrollo). Las tablas se crean al arrancar con server/migrate.js (DDL idempotente, IF NOT EXISTS); cambios de esquema = agregar el DDL ahí y en schema.js.</li>
          <li><b>Turnos</b>: shared/shift.js (zona America/Monterrey). shift_date = fecha en que empieza el turno.</li>
          <li><b>Proceso</b>: PM2 (ecosystem.config.cjs, pnpm start). Variables: DATABASE_URL, SESSION_SECRET, PORT, ADMIN_INITIAL_PASSWORD (solo primer arranque).</li>
          <li><b>Herramientas</b>: pnpm, Biome (pnpm lint / pnpm format). Versión semver en package.json + CHANGELOG.md + src/pages/docs/changelog.js.</li>
        </ul>
      </Card>

      <Card>
        <CardHeader title="Modelo de datos" subtitle="Generado del esquema real (server/schema.js)" />
        <div className="divide-y">
          {tables.map((t) => (
            <div key={t.name} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[15px] font-bold">{t.name}</span>
                <Badge tone="gray">{t.columns.length} columnas</Badge>
              </div>
              {TABLE_INFO[t.name] && <p className="mt-1 text-[13px] text-muted-foreground">{TABLE_INFO[t.name]}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.columns.map((c) => (
                  <span key={c.name} className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-[12px]">
                    {c.name}
                    <span className="text-muted-foreground"> {c.getSQLType()}</span>
                    {c.primary && <b className="text-primary"> PK</b>}
                    {c.notNull && !c.primary && <span className="text-muted-foreground"> ·req</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="API" subtitle="Todas las rutas requieren sesión salvo login" />
        <Table>
          <thead>
            <tr>
              <Th>Método</Th>
              <Th>Ruta</Th>
              <Th>Descripción</Th>
            </tr>
          </thead>
          <tbody>
            {API.map(([m, p, d]) => (
              <tr key={p + m}>
                <Td className="whitespace-nowrap font-mono text-[12px] font-semibold">{m}</Td>
                <Td className="font-mono text-[12.5px]">{p}</Td>
                <Td>{d}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
