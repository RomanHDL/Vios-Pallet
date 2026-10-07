# VIOS Pallet

Control de pallets, producción, calidad y reportes para la línea VIOS (HY / SILO) de MI Technologies Monterrey.
Reemplaza a PalletScan (`palletscan-mi.web.app`) con usuarios, base de datos propia y cálculos corregidos.

## Módulos

| Módulo | Qué hace |
|---|---|
| **Pallets** | Entrada (escanear ID de 6 dígitos + piezas), Salida (`ID-S`) con conciliación pieza por pieza, motivo obligatorio por faltante, hoja imprimible con firmas, historial y búsqueda de serial. |
| **Producción** | Registro de producto terminado (serial TV = serial caja) por estación (línea / modelo / marca), tablero en vivo por línea, plan y personal del turno, historial. |
| **Calidad** | Rechazos por serial con defectos del catálogo; bloquea que un serial rechazado se registre como producción. |
| **Reportes** | Plan vs Real con Delta y Recovery por turno, producción por modelo contra objetivos MTY/Texas con proyección, personal y productividad, dashboard de pallets. |
| **Administración** | Usuarios y roles (admin, supervisor, operador, calidad) y catálogos (líneas y metas, modelos y prefijos, marcas, defectos). |

## Diferencias con PalletScan

- **Login y roles**: cada registro guarda quién lo hizo; borrar / reabrir requiere supervisor o admin.
- **Plan real**: plan capturado por línea y turno (o la meta de las líneas activas), no "400 por cada línea que registró algo".
- **Turno 2 completo**: se agrupa por *fecha de turno* (22:00–07:00 cuenta para el día en que empieza).
- **Serial único en la base**: dos escaneos simultáneos ya no pueden duplicar producción.
- **Catálogos editables**: líneas, metas, modelos, objetivos y defectos ya no están fijos en el código.
- **Escaneo con cámara** en celulares compatibles, además de pistola lectora.

## Correr en local

Requisitos: Node 20+ y pnpm 10.

```bash
pnpm install
pnpm dev
```

- Web: http://localhost:5180 (API en http://localhost:3001, Vite hace proxy de `/api`).
- Sin `DATABASE_URL` usa **PGlite** (Postgres embebido) en `data/pglite`. Con `DATABASE_URL` usa Postgres normal.
- La primera vez se crea el usuario `admin` con una contraseña al azar guardada en `data/initial-admin.txt`.
  Cámbiala en *Mi cuenta* después de entrar.

Producción (Coolify): `pnpm build && pnpm start` (PM2, `ecosystem.config.cjs`). Escucha en `0.0.0.0:$PORT`.
Variables: `DATABASE_URL` (Postgres 16), `SESSION_SECRET` (obligatoria en producción), `PORT`, `ADMIN_INITIAL_PASSWORD` (contraseña del admin en el primer arranque).

## Stack

React 19 + Vite + Tailwind · Express 5 + Drizzle ORM · PostgreSQL (PGlite en local).
