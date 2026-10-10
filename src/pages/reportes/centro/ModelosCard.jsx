// Tarjeta "Producción por modelo": misma grafica (TrendChart) y misma proyeccion (shared/projection.js) que el
// reporte completo, con datos de /reports/models. Marca se filtra en el servidor; modelo con el desglose real por
// modelo y marca (byDay[].split). 14 / 30 dias = ultimos dias con produccion, como en el reporte completo.

import { projectProduction } from '@shared/projection.js'
import { addDays, shiftOf } from '@shared/shift.js'
import { Boxes, LineChart, Target } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt, fmtYmd } from '@/lib/utils'
import { Legend, TrendChart } from '../charts'
import { change, comparableRanges, PREV_LABEL, periodRange } from '../period'
import {
  CardError,
  CardSkeleton,
  Controls,
  linkTo,
  MiniSegmented,
  MiniSelect,
  NoData,
  Pct,
  PeriodNav,
  ReportCard,
  useBrandOptions,
  useCardState,
  useModelOptions,
} from './shell'

const WINDOWS = [
  { value: '14', label: '14 días' },
  { value: '30', label: '30 días' },
  { value: 'todo', label: 'Todo' },
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
]

// Piezas de un dia segun filtros: total, de un modelo, y de una marca dentro del dia.
const piecesOf = (d, model) =>
  model ? Object.values(d.split?.[model] || {}).reduce((a, n) => a + n, 0) : d.total
const brandOf = (d, model, brand) =>
  model ? d.split?.[model]?.[brand] || 0 : d.brands?.find((b) => b.brand === brand)?.pieces || 0

function Tile({ icon: Icon, tone, label, value, unit = 'piezas', children }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
        <span className={cn('grid h-6 w-6 place-items-center rounded-lg', tone)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="tabular text-[22px] font-extrabold leading-tight tracking-tight">{value}</span>
        {unit && <span className="text-[11.5px] text-muted-foreground">{unit}</span>}
      </p>
      <div className="min-h-[18px]">{children}</div>
    </div>
  )
}

