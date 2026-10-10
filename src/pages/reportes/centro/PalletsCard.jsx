// Tarjeta "Dashboard de pallets": las mismas tarimas (PalletCard + PalletStack) y la misma prioridad / rotacion
// (orderPallets + buildView, 10 s) que el Dashboard de pallets completo, con datos de /reports/pallets. La busqueda de
// serial usa el mismo /pallets/find del dashboard.

import { shiftOf } from '@shared/shift.js'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  History,
  ListChecks,
  Package,
  ScanSearch,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt } from '@/lib/utils'
import { PalletCard, ROTATE_MS } from '../PalletProgress'
import { buildView, orderPallets } from '../palletView'
import { queryRange } from '../period'
import {
  CardError,
  CardSkeleton,
  Controls,
  linkTo,
  MiniSegmented,
  MiniSelect,
  MODE_OPTIONS,
  NoData,
  PeriodNav,
  ReportCard,
  useBrandOptions,
  useCardState,
  useModelOptions,
} from './shell'

const MAX = 3
const CARD_MIN = 140
const GAP = 10

function useSlots() {
  const ref = useRef(null)
  const [slots, setSlots] = useState(MAX)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const calc = () =>
      setSlots(Math.max(1, Math.min(MAX, Math.floor((el.clientWidth + GAP) / (CARD_MIN + GAP)))))
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, slots]
}

function SerialBox({ q, setQ }) {
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const search = async (e) => {
    e.preventDefault()
    const code = q.trim()
    if (!code) return
    setBusy(true)
    setErr(null)
    try {
      setRes(await api(`/pallets/find/${encodeURIComponent(code)}`))
    } catch (e2) {
      setErr(e2)
      setRes(null)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <form
        onSubmit={search}
        className="flex h-10 overflow-hidden rounded-xl border bg-card focus-within:ring-2 focus-within:ring-primary/30"
      >
        <span className="grid w-9 place-items-center text-muted-foreground">
          <Search className="h-4 w-4" />
        </span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setRes(null)
          }}
          placeholder="Ingresa un número de serial"
          aria-label="Serial"
          autoCapitalize="characters"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="shrink-0 bg-primary px-4 text-[13px] font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      {err && (
        <p className="mt-1.5 text-[12px] font-semibold text-red-600 dark:text-red-400">{err.message}</p>
      )}
      {res && (
        <div className="mt-2 overflow-hidden rounded-xl border">
          {res.matches.length ? (
            <ul className="divide-y">
              {res.matches.slice(0, 3).map((m) => (
                <li key={m.pallet_id}>
                  <Link
                    to={`/pallets/${m.pallet_id}`}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50"
                  >
                    {m.type === 'salida' ? (
                      <ArrowUpFromLine className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                    ) : (
                      <ArrowDownToLine className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                    )}
                    <span className="font-mono text-[13px] font-bold">{m.pallet_id}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                      {m.type === 'salida' ? 'Salida' : 'Entrada'} · {m.model || '—'} {m.brand || ''} ·{' '}
                      {m.status === 'abierto' ? 'Abierto' : 'Cerrado'}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-[12.5px] text-muted-foreground">
              El serial <b className="font-mono text-foreground">{res.code}</b> no está en ningún pallet.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function PalletsCard({ onUpdate }) {
  const today = shiftOf().shiftDate
  const [f, set] = useCardState('pallets', { mode: 'dia', anchor: today, brand: '', model: '' })
  const [q, setQ] = useState('')
  const brands = useBrandOptions()
  const models = useModelOptions(f.brand)
  const { from, to } = queryRange(f.mode, f.anchor, today)
  const { data, error, loading, reload } = useApi('/reports/pallets', {
    query: { from, to, brand: f.brand },
    refreshMs: to >= today ? 30000 : undefined,
  })
  useEffect(() => {
    if (data) onUpdate?.()
  }, [data, onUpdate])
  useEffect(() => {
    if (f.model && models.length > 1 && !models.some((m) => m.value === f.model)) set({ model: '' })
  }, [f.model, models, set])

  const list = useMemo(
    () => (data?.pallets || []).filter((p) => !f.model || p.model === f.model),
    [data, f.model],
  )
  const [ref, slots] = useSlots()
  const [page, setPage] = useState(0)
  const { pending, done } = useMemo(() => orderPallets(list), [list])
  const view = buildView(pending, done, slots, page)
  const step = useCallback(() => setPage((x) => x + 1), [])
  useEffect(() => {
    if (!view.rotating) return
    const t = setInterval(step, ROTATE_MS)
    return () => clearInterval(t)
  }, [view.rotating, step])

  const total = pending.length + done.length

  return (
    <ReportCard
      tone="violet"
      icon={Package}
      tag="Trazabilidad"
      title="Dashboard de pallets"
      subtitle="Entrada → salida, faltantes y búsqueda de serial."
      to={linkTo('/reportes/pallets', { from, to, brand: f.brand, model: f.model })}
      loading={loading && Boolean(data)}
    >
      <style>{`@keyframes palletIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.pallet-card{animation:palletIn .45s ease both}@media (prefers-reduced-motion: reduce){.pallet-card{animation:none}}`}</style>
      <Controls>
        <MiniSegmented
          label="Periodo"
          value={f.mode}
          onChange={(mode) => set({ mode })}
          options={MODE_OPTIONS}
        />
        <PeriodNav mode={f.mode} anchor={f.anchor} today={today} onChange={(anchor) => set({ anchor })} />
        <MiniSelect label="Marca" value={f.brand} onChange={(brand) => set({ brand })} options={brands} />
        <MiniSelect label="Modelo" value={f.model} onChange={(model) => set({ model })} options={models} />
      </Controls>

      <div ref={ref} className="min-w-0">
        {error && !data ? (
          <CardError error={error} onRetry={reload} />
        ) : !data ? (
          <CardSkeleton className="h-[300px]" />
        ) : !total ? (
          <NoData>Sin pallets para el periodo seleccionado</NoData>
        ) : (
          <>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
              {view.cards.map((c) => (
                <PalletCard key={c.pallet.id} p={c.pallet} fixed={c.fixed} />
              ))}
            </div>
            <p className="mt-2 text-center text-[11.5px] text-muted-foreground">
              {fmtInt(pending.length)} pendiente{pending.length === 1 ? '' : 's'} · {fmtInt(total)} pallet
              {total === 1 ? '' : 's'}
              {view.rotating ? ` · rota cada ${ROTATE_MS / 1000} s` : ''}
            </p>
          </>
        )}
      </div>

      <div className="mt-auto space-y-2.5">
        <SerialBox q={q} setQ={setQ} />
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              icon: ScanSearch,
              label: 'Buscar serial',
              to: linkTo('/reportes/pallets', { from, to, brand: f.brand, q: q.trim() }),
            },
            {
              icon: ListChecks,
              label: 'Ver faltantes',
              to: linkTo('/reportes/pallets', { from, to, brand: f.brand, estado: 'con_faltantes' }),
            },
            { icon: History, label: 'Trazabilidad completa', to: '/pallets/historial' },
          ].map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className={cn(
                'flex min-h-10 items-center justify-center gap-1.5 rounded-xl border bg-card px-2 py-1.5 text-center text-[12px] font-semibold leading-tight text-foreground transition hover:bg-muted',
              )}
            >
              <a.icon className="h-4 w-4 shrink-0 text-primary" />
              <span>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </ReportCard>
  )
}
