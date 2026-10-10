// Personal y productividad (rediseno 2026-10-10, imagen de referencia de Roman). Mismas definiciones:
//  - Producido = piezas producidas del turno (salidas cerradas + escaneo por linea, una vez por serial).
//  - Personas = areas de trabajo (Entrada, Produccion por linea, Salida) que escanearon algo en el turno, 1 por area
//    (2026-10-08: "solo son 3 personas, 3 modos de trabajo").
//  - Piezas / persona = producido ÷ personas (de los turnos con personas). Sin actividad = turnos con produccion y
//    sin escaneos de area.
// Datos: GET /reports/staffing (con marca opcional) en una sola consulta que cubre el periodo, el periodo anterior y
// los ultimos 14 dias (minigraficas); en un solo dia, GET /reports/day para las piezas por hora.
import { addDays, SHIFTS, shiftLabel, shiftOf } from '@shared/shift.js'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  Box,
  CalendarDays,
  Download,
  List,
  PieChart,
  RotateCw,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt, fmtYmd } from '@/lib/utils'
import {
  BackLink,
  BrandControl,
  FilterChip,
  PeriodControls,
  periodText,
  usePeriod,
  useUrlInit,
} from './common'
import { eachDay } from './period'
import { Donut, Sparkline, TrendDual } from './personal/charts'

const fmt1 = (v) =>
  v === null || v === undefined ? '—' : v.toLocaleString('es-MX', { maximumFractionDigits: 1 })
const AREAS = [
  {
    line: 'Entrada',
    color: '#f59e0b',
    bar: 'bg-amber-500',
    icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  },
  {
    line: 'Producción por línea',
    color: '#3b82f6',
    bar: 'bg-blue-600 dark:bg-blue-500',
    icon: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  },
  {
    line: 'Salida',
    color: '#10b981',
    bar: 'bg-emerald-500',
    icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
]
const areaOf = (line) =>
  AREAS.find((a) => a.line === line) || {
    line,
    color: '#94a3b8',
    bar: 'bg-slate-400',
    icon: 'bg-muted text-muted-foreground',
  }
const keyCmp = (d, s) => `${d}|${s === 'T1' ? 1 : 2}`
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1

// Totales oficiales de un conjunto de turnos.
function totalsOf(rows) {
  const staffed = rows.filter((r) => r.people)
  const people = staffed.reduce((a, r) => a + r.people, 0)
  return {
    produced: rows.reduce((a, r) => a + r.produced, 0),
    avgPeople: staffed.length ? people / staffed.length : null,
    perPerson: people ? staffed.reduce((a, r) => a + r.produced, 0) / people : null,
    missing: rows.filter((r) => !r.people && r.produced > 0).length,
  }
}
const change = (cur, prev) => (cur === null || prev === null || !(prev > 0) ? null : (cur - prev) / prev)

function Card({ className, children }) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-2xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.14)]',
        className,
      )}
    >
      {children}
    </section>
  )
}

