import { BrandSplit } from '@/components/BrandSplit'
import { CalendarDays, ChevronDown, HelpCircle, Printer, Target, TrendingUp, XCircle } from 'lucide-react'
import { useState } from 'react'
import { shiftLabel } from '@shared/shift.js'
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, PageHeader, Progress, Spinner, Stat } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt, fmtPct, fmtYmd } from '@/lib/utils'
import { BackLink, BrandControl, Delta, PeriodControls, pctTone, periodText, usePeriod } from './common'

function planSource(lines) {
  const withPlan = lines.filter((l) => l.plan > 0)
  if (!withPlan.length) return null
  const captured = withPlan.filter((l) => l.planCaptured).length
  if (captured === withPlan.length) return { label: 'Meta capturada', tone: 'blue' }
  if (!captured) return { label: 'Meta del día', tone: 'gray' }
  return { label: 'Plan mixto', tone: 'violet' }
}

function Metric({ label, children, hint, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tabular mt-0.5 text-[17px] font-extrabold leading-tight">{children}</div>
      {hint && <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

function ShiftRow({ s, open, onToggle }) {
  const src = planSource(s.lines)
  return (
    <li className="break-inside-avoid">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-4 py-3.5 text-left transition hover:bg-muted/40 sm:px-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold">{fmtYmd(s.shiftDate)}</span>
          <Badge tone={s.shift === 'T1' ? 'amber' : 'blue'}>{shiftLabel(s.shift)}</Badge>
          {src && <Badge tone={src.tone}>{src.label}</Badge>}
          {s.rejected > 0 && <Badge tone="red">{fmtInt(s.rejected)} rechazos</Badge>}
          <ChevronDown className={cn('no-print ml-auto h-5 w-5 text-muted-foreground transition', open && 'rotate-180')} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-6">
          <Metric label="Plan">{fmtInt(s.plan)}</Metric>
          <Metric label="Real">{fmtInt(s.processed)}</Metric>
          <Metric label="Delta">
            <Delta value={s.delta} />
          </Metric>
          <Metric label="Cumpl.">
            <span className={cn(s.pct !== null && (s.pct >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'))}>{fmtPct(s.pct)}</span>
          </Metric>
          <Metric label="Recovery" hint={s.carryOver ? `+${fmtInt(s.carryOver)} pendiente` : 'sin pendiente'}>
            {fmtInt(s.recoveryPlan)}
          </Metric>
          <Metric label="Personas">{s.people ?? '—'}</Metric>
        </div>
        <Progress value={s.pct} tone={pctTone(s.pct)} className="mt-3 h-1.5" />
      </button>
      {open && (
        <div className="px-4 pb-4 sm:px-5">
          <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[1fr_repeat(4,minmax(0,52px))] gap-2 bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[1fr_repeat(4,90px)]">
              <span>Origen</span>
              <span className="text-right">Plan</span>
              <span className="text-right">Real</span>
              <span className="text-right">Delta</span>
              <span className="text-right">Pers.</span>
            </div>
            {s.lines.map((l) => (
              <div key={l.line} className="grid grid-cols-[1fr_repeat(4,minmax(0,52px))] items-center gap-2 border-t px-3 py-2 text-[13.5px] sm:grid-cols-[1fr_repeat(4,90px)]">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{l.line}</span>
                  <span className="block text-[11px] text-muted-foreground">{l.plan ? (l.planCaptured ? 'meta capturada' : 'meta del día (765)') : 'sin plan'}</span>
                </span>
                <span className="tabular text-right">{fmtInt(l.plan)}</span>
                <span className="tabular text-right font-semibold">{fmtInt(l.processed)}</span>
                <span className="text-right">
                  <Delta value={l.processed - l.plan} />
                </span>
                <span className="tabular text-right">{l.people ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </li>
  )
}

export default function ReporteDia() {
  const p = usePeriod('hoy')
  const [brand, setBrand] = useState('')
  const [open, setOpen] = useState({})
  const { data, error, loading } = useApi('/reports/day', {
    query: { from: p.from, to: p.to, brand },
    refreshMs: p.isToday ? 60000 : undefined,
  })
  const t = data?.totals
  const shifts = data?.shifts ? [...data.shifts].reverse() : []
  const keyOf = (s) => `${s.shiftDate}|${s.shift}`
  const allOpen = shifts.length > 0 && shifts.every((s) => open[keyOf(s)])
  const toggleAll = () => setOpen(allOpen ? {} : Object.fromEntries(shifts.map((s) => [keyOf(s), true])))

  return (
    <div className="space-y-5">
      <PageHeader
        back={<BackLink to="/reportes" label="Reportes" />}
        title="Reporte del día"
        subtitle={`Plan vs Real · ${periodText(p.from, p.to)}${brand ? ` · ${brand}` : ''}`}
        actions={
          <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        }
      />

      <Card className="no-print flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
        <PeriodControls p={p} />
        <BrandControl value={brand} onChange={setBrand} />
      </Card>

      <ErrorBox error={error} />

      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <Stat label="Plan" value={fmtInt(t.plan)} icon={Target} hint={`${shifts.length} turno${shifts.length === 1 ? '' : 's'}`} />
            <Stat label="Real" value={fmtInt(t.processed)} icon={TrendingUp} tone="blue" hint="Salidas cerradas + por línea" />
            <Stat
              label="Delta"
              value={<Delta value={t.delta} className="font-extrabold" />}
              hint={t.delta < 0 ? 'Faltante contra plan' : t.delta > 0 ? 'Arriba del plan' : 'Justo en plan'}
            />
            <Stat
              label="Cumplimiento"
              value={fmtPct(t.pct)}
              tone={t.pct === null ? 'default' : t.pct >= 1 ? 'green' : t.pct >= 0.85 ? 'amber' : 'red'}
              hint="Real ÷ Plan"
            />
            <Stat
              label="Rechazos"
              value={fmtInt(t.rejected)}
              icon={XCircle}
              tone={t.rejected ? 'red' : 'default'}
              hint="Calidad, en el periodo"
              className="col-span-2 md:col-span-1"
            />
          </div>

          <BrandSplit brands={data.brands} />

          <Card>
            <CardHeader
              icon={CalendarDays}
              title="Por turno"
              subtitle="Toca un turno para ver el detalle"
              action={
                shifts.length > 0 && (
                  <Button variant="ghost" size="sm" className="no-print shrink-0" onClick={toggleAll}>
                    {allOpen ? 'Contraer' : 'Expandir todo'}
                  </Button>
                )
              }
            />
            {shifts.length ? (
              <ul className="divide-y">
                {shifts.map((s) => (
                  <ShiftRow
                    key={keyOf(s)}
                    s={s}
                    open={Boolean(open[keyOf(s)])}
                    onToggle={() => setOpen((o) => ({ ...o, [keyOf(s)]: !o[keyOf(s)] }))}
                  />
                ))}
              </ul>
            ) : (
              <Empty icon={CalendarDays} title="Sin plan ni producción en este periodo">
                Elige otro día o rango.
              </Empty>
            )}
          </Card>

          <Card className="break-inside-avoid p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <HelpCircle className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 text-[13.5px] leading-relaxed">
                <h3 className="text-[15px] font-bold">¿Cómo se calcula?</h3>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li>
                    <b className="text-foreground">Plan:</b> la meta del turno: 765 piezas o la que se capture en Hora por Hora (sigue
                    vigente los días siguientes). Cuenta en Turno 1 de día hábil; en Turno 2, fines de semana y feriados solo si se trabajó.
                  </li>
                  <li>
                    <b className="text-foreground">Real:</b> piezas de pallets de salida cerrados más las escaneadas (TV + caja) en Producción por línea, en el turno en que se escanearon; cada serie cuenta una vez.
                  </li>
                  <li>
                    <b className="text-foreground">Delta:</b> Real − Plan. Negativo (rojo) es lo que faltó; positivo (verde) es lo que se hizo de más.
                  </li>
                  <li>
                    <b className="text-foreground">Recovery:</b> Plan + lo que faltó en el turno anterior, para recuperar lo pendiente.
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  )
}
