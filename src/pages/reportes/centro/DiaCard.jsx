// Tarjeta "Reporte del día": Plan vs Real con los mismos datos de /reports/day (Reporte del día completo).
// Dia = turnos de esa fecha; Semana = dias; Mes = semanas del mes. Delta = Real - Plan (definicion oficial).

import { SHIFTS, shiftOf } from '@shared/shift.js'
import { BarChart3 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt, fmtYmd } from '@/lib/utils'
import { PlanRealBars } from '../charts'
import { eachDay, periodRange, queryRange } from '../period'
import {
  CardError,
  CardSkeleton,
  Controls,
  fmtSigned,
  linkTo,
  Metric,
  MiniSegmented,
  MiniSelect,
  MODE_OPTIONS,
  NoData,
  Pct,
  PeriodNav,
  ReportCard,
  useBrandOptions,
  useCardState,
  useModelOptions,
} from './shell'

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const dowOf = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}
const hhmm = (t) => {
  const [h, m] = t.split(':').map(Number)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function groupsOf(mode, anchor, today, shifts) {
  const sum = (list) => ({
    plan: list.reduce((a, x) => a + x.plan, 0),
    real: list.reduce((a, x) => a + x.processed, 0),
  })
  if (mode === 'dia')
    return SHIFTS.map((s) => {
      const row = shifts.find((x) => x.shiftDate === anchor && x.shift === s.key)
      return {
        key: s.key,
        label: s.label,
        sub: `${hhmm(s.start)} – ${hhmm(s.end)}`,
        plan: row?.plan || 0,
        real: row?.processed || 0,
      }
    })
  const { from, to } = queryRange(mode, anchor, today)
  if (mode === 'semana')
    return eachDay(from, to).map((d) => ({
      key: d,
      label: dowOf(d),
      sub: fmtYmd(d, { dow: false }),
      ...sum(shifts.filter((x) => x.shiftDate === d)),
    }))
  // Mes: semanas (lunes a domingo) dentro del mes.
  const weeks = []
  for (const d of eachDay(from, to)) {
    const w = periodRange('semana', d).from
    let g = weeks.at(-1)
    if (!g || g.w !== w) {
      g = { w, days: [] }
      weeks.push(g)
    }
    g.days.push(d)
  }
  return weeks.map((g, i) => ({
    key: g.w,
    label: `Sem ${i + 1}`,
    sub: `${g.days[0].slice(8)}–${fmtYmd(g.days.at(-1), { dow: false })}`,
    ...sum(shifts.filter((x) => g.days.includes(x.shiftDate))),
  }))
}

export function DiaCard({ onUpdate }) {
  const today = shiftOf().shiftDate
  const [f, set] = useCardState('dia', { mode: 'dia', anchor: today, brand: '', model: '' })
  const brands = useBrandOptions()
  const models = useModelOptions(f.brand)
  const { from, to } = queryRange(f.mode, f.anchor, today)
  const { data, error, loading, reload } = useApi('/reports/day', {
    query: { from, to, brand: f.brand, model: f.model },
    refreshMs: to >= today ? 60000 : undefined,
  })
  useEffect(() => {
    if (data) onUpdate?.()
  }, [data, onUpdate])
  // Si el modelo elegido no existe para la marca nueva, se quita.
  useEffect(() => {
    if (f.model && models.length > 1 && !models.some((m) => m.value === f.model)) set({ model: '' })
  }, [f.model, models, set])

  const groups = useMemo(
    () => (data ? groupsOf(f.mode, f.anchor, today, data.shifts) : []),
    [data, f.mode, f.anchor, today],
  )
  const t = data?.totals
  const delta = t ? t.processed - t.plan : 0
  const empty = t && !t.plan && !t.processed

  return (
    <ReportCard
      tone="blue"
      icon={BarChart3}
      tag="Reporte diario"
      title="Reporte del día"
      subtitle="Plan vs Real, Delta y Recovery por turno."
      to={linkTo('/reportes/dia', { from, to, brand: f.brand, model: f.model })}
      loading={loading && Boolean(data)}
    >
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

      {error && !data ? (
        <CardError error={error} onRetry={reload} />
      ) : !data ? (
        <CardSkeleton className="h-[290px]" />
      ) : empty ? (
        <NoData />
      ) : (
        <>
          <div>
            <PlanRealBars groups={groups} height={224} />
            <div className="mt-1 flex items-center justify-center gap-5 text-[12px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-400 dark:bg-blue-900" /> Plan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Real
              </span>
            </div>
          </div>
          <div className="mt-auto grid grid-cols-3 divide-x rounded-xl bg-muted/50">
            <Metric label="Total plan" value={fmtInt(t.plan)} />
            <Metric label="Total real" value={fmtInt(t.processed)} />
            <Metric
              label="Delta"
              value={
                <span
                  className={cn(
                    delta < 0 && 'text-red-600 dark:text-red-400',
                    delta > 0 && 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {fmtSigned(delta)}
                </span>
              }
              extra={t.plan > 0 ? <Pct value={delta / t.plan} /> : null}
            />
          </div>
        </>
      )}
    </ReportCard>
  )
}
