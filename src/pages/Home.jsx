// Inicio (rediseno 2026-10-10, imagen de referencia de Roman). Mismos datos de GET /api/dashboard (produccion del
// turno, meta, ritmo y proyeccion, HY/SILO, rechazos, faltantes, pallets abiertos, actividad reciente) mas, para
// Estado de la operacion y Alertas: /production/by-line (lineas con escaneos en el turno) y /pallets/pending
// (pallets sin salida o con salida abierta). Nada se calcula distinto: solo se acomoda y se resume.
import { shiftWindow } from '@shared/pace.js'
import { addDays, shiftLabel, shiftOf } from '@shared/shift.js'
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Box,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileBarChart,
  ShieldX,
  Target,
  TrendingDown,
  Users,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '@/lib/hooks'
import { useCatalogs, useSession } from '@/lib/session'
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

// Mismo porcentaje para el circulo y la barra: produccion / meta. El numero muestra el real (puede pasar de 100%);
// el circulo y la barra se llenan hasta 100%.
const pctOf = (produced, goal) => (goal > 0 ? (produced / goal) * 100 : null)

function Ring({ pct }) {
  const r = 50
  const c = 2 * Math.PI * r
  const fill = Math.min(100, pct || 0)
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          strokeWidth="11"
          className="stroke-slate-100 dark:stroke-muted"
        />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          strokeWidth="11"
          strokeLinecap="round"
          className={pct >= 100 ? 'stroke-emerald-500' : 'stroke-blue-600 dark:stroke-blue-400'}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fill / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="tabular text-[28px] font-extrabold leading-none">
          {pct === null ? '—' : `${Math.round(pct)}%`}
        </span>
        <span className="mt-1 text-[12px] text-muted-foreground">de la meta</span>
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

function BrandTile({ b }) {
  const silo = b.brand === 'SILO'
  const ic = silo ? 'text-violet-500' : 'text-blue-500'
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border px-4 py-3',
        silo
          ? 'border-violet-100 bg-violet-50/70 dark:border-violet-500/20 dark:bg-violet-500/10'
          : 'border-blue-100 bg-blue-50/70 dark:border-blue-500/20 dark:bg-blue-500/10',
      )}
    >
      <p
        className={cn(
          'text-[13px] font-extrabold',
          silo ? 'text-violet-700 dark:text-violet-300' : 'text-blue-700 dark:text-blue-300',
        )}
      >
        {b.brand}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="inline-flex items-baseline gap-1.5">
          <Box className={cn('h-4 w-4 self-center', ic)} />
          <span className="tabular text-[24px] font-extrabold leading-none">{fmtInt(b.pieces)}</span>
          <span className="text-[13px] text-muted-foreground">pzs</span>
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          <Boxes className={cn('h-4 w-4 self-center', ic)} />
          <span className="tabular text-[24px] font-extrabold leading-none">{fmtInt(b.pallets)}</span>
          <span className="text-[13px] text-muted-foreground">pallet{b.pallets === 1 ? '' : 's'}</span>
        </span>
      </div>
    </div>
  )
}

