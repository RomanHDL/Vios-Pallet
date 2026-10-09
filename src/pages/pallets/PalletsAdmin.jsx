// Control de Pallet, vista de administrador: recorrido Entrada -> Produccion por linea -> Salida con datos reales
// de /api/pallet-flow (solo admin). Produccion (cuenta Planta) sigue con su vista sencilla en PalletsHome.
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Factory,
  History,
  Package,
  RefreshCw,
  Route,
  Settings2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Dialog, Empty, ErrorBox, Input, Spinner, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { cn, fmtAgo, fmtInt, fmtTime, fmtYmd } from '@/lib/utils'

const STAGE = {
  entrada: {
    label: 'Entrada',
    title: 'Entrada',
    description: 'Registrar pallets recibidos',
    unit: 'pallets en entrada',
    flow: 'Registrando pallets recibidos',
    to: '/pallets/entrada',
    icon: ArrowDownToLine,
    card: 'border-blue-200 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-500/[0.07]',
    iconBox: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
    text: 'text-blue-600 dark:text-blue-400',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    tab: 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300',
    line: 'from-blue-500 to-blue-600',
  },
  produccion: {
    label: 'Producción',
    title: 'Producción por línea',
    description: 'Seguimiento por línea y avance',
    unit: 'pallets en producción',
    flow: 'En proceso por línea',
    to: '/pallets/lineas',
    icon: Factory,
    card: 'border-teal-200 bg-teal-50/50 dark:border-teal-500/30 dark:bg-teal-500/[0.07]',
    iconBox: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300',
    text: 'text-teal-600 dark:text-teal-400',
    chip: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
    tab: 'border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300',
    line: 'from-teal-500 to-blue-500',
  },
  salida: {
    label: 'Salida',
    title: 'Salida',
    description: 'Confirmar pallets despachados',
    unit: 'pallets en salida',
    flow: 'Confirmando pallets despachados',
    to: '/pallets/salida',
    icon: ArrowUpFromLine,
    card: 'border-violet-200 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/[0.07]',
    iconBox: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300',
    text: 'text-violet-600 dark:text-violet-400',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    tab: 'border-violet-600 text-violet-700 dark:border-violet-400 dark:text-violet-300',
    line: 'from-violet-400 to-violet-300',
  },
}
const ORDER = ['entrada', 'produccion', 'salida']
const shiftName = (s) => (s === 'T2' ? 'Turno 2' : 'Turno 1')

function HeaderLink({ to, icon: Icon, children }) {
  return (
    <Link
      to={to}
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-[14.5px] font-semibold shadow-sm hover:bg-muted"
    >
      <Icon className="h-[18px] w-[18px]" /> {children}
    </Link>
  )
}

function StageCard({ stage, n }) {
  const s = STAGE[stage]
  const Icon = s.icon
  return (
    <Link to={s.to} className={cn('group flex items-center gap-4 rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5', s.card)}>
      <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-full', s.iconBox)}>
        <Icon className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-extrabold leading-tight">{s.title}</span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">{s.description}</span>
        <span className="mt-2 flex items-baseline gap-2">
          <span className={cn('tabular text-[28px] font-extrabold leading-none', s.text)}>{n === null ? '—' : fmtInt(n)}</span>
          <span className="text-[13px] text-muted-foreground">{s.unit}</span>
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
    </Link>
  )
}

function FlowArrow() {
  return <ArrowRight className="hidden h-6 w-6 shrink-0 self-center text-blue-400 lg:block" aria-hidden="true" />
}

