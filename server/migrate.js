// DDL idempotente (mismo modelo que server/schema.js). Se corre al arrancar el servidor.
import { exec } from './db.js'

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'operador',
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lines (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  goal integer NOT NULL DEFAULT 400,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS models (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  prefix text NOT NULL,
  target_mty integer NOT NULL DEFAULT 0,
  target_texas integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS brands (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS defects (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pallets (
  id text PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'abierto',
  linked_pallet_id text,
  model text,
  brand text,
  expected_item_count integer,
  item_count integer NOT NULL DEFAULT 0,
  missing_count integer NOT NULL DEFAULT 0,
  extras_count integer NOT NULL DEFAULT 0,
  created_by integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_by integer,
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS pallets_type_status ON pallets (type, status);
CREATE INDEX IF NOT EXISTS pallets_created ON pallets (created_at);
CREATE TABLE IF NOT EXISTS pallet_items (
  pallet_id text NOT NULL,
  code text NOT NULL,
  scanned_by integer,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pallet_id, code)
);
CREATE INDEX IF NOT EXISTS pallet_items_code ON pallet_items (code);
CREATE TABLE IF NOT EXISTS pallet_missing (
  pallet_id text NOT NULL,
  code text NOT NULL,
  reason text NOT NULL,
  noted_by integer,
  noted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pallet_id, code)
);
CREATE TABLE IF NOT EXISTS production (
  id serial PRIMARY KEY,
  serial text NOT NULL,
  line text NOT NULL,
  model text NOT NULL,
  brand text NOT NULL,
  shift_date text NOT NULL,
  shift text NOT NULL,
  registered_by integer,
  registered_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS production_serial ON production (serial);
CREATE INDEX IF NOT EXISTS production_shift ON production (shift_date, shift);
CREATE TABLE IF NOT EXISTS rejections (
  id serial PRIMARY KEY,
  serial text NOT NULL,
  pallet_id text,
  model text,
  brand text,
  defects jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments text,
  in_production boolean NOT NULL DEFAULT false,
  shift_date text NOT NULL,
  shift text NOT NULL,
  registered_by integer,
  registered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rejections_serial ON rejections (serial);
CREATE INDEX IF NOT EXISTS rejections_shift ON rejections (shift_date);
CREATE TABLE IF NOT EXISTS staffing (
  shift_date text NOT NULL,
  shift text NOT NULL,
  line text NOT NULL,
  people integer NOT NULL DEFAULT 0,
  updated_by integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shift_date, shift, line)
);
CREATE TABLE IF NOT EXISTS plans (
  shift_date text NOT NULL,
  shift text NOT NULL,
  line text NOT NULL,
  planned integer NOT NULL,
  updated_by integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shift_date, shift, line)
);
CREATE TABLE IF NOT EXISTS hourly_goals (
  shift_date text NOT NULL,
  shift text NOT NULL,
  scope text NOT NULL,
  goal integer NOT NULL,
  updated_by integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shift_date, shift, scope)
);
-- Linea de la salida (se elige al iniciarla); alimenta "Produccion por linea".
ALTER TABLE pallets ADD COLUMN IF NOT EXISTS line text;
-- Pieza de otro modelo/prefijo agregada a proposito ("tele diferente"), identificada en listas y reportes.
ALTER TABLE pallet_items ADD COLUMN IF NOT EXISTS different boolean NOT NULL DEFAULT false;
-- Historico de PalletScan (antes de VIOS, 2026-09-11 a 2026-10-02), capturado de su reporte "Produccion VIOS-HY / MTY"
-- (2026-10-08, pedido de Roman). Solo alimenta Reportes -> Produccion por modelo y se suma a lo de VIOS.
-- rejected = rechazados de Calidad en PalletScan por modelo (se anotan en el ultimo dia de ese modelo).
CREATE TABLE IF NOT EXISTS production_history (
  date text NOT NULL,
  model text NOT NULL,
  brand text NOT NULL,
  pieces integer NOT NULL,
  rejected integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'PalletScan',
  PRIMARY KEY (date, model, brand)
);
INSERT INTO production_history (date, model, brand, pieces, rejected) VALUES
  ('2026-09-11', 'EL-32"', 'HY', 79, 0),
  ('2026-09-14', 'EL-32"', 'HY', 100, 0),
  ('2026-09-15', 'EL-32"', 'HY', 171, 0),
  ('2026-09-17', 'EL-32"', 'HY', 241, 0),
  ('2026-09-18', 'EL-32"', 'HY', 313, 0),
  ('2026-09-21', 'EL-32"', 'HY', 276, 0),
  ('2026-09-22', 'EL-32"', 'HY', 309, 0),
  ('2026-09-23', 'EL-32"', 'HY', 401, 0),
  ('2026-09-24', 'EL-32"', 'HY', 450, 0),
  ('2026-09-25', 'EL-32"', 'HY', 262, 32),
  ('2026-10-01', 'EL-43"', 'SILO', 125, 0),
  ('2026-10-02', 'EL-43"', 'SILO', 261, 6)
ON CONFLICT DO NOTHING;
`

export async function migrate() {
  await exec(DDL)
}