function ProductionCard({ data }) {
  const pct = pctOf(data.produced, data.goal)
  const p = data.pace
  const brands = ['HY', 'SILO'].map(
    (b) => data.brands?.find((x) => x.brand === b) || { brand: b, pieces: 0, pallets: 0 },
  )
  return (
    <section
      className={cn(
        panel,
        'grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)] xl:items-center',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <BarChart3 className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-[15px] font-extrabold uppercase tracking-wide">Producción del turno</h2>
            <p className="text-[13px] text-muted-foreground">Avance actual contra la meta del turno</p>
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-3">
          <span className="tabular text-[56px] font-extrabold leading-none tracking-tight sm:text-[64px]">
            {fmtInt(data.produced)}
          </span>
          <span className="text-[36px] font-light text-slate-300 dark:text-muted-foreground">/</span>
          <span className="tabular text-[40px] font-extrabold leading-none text-slate-500 dark:text-muted-foreground sm:text-[46px]">
            {fmtInt(data.goal)}
          </span>
        </div>
        <div className="mt-1 flex gap-10 text-[14px] text-muted-foreground">
          <span>Producidas</span>
          <span>Meta del turno</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                pct >= 100 ? 'bg-emerald-500' : 'bg-blue-600 dark:bg-blue-400',
              )}
              style={{ width: `${Math.min(100, pct || 0)}%`, transition: 'width 0.6s ease' }}
            />
          </div>
          <span className="tabular w-12 text-right text-[15px] font-extrabold">
            {pct === null ? '—' : `${Math.round(pct)}%`}
          </span>
        </div>
      </div>

      <div className="flex justify-center xl:border-r xl:pr-6">
        <Ring pct={pct} />
      </div>

      <div className="min-w-0 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {brands.map((b) => (
            <BrandTile key={b.brand} b={b} />
          ))}
        </div>
        {p && (
          <div className="grid gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-muted/40 sm:grid-cols-[auto_1px_1fr] sm:items-center sm:gap-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-blue-600 shadow-sm dark:bg-card">
                <Clock3 className="h-[18px] w-[18px]" />
              </span>
              <span className="leading-tight">
                <span className="block text-[13px] font-semibold">Proyección fin de turno</span>
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
              </span>
            </div>
            <span className="hidden h-9 w-px bg-slate-200 dark:bg-border sm:block" />
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 shrink-0 text-blue-600" />
              <div className="leading-tight">
                <div className="text-[12px] text-muted-foreground">Ritmo actual</div>
                <div className="text-[16px] font-extrabold">
                  1 pz cada {p.secPerPiece ? `${Math.round(p.secPerPiece)} s` : '—'}{' '}
                  <span className="whitespace-nowrap font-medium text-muted-foreground">
                    (meta {Math.round(p.goalSecPerPiece)} s)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

const KPI_ART = {
  red: (
    <g fill="currentColor">
      {[14, 22, 18, 30].map((h, i) => (
        <rect key={h} x={8 + i * 12} y={40 - h} width="8" height={h} rx="2" opacity={0.35 + i * 0.12} />
      ))}
    </g>
  ),
  amber: (
    <g fill="currentColor">
      <path d="M10 22l18-9 18 9-18 9z" opacity=".55" />
      <path d="M10 22v14l18 9V31z" opacity=".35" />
      <path d="M46 22v14l-18 9V31z" opacity=".45" />
    </g>
  ),
  blue: (
    <g fill="currentColor">
      <path d="M28 4v18m-7-7l7 7 7-7" stroke="currentColor" strokeWidth="4" fill="none" opacity=".5" />
      <path d="M6 30l22-9 22 9-22 9z" opacity=".45" />
      <path d="M6 30v8l22 9v-8z" opacity=".3" />
      <path d="M50 30v8l-22 9v-8z" opacity=".4" />
    </g>
  ),
  violet: (
    <g fill="currentColor">
      {[12, 20, 16, 28].map((h, i) => (
        <rect key={h} x={8 + i * 12} y={44 - h} width="8" height={h} rx="2" opacity={0.3 + i * 0.12} />
      ))}
      <path d="M8 22l14-8 10 5 16-12" stroke="currentColor" strokeWidth="3" fill="none" opacity=".55" />
    </g>
  ),
}
const textTone = (tone) => TONE[tone].split(' ').find((c) => c.startsWith('text-'))

function KpiCard({ to, icon: Icon, tone, title, hint, value }) {
  return (
    <Link
      to={to}
      className={cn(
        panel,
        'group relative flex items-center gap-3.5 overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl', TONE[tone])}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block pr-6 text-[13px] font-extrabold uppercase leading-tight tracking-wide">
          {title}
        </span>
        <span className="tabular mt-1 block text-[32px] font-extrabold leading-none">{fmtInt(value)}</span>
        <span className="mt-1 block text-[12.5px] leading-tight text-muted-foreground">{hint}</span>
      </span>
      <svg
        viewBox="0 0 56 50"
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute bottom-2 right-3 h-12 w-14 opacity-25 dark:opacity-20',
          textTone(tone),
        )}
      >
        {KPI_ART[tone]}
      </svg>
      <ChevronRight className="absolute right-3 top-4 h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5" />
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
        'group relative flex h-full min-h-[160px] flex-col overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      <svg
        viewBox="0 0 160 150"
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -bottom-3 right-2 h-[130px] w-[140px] opacity-[.2] dark:opacity-[.12]',
          textTone(tone),
        )}
      >
        {ART[art]}
      </svg>
      <span className={cn('grid h-11 w-11 place-items-center rounded-xl', TONE[tone])}>
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="relative mt-3 text-[18px] font-extrabold">{title}</span>
      <span className="relative mt-0.5 max-w-[68%] text-[13.5px] leading-snug text-muted-foreground">
        {description}
      </span>
      <span className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-card text-foreground shadow-sm transition group-hover:border-blue-200 group-hover:text-blue-600 dark:border-border">
        <ChevronRight className="h-[18px] w-[18px]" />
      </span>
    </Link>
  )
}