export function ModelosCard({ onUpdate }) {
  const today = shiftOf().shiftDate
  const [f, set] = useCardState('modelos', { win: '30', anchor: today, brand: '', model: '', showProj: true })
  const brands = useBrandOptions()
  const models = useModelOptions(f.brand)
  const { data, error, loading, reload } = useApi('/reports/models', {
    query: { brand: f.brand },
    refreshMs: 60000,
  })
  useEffect(() => {
    if (data) onUpdate?.()
  }, [data, onUpdate])
  useEffect(() => {
    if (f.model && models.length > 1 && !models.some((m) => m.value === f.model)) set({ model: '' })
  }, [f.model, models, set])

  const view = useMemo(() => {
    if (!data) return null
    const series = data.byDay
      .map((d) => ({ d, date: d.date, value: piecesOf(d, f.model) }))
      .filter((x) => x.value > 0)
    const end = f.anchor > today ? today : f.anchor
    let shown
    let tileFrom
    let tileTo
    let prev = null
    let prevLabel = ''
    if (f.win === '14' || f.win === '30' || f.win === 'todo' || f.win === 'dia') {
      const upTo = series.filter((x) => x.date <= end)
      const n = f.win === 'todo' ? upTo.length : f.win === 'dia' ? 14 : Number(f.win)
      shown = upTo.slice(-n)
      if (f.win === 'dia') {
        tileFrom = end
        tileTo = end
        const c = comparableRanges('dia', end, today)
        if (c) prev = c
        prevLabel = PREV_LABEL.dia
      } else {
        tileFrom = shown[0]?.date
        tileTo = shown.at(-1)?.date
        if (f.win !== 'todo') {
          const before = upTo.slice(-2 * n, -n)
          if (before.length === n)
            prev = {
              cur: { from: tileFrom, to: tileTo },
              prev: { from: before[0].date, to: before.at(-1).date },
            }
          prevLabel = `vs. ${n} días anteriores`
        }
      }
    } else {
      const r = periodRange(f.win, end)
      shown = series.filter((x) => x.date >= r.from && x.date <= r.to)
      tileFrom = r.from
      tileTo = r.to
      prev = comparableRanges(f.win, end, today)
      prevLabel = PREV_LABEL[f.win]
    }
    const inRange = (from, to) => data.byDay.filter((d) => d.date >= from && d.date <= to)
    const sumBrand = (from, to, b) =>
      from ? inRange(from, to).reduce((a, d) => a + brandOf(d, f.model, b), 0) : 0
    const sumAll = (from, to) => (from ? inRange(from, to).reduce((a, d) => a + piecesOf(d, f.model), 0) : 0)
    const brandTiles = (f.brand ? [f.brand] : ['HY', 'SILO']).map((b) => ({
      brand: b,
      value: sumBrand(tileFrom, tileTo, b),
      change: prev
        ? change(sumBrand(prev.cur.from, prev.cur.to, b), sumBrand(prev.prev.from, prev.prev.to, b))
        : null,
    }))
    const total = sumAll(tileFrom, tileTo)
    const days = tileFrom ? inRange(tileFrom, tileTo).filter((d) => piecesOf(d, f.model) > 0).length : 0
    // Proyeccion: la misma del reporte completo, sobre la serie filtrada; solo si la ventana llega a hoy.
    const reachesToday = end >= today || (shown.at(-1)?.date || '') >= addDays(today, -1)
    const projection =
      f.showProj && reachesToday
        ? projectProduction(
            series.map((x) => x.value),
            data.totals.capacity,
            today,
          )
        : []
    const targets = (data.models || []).filter((m) => (f.model ? m.code === f.model : m.target > 0))
    const target = targets.reduce((a, m) => a + m.target, 0)
    const net = targets.reduce((a, m) => a + m.net, 0)
    return {
      points: shown.map((x) => ({ date: x.date, value: x.value, parts: [] })),
      projection,
      brandTiles,
      total,
      avg: days ? Math.round(total / days) : null,
      prevLabel,
      target,
      net,
      label: tileFrom
        ? tileFrom === tileTo
          ? fmtYmd(tileFrom)
          : `${fmtYmd(tileFrom, { dow: false })} – ${fmtYmd(tileTo, { dow: false })} ${tileTo.slice(0, 4)}`
        : 'Sin producción',
    }
  }, [data, f.win, f.anchor, f.model, f.brand, f.showProj, today])

  const navMode = f.win === 'semana' || f.win === 'mes' ? f.win : 'dia'

  return (
    <ReportCard
      tone="green"
      icon={LineChart}
      tag="Análisis por modelo"
      title="Producción por modelo"
      subtitle="Avance VIOS HY / SILO contra objetivo MTY + Texas."
      to={linkTo('/reportes/modelos', {
        brand: f.brand,
        win: ['14', '30', 'todo'].includes(f.win) ? f.win : '',
        day: f.anchor !== today ? f.anchor : '',
      })}
      loading={loading && Boolean(data)}
    >
      <Controls>
        <MiniSegmented label="Ventana" value={f.win} onChange={(win) => set({ win })} options={WINDOWS} />
        <PeriodNav
          mode={navMode}
          anchor={f.anchor}
          today={today}
          onChange={(anchor) => set({ anchor })}
          label={view && ['14', '30', 'todo'].includes(f.win) ? view.label : undefined}
        />
        <MiniSelect label="Marca" value={f.brand} onChange={(brand) => set({ brand })} options={brands} />
        <MiniSelect label="Modelo" value={f.model} onChange={(model) => set({ model })} options={models} />
      </Controls>

      {error && !data ? (
        <CardError error={error} onRetry={reload} />
      ) : !view ? (
        <CardSkeleton className="h-[290px]" />
      ) : !view.points.length && !view.total ? (
        <NoData />
      ) : (
        <>
          <div>
            <TrendChart
              points={view.points}
              projection={view.projection}
              showProjection={f.showProj}
              today={today}
              reference={{ value: data.totals.capacity, label: 'Meta del día' }}
              height={214}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Legend
                items={[
                  { label: 'Real', color: 'hsl(var(--primary))' },
                  ...(view.projection.length
                    ? [{ label: 'Proyección', color: '#d97706', dashed: true }]
                    : []),
                  { label: 'Meta del día', color: '#10b981', dashed: true },
                  { label: 'Hoy', color: '#ef4444', dashed: true },
                ]}
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={f.showProj}
                  onChange={(e) => set({ showProj: e.target.checked })}
                  className="h-3.5 w-3.5 rounded accent-[hsl(var(--primary))]"
                />
                Proyección
              </label>
            </div>
          </div>
          <div className="mt-auto grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-3">
            {view.brandTiles.map((b) => (
              <Tile
                key={b.brand}
                icon={Boxes}
                tone={
                  b.brand === 'SILO'
                    ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300'
                    : 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
                }
                label={`VIOS ${b.brand}${f.model ? ` · ${f.model}` : ''}`}
                value={fmtInt(b.value)}
              >
                {b.change !== null && (
                  <span className="text-[11.5px] text-muted-foreground">
                    <Pct value={b.change} className="text-[12px]" /> {view.prevLabel}
                  </span>
                )}
              </Tile>
            ))}
            {f.brand && (
              <Tile
                icon={Boxes}
                tone="bg-muted text-muted-foreground"
                label="Promedio por día"
                value={view.avg === null ? '—' : fmtInt(view.avg)}
              >
                <span className="text-[11.5px] text-muted-foreground">días con producción</span>
              </Tile>
            )}
            <Tile
              icon={Target}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
              label={f.model ? `Objetivo ${f.model}` : 'Objetivo'}
              value={view.target ? fmtInt(view.target) : '—'}
              unit={view.target ? 'piezas' : 'sin objetivo'}
            >
              {view.target > 0 && (
                <span className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(100, (view.net / view.target) * 100)}%` }}
                    />
                  </span>
                  <span className="tabular text-[12px] font-bold">
                    {Math.round((view.net / view.target) * 100)}%
                  </span>
                </span>
              )}
            </Tile>
          </div>
        </>
      )}
    </ReportCard>
  )
}
