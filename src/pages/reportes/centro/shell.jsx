// Piezas del Centro de reportes: marco de cada tarjeta, controles compactos y estado por tarjeta.
// Cada tarjeta guarda sus filtros en sessionStorage (solo filtros, nada sensible) para conservarlos al abrir un
// reporte completo y regresar.
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useCatalogs } from '@/lib/session'
import { cn, fmtInt } from '@/lib/utils'
import { periodLabel, periodRange, stepAnchor } from '../period'

export function useCardState(key, initial) {
  const storageKey = `vios:centro:${key}`
  const [value, setValue] = useState(() => {
    try {
      const v = sessionStorage.getItem(storageKey)
      return v ? { ...initial, ...JSON.parse(v) } : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      /* sin storage: los filtros solo duran mientras la pagina esta abierta */
    }
  }, [storageKey, value])
  const set = useCallback(
    (patch) => setValue((v) => ({ ...v, ...(typeof patch === 'function' ? patch(v) : patch) })),
    [],
  )
  return [value, set]
}

// Enlace con parametros (sin vacios).
export function linkTo(path, params) {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
  const s = q.toString()
  return s ? `${path}?${s}` : path
}

export const TONES = {
  blue: {
    tile: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
    tag: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    arrow:
      'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25',
  },
  green: {
    tile: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    tag: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    arrow:
      'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25',
  },
  orange: {
    tile: 'bg-orange-50 text-orange-500 dark:bg-orange-500/15 dark:text-orange-300',
    tag: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    arrow:
      'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25',
  },
  violet: {
    tile: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    tag: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    arrow:
      'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25',
  },
}

// Marco de tarjeta: encabezado (todo el encabezado abre el reporte completo), cuerpo con controles y contenido.
export function ReportCard({ tone, icon: Icon, tag, title, subtitle, to, loading, children }) {
  const t = TONES[tone]
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
      <Link
        to={to}
        className="group flex items-start gap-3.5 border-b px-4 py-4 outline-none transition hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 sm:px-5"
      >
        <span
          className={cn(
            'grid h-12 w-12 shrink-0 place-items-center rounded-2xl sm:h-[52px] sm:w-[52px]',
            t.tile,
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'inline-block rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide',
              t.tag,
            )}
          >
            {tag}
          </span>
          <span className="mt-1 flex items-center gap-2 text-[19px] font-extrabold leading-tight tracking-tight">
            {title}
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Actualizando" />
            )}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">{subtitle}</span>
        </span>
        <span
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-full transition group-hover:translate-x-0.5 motion-reduce:transition-none',
            t.arrow,
          )}
          aria-hidden="true"
        >
          <ChevronRight className="h-5 w-5" />
        </span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">{children}</div>
    </section>
  )
}

// Estados de una tarjeta: error con reintento, o "sin datos".
export function CardError({ error, onRetry }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-red-300 bg-red-50/50 px-4 py-6 text-center dark:border-red-500/30 dark:bg-red-500/[0.06]">
      <p className="text-[13.5px] font-semibold text-red-700 dark:text-red-300">
        No se pudo consultar este reporte.
      </p>
      <p className="text-[12px] text-muted-foreground">{error?.message || 'Error de servidor'}</p>
      <button
        type="button"
        onClick={() => onRetry()}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted"
      >
        <RotateCw className="h-3.5 w-3.5" /> Reintentar
      </button>
    </div>
  )
}

export function NoData({ children = 'Sin datos para el periodo seleccionado' }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">
      {children}
    </div>
  )
}

export function CardSkeleton({ className = 'h-48' }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted/70', className)} />
}

// Segmentado compacto (Dia / Semana / Mes, 14 dias / 30 dias / Todo).
export function MiniSegmented({ value, onChange, options, label }) {
  return (
    <fieldset
      aria-label={label}
      className="inline-flex max-w-full shrink-0 overflow-x-auto rounded-xl bg-muted p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'whitespace-nowrap rounded-lg px-2.5 py-1 text-[12.5px] font-semibold transition',
            value === o.value
              ? o.strong
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  )
}

