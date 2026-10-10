// Piezas compartidas por los reportes (y admin): enlace de regreso, selector de periodo y marca.

import { addDays, todayPlant } from '@shared/shift.js'
import { ChevronLeft, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Input, Segmented } from '@/components/ui'
import { useCatalogs } from '@/lib/session'
import { cn, fmtInt, fmtYmd } from '@/lib/utils'

export function BackLink({ to, label }) {
  return (
    <Link
      to={to}
      className="no-print mb-1 inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </Link>
  )
}

const PERIOD_LABEL = { hoy: 'Hoy', ayer: 'Ayer', semana: 'Semana', rango: 'Rango' }

// Periodo de consulta: hoy / ayer / ultimos 7 dias / rango libre. Fechas en YYYY-MM-DD (planta).
// Si la URL trae ?from=&to= (Centro de reportes), arranca con ese periodo.
export function usePeriod(initial = 'hoy') {
  const today = todayPlant()
  const [params] = useSearchParams()
  const [start] = useState(() => {
    const from = params.get('from')
    const to = params.get('to')
    const ymd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '')
    if (!ymd(from) || !ymd(to)) return null
    if (from === today && to === today) return { period: 'hoy' }
    const y = addDays(today, -1)
    if (from === y && to === y) return { period: 'ayer' }
    return { period: 'rango', custom: { from, to } }
  })
  const [period, setPeriod] = useState(start?.period || initial)
  const [custom, setCustom] = useState(start?.custom || { from: addDays(today, -6), to: today })
  const { from, to } = useMemo(() => {
    if (period === 'hoy') return { from: today, to: today }
    if (period === 'ayer') return { from: addDays(today, -1), to: addDays(today, -1) }
    if (period === 'semana') return { from: addDays(today, -6), to: today }
    const a = custom.from || today
    const b = custom.to || today
    return a <= b ? { from: a, to: b } : { from: b, to: a }
  }, [period, custom, today])
  return { period, setPeriod, from, to, today, custom, setCustom, isToday: to === today }
}

export function PeriodControls({ p, options = ['hoy', 'ayer', 'semana', 'rango'], className }) {
  return (
    <div className={cn('flex flex-wrap items-end gap-2', className)}>
      <Segmented
        value={p.period}
        onChange={p.setPeriod}
        options={options.map((o) => ({ value: o, label: PERIOD_LABEL[o] }))}
      />
      {p.period === 'rango' && (
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            type="date"
            aria-label="Desde"
            value={p.custom.from}
            max={p.today}
            onChange={(e) => p.setCustom((c) => ({ ...c, from: e.target.value }))}
            className="h-10 min-w-0 flex-1 text-[14px] sm:w-40"
          />
          <span className="text-[13px] text-muted-foreground">a</span>
          <Input
            type="date"
            aria-label="Hasta"
            value={p.custom.to}
            max={p.today}
            onChange={(e) => p.setCustom((c) => ({ ...c, to: e.target.value }))}
            className="h-10 min-w-0 flex-1 text-[14px] sm:w-40"
          />
        </div>
      )}
    </div>
  )
}

export function periodText(from, to) {
  return from === to ? fmtYmd(from) : `${fmtYmd(from)} – ${fmtYmd(to)}`
}

// Marcas activas del catalogo (respaldo HY / SILO si aun no carga).
export function BrandControl({ value, onChange }) {
  const { brands } = useCatalogs()
  const codes = brands.length ? brands.map((b) => b.code) : ['HY', 'SILO']
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[{ value: '', label: 'Todos' }, ...codes.map((c) => ({ value: c, label: c }))]}
    />
  )
}

// Diferencia con signo y color: + verde, - rojo.
export function Delta({ value, className }) {
  if (value === null || value === undefined) return <span className={className}>—</span>
  const tone =
    value > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : value < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground'
  return (
    <span className={cn('tabular font-bold', tone, className)}>
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {fmtInt(Math.abs(value))}
    </span>
  )
}

export const pctTone = (pct) =>
  pct === null || pct === undefined ? 'primary' : pct >= 1 ? 'green' : pct >= 0.85 ? 'amber' : 'red'

// Valor inicial desde la URL (?brand=HY...), para abrir un reporte con los filtros del Centro de reportes.
export function useUrlInit(key, fallback = '') {
  const [params] = useSearchParams()
  return params.get(key) ?? fallback
}

// Filtro que llego por la URL y que el reporte no tiene como control propio (modelo, turno): se puede quitar.
export function FilterChip({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-[12.5px] font-semibold text-primary">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Quitar ${label}`}
        className="grid h-5 w-5 place-items-center rounded-full hover:bg-primary/15"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}
