import { BarChart3, Box, History } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Badge, Card, CardHeader, Empty, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt, fmtShift, fmtTime } from '@/lib/utils'
import { BackLink, CountVsGoal, fmtDec, hourLabels, KpiGrid, lineKpis, ShiftPicker, useShiftParams } from './common'

export default function LineaDetalle() {
  const name = useParams().line || ''
  const sel = useShiftParams()
  const query = { shiftDate: sel.shiftDate, shift: sel.shift }
  const live = useApi('/production/live', { query, refreshMs: 15000 })
  const recent = useApi('/production', { query: { ...query, line: name, limit: 50 }, refreshMs: 30000 })

  const data = live.data
  const line = data?.lines.find((l) => l.line === name)
  const ctx = data && { shiftDate: data.shiftDate, shift: data.shift, now: data.now }
  const k = line && lineKpis(line, ctx)

  return (
    <div className="space-y-5">
      <PageHeader
        back={<BackLink to={`/produccion/lineas${sel.search}`}>Líneas en vivo</BackLink>}
        title={`Línea ${name}`}
        subtitle={fmtShift(sel.shiftDate, sel.shift)}
        actions={<ShiftPicker shiftDate={sel.shiftDate} shift={sel.shift} onChange={sel.setShift} />}
      />

      <ErrorBox error={live.error} />

      {live.loading && !data ? (
        <Spinner />
      ) : data && !line ? (
        <Card>
          <Empty icon={Box} title="Línea no encontrada">
            La línea no existe o está inactiva.
          </Empty>
        </Card>
      ) : line ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
            <Card className="p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Avance vs meta</span>
                {k.active && <Badge tone="green" dot>En vivo</Badge>}
              </div>
              <CountVsGoal count={line.count} goal={line.goal} pct={k.pct} size="lg" />
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                {line.planned !== null ? 'Meta según plan de materiales' : 'Meta estándar de la línea'} · {fmtDec(k.goalPerHour)} pz/h para cumplir
              </p>
              <KpiGrid line={line} k={k} className="mt-4 border-t pt-4" />
            </Card>
            <Card>
              <CardHeader icon={BarChart3} title="Producción por hora" subtitle={`Línea punteada: ${fmtDec(k.goalPerHour)} pz/h para la meta`} />
              <div className="p-4 sm:p-5">
                <HourChart perHour={line.perHour} labels={hourLabels(sel.shift)} goalPerHour={k.goalPerHour} currentHour={k.currentHour} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader icon={History} title="Registros recientes" subtitle="Últimos 50 de la línea en el turno" />
            {recent.loading && !recent.data ? (
              <Spinner className="py-10" />
            ) : recent.error ? (
              <ErrorBox error={recent.error} className="m-4" />
            ) : recent.data?.records.length ? (
              <ul className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
                {recent.data.records.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 sm:border-b sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13.5px] font-semibold">{r.serial}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {r.model} · {r.brand} · {r.registered_by_name || '—'}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-[12.5px] font-semibold text-muted-foreground">{fmtTime(r.registered_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={Box} title="Sin registros en este turno" />
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}

// Grafica de barras por hora del turno con linea de meta por hora.
function HourChart({ perHour, labels, goalPerHour, currentHour }) {
  const max = Math.max(1, goalPerHour, ...perHour) * 1.15
  const goalPos = (goalPerHour / max) * 100
  return (
    <div>
      <div className="relative flex h-52 items-end gap-[3px] border-b sm:gap-1.5">
        {goalPerHour > 0 && (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-amber-500/80" style={{ bottom: `${goalPos}%` }}>
            <span className="absolute -top-5 right-0 rounded bg-amber-500 px-1.5 text-[10.5px] font-bold text-white">{fmtDec(goalPerHour, 0)}</span>
          </div>
        )}
        {perHour.map((v, i) => {
          const future = currentHour !== null && i > currentHour
          const tone = future ? 'bg-muted' : v >= goalPerHour && v > 0 ? 'bg-emerald-500' : i === currentHour ? 'bg-primary/60' : 'bg-primary'
          return (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${labels[i]}:00 · ${v} pz`}>
              {v > 0 && <span className="tabular mb-0.5 hidden text-[10.5px] font-bold text-muted-foreground min-[420px]:block">{v}</span>}
              <div className={cn('w-full rounded-t-md transition-all duration-500', tone)} style={{ height: `${(v / max) * 100}%`, minHeight: v ? 3 : 0 }} />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px] sm:gap-1.5">
        {labels.map((l, i) => (
          <span key={i} className={cn('tabular min-w-0 flex-1 text-center text-[10px] font-semibold text-muted-foreground', i === currentHour && 'text-primary')}>
            {l}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">
        Total {fmtInt(perHour.reduce((a, b) => a + b, 0))} pz · mejor hora {fmtInt(Math.max(0, ...perHour))} pz
      </p>
    </div>
  )
}
