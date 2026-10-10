// Reporte del dia (rediseno 2026-10-10, imagen de referencia de Roman): Centro de desempeno (5 indicadores +
// grafica Real vs Plan), Resumen ejecutivo, Produccion por tipo, Calidad del dia, linea de tiempo por turno y
// "¿Como se calcula?". Mismos datos y formulas: GET /reports/day (Plan, Real, Delta, Recovery, personas, rechazos,
// marcas y, en un solo dia, piezas por hora). Filtros y parametros de URL (from/to/brand/model) iguales que antes.
import { SHIFTS, shiftLabel } from '@shared/shift.js'
import {
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronRight,
  Clock3,
  Info,
  Layers,
  Printer,
  RotateCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt, fmtYmd } from '@/lib/utils'
import { buildSlots, shiftRange } from '../horaxhora/slots'
import {
  BackLink,
  BrandControl,
  FilterChip,
  PeriodControls,
  periodText,
  usePeriod,
  useUrlInit,
} from './common'
import { DesempenoChart, dayLabel } from './dia/DesempenoChart'
import { Gauge, Kpi, ShiftTimeline, STATUS } from './dia/parts'
import { eachDay } from './period'

const pad2 = (h) => `${String(h).padStart(2, '0')}:00`
const pctText = (p) => (p === null || p === undefined ? '—' : `${Math.round(p * 100)}%`)
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtInt(Math.abs(n))}`
const deltaCls = (n) =>
  n < 0 ? 'text-red-600 dark:text-red-400' : n > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''

function Card({ className, children }) {
  return (
    <section
      className={cn(
        'min-w-0 break-inside-avoid rounded-2xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.14)]',
        className,
      )}
    >
      {children}
    </section>
  )
}

function Head({
  icon: Icon,
  title,
  subtitle,
  right,
  tone = 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[17px] font-extrabold leading-tight tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

function Mini({ icon: Icon, tone, label, children, hint }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
        <div className="tabular truncate text-[20px] font-extrabold leading-tight">{children}</div>
        {hint && <p className="truncate text-[11.5px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

// Estado de un turno en la linea de tiempo segun datos reales.
function shiftStatus(row, key, currentKey) {
  if (key === currentKey) return 'current'
  if (key > currentKey) return 'pending'
  if (!row) return 'none'
  if (row.plan > 0 && row.processed >= row.plan) return 'done'
  return 'data'
}
const keyCmp = (d, s) => `${d}|${s === 'T1' ? 1 : 2}`

export default function ReporteDia() {
  const p = usePeriod('hoy')
  const [brand, setBrand] = useState(useUrlInit('brand'))
  const [model, setModel] = useState(useUrlInit('model'))
  const { data, error, loading, reload } = useApi('/reports/day', {
    query: { from: p.from, to: p.to, brand, model },
    refreshMs: p.isToday ? 60000 : undefined,
  })
  const t = data?.totals
  const multiDay = p.from !== p.to
  const current = data?.current
  const currentKey = current ? keyCmp(current.shiftDate, current.shift) : '9'

  // Turnos del periodo (los dos de cada fecha), con su estado real.
  const items = useMemo(() => {
    if (!data) return []
    const out = []
    for (const d of eachDay(p.from, p.to)) {
      for (const s of SHIFTS) {
        const row = data.shifts.find((x) => x.shiftDate === d && x.shift === s.key)
        const k = keyCmp(d, s.key)
        out.push({
          key: `${d}|${s.key}`,
          date: d,
          shift: s.key,
          row,
          status: shiftStatus(row, k, currentKey),
          range: `${s.start} – ${s.end}`,
        })
      }
    }
    // Varios dias: solo los turnos con datos o en curso (los demas no aportan) y el mas reciente arriba.
    return multiDay ? out.filter((x) => x.row || x.status === 'current').reverse() : out
  }, [data, p.from, p.to, currentKey, multiDay])

  const [selected, setSelected] = useState(null)
  useEffect(() => {
    if (!items.length) return
    if (selected && items.some((x) => x.key === selected)) return
    const cur = items.find((x) => x.status === 'current')
    const withData = items.filter((x) => x.row)
    setSelected((cur || (multiDay ? withData[0] : withData.at(-1)) || items[0]).key)
  }, [items, selected, multiDay])
  const sel = items.find((x) => x.key === selected)

  // Grafica: un dia = por hora de cada turno; varios dias = por fecha.
  const points = useMemo(() => {
    if (!data) return []
    if (!multiDay && data.hours) {
      const now = new Date().toISOString()
      const out = []
      for (const s of SHIFTS) {
        const row = data.shifts.find((x) => x.shiftDate === p.from && x.shift === s.key)
        const perHour = data.hours[s.key] || []
        const had = perHour.some((n) => n > 0)
        if (!row && !had && !(current?.shiftDate === p.from && current?.shift === s.key)) continue
        const goal = row?.plan || 0
        const { slots } = buildSlots({ shiftDate: p.from, shift: s.key, goal, perHour, current, now })
        for (const sl of slots)
          out.push({
            key: `${s.key}-${sl.key}`,
            group: s.key,
            label: pad2(sl.hour),
            title: `${shiftLabel(s.key)} · ${pad2(sl.hour)} – ${pad2((sl.hour + 1) % 24)}`,
            real: sl.real,
            plan: goal > 0 && !sl.extra ? sl.plan : null,
            note: sl.extra ? 'Tiempo extra (sin meta por hora)' : goal ? null : 'Turno sin plan',
          })
      }
      return out
    }
    return eachDay(p.from, p.to).map((d) => {
      const list = data.shifts.filter((x) => x.shiftDate === d)
      const plan = list.reduce((a, x) => a + x.plan, 0)
      return {
        key: d,
        group: 'd',
        label: dayLabel(d),
        title: fmtYmd(d),
        real: list.reduce((a, x) => a + x.processed, 0),
        plan: plan || null,
      }
    })
  }, [data, multiDay, p.from, p.to, current])

  const shiftsWithPlan = data?.shifts.filter((x) => x.plan > 0).length || 0
  const people = data ? Math.max(0, ...data.shifts.map((x) => x.people || 0)) : 0
  const curInRange = current && current.shiftDate >= p.from && current.shiftDate <= p.to
  const selRow = sel?.row
  // Recovery y meta: del turno elegido; si no tiene datos (en curso, sin escaneos), del ultimo turno con datos.
  const lastRow = data?.shifts?.at(-1)
  const refRow = selRow || lastRow
  const refName = refRow ? `${shiftLabel(refRow.shift)} · ${fmtYmd(refRow.shiftDate, { dow: false })}` : ''
  const brandCards = data?.brands?.filter((b) => b.brand === 'HY' || b.brand === 'SILO') || []

  return (
    <div className="space-y-4 print:space-y-3 print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="no-print">
            <BackLink to="/reportes" label="Reportes" />
          </span>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Reporte del día</h1>
          <p className="text-[15px] text-muted-foreground">
            Plan vs Real · {periodText(p.from, p.to)}
            {brand ? ` · ${brand}` : ''}
            {model ? ` · ${model}` : ''}
          </p>
        </div>
        <Button variant="outline" className="no-print" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
      </div>

      {/* Filtros */}
      <Card className="no-print flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4">
        <PeriodControls p={p} />
        <label
          className={cn(
            'relative inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 text-[13.5px] font-semibold hover:bg-muted',
            p.period === 'rango' && 'hidden',
          )}
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {p.from === p.to ? `${fmtYmd(p.from)} ${p.from.slice(0, 4)}` : periodText(p.from, p.to)}
          <input
            type="date"
            value={p.to}
            max={p.today}
            aria-label="Elegir día"
            onChange={(e) => {
              if (!e.target.value) return
              p.setCustom({ from: e.target.value, to: e.target.value })
              p.setPeriod('rango')
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {model && <FilterChip label={`Modelo ${model}`} onClear={() => setModel('')} />}
          <BrandControl value={brand} onChange={setBrand} />
        </div>
      </Card>

      {error && !data ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <p className="font-semibold text-red-700 dark:text-red-300">No se pudo consultar el reporte.</p>
          <p className="text-[12.5px] text-muted-foreground">{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RotateCw className="h-4 w-4" /> Reintentar
          </Button>
        </Card>
      ) : !data ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
          <div className="h-[560px] animate-pulse rounded-2xl bg-muted/70" />
          <div className="h-[560px] animate-pulse rounded-2xl bg-muted/70" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] print:grid-cols-1">
            {/* Centro de desempeno */}
            <Card className="flex flex-col p-4 sm:p-5">
              <Head
                icon={BarChart3}
                title="Centro de desempeño"
                subtitle={
                  multiDay ? 'Producción por día · Plan vs Real' : 'Producción por hora · Plan vs Real'
                }
                right={
                  <span className="hidden items-center gap-4 text-[12px] font-semibold text-muted-foreground sm:flex">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500 dark:bg-blue-400" /> Real (pzs)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-4 border-t-2 border-dashed border-blue-800 dark:border-blue-200" />{' '}
                      Plan (pzs)
                    </span>
                    {loading && <RotateCw className="h-3.5 w-3.5 animate-spin" aria-label="Actualizando" />}
                  </span>
                }
              />
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
                <Kpi
                  icon={Target}
                  label="Plan"
                  hint={`${shiftsWithPlan} turno${shiftsWithPlan === 1 ? '' : 's'} con plan`}
                >
                  {fmtInt(t.plan)}
                </Kpi>
                <Kpi icon={Boxes} label="Real" hint="Salidas cerradas + por línea">
                  <span className="text-blue-600 dark:text-blue-400">{fmtInt(t.processed)}</span>
                </Kpi>
                <Kpi
                  icon={TrendingUp}
                  label="Delta"
                  hint={
                    t.delta < 0 ? 'Faltante contra plan' : t.delta > 0 ? 'Arriba del plan' : 'Justo en plan'
                  }
                >
                  <span className={deltaCls(t.delta)}>{signed(t.delta)}</span>
                </Kpi>
                <div className="flex min-w-0 flex-col items-center rounded-xl border bg-card px-3 py-3">
                  <p className="flex items-center gap-1.5 self-start text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                    <Target className="h-3.5 w-3.5" /> Cumplimiento
                  </p>
                  <div className="relative mt-1">
                    <Gauge value={t.pct} />
                    <span className="tabular absolute inset-x-0 bottom-0 text-center text-[20px] font-extrabold leading-none">
                      {pctText(t.pct)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Real ÷ Plan</p>
                </div>
                <Kpi icon={ShieldCheck} label="Rechazos" hint="Calidad, en el periodo">
                  <span className={t.rejected ? 'text-red-600 dark:text-red-400' : ''}>
                    {fmtInt(t.rejected)}
                  </span>
                </Kpi>
              </div>
              <p className="mt-4 text-[12px] font-semibold text-muted-foreground">Piezas</p>
              {points.length && (points.some((x) => x.real > 0) || points.some((x) => x.plan)) ? (
                <DesempenoChart points={points} height={300} className="flex-1" />
              ) : (
                <p className="mt-2 flex min-h-[220px] flex-1 items-center justify-center rounded-xl border border-dashed text-[13px] text-muted-foreground">
                  Sin plan ni producción en este periodo
                </p>
              )}
              {!multiDay && (
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  Plan por hora = meta del turno repartida en sus horas productivas, igual que Hora por Hora
                  (comida a la mitad; las horas de tiempo extra no tienen meta).
                </p>
              )}
            </Card>

            {/* Columna derecha */}
            <div className="flex min-w-0 flex-col gap-4">
              <Card className="p-4">
                <Head icon={Zap} title="Resumen ejecutivo" subtitle="Información clave del periodo" />
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <Mini
                    icon={Layers}
                    tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                    label="Recovery"
                    hint={
                      refRow
                        ? `${refRow.carryOver ? `+${fmtInt(refRow.carryOver)} pendiente` : 'sin pendiente'} · ${refName}`
                        : 'sin turno con datos'
                    }
                  >
                    {refRow ? fmtInt(refRow.recoveryPlan) : '—'}
                  </Mini>
                  <Mini
                    icon={Users}
                    tone="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
                    label="Personas"
                    hint={people ? 'Áreas de trabajo activas' : 'Sin actividad registrada'}
                  >
                    {people || '—'}
                  </Mini>
                  <Mini
                    icon={Clock3}
                    tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                    label={curInRange ? 'Turno activo' : 'Turno seleccionado'}
                    hint={
                      curInRange
                        ? 'En curso ahora'
                        : sel
                          ? `Histórico · ${fmtYmd(sel.date, { dow: false })}`
                          : ''
                    }
                  >
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[13px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      {curInRange ? shiftLabel(current.shift) : sel ? shiftLabel(sel.shift) : '—'}
                    </span>
                  </Mini>
                  <Mini
                    icon={Target}
                    tone="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
                    label="Meta capturada"
                    hint={refName}
                  >
                    {refRow?.plan > 0 ? (
                      refRow.lines?.[0]?.planCaptured ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[13px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          ✓ Capturada
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[13px] font-bold text-muted-foreground">
                          Por defecto
                        </span>
                      )
                    ) : (
                      <span className="text-[14px] text-muted-foreground">Sin plan</span>
                    )}
                  </Mini>
                </div>
              </Card>

              <Card className="p-4">
                <Head icon={Boxes} title="Producción por tipo" subtitle="Piezas y pallets del periodo" />
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {brandCards.map((b) => {
                    const silo = b.brand === 'SILO'
                    const out = brand && brand !== b.brand
                    return (
                      <Link
                        key={b.brand}
                        to={`/reportes/modelos?brand=${b.brand}`}
                        className={cn(
                          'group rounded-xl p-3.5 transition hover:-translate-y-0.5',
                          silo ? 'bg-violet-50 dark:bg-violet-500/10' : 'bg-blue-50 dark:bg-blue-500/10',
                          out && 'opacity-50',
                        )}
                      >
                        <span
                          className={cn(
                            'flex items-center gap-1.5 text-[13px] font-bold',
                            silo
                              ? 'text-violet-700 dark:text-violet-300'
                              : 'text-blue-700 dark:text-blue-300',
                          )}
                        >
                          <Boxes className="h-4 w-4" /> {b.brand}
                          <ChevronRight className="ml-auto h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
                        </span>
                        <span className="tabular mt-1 block text-[26px] font-extrabold leading-tight">
                          {fmtInt(b.pieces)}{' '}
                          <span className="text-[13px] font-semibold text-muted-foreground">pzs</span>
                        </span>
                        <span
                          className={cn(
                            'mt-1.5 block rounded-lg px-2 py-1 text-center text-[12px] font-semibold',
                            silo
                              ? 'bg-violet-100/70 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                              : 'bg-blue-100/70 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
                          )}
                        >
                          {out
                            ? 'Fuera del filtro'
                            : `${fmtInt(b.pallets)} pallet${b.pallets === 1 ? '' : 's'}`}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </Card>

              <Card className="p-4">
                <Link to="/calidad" className="block">
                  <Head
                    icon={ShieldCheck}
                    title="Calidad del día"
                    subtitle="Rechazos en el periodo"
                    right={
                      <span className="text-right">
                        <span className="tabular block text-[24px] font-extrabold leading-none">
                          {fmtInt(t.rejected)}
                        </span>
                        <span
                          className={cn(
                            'mt-1 inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
                            t.rejected
                              ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
                          )}
                        >
                          {t.rejected ? 'Con rechazos' : '✓ Sin rechazos'}
                        </span>
                      </span>
                    }
                  />
                </Link>
              </Card>
            </div>
          </div>

          {/* Por turno */}
          <Card className="p-4 sm:p-5">
            <Head
              icon={Clock3}
              title="Por turno"
              subtitle={
                multiDay
                  ? 'Turnos con datos del periodo · da clic en uno para ver el detalle'
                  : 'Da clic en un turno para ver el detalle'
              }
            />
            {items.length ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
                <div className={cn('no-print', multiDay && 'max-h-[360px] overflow-y-auto pr-1')}>
                  <ShiftTimeline
                    items={items}
                    selected={selected}
                    onSelect={setSelected}
                    multiDay={multiDay}
                  />
                </div>
                {sel && (
                  <div className="no-print min-w-0 self-start rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[14.5px] font-bold">{shiftLabel(sel.shift)}</span>
                      <span className="text-[13.5px] text-muted-foreground">
                        · {fmtYmd(sel.date)} · {shiftRange(sel.shift)}
                      </span>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
                          STATUS[sel.status].cls,
                        )}
                      >
                        {STATUS[sel.status].label}
                      </span>
                      {selRow?.plan > 0 && (
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11.5px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          {selRow.lines?.[0]?.planCaptured ? 'Meta capturada' : 'Meta por defecto'}
                        </span>
                      )}
                    </div>
                    {selRow ? (
                      <>
                        <div className="mt-4 grid grid-cols-2 gap-y-4 sm:grid-cols-3 xl:grid-cols-6 xl:divide-x">
                          {[
                            { label: 'Plan', value: fmtInt(selRow.plan) },
                            { label: 'Real', value: fmtInt(selRow.processed) },
                            {
                              label: 'Delta',
                              value: <span className={deltaCls(selRow.delta)}>{signed(selRow.delta)}</span>,
                            },
                            { label: 'Cumplimiento', value: pctText(selRow.pct) },
                            {
                              label: 'Recovery',
                              value: fmtInt(selRow.recoveryPlan),
                              hint: selRow.carryOver
                                ? `+${fmtInt(selRow.carryOver)} pendiente`
                                : 'sin pendiente',
                            },
                            { label: 'Personas', value: selRow.people ?? '—' },
                          ].map((m) => (
                            <div key={m.label} className="min-w-0 px-3 first:pl-0">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                {m.label}
                              </p>
                              <p className="tabular text-[22px] font-extrabold leading-tight">{m.value}</p>
                              {m.hint && <p className="text-[11.5px] text-muted-foreground">{m.hint}</p>}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                selRow.pct >= 1 ? 'bg-emerald-500' : 'bg-blue-600 dark:bg-blue-500',
                              )}
                              style={{ width: `${Math.min(100, (selRow.pct || 0) * 100)}%` }}
                            />
                          </div>
                          <span className="tabular text-[14px] font-extrabold">{pctText(selRow.pct)}</span>
                        </div>
                        {selRow.rejected > 0 && (
                          <p className="mt-2 text-[12.5px] font-semibold text-red-600 dark:text-red-400">
                            {fmtInt(selRow.rejected)} rechazos de Calidad en este turno
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-4 rounded-xl border border-dashed p-5 text-center text-[13px] text-muted-foreground">
                        {sel.status === 'pending'
                          ? 'Este turno todavía no empieza.'
                          : 'Sin plan ni producción en este turno.'}
                      </p>
                    )}
                  </div>
                )}
                {/* Impresion: todos los turnos en tabla */}
                <table className="hidden w-full text-[12px] print:table">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      {['Turno', 'Plan', 'Real', 'Delta', 'Cumpl.', 'Recovery', 'Personas', 'Rechazos'].map(
                        (h) => (
                          <th key={h} className="py-1 pr-2 font-semibold">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .filter((x) => x.row)
                      .map((x) => (
                        <tr key={x.key} className="border-b">
                          <td className="py-1 pr-2">
                            {fmtYmd(x.date)} · {shiftLabel(x.shift)}
                          </td>
                          <td className="pr-2">{fmtInt(x.row.plan)}</td>
                          <td className="pr-2">{fmtInt(x.row.processed)}</td>
                          <td className="pr-2">{signed(x.row.delta)}</td>
                          <td className="pr-2">{pctText(x.row.pct)}</td>
                          <td className="pr-2">{fmtInt(x.row.recoveryPlan)}</td>
                          <td className="pr-2">{x.row.people ?? '—'}</td>
                          <td>{fmtInt(x.row.rejected)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-[13px] text-muted-foreground">
                Sin turnos en este periodo.
              </p>
            )}
          </Card>

          {/* Como se calcula */}
          <Card className="bg-blue-50/40 p-4 sm:p-5 dark:bg-blue-500/[0.04]">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                <Info className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-extrabold">¿Cómo se calcula?</h3>
                <div className="mt-2 grid gap-x-8 gap-y-2 text-[13px] leading-relaxed text-muted-foreground md:grid-cols-2 md:divide-x">
                  <div className="space-y-1.5">
                    <p>
                      <b className="text-foreground">Plan:</b> la meta del turno: 765 piezas o la que se
                      capture en Hora por Hora (sigue vigente los días siguientes). Cuenta en Turno 1 de día
                      hábil; en Turno 2, fines de semana y feriados solo si se trabajó.
                    </p>
                    <p>
                      <b className="text-foreground">Delta:</b> Real − Plan. Negativo (rojo) es lo que faltó;
                      positivo (verde) es lo que se hizo de más.{' '}
                      <b className="text-foreground">Cumplimiento:</b> Real ÷ Plan.
                    </p>
                  </div>
                  <div className="space-y-1.5 md:pl-8">
                    <p>
                      <b className="text-foreground">Real:</b> piezas de pallets de salida cerrados más las
                      escaneadas (TV + caja) en Producción por línea, en el turno en que se escanearon; cada
                      serie cuenta una vez.
                    </p>
                    <p>
                      <b className="text-foreground">Recovery:</b> Plan + lo que faltó en el turno anterior,
                      para recuperar lo pendiente. <b className="text-foreground">Personas:</b> áreas de
                      trabajo con escaneos en el turno (Entrada, Producción por línea y Salida, 1 cada una).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
