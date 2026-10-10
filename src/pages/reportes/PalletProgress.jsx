// Progreso visual de pallets: una tarima por salida iniciada, con prioridad a los pendientes.
// - Pendientes (todo lo que no esta consolidado) van primero, de menor a mayor avance, y no se ocultan.
// - Si caben, se quedan fijos y solo rotan los consolidados en los lugares que sobran.
// - Si hay mas pendientes que lugares, rotan solo los pendientes.
// Rota cada 10 s (se puede pausar); los datos se refrescan sin reiniciar la rotacion.
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Layers,
  Pause,
  Pin,
  Play,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Empty } from '@/components/ui'
import { cn, fmtInt } from '@/lib/utils'
import { PalletStack } from './PalletStack'
import { buildView, isPending, orderPallets, rangesText } from './palletView'

export const ROTATE_MS = 10000
const MAX_SLOTS = 7
const CARD_MIN = 158
const GAP = 12

// Lugares visibles segun el ancho (maximo 7; las tarjetas no se encogen de mas).
function useSlots() {
  const ref = useRef(null)
  const [slots, setSlots] = useState(MAX_SLOTS)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const calc = () => {
      const w = el.clientWidth
      setSlots(Math.max(1, Math.min(MAX_SLOTS, Math.floor((w + GAP) / (CARD_MIN + GAP)))))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, slots]
}

const STATE_UI = {
  escaneando: {
    label: 'Escaneando entrada',
    icon: Clock3,
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    bar: 'bg-blue-500',
    pct: 'text-blue-600 dark:text-blue-400',
  },
  sin_salida: {
    label: 'Sin salida',
    icon: TriangleAlert,
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    bar: 'bg-amber-500',
    pct: 'text-amber-600 dark:text-amber-400',
  },
  en_proceso: {
    label: 'En proceso',
    icon: Clock3,
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    bar: 'bg-gradient-to-r from-violet-600 to-blue-600',
    pct: 'text-violet-700 dark:text-violet-300',
  },
  sin_iniciar: {
    label: 'Sin iniciar',
    icon: Clock3,
    chip: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
    bar: 'bg-slate-400',
    pct: 'text-slate-500 dark:text-slate-400',
  },
  con_faltantes: {
    label: 'Con faltantes',
    icon: TriangleAlert,
    chip: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    bar: 'bg-red-500',
    pct: 'text-red-600 dark:text-red-400',
  },
  consolidado: {
    label: 'Consolidado',
    icon: CheckCircle2,
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    bar: 'bg-emerald-600',
    pct: 'text-emerald-600 dark:text-emerald-400',
  },
}

const fmtDay = (iso) =>
  new Date(iso)
    .toLocaleDateString('es-MX', { timeZone: 'America/Monterrey', day: '2-digit', month: 'short' })
    .replace('.', '')

function uiState(p) {
  if (p.state === 'en_proceso' && p.valid_out === 0) return 'sin_iniciar'
  return STATE_UI[p.state] ? p.state : 'en_proceso'
}

