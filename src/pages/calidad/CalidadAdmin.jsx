// Calidad, vista de administrador (2026-10-10, diseno de referencia de Roman): indicadores, defectos frecuentes,
// Pareto 80/20 y rechazos recientes, con filtros de periodo, marca y modelo. Datos de GET /rejections (incluye el
// historico de la hoja MTY - VIOS/HY, marcado como "Histórico"). Rechazos = registros; el Pareto cuenta defectos.

import { addDays, shiftOf } from '@shared/shift.js'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardX,
  Filter,
  Layers,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Dialog, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { canDo, cn, fmtAgo, fmtDateTime, fmtInt, fmtYmd } from '@/lib/utils'
import { defectList } from '../produccion/common'
import { ParetoChart } from './ParetoChart'
import { computePareto } from './pareto'

const PRESETS = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: 'todo', label: 'Todo' },
]
const SOURCES = [
  { value: '', label: 'Todos los registros' },
  { value: 'vios', label: 'Registrados en VIOS' },
  { value: 'historico', label: 'Históricos (hoja)' },
  { value: 'prod', label: 'En producción' },
]

// Rango por fecha de turno (el Turno 2 despues de medianoche sigue siendo "hoy").
function rangeOf(preset, custom, today) {
  if (preset === 'hoy') return { from: today, to: today }
  if (preset === '7') return { from: addDays(today, -6), to: today }
  if (preset === '30') return { from: addDays(today, -29), to: today }
  if (preset === 'rango') return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
  return { from: undefined, to: undefined }
}
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1
const change = (cur, prev) => (prev > 0 ? (cur - prev) / prev : null)

function Select({ value, onChange, options, label, className }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn(
        'h-10 shrink-0 appearance-none rounded-xl border bg-card bg-[length:14px] bg-[position:right_10px_center] bg-no-repeat pl-3 pr-8 text-[13px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
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

function Trend({ value, label }) {
  if (value === null || value === undefined)
    return <span className="text-[11.5px] text-muted-foreground">{label}</span>
  const up = value >= 0
  return (
    <span className="text-right">
      <span
        className={cn(
          'tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold',
          up
            ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        )}
      >
        {up ? '↑' : '↓'} {Math.abs(value * 100).toFixed(0)}%
      </span>
      <span className="mt-1 block text-[11px] text-muted-foreground">{label}</span>
    </span>
  )
}

function Kpi({ icon: Icon, tone, label, value, sub, right, muted }) {
  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.14)]">
      <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl', tone)}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
        <p
          className={cn(
            'tabular truncate font-extrabold leading-tight tracking-tight',
            muted ? 'py-1 text-[20px] text-muted-foreground' : 'text-[28px]',
          )}
        >
          {value}
        </p>
        <p className="truncate text-[12px] text-muted-foreground">{sub}</p>
      </div>
      <div className="shrink-0 self-end">{right}</div>
    </div>
  )
}

function Panel({ icon: Icon, title, subtitle, action, children, className }) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.14)]',
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b px-4 py-3.5">
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold leading-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

function RangeButton({ from, to, onPick, today }) {
  const [open, setOpen] = useState(false)
  const [a, setA] = useState(from || addDays(today, -6))
  const [b, setB] = useState(to || today)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => !box.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-[13px] font-semibold hover:bg-muted"
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        {from
          ? from === to
            ? fmtYmd(from)
            : `${fmtYmd(from, { dow: false })} – ${fmtYmd(to, { dow: false })}`
          : 'Todo el historial'}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(92vw,300px)] space-y-3 rounded-xl border bg-card p-3 shadow-lg">
          <p className="text-[12.5px] font-bold">Rango de fechas (fecha de turno)</p>
          <label className="block text-[12px] text-muted-foreground">
            Desde
            <input
              type="date"
              value={a}
              max={today}
              onChange={(e) => setA(e.target.value)}
              className="field mt-1 h-10 text-[14px]"
            />
          </label>
          <label className="block text-[12px] text-muted-foreground">
            Hasta
            <input
              type="date"
              value={b}
              max={today}
              onChange={(e) => setB(e.target.value)}
              className="field mt-1 h-10 text-[14px]"
            />
          </label>
          <Button
            size="sm"
            className="w-full"
            disabled={!a || !b}
            onClick={() => {
              onPick(a <= b ? { from: a, to: b } : { from: b, to: a })
              setOpen(false)
            }}
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  )
}