function PalletRow({ p }) {
  const s = STAGE[p.stage]
  const id = p.stage === 'salida' && p.salidaId ? p.salidaId : p.id
  const meta = [p.model, p.brand, p.stage === 'produccion' && p.line].filter(Boolean).join(' · ')
  const progress =
    p.stage === 'salida'
      ? `${fmtInt(p.salidaPieces)} / ${fmtInt(p.expected)} piezas`
      : p.stage === 'produccion'
        ? `${fmtInt(p.producedPieces)} / ${fmtInt(p.pieces)} en línea`
        : `${fmtInt(p.pieces)} ${p.pieces === 1 ? 'pieza' : 'piezas'}`
  return (
    <li>
      <Link to={`/pallets/${id}`} className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 hover:bg-muted/50 sm:grid-cols-[auto_minmax(0,1.3fr)_auto_minmax(0,1fr)_auto] sm:px-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-foreground/80">
          <Package className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-mono text-[15px] font-extrabold">{id}</span>
          <span className="block truncate text-[12.5px] text-muted-foreground">{meta}</span>
          <span className="block text-[12px] text-muted-foreground">
            {fmtAgo(p.since)} · {progress}
          </span>
        </span>
        <span className="hidden justify-self-start sm:block">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold', s.chip)}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> {s.label}
          </span>
          {p.detained && (
            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[11.5px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" /> Detenido
            </span>
          )}
        </span>
        <span className="hidden min-w-0 text-[12.5px] text-muted-foreground sm:block">
          <span className="block truncate">{p.event}</span>
          <span className="block">
            {shiftName(p.shift)} · {fmtTime(p.last)}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5" />
      </Link>
    </li>
  )
}

function SummaryTile({ tone, icon: Icon, label, value, hint, onClick, active }) {
  const t = {
    entrada: 'bg-blue-50 dark:bg-blue-500/[0.08]',
    produccion: 'bg-teal-50 dark:bg-teal-500/[0.08]',
    salida: 'bg-violet-50 dark:bg-violet-500/[0.08]',
    detenidos: 'bg-red-50 dark:bg-red-500/[0.08]',
  }[tone]
  const text = tone === 'detenidos' ? 'text-red-600 dark:text-red-400' : STAGE[tone].text
  const box =
    tone === 'detenidos' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300' : STAGE[tone].iconBox
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('group flex items-center gap-3 rounded-2xl p-3.5 text-left transition hover:brightness-[0.98]', t, active && 'ring-2 ring-primary/40')}
    >
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full', box)}>
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13px] font-bold leading-tight', text)}>{label}</span>
        <span className={cn('tabular block text-[24px] font-extrabold leading-tight', text)}>{value}</span>
        <span className="block text-[12px] leading-snug text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground min-[1500px]:block" />
    </button>
  )
}

function ThresholdsDialog({ open, thresholds, onClose, onSaved }) {
  const toast = useToast()
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) setValues(Object.fromEntries(ORDER.map((s) => [s, thresholds?.[s] ?? ''])))
  }, [open, thresholds])
  const save = async () => {
    setSaving(true)
    try {
      await api('/pallet-flow/thresholds', { method: 'PUT', body: values })
      toast('Umbrales guardados')
      onSaved()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      title="Pallets detenidos"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] text-muted-foreground">
        Un pallet se marca detenido cuando lleva más de estos minutos sin ningún movimiento en su etapa (último escaneo
        de entrada, de línea o de salida). Deja vacío para no marcar ninguno en esa etapa.
      </p>
      <div className="mt-4 space-y-3">
        {ORDER.map((s) => (
          <label key={s} className="flex items-center gap-3">
            <span className="w-44 text-[14px] font-semibold">{STAGE[s].title}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={values[s] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [s]: e.target.value }))}
              placeholder="Sin umbral"
              className="h-10 w-32"
            />
            <span className="text-[13px] text-muted-foreground">min</span>
          </label>
        ))}
      </div>
    </Dialog>
  )
}