function Kpi({ icon: Icon, tone, label, value, sub, delta, spark, color, id }) {
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex items-start gap-3.5">
        <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl', tone)}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="tabular text-[32px] font-extrabold leading-tight tracking-tight">{value}</p>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-2">
        {delta ? (
          <p className="min-w-0 leading-tight">
            <span
              className={cn(
                'tabular inline-flex items-center gap-0.5 text-[14px] font-bold',
                delta.value >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {delta.value >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              {delta.value >= 0 ? '+' : '−'}
              {Math.abs(delta.value * 100).toFixed(0)}%
            </span>
            <span className="block text-[12px] text-muted-foreground">{delta.label}</span>
          </p>
        ) : (
          <p className="min-w-0 text-[12px] leading-snug text-muted-foreground">{sub}</p>
        )}
        <Sparkline
          values={spark}
          color={color}
          id={id}
          className="pointer-events-none h-10 w-[104px] shrink-0"
        />
      </div>
    </Card>
  )
}

export default function ReportePersonal() {
  const p = usePeriod('semana')
  const [brand, setBrand] = useState(useUrlInit('brand'))
  const [shift, setShift] = useState(useUrlInit('shift'))
  const [group, setGroup] = useState(null)
  const [areaMode, setAreaMode] = useState('piezas')
  const single = p.from === p.to
  const current = shiftOf()
  const currentKey = keyCmp(current.shiftDate, current.shift)
  const inProgress = p.to >= current.shiftDate

  // Una consulta: periodo + periodo anterior (mismo largo) + ultimos 14 dias para las minigraficas.
  const len = days(p.from, p.to)
  const prevFrom = addDays(p.from, -len)
  const wideFrom = [prevFrom, addDays(p.to, -13)].sort()[0]
  const { data, error, loading, reload } = useApi('/reports/staffing', {
    query: { from: wideFrom, to: p.to, brand },
    refreshMs: inProgress ? 60000 : undefined,
  })
  const dayQ = useApi('/reports/day', {
    query: { from: p.from, to: p.to, brand },
    skip: !single,
    refreshMs: inProgress ? 60000 : undefined,
  })

  const pick = (from, to) =>
    (data?.rows || []).filter(
      (r) => r.shiftDate >= from && r.shiftDate <= to && (!shift || r.shift === shift),
    )
  const rows = useMemo(() => pick(p.from, p.to), [data, p.from, p.to, shift])
  const prevRows = useMemo(() => pick(prevFrom, addDays(p.from, -1)), [data, prevFrom, p.from, shift])
  const t = totalsOf(rows)
  const pt = totalsOf(prevRows)
  const prevLabel = single ? 'vs. día anterior' : `vs. ${len} días anteriores`
  // Un periodo en curso no se compara contra uno completo.
  const delta = (cur, prev) =>
    inProgress || !prevRows.length
      ? null
      : change(cur, prev) === null
        ? null
        : { value: change(cur, prev), label: prevLabel }

  // Minigraficas: ultimos 14 dias con actividad, hasta el fin del periodo.
  const spark = useMemo(() => {
    const byDay = eachDay(addDays(p.to, -13), p.to)
      .map((d) => totalsOf(pick(d, d)))
      .filter((x) => x.produced > 0 || x.avgPeople)
    return {
      produced: byDay.map((x) => x.produced),
      people: byDay.map((x) => x.avgPeople || 0),
      perPerson: byDay.map((x) => x.perPerson || 0),
      missing: byDay.map((x) => x.missing),
    }
  }, [data, p.to, shift])

  // Trabajo por area (escaneos de cada area; una pieza puede pasar por las 3, no es produccion unica).
  const areas = useMemo(() => {
    const m = new Map()
    for (const r of rows)
      for (const l of r.lines) {
        const s = m.get(l.line) || { line: l.line, pieces: 0, shifts: 0 }
        s.pieces += l.pieces
        s.shifts += l.people
        m.set(l.line, s)
      }
    const list = AREAS.map((a) => m.get(a.line) || { line: a.line, pieces: 0, shifts: 0 })
    const total = list.reduce((a, x) => a + x.pieces, 0)
    return { list, total }
  }, [rows])
  // Rendimiento: escaneos por persona del area = escaneos ÷ personas del area en el periodo (1 por turno trabajado).
  const ranking = areas.list
    .filter((a) => a.shifts > 0)
    .map((a) => ({ ...a, perPerson: a.pieces / a.shifts }))
    .sort((a, b) => b.perPerson - a.perPerson)
  const maxRank = Math.max(1, ...ranking.map((a) => a.perPerson))

  // Agrupaciones validas: un dia = por hora / por turno; varios dias = por dia / por turno.
  const groups = single
    ? [
        { value: 'hora', label: 'Por hora' },
        { value: 'turno', label: 'Por turno' },
      ]
    : [
        { value: 'dia', label: 'Por día' },
        { value: 'turno', label: 'Por turno' },
      ]
  const g = groups.some((x) => x.value === group) ? group : groups[0].value

  const trend = useMemo(() => {
    if (g === 'turno')
      return rows.map((r) => ({
        key: `${r.shiftDate}|${r.shift}`,
        label: single ? shiftLabel(r.shift) : `${fmtYmd(r.shiftDate, { dow: false })} ${r.shift}`,
        title: `${fmtYmd(r.shiftDate)} · ${shiftLabel(r.shift)}`,
        a: r.produced,
        b: r.people ? r.produced / r.people : null,
      }))
    if (g === 'dia')
      return eachDay(p.from, p.to).map((d) => {
        const x = totalsOf(pick(d, d))
        return { key: d, label: fmtYmd(d, { dow: false }), title: fmtYmd(d), a: x.produced, b: x.perPerson }
      })
    // Por hora (un dia): acumulado del dia; piezas por persona = acumulado ÷ personas de los turnos ya iniciados
    // (al final del dia es exactamente el valor oficial producido ÷ personas).
    const hours = dayQ.data?.hours
    if (!hours) return []
    const seq = []
    for (const s of SHIFTS) {
      if (shift && shift !== s.key) continue
      const row = rows.find((r) => r.shift === s.key)
      const perHour = hours[s.key] || []
      for (let i = 0; i < perHour.length; i++)
        seq.push({
          shift: s.key,
          hour: (Number(s.start.slice(0, 2)) + i) % 24,
          n: perHour[i],
          people: row?.people || 0,
        })
    }
    const first = seq.findIndex((x) => x.n > 0)
    if (first < 0) return []
    let last = seq.length - 1
    while (last > first && seq[last].n === 0) last--
    let cum = 0
    const peopleBy = {}
    return seq.slice(first, last + 1).map((x) => {
      cum += x.n
      peopleBy[x.shift] = x.people
      const people = Object.values(peopleBy).reduce((a, v) => a + v, 0)
      const hh = `${String(x.hour).padStart(2, '0')}:00`
      return {
        key: `${x.shift}-${x.hour}`,
        label: hh,
        title: `${shiftLabel(x.shift)} · ${hh} (acumulado)`,
        a: cum,
        b: people ? cum / people : null,
      }
    })
  }, [g, rows, dayQ.data, p.from, p.to, single, shift])

  const table = [...rows].reverse()
  const exportCsv = () => {
    const head = [
      'Fecha',
      'Turno',
      'Entrada',
      'Producción por línea',
      'Salida',
      'Personas',
      'Producido',
      'Piezas por persona',
      'Estatus',
    ]
    const lines = table.map((r) => {
      const a = (n) => r.lines.find((l) => l.line === n)?.pieces || 0
      const st =
        !r.people && r.produced
          ? 'Sin escaneos de área'
          : keyCmp(r.shiftDate, r.shift) === currentKey
            ? 'En curso'
            : 'Completado'
      return [
        r.shiftDate,
        shiftLabel(r.shift),
        a('Entrada'),
        a('Producción por línea'),
        a('Salida'),
        r.people ?? '',
        r.produced,
        r.perPerson === null ? '' : r.perPerson.toFixed(1),
        st,
      ]
    })
    const csv = [head, ...lines]
      .map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `personal-productividad_${p.from}_${p.to}${brand ? `_${brand}` : ''}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Encabezado y filtros */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <BackLink to="/reportes" label="Reportes" />
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">
            Personal y productividad
          </h1>
          <p className="text-[15px] text-muted-foreground">
            Piezas producidas por persona · {periodText(p.from, p.to)}
            {brand ? ` · ${brand}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-[12px] font-semibold text-muted-foreground">Periodo</p>
            <PeriodControls p={p} />
          </div>
          <div>
            <p className="mb-1 text-[12px] font-semibold text-muted-foreground">Planta / Marca</p>
            <BrandControl value={brand} onChange={setBrand} />
          </div>
          <label
            className={cn(
              'relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 text-[13.5px] font-semibold hover:bg-muted',
              p.period === 'rango' && 'hidden',
            )}
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {single ? `${fmtYmd(p.from)} ${p.from.slice(0, 4)}` : periodText(p.from, p.to)}
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
          {shift && <FilterChip label={shiftLabel(shift)} onClear={() => setShift('')} />}
        </div>
      </div>

      {error && !data ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <p className="font-semibold text-red-700 dark:text-red-300">No se pudo consultar el reporte.</p>
          <p className="text-[12.5px] text-muted-foreground">{error.message}</p>
          <button
            type="button"
            onClick={() => reload()}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold hover:bg-muted"
          >
            <RotateCw className="h-4 w-4" /> Reintentar
          </button>
        </Card>
      ) : !data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[120px] animate-pulse rounded-2xl bg-muted/70" />
            ))}
          </div>
          <div className="h-[420px] animate-pulse rounded-2xl bg-muted/70" />
        </div>
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={Box}
              tone="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
              label="Producido"
              value={fmtInt(t.produced)}
              sub={inProgress ? 'Periodo en curso' : 'Sin periodo anterior'}
              delta={delta(t.produced, pt.produced)}
              spark={spark.produced}
              color="#2563eb"
              id="sp-a"
            />
            <Kpi
              icon={User}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
              label="Personas / turno"
              value={fmt1(t.avgPeople)}
              sub="Áreas que trabajaron (1 persona c/u)"
              spark={spark.people}
              color="#10b981"
              id="sp-b"
            />
            <Kpi
              icon={Zap}
              tone="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
              label="Piezas / persona"
              value={fmt1(t.perPerson)}
              sub={inProgress ? 'Periodo en curso' : 'Sin periodo anterior'}
              delta={delta(t.perPerson, pt.perPerson)}
              spark={spark.perPerson}
              color="#7c3aed"
              id="sp-c"
            />
            <Kpi
              icon={AlertTriangle}
              tone="bg-orange-50 text-orange-500 dark:bg-orange-500/15 dark:text-orange-300"
              label="Sin actividad"
              value={fmtInt(t.missing)}
              sub="Turnos con producción sin escaneos de área"
              spark={spark.missing}
              color="#f97316"
              id="sp-d"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            {/* Tendencia */}
            <Card className="flex flex-col p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                  <BarChart3 className="h-5 w-5" />
                </span>
                <h3 className="mr-auto text-[17px] font-extrabold">Tendencia de producción</h3>
                {(loading || dayQ.loading) && (
                  <RotateCw
                    className="h-4 w-4 animate-spin text-muted-foreground"
                    aria-label="Actualizando"
                  />
                )}
                <select
                  value={g}
                  onChange={(e) => setGroup(e.target.value)}
                  aria-label="Agrupar"
                  className="h-9 appearance-none rounded-xl border bg-card bg-[length:14px] bg-[position:right_10px_center] bg-no-repeat pl-3 pr-8 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  }}
                >
                  {groups.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex justify-center gap-5 text-[12.5px] font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400" /> Piezas producidas
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-600 dark:bg-violet-400" /> Piezas por
                  persona
                </span>
              </div>
              <div className="mt-1 flex-1">
                {trend.length ? (
                  <TrendDual points={trend} height={340} />
                ) : (
                  <p className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-dashed text-[13px] text-muted-foreground">
                    {g === 'hora' && dayQ.loading ? 'Cargando…' : 'Sin producción en este periodo'}
                  </p>
                )}
              </div>
              {g === 'hora' && trend.length > 0 && (
                <p className="text-[11.5px] text-muted-foreground">
                  Por hora se muestra el acumulado del día; piezas por persona = acumulado ÷ personas de los
                  turnos ya iniciados.
                </p>
              )}
            </Card>

            <div className="flex min-w-0 flex-col gap-4">
              {/* Trabajo por area */}
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    <PieChart className="h-5 w-5" />
                  </span>
                  <h3 className="mr-auto text-[17px] font-extrabold">Trabajo por área</h3>
                  <div className="inline-flex rounded-xl bg-muted p-1">
                    {[
                      { v: 'piezas', l: 'Piezas' },
                      { v: 'pct', l: 'Porcentaje' },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setAreaMode(o.v)}
                        aria-pressed={areaMode === o.v}
                        className={cn(
                          'rounded-lg px-3 py-1 text-[12.5px] font-semibold transition',
                          areaMode === o.v
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                {areas.total ? (
                  <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                    <Donut
                      parts={areas.list.map((a) => ({
                        key: a.line,
                        value: a.pieces,
                        color: areaOf(a.line).color,
                      }))}
                      total={areaMode === 'pct' ? 100 : areas.total}
                      unit={areaMode === 'pct' ? '% de los escaneos' : 'escaneos de las 3 áreas'}
                    />
                    <ul className="w-full min-w-0 flex-1 space-y-3">
                      {areas.list.map((a) => {
                        const pct = areas.total ? a.pieces / areas.total : 0
                        return (
                          <li key={a.line}>
                            <div className="flex items-baseline gap-2 text-[13.5px]">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ background: areaOf(a.line).color }}
                              />
                              <span className="min-w-0 flex-1 truncate font-semibold">{a.line}</span>
                              <span
                                className={cn(
                                  'tabular font-extrabold',
                                  areaMode === 'pct' && 'text-muted-foreground',
                                )}
                              >
                                {fmtInt(a.pieces)}
                              </span>
                              <span
                                className={cn(
                                  'tabular w-14 text-right',
                                  areaMode === 'pct' ? 'font-extrabold' : 'text-muted-foreground',
                                )}
                              >
                                {(pct * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all duration-500',
                                  areaOf(a.line).bar,
                                )}
                                style={{ width: `${pct * 100}%` }}
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed p-6 text-center text-[13px] text-muted-foreground">
                    Sin escaneos en este periodo
                  </p>
                )}
                <p className="mt-3 text-[11.5px] text-muted-foreground">
                  Una misma tele puede escanearse en las 3 áreas: el total es de escaneos, no de piezas
                  producidas.
                </p>
              </Card>

              {/* Rendimiento por area */}
              <Card className="flex-1 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                    <Trophy className="h-5 w-5" />
                  </span>
                  <h3 className="mr-auto text-[17px] font-extrabold">Rendimiento por área</h3>
                  <span className="text-[12.5px] text-muted-foreground">Escaneos por persona</span>
                </div>
                {ranking.length ? (
                  <ul className="mt-4 space-y-3.5">
                    {ranking.map((a, i) => (
                      <li key={a.line} className="flex items-center gap-3">
                        <span
                          className={cn(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                            areaOf(a.line).icon,
                          )}
                        >
                          <Award className={cn('h-4 w-4', i === 0 && 'fill-current')} />
                        </span>
                        <span className="w-[42%] min-w-0 truncate text-[14px] font-semibold sm:w-[38%]">
                          {a.line}
                        </span>
                        <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              'block h-full rounded-full transition-all duration-500',
                              areaOf(a.line).bar,
                            )}
                            style={{ width: `${(a.perPerson / maxRank) * 100}%` }}
                          />
                        </span>
                        <span className="tabular w-12 text-right text-[15px] font-extrabold">
                          {fmt1(a.perPerson)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed p-6 text-center text-[13px] text-muted-foreground">
                    Sin escaneos en este periodo
                  </p>
                )}
                <p className="mt-3 text-[11.5px] text-muted-foreground">
                  Cada área cuenta como 1 persona por turno trabajado: escaneos del área ÷ turnos en que
                  escaneó.
                </p>
              </Card>
            </div>
          </div>

          {/* Detalle por turno */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 border-b px-4 py-3.5 sm:px-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                <List className="h-5 w-5" />
              </span>
              <h3 className="mr-auto text-[17px] font-extrabold">Detalle por turno</h3>
              {table.length > 0 && (
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-[13px] font-semibold hover:bg-muted"
                >
                  <Download className="h-4 w-4" /> Exportar
                </button>
              )}
            </div>
            {table.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-[13.5px]">
                  <thead>
                    <tr className="bg-muted/50 text-left text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                      {[
                        'Fecha',
                        'Turno',
                        'Áreas (piezas escaneadas)',
                        'Personas',
                        'Producido',
                        'Piezas / persona',
                        'Estatus',
                      ].map((h) => (
                        <th key={h} className="px-4 py-2.5 font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {table.map((r) => {
                      const k = keyCmp(r.shiftDate, r.shift)
                      const st =
                        !r.people && r.produced
                          ? {
                              l: 'Sin escaneos de área',
                              c: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
                            }
                          : k === currentKey
                            ? {
                                l: 'En curso',
                                c: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
                              }
                            : {
                                l: 'Completado',
                                c: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
                              }
                      return (
                        <tr key={k}>
                          <td className="px-4 py-3 font-semibold">
                            {fmtYmd(r.shiftDate)} {r.shiftDate.slice(0, 4)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold',
                                r.shift === 'T1'
                                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
                              )}
                            >
                              {shiftLabel(r.shift)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {r.lines.length
                              ? r.lines.map((l) => `${l.line}: ${fmtInt(l.pieces)}`).join(' · ')
                              : '—'}
                          </td>
                          <td className="tabular px-4 py-3">{r.people ?? '—'}</td>
                          <td className="tabular px-4 py-3 font-semibold">{fmtInt(r.produced)}</td>
                          <td className="tabular px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                            {fmt1(r.perPerson)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
                                st.c,
                              )}
                            >
                              ● {st.l}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="px-4 py-3" colSpan={2}>
                        Promedio del periodo
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">—</td>
                      <td className="tabular px-4 py-3">{fmt1(t.avgPeople)}</td>
                      <td className="tabular px-4 py-3">
                        {fmtInt(table.length ? t.produced / table.length : 0)}
                      </td>
                      <td className="tabular px-4 py-3">{fmt1(t.perPerson)}</td>
                      <td className="px-4 py-3 text-muted-foreground">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="m-4 rounded-xl border border-dashed p-6 text-center text-[13px] text-muted-foreground">
                Sin turnos con actividad en este periodo
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
