// Piezas compartidas de Produccion / Calidad: enlace de regreso, selector de turno y KPIs por linea.
import { AlertTriangle, ChevronLeft, Clock, Gauge, TrendingUp, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { shiftOf, SHIFTS } from '@shared/shift.js'
import { Progress, Segmented } from '@/components/ui'
import { cn, fmtInt, fmtPct } from '@/lib/utils'

export function BackLink({ to, children }) {
  return (
    <Link
      to={to}
      className="-ml-1 mb-1 inline-flex items-center gap-0.5 rounded-lg px-1 py-0.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4" />
      {children}
    </Link>
  )
}

export const SHIFT_OPTIONS = SHIFTS.map((s) => ({ value: s.key, label: s.label }))

// Fecha de turno + Turno 1 / Turno 2.
export function ShiftPicker({ shiftDate, shift, onChange, className }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <input
        type="date"
        value={shiftDate}
        onChange={(e) => e.target.value && onChange({ shiftDate: e.target.value, shift })}
        className="field h-10 w-auto min-w-0 px-3 text-[14px]"
        aria-label="Fecha del turno"
      />
      <Segmented value={shift} onChange={(v) => onChange({ shiftDate, shift: v })} options={SHIFT_OPTIONS} />
    </div>
  )
}

// La planta esta en America/Monterrey (UTC-6 todo el ano, sin horario de verano desde 2022).
const PLANT_OFFSET = '-06:00'
export function shiftWindow(shiftDate, shift) {
  const s = SHIFTS.find((x) => x.key === shift) || SHIFTS[0]
  const start = Date.parse(`${shiftDate}T${s.start}:00${PLANT_OFFSET}`)
  return { start, end: start + s.hours * 3600000, hours: s.hours, startHour: Number(s.start.slice(0, 2)) }
}

// Etiquetas de hora del turno: 07, 08, ... / 22, 23, 00 ...
export function hourLabels(shift) {
  const { hours, startHour } = shiftWindow('2000-01-01', shift)
  return Array.from({ length: hours }, (_, i) => String((startHour + i) % 24).padStart(2, '0'))
}

// KPIs de una linea del tablero en vivo (/production/live).
export function lineKpis(l, { shiftDate, shift, now }) {
  const w = shiftWindow(shiftDate, shift)
  const nowMs = now ? Date.parse(now) : Date.now()
  const active = nowMs >= w.start && nowMs < w.end
  const from = l.first ? Date.parse(l.first) : w.start
  const until = Math.min(nowMs, w.end)
  const elapsedH = Math.max(0.25, (until - from) / 3600000)
  const uph = l.count ? l.count / elapsedH : 0
  const remainingH = active ? Math.max(0, (w.end - nowMs) / 3600000) : 0
  const projection = Math.round(l.count + uph * remainingH)
  const sinceLast = l.last ? Math.max(0, Math.round((nowMs - Date.parse(l.last)) / 60000)) : null
  const idleRef = sinceLast ?? (active ? Math.round((nowMs - w.start) / 60000) : null)
  const idle = !active || idleRef === null ? 'none' : idleRef > 30 ? 'red' : idleRef > 10 ? 'amber' : 'none'
  const pct = l.goal ? l.count / l.goal : null
  return {
    active,
    pct,
    uph,
    projection,
    sinceLast,
    idle,
    perPerson: l.people ? l.count / l.people : null,
    goalPerHour: l.goal ? l.goal / w.hours : 0,
    currentHour: active ? Math.floor((nowMs - w.start) / 3600000) : null,
  }
}

export function totalsOf(lines, ctx) {
  const t = lines.reduce(
    (a, l) => {
      const k = lineKpis(l, ctx)
      a.count += l.count
      a.goal += l.goal || 0
      a.uph += k.uph
      a.projection += k.projection
      a.people += l.people || 0
      return a
    },
    { count: 0, goal: 0, uph: 0, projection: 0, people: 0 },
  )
  return { ...t, pct: t.goal ? t.count / t.goal : null }
}

export const fmtMin = (m) => (m === null || m === undefined ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`)
export const fmtDec = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(d))

const IDLE_TEXT = { amber: 'text-amber-700 dark:text-amber-300', red: 'text-red-700 dark:text-red-300', none: '' }

// Cuadricula de indicadores (usada en tarjetas de linea y en el detalle).
export function KpiGrid({ line, k, className }) {
  const items = [
    { icon: Gauge, label: 'Piezas / hora', value: fmtDec(k.uph) },
    {
      icon: Clock,
      label: 'Último escaneo',
      value: line.last ? `hace ${fmtMin(k.sinceLast)}` : 'Sin escaneos',
      cls: IDLE_TEXT[k.idle],
      warn: k.idle !== 'none',
    },
    {
      icon: Users,
      label: 'Personal',
      value: line.people ? `${fmtInt(line.people)} · ${fmtDec(k.perPerson)} pz/p` : 'Sin capturar',
    },
    {
      icon: TrendingUp,
      label: k.active ? 'Proyección' : 'Final',
      value: `${fmtInt(k.projection)}${line.goal ? ` · ${fmtPct(k.projection / line.goal)}` : ''}`,
    },
  ]
  return (
    <dl className={cn('grid grid-cols-2 gap-x-3 gap-y-2.5', className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            <it.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{it.label}</span>
          </dt>
          <dd className={cn('tabular mt-0.5 flex items-center gap-1 truncate text-[14.5px] font-bold', it.cls)}>
            {it.warn && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{it.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

// Conteo grande + barra de avance contra meta.
export function CountVsGoal({ count, goal, pct, size = 'md' }) {
  return (
    <div>
      <div className="flex items-end gap-2">
        <span className={cn('tabular font-extrabold leading-none tracking-tight', size === 'lg' ? 'text-[40px]' : 'text-[32px]')}>
          {fmtInt(count)}
        </span>
        <span className="pb-1 text-[14px] font-semibold text-muted-foreground">/ {fmtInt(goal)}</span>
        <span className={cn('ml-auto pb-1 text-[18px] font-extrabold', pct >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary')}>
          {fmtPct(pct)}
        </span>
      </div>
      <Progress value={pct} tone={pct >= 1 ? 'green' : 'primary'} className="mt-2.5" />
    </div>
  )
}

// Normaliza el campo jsonb "defects" (por si llega como texto).
export function defectList(d) {
  if (Array.isArray(d)) return d
  if (typeof d === 'string') {
    try {
      const v = JSON.parse(d)
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }
  return []
}

// Turno elegido guardado en la URL (?shiftDate=&shift=), por defecto el turno actual.
export function useShiftParams() {
  const [params, setParams] = useSearchParams()
  const now = shiftOf()
  const shiftDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get('shiftDate') || '') ? params.get('shiftDate') : now.shiftDate
  const shift = SHIFTS.some((s) => s.key === params.get('shift')) ? params.get('shift') : now.shift
  const isCurrent = shiftDate === now.shiftDate && shift === now.shift
  const setShift = (v) => setParams({ shiftDate: v.shiftDate, shift: v.shift }, { replace: true })
  return { shiftDate, shift, isCurrent, setShift, search: `?shiftDate=${shiftDate}&shift=${shift}` }
}