// Fecha / rango con flechas. El calendario es un <input type="date"> invisible encima de la etiqueta: en cualquier
// modo se elige un dia y el periodo es el que lo contiene.
export function PeriodNav({ mode, anchor, onChange, today, label }) {
  const input = useRef(null)
  const next = stepAnchor(mode, anchor, 1)
  const canNext = periodRange(mode, next).from <= today
  const nextAnchor = next > today ? today : next
  return (
    <div className="inline-flex h-9 shrink-0 items-center rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => onChange(stepAnchor(mode, anchor, -1))}
        aria-label="Periodo anterior"
        className="grid h-full w-8 place-items-center rounded-l-xl text-foreground hover:bg-muted"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <label className="relative flex h-full cursor-pointer items-center gap-1.5 border-x px-2.5 text-[12.5px] font-semibold hover:bg-muted">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="whitespace-nowrap">{label || periodLabel(mode, anchor)}</span>
        <input
          ref={input}
          type="date"
          value={anchor}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={() => {
            try {
              input.current?.showPicker?.()
            } catch {
              /* navegador sin showPicker */
            }
          }}
          aria-label="Elegir fecha"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <button
        type="button"
        onClick={() => canNext && onChange(nextAnchor)}
        disabled={!canNext}
        aria-label="Periodo siguiente"
        className="grid h-full w-8 place-items-center rounded-r-xl text-foreground hover:bg-muted disabled:opacity-35"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export function MiniSelect({ value, onChange, options, label, className }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn(
        'h-9 min-w-[84px] shrink-0 appearance-none rounded-xl border bg-card bg-[length:14px] bg-[position:right_10px_center] bg-no-repeat pl-3 pr-8 text-[12.5px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Controls({ children }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

export const MODE_OPTIONS = [
  { value: 'dia', label: 'Día', strong: true },
  { value: 'semana', label: 'Semana', strong: true },
  { value: 'mes', label: 'Mes', strong: true },
]

// Marcas reales del catalogo (respaldo HY / SILO si aun no carga).
export function useBrandOptions() {
  const { brands } = useCatalogs()
  const codes = brands.length ? brands.map((b) => b.code) : ['HY', 'SILO']
  return [{ value: '', label: 'Todas' }, ...codes.map((c) => ({ value: c, label: c }))]
}

// Modelos con produccion real de la marca elegida (Todas = cualquier modelo producido). Sale del mismo reporte
// por modelo (models[].brands = piezas por marca); una sola consulta compartida por las tarjetas.
let modelsCache = null
export function useModelOptions(brand) {
  const [data, setData] = useState(modelsCache?.data || null)
  useEffect(() => {
    if (!modelsCache || Date.now() - modelsCache.at > 120000) {
      const p = api('/reports/models').then((d) => {
        modelsCache = { data: d, at: Date.now(), p: null }
        return d
      })
      modelsCache = { ...(modelsCache || {}), at: Date.now(), p }
    }
    let alive = true
    const p = modelsCache.p || Promise.resolve(modelsCache.data)
    p.then((d) => alive && setData(d)).catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const list = (data?.models || []).filter((m) => (brand ? m.brands?.[brand] > 0 : m.produced > 0))
  return [{ value: '', label: 'Todos' }, ...list.map((m) => ({ value: m.code, label: m.code }))]
}

// Indicador pequeno (Total plan / Total real / Delta).
export function Metric({ label, value, unit = 'piezas', extra, className }) {
  return (
    <div className={cn('min-w-0 px-3 py-2.5 sm:px-4', className)}>
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="tabular text-[24px] font-extrabold leading-tight tracking-tight">{value}</span>
        {extra}
      </div>
      {unit && <p className="text-[11.5px] text-muted-foreground">{unit}</p>}
    </div>
  )
}

export function Pct({ value, className }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const up = value >= 0
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-0.5 text-[13px] font-bold',
        up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        className,
      )}
    >
      {up ? '▲' : '▼'} {up ? '+' : '−'}
      {Math.abs(value * 100).toFixed(1)}%
    </span>
  )
}

export const fmtSigned = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtInt(Math.abs(n))}`
