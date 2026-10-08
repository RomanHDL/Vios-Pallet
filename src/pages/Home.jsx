// Inicio (dashboard). Mismos datos que antes (GET /api/dashboard): produccion del turno contra la meta, ritmo y
// proyeccion, rechazos, faltantes, pallets abiertos y actividad reciente. Sin boton de accion en el encabezado.
import { shiftLabel } from '@shared/shift.js'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Box,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileBarChart,
  ShieldX,
  Target,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Empty, Spinner } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { cn, fmtAgo, fmtInt, fmtYmd } from '@/lib/utils'

const KIND = {
  produccion: {
    label: 'Producción',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  rechazo: {
    label: 'Rechazo',
    badge: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    dot: 'bg-red-500',
  },
  pallet: {
    label: 'Pallet',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
}

const TONE = {
  red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
}

const panel =
  'rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_3px_rgba(15,23,42,.06)] dark:border-border'

// Mismo porcentaje para el circulo y la barra: produccion / meta (0..100).
const progressOf = (produced, goal) => (goal > 0 ? Math.min(100, (produced / goal) * 100) : 0)

function Ring({ pct }) {
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-[112px] w-[112px] shrink-0">
      <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          strokeWidth="10"
          className="stroke-slate-100 dark:stroke-muted"
        />
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="#2563EB"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="tabular text-[24px] font-extrabold leading-none">{Math.round(pct)}%</span>
        <span className="mt-1 text-[11px] text-muted-foreground">de la meta</span>
      </div>
    </div>
  )
}

function shiftState(pace) {
  if (!pace) return null
  if (pace.remainingHours > 0)
    return {
      label: 'Turno en proceso',
      cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
      dot: 'bg-emerald-500',
    }
  return {
    label: 'Horario regular terminado',
    cls: 'bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground',
    dot: 'bg-slate-400',
  }
}

function ProductionCard({ data }) {
  const pct = progressOf(data.produced, data.goal)
  const p = data.pace
  const state = shiftState(p)
  return (
    <section className={cn(panel, 'p-5 sm:p-6')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <BarChart3 className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-[14.5px] font-extrabold uppercase tracking-wide">Producción del turno</h2>
            <p className="text-[13px] text-muted-foreground">Avance actual contra meta del turno</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold',
                state.cls,
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', state.dot)} /> {state.label}
            </span>
          )}
          <Link
            to="/hora-por-hora"
            aria-label="Ver Hora x Hora"
            className="grid h-8 w-8 place-items-center rounded-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
          >
            <Target className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="tabular text-[52px] font-extrabold leading-none tracking-tight sm:text-[60px]">
              {fmtInt(data.produced)}
            </span>
            <span className="text-[34px] font-light text-slate-300 dark:text-muted-foreground">/</span>
            <span className="tabular text-[36px] font-extrabold leading-none text-slate-500 dark:text-muted-foreground sm:text-[42px]">
              {fmtInt(data.goal)}
            </span>
          </div>
          <div className="mt-1.5 flex gap-10 text-[13.5px] text-muted-foreground">
            <span>Producidas</span>
            <span>Meta del turno</span>
          </div>
        </div>
        <Ring pct={pct} />
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-muted">
        <div
          className="h-full rounded-full bg-blue-600"
          style={{ width: `${pct}%`, transition: 'width 0.4s ease' }}
        />
      </div>

      {p && (
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-muted/40 sm:grid-cols-[auto_1px_1fr] sm:items-center sm:gap-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-blue-600 shadow-sm dark:bg-card">
              <Clock3 className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[13.5px] font-semibold">Proyección fin de turno</span>
            <span
              className={cn(
                'tabular text-[22px] font-extrabold',
                p.projection >= data.goal
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {fmtInt(p.projection)}
            </span>
          </div>
          <span className="hidden h-9 w-px bg-slate-200 dark:bg-border sm:block" />
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="leading-tight">
              <div className="text-[12px] text-muted-foreground">Ritmo actual</div>
              <div className="text-[15.5px] font-extrabold">
                1 pz cada {p.secPerPiece ? `${Math.round(p.secPerPiece)} s` : '—'}{' '}
                <span className="whitespace-nowrap font-medium text-muted-foreground">
                  (meta {Math.round(p.goalSecPerPiece)} s)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function KpiCard({ to, icon: Icon, tone, title, hint, value }) {
  return (
    <Link
      to={to}
      className={cn(
        panel,
        'group flex items-center gap-3.5 p-4 transition hover:border-slate-300 hover:shadow-md',
      )}
    >
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', TONE[tone])}>
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-extrabold uppercase leading-tight tracking-wide">
          {title}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-tight text-muted-foreground">{hint}</span>
        <span className="tabular mt-0.5 block text-[30px] font-extrabold leading-none">{fmtInt(value)}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
    </Link>
  )
}

// Ilustraciones de fondo muy tenues (trazos simples, tono del modulo).
const ART = {
  pallet: (
    <g fill="currentColor">
      <path d="M40 70l40-20 40 20-40 20z" opacity=".55" />
      <path d="M40 70v40l40 20V90z" opacity=".35" />
      <path d="M120 70v40l-40 20V90z" opacity=".45" />
      <path d="M80 40l30-15 30 15-30 15z" opacity=".5" />
      <path d="M80 40v30l30 15V55z" opacity=".3" />
      <path d="M140 40v30l-30 15V55z" opacity=".4" />
    </g>
  ),
  produccion: (
    <g fill="currentColor">
      {[30, 55, 45, 80, 70, 100].map((h, i) => (
        <rect key={h} x={20 + i * 22} y={130 - h} width="14" height={h} rx="3" opacity={0.25 + i * 0.08} />
      ))}
      <path d="M20 90l40-25 30 12 50-40" fill="none" stroke="currentColor" strokeWidth="4" opacity=".5" />
    </g>
  ),
  calidad: (
    <g fill="currentColor">
      <rect x="45" y="25" width="80" height="105" rx="10" opacity=".3" />
      <rect x="70" y="18" width="30" height="16" rx="5" opacity=".5" />
      {[50, 72, 94].map((y) => (
        <g key={y}>
          <path d={`M58 ${y}l6 6 10-12`} fill="none" stroke="currentColor" strokeWidth="4" opacity=".6" />
          <rect x="82" y={y - 2} width="32" height="6" rx="3" opacity=".45" />
        </g>
      ))}
    </g>
  ),
  reportes: (
    <g fill="currentColor">
      <rect x="40" y="20" width="85" height="110" rx="8" opacity=".25" transform="rotate(-8 82 75)" />
      <rect x="55" y="30" width="85" height="110" rx="8" opacity=".35" />
      {[40, 52, 64].map((y) => (
        <rect key={y} x="68" y={y} width="55" height="6" rx="3" opacity=".5" />
      ))}
      {[24, 40, 32, 50].map((h, i) => (
        <rect key={h} x={70 + i * 14} y={125 - h} width="9" height={h} rx="2" opacity=".55" />
      ))}
    </g>
  ),
}

function AccessCard({ to, icon: Icon, tone, art, title, description }) {
  return (
    <Link
      to={to}
      className={cn(
        panel,
        'group relative flex min-h-[150px] flex-col overflow-hidden p-5 transition hover:border-slate-300 hover:shadow-md',
      )}
    >
      <svg
        viewBox="0 0 160 150"
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -bottom-3 right-2 h-[130px] w-[140px] opacity-[.18] dark:opacity-[.12]',
          TONE[tone].split(' ').find((c) => c.startsWith('text-')),
        )}
      >
        {ART[art]}
      </svg>
      <span className={cn('grid h-11 w-11 place-items-center rounded-xl', TONE[tone])}>
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="relative mt-3 text-[17px] font-extrabold">{title}</span>
      <span className="relative mt-0.5 max-w-[70%] text-[13.5px] leading-snug text-muted-foreground">
        {description}
      </span>
      <span className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-card text-foreground shadow-sm transition group-hover:border-blue-200 group-hover:text-blue-600 dark:border-border">
        <ChevronRight className="h-[18px] w-[18px]" />
      </span>
    </Link>
  )
}

function Activity({ recent }) {
  return (
    <section className={cn(panel, 'flex flex-col')}>
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-border">
        <Clock3 className="h-6 w-6 text-blue-600" />
        <div>
          <h2 className="text-[16px] font-extrabold">Actividad reciente</h2>
          <p className="text-[12.5px] text-muted-foreground">Últimos movimientos del sistema</p>
        </div>
      </div>
      {recent?.length ? (
        <ol className="relative px-5 py-2">
          <span
            className="absolute bottom-6 left-[27px] top-6 w-px bg-slate-200 dark:bg-border"
            aria-hidden="true"
          />
          {recent.map((r, i) => {
            const k = KIND[r.kind] || KIND.pallet
            return (
              <li
                key={`${r.ref}-${i}`}
                className="relative flex items-center gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-border"
              >
                <span
                  className={cn('relative z-10 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-card', k.dot)}
                />
                <span
                  className={cn(
                    'w-[92px] shrink-0 rounded-full px-2 py-1 text-center text-[12px] font-semibold',
                    k.badge,
                  )}
                >
                  {k.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold">{r.ref}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{r.detail}</span>
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground">{fmtAgo(r.at)}</span>
              </li>
            )
          })}
        </ol>
      ) : (
        <Empty title="Sin actividad todavía" />
      )}
    </section>
  )
}

export default function Home() {
  const { user } = useSession()
  const { data, loading } = useApi('/dashboard', { refreshMs: 20000 })
  const first = user?.name?.split(' ')[0]

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[13.5px] font-semibold text-muted-foreground">
          {data ? `${shiftLabel(data.shift)} · ${fmtYmd(data.shiftDate)}` : ' '}
        </p>
        <h1 className="text-[28px] font-extrabold tracking-tight sm:text-[34px]">Hola, {first}</h1>
        <p className="text-[14px] text-muted-foreground">
          Aquí está el resumen de tu operación en tiempo real.
        </p>
      </header>

      {loading && !data ? (
        <Spinner />
      ) : (
        data && (
          // Monitor ancho (2xl): produccion + 4 tarjetas lado a lado. Laptop (xl): produccion a todo lo ancho
          // y las 4 tarjetas en una fila, para que no se compriman los textos.
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="xl:col-span-2 2xl:col-span-1">
              <ProductionCard data={data} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-4 2xl:col-span-1 2xl:grid-cols-2">
              <KpiCard
                to="/calidad"
                icon={ShieldX}
                tone="red"
                title="Rechazos hoy"
                hint="Calidad"
                value={data.rejected}
              />
              <KpiCard
                to="/pallets/historial"
                icon={AlertTriangle}
                tone="amber"
                title="Con faltantes"
                hint="Salidas, últimos 7 días"
                value={data.withMissing7d}
              />
              <KpiCard
                to="/pallets"
                icon={ArrowDownToLine}
                tone="blue"
                title="Entradas abiertas"
                hint="Escaneando"
                value={data.openEntrada}
              />
              <KpiCard
                to="/pallets"
                icon={ArrowUpFromLine}
                tone="violet"
                title="Salidas abiertas"
                hint="Por conciliar"
                value={data.openSalida}
              />
            </div>

            <div className="grid content-start gap-4 sm:grid-cols-2">
              <AccessCard
                to="/pallets"
                icon={Box}
                tone="blue"
                art="pallet"
                title="Control de Pallet"
                description="Entrada, salida y conciliación de pallets"
              />
              <AccessCard
                to="/produccion"
                icon={BarChart3}
                tone="green"
                art="produccion"
                title="Producción"
                description="Conteo del turno, ritmo y proyección"
              />
              <AccessCard
                to="/calidad"
                icon={ClipboardCheck}
                tone="red"
                art="calidad"
                title="Calidad"
                description="Rechazos por defecto y análisis de calidad"
              />
              <AccessCard
                to="/reportes"
                icon={FileBarChart}
                tone="violet"
                art="reportes"
                title="Reportes"
                description="Plan vs Real, modelos y pallets"
              />
            </div>

            <Activity recent={data.recent} />
          </div>
        )
      )}
    </div>
  )
}
