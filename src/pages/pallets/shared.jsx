// Piezas compartidas por las pantallas de Pallets.
import { ChevronLeft, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Stat } from '@/components/ui'
import { cn, feedback, fmtInt } from '@/lib/utils'

export const PALLET_ID = /^\d{6}$/

// El API mezcla snake_case (SQL crudo) y camelCase (drizzle): se normaliza a un solo formato.
export function normPallet(p) {
  if (!p) return null
  const g = (camel, snake) => p[camel] ?? p[snake] ?? null
  const itemCount = g('itemCount', 'item_count') ?? 0
  return {
    id: p.id,
    type: p.type,
    status: p.status,
    model: p.model,
    brand: p.brand,
    linkedPalletId: g('linkedPalletId', 'linked_pallet_id'),
    expected: g('expectedItemCount', 'expected_item_count'),
    itemCount,
    liveCount: p.live_count ?? itemCount,
    missingCount: g('missingCount', 'missing_count') ?? 0,
    extrasCount: g('extrasCount', 'extras_count') ?? 0,
    createdAt: g('createdAt', 'created_at'),
    closedAt: g('closedAt', 'closed_at'),
    createdByName: p.created_by_name ?? null,
    closedByName: p.closed_by_name ?? null,
  }
}

export const isOpen = (p) => p?.status === 'abierto'

// Ruta para seguir escaneando un pallet abierto.
export const resumePath = (p) =>
  p.type === 'salida' ? `/pallets/salida?id=${p.linkedPalletId || p.id.replace(/-S$/, '')}` : `/pallets/entrada?id=${p.id}`

export function BackLink({ to = '/pallets', label = 'Pallets' }) {
  return (
    <Link to={to} className="no-print -ml-1 mb-1 inline-flex h-8 items-center gap-0.5 rounded-lg pr-2 text-[13.5px] font-semibold text-muted-foreground hover:text-foreground">
      <ChevronLeft className="h-4 w-4" />
      {label}
    </Link>
  )
}

export function TypeBadge({ type }) {
  return type === 'salida' ? <Badge tone="violet">Salida</Badge> : <Badge tone="blue">Entrada</Badge>
}

export function StatusBadge({ status }) {
  return status === 'abierto' ? (
    <Badge tone="amber" dot>
      Abierto
    </Badge>
  ) : (
    <Badge tone="green" dot>
      Cerrado
    </Badge>
  )
}

// Opciones grandes y faciles de tocar (modelo, marca, motivos).
export function ChipGroup({ options, value, onChange, className, size = 'lg' }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o
        const l = typeof o === 'object' ? o.label : o
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={active}
            className={cn(
              'select-none rounded-xl border-2 font-semibold transition active:scale-[.97]',
              size === 'lg' ? 'h-14 min-w-[84px] px-4 text-[16px]' : 'h-10 px-3 text-[13.5px]',
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-input bg-card text-foreground hover:border-primary/40 hover:bg-muted',
            )}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

// Contador grande del pallet.
export function BigCount({ value, label, of, tone = 'default' }) {
  return (
    <div className="text-center">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-end justify-center gap-1.5">
        <span
          className={cn(
            'tabular text-[56px] font-extrabold leading-none tracking-tight sm:text-[64px]',
            tone === 'green' && 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {value}
        </span>
        {of !== undefined && of !== null && <span className="tabular pb-2 text-[20px] font-bold text-muted-foreground">/ {of}</span>}
      </div>
    </div>
  )
}

// Buscador pequeno dentro de una lista.
export function SearchBox({ value, onChange, placeholder = 'Buscar serial', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field h-10 pl-9 font-mono text-[14px]"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}

// Resultado del ultimo escaneo + color del campo (se apaga solo).
export function useScanFeedback() {
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState(null)
  const timer = useRef(null)
  const show = useCallback((tone, title, detail) => {
    feedback(tone !== 'error')
    setResult({ tone, title, detail, at: Date.now() })
    setStatus(tone === 'error' ? 'error' : 'ok')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus(null), 1200)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const reset = useCallback(() => {
    setResult(null)
    setStatus(null)
  }, [])
  return { result, status, show, reset }
}

// Cola en serie: la pistola puede disparar varios codigos seguidos; se procesan en orden sin perder ninguno.
export function useSerialQueue() {
  const chain = useRef(Promise.resolve())
  const [pending, setPending] = useState(0)
  const enqueue = useCallback((fn) => {
    setPending((n) => n + 1)
    chain.current = chain.current
      .then(fn)
      .catch(() => {})
      .finally(() => setPending((n) => n - 1))
    return chain.current
  }, [])
  return { enqueue, pending }
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

// Fila de dato etiqueta/valor.
export function InfoRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="shrink-0 text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-[14px] font-semibold">{children}</dd>
    </div>
  )
}

export const MISSING_REASONS = ['Dañada', 'No llegó', 'Rechazo de calidad', 'Error de escaneo']

// Resumen de conciliacion entrada vs salida.
export function ReconSummary({ rec, className }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      <Stat label="Esperados" value={fmtInt(rec.expected)} />
      <Stat label="Confirmados" value={fmtInt(rec.confirmed.length)} tone="green" />
      <Stat label="Faltantes" value={fmtInt(rec.missing.length)} tone={rec.missing.length ? 'red' : 'default'} />
      <Stat label="Extras" value={fmtInt(rec.extras.length)} tone={rec.extras.length ? 'amber' : 'default'} />
    </div>
  )
}