export default function CalidadAdmin() {
  const { user } = useSession()
  const toast = useToast()
  const today = shiftOf().shiftDate
  const [preset, setPreset] = useState('todo')
  const [custom, setCustom] = useState({ from: addDays(today, -6), to: today })
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [, tick] = useState(0)

  const { from, to } = rangeOf(preset, custom, today)
  const cur = useApi('/rejections', { query: { from, to }, refreshMs: 60000 })
  // Periodo anterior del mismo largo (para las variaciones). "Todo" no tiene periodo anterior.
  const prevRange = from ? { from: addDays(from, -days(from, to)), to: addDays(from, -1) } : null
  const prev = useApi('/rejections', { query: prevRange || {}, skip: !prevRange })
  // Marcas y modelos reales: los que aparecen en todos los rechazos registrados.
  const all = useApi('/rejections', { refreshMs: 300000 })

  useEffect(() => {
    if (cur.data) setUpdatedAt(new Date().toISOString())
  }, [cur.data])
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const norm = (list) => (list || []).map((r) => ({ ...r, defects: defectList(r.defects) }))
  const match = (r) => (!brand || r.brand === brand) && (!model || r.model === model)
  const list = useMemo(() => norm(cur.data?.rejections).filter(match), [cur.data, brand, model])
  const prevList = useMemo(() => norm(prev.data?.rejections).filter(match), [prev.data, brand, model])
  const allList = useMemo(() => norm(all.data?.rejections), [all.data])

  const brands = useMemo(() => [...new Set(allList.map((r) => r.brand).filter(Boolean))].sort(), [allList])
  const models = useMemo(
    () =>
      [
        ...new Set(
          allList
            .filter((r) => !brand || r.brand === brand)
            .map((r) => r.model)
            .filter(Boolean),
        ),
      ].sort(),
    [allList, brand],
  )
  useEffect(() => {
    if (model && models.length && !models.includes(model)) setModel('')
  }, [model, models])

  const pareto = useMemo(() => computePareto(list), [list])
  const top = pareto.rows[0]
  const serials = new Set(list.map((r) => r.serial)).size
  const inProd = list.filter((r) => r.in_production).length
  const rejChange = prevRange && prev.data ? change(list.length, prevList.length) : null

  const s = search.trim().toUpperCase()
  const shown = list.filter(
    (r) =>
      (!source || (source === 'prod' ? r.in_production : r.source === source)) &&
      (!s ||
        r.serial.includes(s) ||
        String(r.model || '')
          .toUpperCase()
          .includes(s) ||
        r.defects.some((d) => d.toUpperCase().includes(s))),
  )

  const canAdd = canDo(user, ['calidad', 'supervisor'])
  const canDelete = canDo(user, ['supervisor'])

  const remove = async () => {
    setDeleting(true)
    try {
      await api(`/rejections/${toDelete.id}`, { method: 'DELETE' })
      toast('Rechazo eliminado')
      setToDelete(null)
      cur.reload(true)
      all.reload(true)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const loading = cur.loading && !cur.data

  return (
    <div className="space-y-4">
      {/* Encabezado + filtros */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">Calidad</h1>
            <p className="text-[13.5px] text-muted-foreground">
              Control de rechazos, defectos y trazabilidad de calidad
            </p>
          </div>
        </div>
        <div className="ml-auto flex min-w-0 flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {updatedAt ? `Actualizado ${fmtAgo(updatedAt)}` : 'Cargando…'}
            <button
              type="button"
              onClick={() => cur.reload()}
              aria-label="Actualizar"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCw className={cn('h-3.5 w-3.5', cur.loading && 'animate-spin')} />
            </button>
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <fieldset aria-label="Periodo" className="inline-flex rounded-xl bg-muted p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  aria-pressed={preset === p.value}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition',
                    preset === p.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </fieldset>
            <RangeButton
              from={from}
              to={to}
              today={today}
              onPick={(r) => {
                setCustom(r)
                setPreset('rango')
              }}
            />
            <Select
              label="Marca"
              value={brand}
              onChange={setBrand}
              options={[
                { value: '', label: 'Todas las marcas' },
                ...brands.map((b) => ({ value: b, label: b })),
              ]}
            />
            <Select
              label="Modelo"
              value={model}
              onChange={setModel}
              options={[
                { value: '', label: 'Todos los modelos' },
                ...models.map((m) => ({ value: m, label: m })),
              ]}
            />
            {canAdd && (
              <Link
                to="/calidad/nuevo"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[13.5px] font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> Nuevo rechazo
              </Link>
            )}
          </div>
        </div>
      </div>

      {cur.error && !cur.data ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-red-300 bg-red-50/50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/[0.06]">
          <p className="font-semibold text-red-700 dark:text-red-300">No se pudieron cargar los rechazos.</p>
          <p className="text-[12.5px] text-muted-foreground">{cur.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => cur.reload()}>
            <RotateCw className="h-4 w-4" /> Reintentar
          </Button>
        </div>
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={ClipboardX}
              tone="bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
              label="Rechazos"
              value={loading ? '…' : fmtInt(list.length)}
              sub={`${fmtInt(serials)} serial${serials === 1 ? '' : 'es'}`}
              right={
                prevRange ? (
                  <Trend
                    value={rejChange}
                    label={rejChange === null ? 'sin periodo anterior' : 'vs. periodo anterior'}
                  />
                ) : null
              }
            />
            <Kpi
              icon={Layers}
              tone="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
              label="En producción"
              value={loading ? '…' : fmtInt(inProd)}
              sub={
                list.length
                  ? `${Math.round((inProd / list.length) * 100)}% ya registrados como producidos`
                  : 'Ya registrados como producidos'
              }
            />
            <Kpi
              icon={AlertTriangle}
              tone="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
              label="Defecto principal"
              value={loading ? '…' : top ? fmtInt(top.n) : '—'}
              sub={top ? top.name : 'Sin defectos'}
              right={
                top ? (
                  <span className="text-right">
                    <span className="tabular inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[12px] font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      {(top.pct * 100).toFixed(0)}%
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">de los defectos</span>
                  </span>
                ) : null
              }
            />
            <Kpi
              icon={CheckCircle2}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
              label="Calidad OK"
              value="Sin datos"
              muted
              sub="VIOS no registra las TVs inspeccionadas sin defecto"
            />
          </div>

          {/* Paneles */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)_minmax(0,0.85fr)]">
            <Panel
              icon={Tag}
              title="Defectos más frecuentes"
              subtitle="Veces reportado en el periodo"
              className="xl:h-[460px]"
            >
              {pareto.rows.length ? (
                <ul className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4">
                  {pareto.rows.map((d) => (
                    <li key={d.name}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-[13.5px]">
                        <span className="min-w-0 truncate font-semibold">{d.name}</span>
                        <span className="tabular shrink-0 font-bold">
                          {fmtInt(d.n)}{' '}
                          <span className="font-medium text-muted-foreground">
                            · {(d.pct * 100).toFixed(0)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-red-500 transition-all duration-500"
                          style={{ width: `${(d.n / pareto.rows[0].n) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-4 flex flex-1 items-center justify-center rounded-xl border border-dashed p-6 text-center text-[13px] text-muted-foreground">
                  {loading ? 'Cargando…' : 'Sin defectos en el periodo'}
                </p>
              )}
            </Panel>

            <Panel
              icon={BarChart3}
              title="Pareto de defectos"
              subtitle="Defectos ordenados por frecuencia con porcentaje acumulado"
              className="md:order-first md:col-span-2 xl:order-none xl:col-span-1 xl:h-[460px]"
              action={
                <span className="hidden items-center gap-3 text-[11.5px] font-semibold text-muted-foreground sm:flex">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Frecuencia
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-blue-600 dark:bg-blue-400" /> % Acumulado
                  </span>
                </span>
              }
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {pareto.rows.length ? (
                  <>
                    <ParetoChart rows={pareto.rows} total={pareto.total} height={290} />
                    <p className="mt-1 text-center text-[11.5px] text-muted-foreground">
                      {fmtInt(pareto.rows.filter((r) => r.vital).length)} de {fmtInt(pareto.rows.length)}{' '}
                      defectos suman el {(pareto.rows.filter((r) => r.vital).at(-1).cum * 100).toFixed(1)}% de{' '}
                      {fmtInt(pareto.total)} incidencias
                    </p>
                  </>
                ) : (
                  <p className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed text-[13px] text-muted-foreground">
                    {loading ? 'Cargando…' : 'Sin defectos para graficar en el periodo'}
                  </p>
                )}
              </div>
            </Panel>

            <Panel title="Rechazos recientes" className="xl:h-[460px]">
              <div className="flex gap-2 border-b px-3 py-2.5">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Serial, modelo o defecto…"
                    aria-label="Buscar rechazo"
                    className="field h-9 pl-9 text-[13px]"
                  />
                </div>
                <label
                  className={cn(
                    'relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border bg-card hover:bg-muted',
                    source && 'border-primary text-primary',
                  )}
                >
                  <Filter className="h-4 w-4" />
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    aria-label="Filtrar registros"
                    className="absolute inset-0 cursor-pointer opacity-0"
                  >
                    {SOURCES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {source && (
                <p className="border-b px-3 py-1.5 text-[11.5px] font-semibold text-primary">
                  {SOURCES.find((o) => o.value === source).label} ·{' '}
                  <button type="button" className="underline" onClick={() => setSource('')}>
                    quitar
                  </button>
                </p>
              )}
              {shown.length ? (
                <ul className="max-h-[60dvh] min-h-0 flex-1 divide-y overflow-y-auto xl:max-h-none">
                  {shown.map((r) => (
                    <li key={r.id} className="flex items-start gap-2 px-3.5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="break-all font-mono text-[13.5px] font-bold">{r.serial}</span>
                          {r.source === 'historico' && <Badge tone="gray">Histórico</Badge>}
                          {r.in_production && (
                            <Badge tone="amber" dot>
                              En producción
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.defects.map((d) => (
                            <Badge key={d} tone="red">
                              {d}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {[r.model, r.brand, r.pallet_id && `Pallet ${r.pallet_id}`]
                            .filter(Boolean)
                            .join(' · ') || 'Sin datos de pallet'}
                        </p>
                        {r.comments && (
                          <p className="mt-0.5 text-[12.5px] italic text-foreground/80">“{r.comments}”</p>
                        )}
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {r.source === 'historico'
                            ? `Hoja MTY · ${fmtYmd(r.shift_date)}`
                            : `${r.registered_by_name || '—'} · ${fmtDateTime(r.registered_at)} · ${r.shift}`}
                        </p>
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setToDelete(r)}
                          aria-label={`Eliminar rechazo ${r.serial}`}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-3 flex flex-1 items-center justify-center rounded-xl border border-dashed p-6 text-center text-[13px] text-muted-foreground">
                  {loading ? 'Cargando…' : s || source ? 'Sin coincidencias' : 'Sin rechazos en el periodo'}
                </p>
              )}
            </Panel>
          </div>
        </>
      )}

      <Dialog
        open={Boolean(toDelete)}
        onClose={() => !deleting && setToDelete(null)}
        title="Eliminar rechazo"
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={remove} loading={deleting}>
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          </>
        }
      >
        {toDelete && (
          <div className="space-y-2 text-[14px]">
            <p>Se eliminará el rechazo del serial:</p>
            <p className="rounded-xl bg-muted px-3 py-2 font-mono text-[15px] font-bold">{toDelete.serial}</p>
            <p className="text-muted-foreground">{toDelete.defects.join(', ')}</p>
            {toDelete.source === 'historico' && (
              <p className="text-[13px] font-semibold text-amber-700 dark:text-amber-300">
                Es un registro histórico de la hoja MTY - VIOS/HY.
              </p>
            )}
            <p className="text-[13px] text-muted-foreground">
              Si no tiene otros rechazos, el serial podrá registrarse en producción.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