// Marco comun de los 3 paneles de abajo: misma altura en escritorio, contenido con scroll interno.
function Panel({ icon: Icon, iconCls, title, subtitle, action, children }) {
  return (
    <section className={cn(panel, 'flex h-[300px] min-h-0 flex-col overflow-hidden')}>
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-border">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', iconCls)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-extrabold leading-tight">{title}</h2>
          <p className="text-[12.5px] text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  )
}

const pillBtn =
  'inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 px-3 py-1.5 text-[12.5px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10'

function Activity({ recent }) {
  const [all, setAll] = useState(false)
  const list = all ? recent || [] : (recent || []).slice(0, 3)
  return (
    <Panel
      icon={Clock3}
      iconCls="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
      title="Actividad reciente"
      subtitle="Últimos movimientos del sistema"
      action={
        recent?.length > 3 && (
          <button type="button" onClick={() => setAll((x) => !x)} className={pillBtn} aria-expanded={all}>
            {all ? 'Ver menos' : 'Ver todo'}{' '}
            <ChevronRight className={cn('h-3.5 w-3.5 transition', all && 'rotate-90')} />
          </button>
        )
      }
    >
      {list.length ? (
        <ol className="px-5 py-1">
          {list.map((r, i) => {
            const k = KIND[r.kind] || KIND.pallet
            return (
              <li
                key={`${r.ref}-${i}`}
                className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0 dark:border-border"
              >
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', k.dot)} />
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
        <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">Sin actividad todavía</p>
      )}
    </Panel>
  )
}

const fmtDur = (ms) => {
  const m = Math.max(0, Math.floor(ms / 60000))
  return `${Math.floor(m / 60)} h ${m % 60} min`
}
const plantDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' })

// Alertas reales: faltantes (7 dias), pallets pendientes de turnos anteriores, proyeccion por debajo de la meta.
function buildAlerts(data, pending) {
  const out = []
  if (data.withMissing7d > 0)
    out.push({
      key: 'faltantes',
      level: 'critical',
      title: `${fmtInt(data.withMissing7d)} salida${data.withMissing7d === 1 ? '' : 's'} con faltantes`,
      detail: 'Últimos 7 días · revisar conciliación',
      to: `/reportes/pallets?from=${addDays(data.shiftDate, -6)}&to=${data.shiftDate}&estado=con_faltantes`,
    })
  const { start } = shiftWindow(data.shiftDate, data.shift)
  const old = (pending || []).filter((x) => new Date(x.since) < start)
  for (const x of old.slice(0, 4))
    out.push({
      key: `p${x.id}`,
      level: 'follow',
      title: `Pallet ${x.id} ${x.kind === 'sin_salida' ? 'sin salida' : 'con salida abierta'}`,
      detail: `${[x.model, x.brand].filter(Boolean).join(' · ')} · desde el ${fmtYmd(plantDay(x.since), { dow: false })}${
        x.kind === 'salida_abierta' ? ` · ${fmtInt(x.done)}/${fmtInt(x.total)}` : ''
      }`,
      to: '/reportes/pallets',
    })
  if (old.length > 4)
    out.push({
      key: 'more',
      level: 'follow',
      title: `+${old.length - 4} pallets pendientes más`,
      detail: 'De turnos anteriores',
      to: '/reportes/pallets',
    })
  const p = data.pace
  if (p && p.remainingHours > 0 && p.elapsedHours >= 1 && data.goal > 0 && p.projection < data.goal)
    out.push({
      key: 'proy',
      level: 'warn',
      title: 'Proyección por debajo de la meta',
      detail: `${fmtInt(p.projection)} de ${fmtInt(data.goal)} a este ritmo`,
      to: '/hora-por-hora',
    })
  return out
}

const LEVEL = {
  critical: { icon: AlertTriangle, cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
  warn: { icon: TrendingDown, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
  follow: { icon: Clock3, cls: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
}

function OperationState({ data, alerts, lines, now }) {
  const critical = alerts.some((a) => a.level === 'critical')
  const warn = alerts.length > 0 && !critical
  const regularOver = data.pace && data.pace.remainingHours <= 0
  const state = critical
    ? {
        title: 'Requiere atención',
        detail: 'Hay faltantes por revisar',
        cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
        dot: 'bg-red-500',
      }
    : warn
      ? {
          title: 'Con seguimientos',
          detail: `${alerts.length} pendiente${alerts.length === 1 ? '' : 's'} en Alertas`,
          cls: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
          dot: 'bg-amber-500',
        }
      : {
          title: 'Operación normal',
          detail: regularOver ? 'Horario regular terminado' : 'Todo en orden',
          cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
          dot: 'bg-emerald-500',
        }
  const { start } = shiftWindow(data.shiftDate, data.shift)
  const stats = [
    {
      icon: Users,
      cls: 'text-blue-600 dark:text-blue-400',
      label: 'Líneas activas',
      value: lines ? `${lines.active} / ${lines.total}` : '—',
    },
    {
      icon: Box,
      cls: 'text-muted-foreground',
      label: 'Pallets en proceso',
      value: fmtInt(data.openEntrada + data.openSalida),
    },
    { icon: Clock3, cls: 'text-muted-foreground', label: 'Tiempo de turno', value: fmtDur(now - start) },
  ]
  return (
    <Panel
      icon={ActivityIcon}
      iconCls="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
      title="Estado de la operación"
      subtitle="Situación actual del turno"
    >
      <div className="space-y-4 p-5">
        <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3', state.cls)}>
          <span className={cn('h-3 w-3 shrink-0 rounded-full', state.dot)} />
          <span className="leading-tight">
            <span className="block text-[14.5px] font-bold">{state.title}</span>
            <span className="block text-[12.5px] opacity-80">{state.detail}</span>
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x dark:divide-border">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn('flex min-w-0 items-center gap-2', i === 0 ? 'pr-2' : i === 1 ? 'px-2' : 'pl-2')}
            >
              <s.icon className={cn('h-5 w-5 shrink-0', s.cls)} />
              <span className="min-w-0 leading-tight">
                <span className="block text-[11px] text-muted-foreground">{s.label}</span>
                <span className="tabular block whitespace-nowrap text-[14px] font-extrabold sm:text-[16px]">
                  {s.value}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          Líneas activas: con escaneos en Producción por línea este turno. Pallets en proceso: entradas y
          salidas abiertas.
        </p>
      </div>
    </Panel>
  )
}

function Alerts({ alerts }) {
  return (
    <Panel
      icon={Bell}
      iconCls="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
      title="Alertas y seguimientos"
      subtitle="Eventos que requieren atención"
      action={
        <Link to="/reportes/pallets" className={pillBtn}>
          Ver todo <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {alerts.length ? (
        <ul className="divide-y divide-slate-100 dark:divide-border">
          {alerts.map((a) => {
            const L = LEVEL[a.level]
            return (
              <li key={a.key}>
                <Link to={a.to} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40">
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', L.cls)}>
                    <L.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">{a.title}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{a.detail}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-5 py-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <p className="mt-3 text-[14.5px] font-bold">Sin alertas activas</p>
          <p className="text-[12.5px] text-muted-foreground">Todo se encuentra en orden en este momento.</p>
        </div>
      )}
    </Panel>
  )
}

// Decoracion tenue del encabezado (almacen con cajas); no tapa el texto.
function HeaderArt() {
  return (
    <svg
      viewBox="0 0 420 120"
      aria-hidden="true"
      className="pointer-events-none absolute right-44 top-0 hidden h-[110px] w-[400px] text-blue-500 opacity-[.13] xl:block dark:opacity-[.08]"
    >
      <g fill="currentColor">
        <path d="M150 18l120-14 120 14v96H150z" opacity=".5" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={170 + i * 52} y="40" width="40" height="74" rx="3" opacity=".35" />
        ))}
        {[
          [20, 76],
          [52, 76],
          [36, 52],
          [84, 86],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <path d={`M${x} ${y}l18-9 18 9-18 9z`} opacity=".7" />
            <path d={`M${x} ${y}v18l18 9v-18z`} opacity=".5" />
            <path d={`M${x + 36} ${y}v18l-18 9v-18z`} opacity=".6" />
          </g>
        ))}
      </g>
    </svg>
  )
}

export default function Home() {
  const { user } = useSession()
  const { lines: catalogLines } = useCatalogs()
  const { data, loading, error } = useApi('/dashboard', { refreshMs: 20000 })
  const byLine = useApi('/production/by-line', { refreshMs: 60000 })
  const pending = useApi('/pallets/pending', { query: { area: 'salida' }, refreshMs: 60000 })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])
  const first = user?.name?.split(' ')[0]
  const state = shiftState(data?.pace)
  const alerts = data ? buildAlerts(data, pending.data?.pallets) : []
  const lines = byLine.data
    ? {
        active: byLine.data.lines.filter((l) => l.pieces > 0).length,
        total: Math.max(catalogLines.length, byLine.data.lines.length),
      }
    : null
  const cur = data || shiftOf()

  return (
    <div className="space-y-4">
      <header className="relative flex flex-wrap items-start justify-between gap-3">
        <HeaderArt />
        <div className="relative min-w-0">
          <p className="text-[14px] font-semibold text-muted-foreground">
            {shiftLabel(cur.shift)} · {fmtYmd(cur.shiftDate)}
          </p>
          <h1 className="text-[30px] font-extrabold tracking-tight sm:text-[38px]">Hola, {first}</h1>
          <p className="text-[15px] text-muted-foreground">
            Aquí está el resumen de tu operación en tiempo real.
          </p>
        </div>
        <div className="relative flex items-center gap-2">
          {state && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold',
                state.cls,
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', state.dot)} /> {state.label}
            </span>
          )}
          <Link
            to="/hora-por-hora"
            aria-label="Ver Hora x Hora"
            className="grid h-9 w-9 place-items-center rounded-full text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
          >
            <Target className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {error && !data ? (
        <div className={cn(panel, 'p-6 text-center text-[13.5px] text-red-700 dark:text-red-300')}>
          No se pudo cargar el resumen: {error.message}
        </div>
      ) : loading && !data ? (
        <div className="space-y-4">
          <div className="h-[220px] animate-pulse rounded-2xl bg-muted/70" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[110px] animate-pulse rounded-2xl bg-muted/70" />
            ))}
          </div>
        </div>
      ) : (
        data && (
          <>
            <ProductionCard data={data} />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                to="/calidad"
                icon={ShieldX}
                tone="red"
                title="Rechazos hoy"
                hint="Calidad"
                value={data.rejected}
              />
              <KpiCard
                to={`/reportes/pallets?from=${addDays(data.shiftDate, -6)}&to=${data.shiftDate}&estado=con_faltantes`}
                icon={AlertTriangle}
                tone="amber"
                title="Con faltantes"
                hint="Salidas, últimos 7 días"
                value={data.withMissing7d}
              />
              <KpiCard
                to="/pallets/entrada"
                icon={ArrowDownToLine}
                tone="blue"
                title="Entradas abiertas"
                hint="Escaneando"
                value={data.openEntrada}
              />
              <KpiCard
                to="/pallets/salida"
                icon={ArrowUpFromLine}
                tone="violet"
                title="Salidas abiertas"
                hint="Por conciliar"
                value={data.openSalida}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Activity recent={data.recent} />
              <OperationState data={data} alerts={alerts} lines={lines} now={now} />
              <div className="md:col-span-2 xl:col-span-1">
                <Alerts alerts={alerts} />
              </div>
            </div>
          </>
        )
      )}
    </div>
  )
}
