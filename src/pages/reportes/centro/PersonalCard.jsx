// Tarjeta "Personal y productividad": datos de /reports/staffing (mismo reporte completo). En VIOS el personal son
// las areas de trabajo (Entrada, Produccion por linea, Salida = 1 persona cada una, regla de 2026-10-08), no hay
// empleados con nombre: el ranking es por area con sus piezas escaneadas. Total de piezas = produccion oficial.

import { shiftOf } from '@shared/shift.js'
import { ArrowDown, ArrowUp, BarChart3, Users } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt } from '@/lib/utils'
import { change, comparableRanges, PREV_LABEL, queryRange } from '../period'
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
  useCardState,
} from './shell'

const SHIFT_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'T1', label: 'Turno 1' },
  { value: 'T2', label: 'Turno 2' },
]
const INITIALS = { Entrada: 'EN', 'Producción por línea': 'PL', Salida: 'SA' }
const AVATAR = {
  Entrada: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  'Producción por línea': 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  Salida: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
}

export function PersonalCard({ onUpdate }) {
  const today = shiftOf().shiftDate
  const [f, set] = useCardState('personal', { mode: 'dia', anchor: today, shift: '' })
  const { from, to } = queryRange(f.mode, f.anchor, today)
  const { data, error, loading, reload } = useApi('/reports/staffing', {
    query: { from, to },
    refreshMs: to >= today ? 60000 : undefined,
  })
  // Periodo anterior comparable (solo dias cerrados si el actual sigue en curso).
  const cmp = comparableRanges(f.mode, f.anchor, today)
  const prevQ = useApi('/reports/staffing', { query: cmp ? cmp.prev : {}, skip: !cmp })
  const curQ = useApi('/reports/staffing', { query: cmp?.partial ? cmp.cur : {}, skip: !cmp?.partial })
  useEffect(() => {
    if (data) onUpdate?.()
  }, [data, onUpdate])

  const pick = (rows) => (rows || []).filter((r) => !f.shift || r.shift === f.shift)
  const view = useMemo(() => {
    if (!data) return null
    const rows = pick(data.rows)
    const byArea = new Map()
    for (const r of rows) for (const l of r.lines) byArea.set(l.line, (byArea.get(l.line) || 0) + l.pieces)
    const ranking = [...byArea]
      .map(([line, pieces]) => ({ line, pieces }))
      .sort((a, b) => b.pieces - a.pieces)
    const total = rows.reduce((a, r) => a + r.produced, 0)
    const sumOf = (d) => pick(d?.rows).reduce((a, r) => a + r.produced, 0)
    let variation = null
    if (cmp && prevQ.data && (!cmp.partial || curQ.data)) {
      variation = change(cmp.partial ? sumOf(curQ.data) : total, sumOf(prevQ.data))
    }
    return { ranking, total, variation }
  }, [data, prevQ.data, curQ.data, f.shift, cmp?.partial])

  const max = Math.max(1, ...(view?.ranking.map((x) => x.pieces) || [1]))

  return (
    <ReportCard
      tone="orange"
      icon={Users}
      tag="Rendimiento"
      title="Personal y productividad"
      subtitle="Piezas producidas por persona y por turno."
      to={linkTo('/reportes/personal', { from, to, shift: f.shift })}
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
        <MiniSelect
          label="Turno"
          value={f.shift}
          onChange={(shift) => set({ shift })}
          options={SHIFT_OPTIONS}
        />
      </Controls>

      {error && !data ? (
        <CardError error={error} onRetry={reload} />
      ) : !view ? (
        <CardSkeleton className="h-[260px]" />
      ) : !view.ranking.length && !view.total ? (
        <NoData />
      ) : (
        <>
          <ul className="space-y-3.5">
            {view.ranking.map((x) => (
              <li key={x.line} className="flex items-center gap-3">
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-extrabold',
                    AVATAR[x.line] || 'bg-muted text-foreground',
                  )}
                  aria-hidden="true"
                >
                  {INITIALS[x.line] || x.line.slice(0, 2).toUpperCase()}
                </span>
                <span className="w-[38%] min-w-0 truncate text-[14px] font-semibold sm:w-[34%]">
                  {x.line}
                </span>
                <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-blue-600 dark:bg-blue-500"
                    style={{ width: `${(x.pieces / max) * 100}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right leading-tight">
                  <span className="tabular block text-[15px] font-extrabold">{fmtInt(x.pieces)}</span>
                  <span className="block text-[11px] text-muted-foreground">piezas</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] text-muted-foreground">
            Cada área de trabajo cuenta como 1 persona; sus piezas son las que escaneó en el periodo.
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-4 rounded-xl bg-muted/50 px-4 py-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-muted-foreground">Total de piezas</p>
              <p className="flex items-baseline gap-1.5">
                <span className="tabular text-[26px] font-extrabold leading-tight tracking-tight">
                  {fmtInt(view.total)}
                </span>
                <span className="text-[13px] text-muted-foreground">piezas</span>
              </p>
            </div>
            <div className="flex items-center gap-2 border-l pl-4">
              {view.variation === null ? (
                <span className="max-w-[150px] text-[12px] text-muted-foreground">
                  {cmp ? 'Sin datos del periodo anterior' : 'Periodo en curso, sin comparar'}
                </span>
              ) : (
                <>
                  {view.variation >= 0 ? (
                    <ArrowUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ArrowDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                  )}
                  <span className="leading-tight">
                    <span
                      className={cn(
                        'tabular block text-[18px] font-extrabold',
                        view.variation >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {view.variation >= 0 ? '+' : '−'}
                      {Math.abs(view.variation * 100).toFixed(0)}%
                    </span>
                    <span className="block text-[12px] text-muted-foreground">
                      {PREV_LABEL[f.mode]}
                      {cmp?.partial ? ' (días cerrados)' : ''}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </ReportCard>
  )
}