export function PalletCard({ p, fixed }) {
  const key = uiState(p)
  const s = STATE_UI[key]
  const pending = isPending(p)
  const pct = Math.round(Math.max(0, Math.min(1, p.progress)) * 100)
  const Icon = s.icon
  return (
    <Link
      to={`/pallets/${p.salida_id || p.id}`}
      className={cn(
        'pallet-card group flex min-w-0 flex-col rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md',
        pending
          ? key === 'con_faltantes'
            ? 'border-red-200 bg-red-50/40 dark:border-red-500/30 dark:bg-red-500/[0.06]'
            : 'border-violet-200 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/[0.07]'
          : 'border-border bg-card',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate font-mono text-[14.5px] font-extrabold tracking-tight">#{p.id}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {p.model} · {p.brand}
          </p>
          {p.carried && (
            <p className="truncate text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">
              Pendiente desde el {fmtDay(p.created_at)}
            </p>
          )}
        </div>
        {pending && (
          <Pin className="mt-0.5 h-4 w-4 shrink-0 fill-current text-violet-600 dark:text-violet-400" />
        )}
      </div>
      <div className="mt-1.5 h-[22px]">
        {pending && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            <Clock3 className="h-3 w-3" /> {fixed ? 'Siempre visible' : 'Prioridad'}
          </span>
        )}
      </div>
      <PalletStack
        progress={p.progress}
        model={p.model}
        className="mx-auto mt-1 aspect-[150/156] w-full max-w-[150px]"
      />
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
        <div
          className={cn('h-full rounded-full transition-[width] duration-700', s.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          'mx-auto mt-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
          s.chip,
        )}
      >
        <Icon className="h-3.5 w-3.5" /> {s.label}
      </span>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="tabular text-[14px] font-bold">
          {fmtInt(p.valid_out)}{' '}
          <span className="font-medium text-muted-foreground">/ {fmtInt(p.expected)}</span>
        </span>
        <span className={cn('tabular text-[14px] font-extrabold', s.pct)}>{pct}%</span>
      </div>
    </Link>
  )
}

export function PalletProgress({ pallets }) {
  const [ref, slots] = useSlots()
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const { pending, done } = useMemo(() => orderPallets(pallets || []), [pallets])
  const total = pending.length + done.length
  const view = buildView(pending, done, slots, page)

  const step = useCallback((d) => setPage((x) => x + d), [])
  // Un solo timer; los datos nuevos no lo reinician (solo pausar o que deje de hacer falta rotar).
  useEffect(() => {
    if (paused || !view.rotating) return
    const t = setInterval(() => step(1), ROTATE_MS)
    return () => clearInterval(t)
  }, [paused, view.rotating, step])

  return (
    <Card className="overflow-hidden">
      <style>{`@keyframes palletIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.pallet-card{animation:palletIn .45s ease both}@media (prefers-reduced-motion: reduce){.pallet-card{animation:none}}`}</style>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b px-4 py-3.5 sm:px-5">
        <div className="flex min-w-[min(100%,440px)] flex-1 items-start gap-3">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Layers className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[18px] font-extrabold leading-tight tracking-tight">
              Progreso visual de pallets
            </h3>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Los pallets pendientes siempre permanecen visibles. Los consolidados rotan automáticamente
              cuando existen más de {slots} pallets.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-[12px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            <Pin className="h-3.5 w-3.5 fill-current" /> Prioridad a pallets pendientes
          </span>
          {total > 0 && (
            <span className="tabular text-[12.5px] text-muted-foreground">
              Mostrando {rangesText(view.cards.map((c) => c.index))} de {fmtInt(total)}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={!view.rotating}
              aria-label="Anteriores"
              className="grid h-9 w-9 place-items-center rounded-xl border bg-card text-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={!view.rotating}
              aria-label="Siguientes"
              className="grid h-9 w-9 place-items-center rounded-xl border bg-card text-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setPaused((x) => !x)}
            disabled={!view.rotating}
            className="flex items-center gap-2 rounded-xl px-1.5 py-1 text-left transition hover:bg-muted disabled:opacity-50"
            aria-label={paused ? 'Reanudar rotación' : 'Pausar rotación'}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400">
              {paused || !view.rotating ? (
                <Play className="h-4 w-4 fill-current" />
              ) : (
                <Pause className="h-4 w-4 fill-current" />
              )}
            </span>
            <span className="leading-tight">
              <span className="block text-[11.5px] text-muted-foreground">Rotación automática</span>
              <span className="block text-[13px] font-bold">
                {!view.rotating ? 'No hace falta' : paused ? 'En pausa' : `${ROTATE_MS / 1000} s`}
              </span>
            </span>
          </button>
        </div>
      </div>
      <div ref={ref} className="p-3 sm:p-4">
        {total ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
            {view.cards.map((c) => (
              <PalletCard key={c.pallet.id} p={c.pallet} fixed={c.fixed} />
            ))}
          </div>
        ) : (
          <Empty icon={Layers} title="Sin pallets en este periodo">
            Los pallets pendientes de cualquier día aparecen aquí hasta que se cierran.
          </Empty>
        )}
      </div>
    </Card>
  )
}