function FlowNode({ stage, n, last }) {
  const s = STAGE[stage]
  const Icon = s.icon
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-full', s.iconBox)}>
        <Icon className="h-7 w-7" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-center gap-2">
          <div className={cn('h-1.5 flex-1 rounded-full bg-gradient-to-r', s.line)} />
          {!last && (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <p className="mt-2 text-[15px] font-extrabold">{s.title}</p>
        <p className="text-[14px]">
          <b className="tabular text-[18px]">{fmtInt(n)}</b> pallets
        </p>
        <p className="text-[12.5px] text-muted-foreground">{s.flow}</p>
      </div>
    </div>
  )
}

export default function PalletsAdmin({ FindSerial }) {
  const [shift, setShift] = useState('')
  const [tab, setTab] = useState('entrada')
  const [onlyDetained, setOnlyDetained] = useState(false)
  const [editLimits, setEditLimits] = useState(false)
  const { data, error, loading, reload } = useApi('/pallet-flow', { query: { shift }, refreshMs: 30000 })
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const c = data?.counts
  const list = useMemo(
    () => (data?.pallets || []).filter((p) => (onlyDetained ? p.detained : p.stage === tab)),
    [data, tab, onlyDetained],
  )
  const hasLimits = data && ORDER.some((s) => data.thresholds[s] !== null)
  const pick = (stage) => {
    setOnlyDetained(false)
    setTab(stage)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-tight sm:text-[30px]">Control de Pallet</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Entrada, producción por línea y salida de pallets</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HeaderLink to="/pallets/lineas" icon={Factory}>
            Producción por línea
          </HeaderLink>
          <HeaderLink to="/pallets/historial" icon={History}>
            Historial
          </HeaderLink>
        </div>
      </div>

      <ErrorBox error={error} />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:gap-2">
        <StageCard stage="entrada" n={c ? c.entrada : null} />
        <FlowArrow />
        <StageCard stage="produccion" n={c ? c.produccion : null} />
        <FlowArrow />
        <StageCard stage="salida" n={c ? c.salida : null} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
                <Package className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-[17px] font-extrabold leading-tight">Pallets activos</h3>
                <p className="text-[12.5px] text-muted-foreground">Pallets en el sistema y su estado actual</p>
              </div>
            </div>
            <div className="relative">
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                aria-label="Turno"
                className="h-10 appearance-none rounded-xl border border-input bg-card py-0 pl-3.5 pr-9 text-[13.5px] font-medium"
              >
                <option value="">Todos los turnos</option>
                <option value="T1">Turno 1</option>
                <option value="T2">Turno 2</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="mx-3 mt-3 grid grid-cols-3 rounded-xl bg-muted/60 sm:mx-4">
            {ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pick(s)}
                className={cn(
                  'border-b-2 px-2 py-2.5 text-[13.5px] font-semibold transition sm:text-[14px]',
                  !onlyDetained && tab === s ? STAGE[s].tab : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {STAGE[s].label} ({c ? fmtInt(c[s]) : '–'})
              </button>
            ))}
          </div>
          {onlyDetained && (
            <div className="mx-3 mt-2 flex items-center justify-between rounded-xl bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300 sm:mx-4">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Mostrando pallets detenidos
              </span>
              <button type="button" onClick={() => setOnlyDetained(false)} className="underline-offset-2 hover:underline">
                Quitar filtro
              </button>
            </div>
          )}
          <div className="mt-2 max-h-[460px] overflow-y-auto">
            {loading && !data ? (
              <Spinner />
            ) : list.length ? (
              <ul className="divide-y">
                {list.map((p) => (
                  <PalletRow key={p.id} p={p} />
                ))}
              </ul>
            ) : (
              <Empty icon={Package} title={onlyDetained ? 'Ningún pallet detenido' : `Sin pallets en ${STAGE[tab].label.toLowerCase()}`} />
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <FindSerial />
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
                  <BarChart3 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[17px] font-extrabold leading-tight">Resumen operativo</h3>
                  <p className="text-[12.5px] text-muted-foreground">Estado actual de pallets en el sistema</p>
                </div>
              </div>
              {data && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">
                  {shiftName(data.current.shift)} · {fmtYmd(data.current.shiftDate)}
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <SummaryTile tone="entrada" icon={ArrowDownToLine} label="En entrada" value={c ? fmtInt(c.entrada) : '—'} hint="pallets" onClick={() => pick('entrada')} />
              <SummaryTile tone="produccion" icon={Factory} label="En producción" value={c ? fmtInt(c.produccion) : '—'} hint="pallets" onClick={() => pick('produccion')} />
              <SummaryTile tone="salida" icon={ArrowUpFromLine} label="En salida" value={c ? fmtInt(c.salida) : '—'} hint="pallets" onClick={() => pick('salida')} />
              <SummaryTile
                tone="detenidos"
                icon={AlertTriangle}
                label="Pallets detenidos"
                value={!data ? '—' : hasLimits ? fmtInt(c.detenidos) : '—'}
                hint={!data ? '' : !hasLimits ? 'Sin umbral configurado' : c.detenidos ? 'requiere atención' : 'ninguno'}
                active={onlyDetained}
                onClick={() => (hasLimits ? setOnlyDetained(true) : setEditLimits(true))}
              />
            </div>
            <button
              type="button"
              onClick={() => setEditLimits(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" /> Configurar umbrales de pallets detenidos
            </button>
          </Card>
        </div>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
              <Route className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-[17px] font-extrabold leading-tight">Flujo del pallet</h3>
              <p className="text-[12.5px] text-muted-foreground">Seguimiento en tiempo real del flujo de pallets en planta</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Actualizado {fmtAgo(data.now)}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => reload()} loading={loading && Boolean(data)}>
              {!(loading && data) && <RefreshCw className="h-4 w-4" />} Actualizar
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-5 md:flex-row md:gap-3">
          {ORDER.map((s, i) => (
            <FlowNode key={s} stage={s} n={c ? c[s] : 0} last={i === ORDER.length - 1} />
          ))}
        </div>
      </Card>

      <ThresholdsDialog
        open={editLimits}
        thresholds={data?.thresholds}
        onClose={() => setEditLimits(false)}
        onSaved={() => {
          setEditLimits(false)
          reload(true)
        }}
      />
    </div>
  )
}
