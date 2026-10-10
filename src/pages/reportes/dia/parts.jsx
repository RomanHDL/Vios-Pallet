// Piezas visuales del Reporte del dia: indicador compacto, gauge de cumplimiento, linea de tiempo de turnos.

import { shiftLabel } from '@shared/shift.js'
import { CheckCircle2, CircleDashed, Clock3, Minus } from 'lucide-react'
import { cn, fmtInt, fmtYmd } from '@/lib/utils'

export function Kpi({ icon: Icon, label, children, hint, className }) {
  return (
    <div className={cn('min-w-0 rounded-xl border bg-card px-3.5 py-3', className)}>
      <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </p>
      <div className="tabular mt-1 text-[28px] font-extrabold leading-tight tracking-tight">{children}</div>
      {hint && <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

// Medio circulo de cumplimiento (0 a 100%+, el arco se llena hasta 100%).
export function Gauge({ value, size = 104 }) {
  const pct = value === null || value === undefined ? null : value
  const f = Math.max(0, Math.min(1, pct || 0))
  const r = 40
  const len = Math.PI * r
  return (
    <svg viewBox="0 0 100 58" width={size} height={size * 0.58} aria-hidden="true" className="block">
      <path
        d="M10 50 A40 40 0 0 1 90 50"
        fill="none"
        strokeWidth="9"
        strokeLinecap="round"
        className="stroke-muted"
      />
      {pct !== null && (
        <path
          d="M10 50 A40 40 0 0 1 90 50"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${len * f} ${len}`}
          className={cn(
            'transition-all duration-700',
            pct >= 1 ? 'stroke-emerald-500' : 'stroke-blue-600 dark:stroke-blue-400',
          )}
        />
      )}
    </svg>
  )
}

export const STATUS = {
  current: {
    label: 'En curso',
    cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    icon: Clock3,
  },
  done: {
    label: 'Completado',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  data: {
    label: 'Con información',
    cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    icon: CheckCircle2,
  },
  pending: { label: 'Pendiente', cls: 'bg-muted text-muted-foreground', icon: CircleDashed },
  none: { label: 'Sin datos', cls: 'bg-muted text-muted-foreground', icon: Minus },
}

// Linea de tiempo vertical: turnos agrupados por fecha (si hay varias).
export function ShiftTimeline({ items, selected, onSelect, multiDay }) {
  let lastDate = null
  return (
    <ol className="relative">
      {items.map((it, i) => {
        const on = it.key === selected
        const st = STATUS[it.status]
        const header = multiDay && it.date !== lastDate
        lastDate = it.date
        const last = i === items.length - 1
        return (
          <li key={it.key}>
            {header && (
              <p className="mb-1.5 mt-2 pl-9 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground first:mt-0">
                {fmtYmd(it.date)}
              </p>
            )}
            <button
              type="button"
              onClick={() => onSelect(it.key)}
              aria-pressed={on}
              className={cn(
                'group relative flex w-full items-start gap-3 rounded-xl py-2 pl-1 pr-2 text-left outline-none transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/40',
                on && 'bg-blue-50/60 dark:bg-blue-500/10',
              )}
            >
              {!last && (
                <span
                  className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-0.5 bg-border"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  'relative z-10 mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 bg-card ml-[4px]',
                  on
                    ? 'border-blue-600 dark:border-blue-400'
                    : it.status === 'none' || it.status === 'pending'
                      ? 'border-muted-foreground/40'
                      : 'border-blue-300 dark:border-blue-500/60',
                )}
              >
                {on && <span className="h-3 w-3 rounded-full bg-blue-600 dark:bg-blue-400" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-[14.5px] font-bold', on && 'text-blue-700 dark:text-blue-300')}>
                    {shiftLabel(it.shift)}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      st.cls,
                    )}
                  >
                    {st.label}
                  </span>
                </span>
                <span className="block text-[12.5px] text-muted-foreground">
                  {multiDay ? '' : `${fmtYmd(it.date)} · `}
                  {it.row ? `${fmtInt(it.row.processed)} de ${fmtInt(it.row.plan)} pzs` : it.range}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
