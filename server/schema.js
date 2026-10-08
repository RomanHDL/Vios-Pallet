import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

const ts = (name) => timestamp(name, { withTimezone: true })

export const users = pgTable('users', {
  id: serial().primaryKey(),
  username: text().notNull().unique(),
  name: text().notNull(),
  // admin | supervisor | operador | calidad
  role: text().notNull().default('operador'),
  passwordHash: text('password_hash').notNull(),
  active: boolean().notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow(),
})

// Catalogos (en PalletScan estaban fijos en el codigo).
export const lines = pgTable('lines', {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  goal: integer().notNull().default(400), // meta por turno
  active: boolean().notNull().default(true),
  sort: integer().notNull().default(0),
})

export const models = pgTable('models', {
  id: serial().primaryKey(),
  code: text().notNull().unique(), // EL-32"
  prefix: text().notNull(), // el serial debe empezar con esto (EL, J0)
  targetMty: integer('target_mty').notNull().default(0),
  targetTexas: integer('target_texas').notNull().default(0),
  active: boolean().notNull().default(true),
  sort: integer().notNull().default(0),
})

export const brands = pgTable('brands', {
  id: serial().primaryKey(),
  code: text().notNull().unique(), // HY, SILO
  active: boolean().notNull().default(true),
})

export const defects = pgTable('defects', {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  active: boolean().notNull().default(true),
  sort: integer().notNull().default(0),
})

export const pallets = pgTable(
  'pallets',
  {
    id: text().primaryKey(), // 6 digitos (entrada) o 6 digitos + "-S" (salida)
    type: text().notNull(), // entrada | salida
    status: text().notNull().default('abierto'), // abierto | cerrado
    linkedPalletId: text('linked_pallet_id'),
    model: text(),
    brand: text(),
    line: text(), // salidas: linea elegida al iniciar la salida
    expectedItemCount: integer('expected_item_count'),
    itemCount: integer('item_count').notNull().default(0),
    missingCount: integer('missing_count').notNull().default(0),
    extrasCount: integer('extras_count').notNull().default(0),
    createdBy: integer('created_by'),
    createdAt: ts('created_at').notNull().defaultNow(),
    closedBy: integer('closed_by'),
    closedAt: ts('closed_at'),
  },
  (t) => [index('pallets_type_status').on(t.type, t.status), index('pallets_created').on(t.createdAt)],
)

export const palletItems = pgTable(
  'pallet_items',
  {
    palletId: text('pallet_id').notNull(),
    code: text().notNull(),
    different: boolean().notNull().default(false), // "tele diferente": otro prefijo, agregada a proposito
    scannedBy: integer('scanned_by'),
    scannedAt: ts('scanned_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.palletId, t.code] }), index('pallet_items_code').on(t.code)],
)

export const palletMissing = pgTable(
  'pallet_missing',
  {
    palletId: text('pallet_id').notNull(),
    code: text().notNull(),
    reason: text().notNull(),
    notedBy: integer('noted_by'),
    notedAt: ts('noted_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.palletId, t.code] })],
)

// Producto terminado: serial unico en la base (PalletScan solo lo revisaba antes de escribir).
export const production = pgTable(
  'production',
  {
    id: serial().primaryKey(),
    serial: text().notNull(),
    line: text().notNull(),
    model: text().notNull(),
    brand: text().notNull(),
    shiftDate: text('shift_date').notNull(), // YYYY-MM-DD (fecha en que empieza el turno)
    shift: text().notNull(), // T1 | T2
    registeredBy: integer('registered_by'),
    registeredAt: ts('registered_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('production_serial').on(t.serial),
    index('production_shift').on(t.shiftDate, t.shift),
  ],
)

export const rejections = pgTable(
  'rejections',
  {
    id: serial().primaryKey(),
    serial: text().notNull(),
    palletId: text('pallet_id'),
    model: text(),
    brand: text(),
    defects: jsonb().notNull().default(sql`'[]'::jsonb`),
    comments: text(),
    inProduction: boolean('in_production').notNull().default(false),
    shiftDate: text('shift_date').notNull(),
    shift: text().notNull(),
    registeredBy: integer('registered_by'),
    registeredAt: ts('registered_at').notNull().defaultNow(),
    source: text().notNull().default('vios'), // 'historico' = capturado de la hoja MTY - VIOS/HY
  },
  (t) => [index('rejections_serial').on(t.serial), index('rejections_shift').on(t.shiftDate)],
)

// Personal por linea y turno (capturado).
export const staffing = pgTable(
  'staffing',
  {
    shiftDate: text('shift_date').notNull(),
    shift: text().notNull(),
    line: text().notNull(),
    people: integer().notNull().default(0),
    updatedBy: integer('updated_by'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.shiftDate, t.shift, t.line] })],
)

// Plan por linea y turno (materiales disponibles). Sin captura se usa la meta de la linea.
export const plans = pgTable(
  'plans',
  {
    shiftDate: text('shift_date').notNull(),
    shift: text().notNull(),
    line: text().notNull(),
    planned: integer().notNull(),
    updatedBy: integer('updated_by'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.shiftDate, t.shift, t.line] })],
)

// Meta del tablero Hora por Hora por turno ('*' = todas las lineas, o el nombre de una linea).
// Sin registro la meta es el plan del turno (plans o meta de las lineas). La ultima meta capturada
// sigue vigente los dias siguientes.
export const hourlyGoals = pgTable(
  'hourly_goals',
  {
    shiftDate: text('shift_date').notNull(),
    shift: text().notNull(),
    scope: text().notNull(),
    goal: integer().notNull(),
    updatedBy: integer('updated_by'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.shiftDate, t.shift, t.scope] })],
)
