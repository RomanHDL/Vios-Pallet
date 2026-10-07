// Componentes base de la interfaz (estilo shadcn, sin dependencias extra).
import { Loader2, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const BTN = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary: 'bg-accent text-accent-foreground hover:bg-accent/70',
  outline: 'border border-input bg-card hover:bg-muted',
  ghost: 'hover:bg-muted',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
}
const BTN_SIZE = {
  sm: 'h-9 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-11 px-4 text-[14.5px] rounded-xl gap-2',
  lg: 'h-14 px-5 text-[16px] rounded-2xl gap-2.5',
  icon: 'h-10 w-10 rounded-xl',
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...p }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25',
        BTN[variant],
        BTN_SIZE[size],
        className,
      )}
      {...p}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className, children, ...p }) {
  return (
    <div className={cn('card', className)} {...p}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, icon: Icon, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold leading-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-[12px] text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-[12px] font-medium text-red-600">{error}</span>}
    </label>
  )
}

export function Input({ className, ...p }) {
  return <input className={cn('field', className)} {...p} />
}

export function Select({ className, children, ...p }) {
  return (
    <select className={cn('field appearance-none bg-[length:16px] pr-9', className)} style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
    }} {...p}>
      {children}
    </select>
  )
}

const BADGE = {
  gray: 'bg-muted text-muted-foreground',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/10 dark:text-blue-300',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300',
}
export function Badge({ tone = 'gray', dot, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset ring-transparent',
        BADGE[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

const STAT_TONE = {
  default: 'text-foreground',
  blue: 'text-blue-700 dark:text-blue-300',
  green: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  red: 'text-red-700 dark:text-red-300',
  violet: 'text-violet-700 dark:text-violet-300',
}
export function Stat({ label, value, hint, tone = 'default', icon: Icon, className }) {
  return (
    <div className={cn('card p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon && <Icon className={cn('h-4 w-4', STAT_TONE[tone])} />}
      </div>
      <div className={cn('tabular mt-1.5 text-[28px] font-extrabold leading-none tracking-tight', STAT_TONE[tone])}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[12.5px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function Progress({ value, tone = 'primary', className }) {
  const pct = Math.max(0, Math.min(100, (value || 0) * 100))
  const color = {
    primary: 'bg-primary',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }[tone]
  return (
    <div className={cn('h-2.5 overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// Selector segmentado (Hoy / Semana / Rango, HY / SILO...).
export function Segmented({ value, onChange, options, className, size = 'md' }) {
  return (
    <div className={cn('inline-flex max-w-full overflow-x-auto rounded-xl bg-muted p-1', className)}>
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o
        const l = typeof o === 'object' ? o.label : o
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'whitespace-nowrap rounded-lg font-semibold transition',
              size === 'sm' ? 'px-2.5 py-1 text-[12.5px]' : 'px-3.5 py-1.5 text-[13.5px]',
              value === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

export function Spinner({ className }) {
  return (
    <div className={cn('grid place-items-center py-16 text-muted-foreground', className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

export function Empty({ icon: Icon, title, children, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <p className="text-[15px] font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[13.5px] text-muted-foreground">{children}</div>}
    </div>
  )
}

export function ErrorBox({ error, className }) {
  if (!error) return null
  return (
    <div className={cn('rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300', className)}>
      {error.message || String(error)}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-[22px] font-extrabold tracking-tight sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// Dialogo modal sencillo (hoja inferior en celular, centrado en PC).
export function Dialog({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div data-dialog-open className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cn('animate-pop flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

// Avisos flotantes.
const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message, tone = 'ok') => {
    const id = Math.random()
    setItems((x) => [...x, { id, message, tone }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'animate-pop pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg',
              t.tone === 'error' ? 'bg-red-600' : t.tone === 'warn' ? 'bg-amber-600' : 'bg-slate-900 dark:bg-slate-700',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// Tabla responsiva: en celular se desplaza horizontalmente dentro de la tarjeta.
export function Table({ className, children }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[560px] text-left text-[13.5px]">{children}</table>
    </div>
  )
}
export const Th = ({ className, children, ...p }) => (
  <th className={cn('whitespace-nowrap border-b bg-muted/50 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground', className)} {...p}>
    {children}
  </th>
)
export const Td = ({ className, children, ...p }) => (
  <td className={cn('border-b px-4 py-3 align-middle', className)} {...p}>
    {children}
  </td>
)
