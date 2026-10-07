import { ChevronRight, Factory, Gauge, Target, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, Empty, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt, fmtPct, fmtShift } from '@/lib/utils'
import { BackLink, CountVsGoal, fmtDec, KpiGrid, lineKpis, ShiftPicker, totalsOf, useShiftParams } from './common'

export default function Lineas() {
  const sel = useShiftParams()
  const { data, error, loading } = useApi('/production/live', {
    query: { shiftDate: sel.shiftDate, shift: sel.shift },
    refreshMs: 15000,
  })
  const ctx = data && { shiftDate: data.shiftDate, shift: data.shift, now: data.now }
  const t = data ? totalsOf(data.lines, ctx) : null

  return (
    <div className="space-y-5">
      <PageHeader
        back={<BackLink to="/produccion">Producción</BackLink>}
        title="Líneas en vivo"
        subtitle={sel.isCurrent ? 'Se actualiza cada 15 segundos' : fmtShift(sel.shiftDate, sel.shift)}
        actions={<ShiftPicker shiftDate={sel.shiftDate} shift={sel.shift} onChange={sel.setShift} />}
      />

      <ErrorBox error={error} />

      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <>
          <Card className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Total planta</span>
                {sel.isCurrent && <Badge tone="green" dot>En vivo</Badge>}
              </div>
              <CountVsGoal count={t.count} goal={t.goal} pct={t.pct} size="lg" />
            </div>
            <div className="grid grid-cols-3 gap-2 md:border-l md:pl-5">
              <Mini icon={Gauge} label="Pz / hora" value={fmtDec(t.uph)} />
              <Mini icon={Users} label="Personal" value={t.people ? fmtInt(t.people) : '—'} />
              <Mini
                icon={TrendingUp}
                label="Proyección"
                value={fmtInt(t.projection)}
                tone={t.goal ? (t.projection >= t.goal ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300') : ''}
              />
            </div>
          </Card>

          {data.lines.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.lines.map((l) => (
                <LineCard key={l.line} line={l} k={lineKpis(l, ctx)} to={`/produccion/lineas/${encodeURIComponent(l.line)}${sel.search}`} />
              ))}
            </div>
          ) : (
            <Card>
              <Empty icon={Factory} title="No hay líneas activas">
                Da de alta líneas en Administración › Catálogos.
              </Empty>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}

function Mini({ icon: Icon, label, value, tone }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/60 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn('tabular mt-0.5 truncate text-[18px] font-extrabold', tone)}>{value}</div>
    </div>
  )
}

function LineCard({ line, k, to }) {
  const met = k.pct !== null && k.pct >= 1
  const ring = k.idle === 'red' ? 'border-red-300 dark:border-red-500/40' : k.idle === 'amber' ? 'border-amber-300 dark:border-amber-500/40' : ''
  return (
    <Link to={to} className={cn('card group block p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:p-5', ring)}>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Target className="h-[18px] w-[18px]" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[16px] font-extrabold">{line.line}</h3>
        {met ? (
          <Badge tone="green">Meta</Badge>
        ) : k.idle === 'red' ? (
          <Badge tone="red" dot>Detenida</Badge>
        ) : k.idle === 'amber' ? (
          <Badge tone="amber" dot>Lenta</Badge>
        ) : k.active && line.count ? (
          <Badge tone="blue" dot>Activa</Badge>
        ) : null}
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>
      <CountVsGoal count={line.count} goal={line.goal} pct={k.pct} />
      {line.planned !== null && (
        <p className="mt-1.5 text-[12px] text-muted-foreground">Meta por plan de materiales · {fmtPct(k.pct)}</p>
      )}
      <KpiGrid line={line} k={k} className="mt-4 border-t pt-3.5" />
    </Link>
  )
}
