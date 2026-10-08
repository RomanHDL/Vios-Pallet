// Personal y productividad: piezas producidas del turno (salidas cerradas + escaneo por linea) (sin linea) entre las personas del turno
// (suma de lo capturado por linea en Reportes -> Personal del turno).
import { shiftLabel } from '@shared/shift.js'
import { AlertTriangle, BarChart3, Factory, Gauge, Users } from 'lucide-react'
import { useMemo } from 'react'
import {
  Badge,
  Card,
  CardHeader,
  Empty,
  ErrorBox,
  PageHeader,
  Spinner,
  Stat,
  Table,
  Td,
  Th,
} from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { fmtInt, fmtYmd } from '@/lib/utils'
import { HBars } from './charts'
import { BackLink, PeriodControls, periodText, usePeriod } from './common'

const fmt1 = (v) =>
  v === null || v === undefined ? '—' : v.toLocaleString('es-MX', { maximumFractionDigits: 1 })
const shortShift = (r) => `${fmtYmd(r.shiftDate, { dow: false })} · ${r.shift === 'T1' ? 'T1' : 'T2'}`

// Promedio de personas por linea en los turnos donde se capturo.
function peopleByLine(rows) {
  const m = new Map()
  for (const r of rows)
    for (const l of r.lines) {
      const s = m.get(l.line) || { line: l.line, people: 0, shifts: 0 }
      s.people += l.people
      s.shifts++
      m.set(l.line, s)
    }
  return [...m.values()]
    .map((s) => ({ ...s, avg: s.people / s.shifts }))
    .sort((a, b) => a.line.localeCompare(b.line))
}

export default function ReportePersonal() {
  const p = usePeriod('semana')
  const { data, error, loading } = useApi('/reports/staffing', { query: { from: p.from, to: p.to } })
  const rows = useMemo(() => data?.rows || [], [data])
  const lines = useMemo(() => peopleByLine(rows), [rows])
  const recent = useMemo(() => [...rows].reverse(), [rows])

  const totals = useMemo(() => {
    const staffed = rows.filter((r) => r.people)
    const people = staffed.reduce((a, r) => a + r.people, 0)
    return {
      produced: rows.reduce((a, r) => a + r.produced, 0),
      avgPeople: staffed.length ? people / staffed.length : null,
      perPerson: people ? staffed.reduce((a, r) => a + r.produced, 0) / people : null,
      missing: rows.filter((r) => !r.people && r.produced > 0).length,
    }
  }, [rows])

  return (
    <div className="space-y-5">
      <PageHeader
        back={<BackLink to="/reportes" label="Reportes" />}
        title="Personal y productividad"
        subtitle={`Piezas producidas por persona · ${periodText(p.from, p.to)}`}
      />

      <Card className="p-3 sm:p-4">
        <PeriodControls p={p} />
      </Card>

      <ErrorBox error={error} />

      {loading && !data ? (
        <Spinner />
      ) : data && !rows.length ? (
        <Card>
          <Empty icon={Users} title="Sin personal ni producción en este periodo">
            El personal se captura por línea y turno en Reportes → Personal del turno.
          </Empty>
        </Card>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Producido"
              value={fmtInt(totals.produced)}
              icon={Factory}
              tone="blue"
              hint={`Salidas + por línea · ${rows.length} turno${rows.length === 1 ? '' : 's'}`}
            />
            <Stat
              label="Personas / turno"
              value={fmt1(totals.avgPeople)}
              icon={Users}
              hint="Promedio, turnos con captura"
            />
            <Stat
              label="Piezas / persona"
              value={fmt1(totals.perPerson)}
              icon={Gauge}
              tone="green"
              hint="Solo turnos con personal"
            />
            <Stat
              label="Sin personal"
              value={fmtInt(totals.missing)}
              icon={AlertTriangle}
              tone={totals.missing ? 'amber' : 'default'}
              hint="Turnos con producción sin captura"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                icon={BarChart3}
                title="Piezas por persona"
                subtitle="Producido ÷ personas, por turno"
              />
              <div className="p-4 sm:p-5">
                {recent.some((r) => r.perPerson !== null) ? (
                  <HBars
                    format={fmt1}
                    items={recent
                      .filter((r) => r.perPerson !== null)
                      .map((r) => ({
                        label: shortShift(r),
                        value: r.perPerson,
                        hint: `· ${fmtInt(r.produced)} pzas / ${r.people}`,
                        className: 'bg-emerald-500',
                      }))}
                  />
                ) : (
                  <p className="text-[13.5px] text-muted-foreground">
                    Captura el personal del turno para ver piezas por persona.
                  </p>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader icon={Users} title="Personas por línea" subtitle="Promedio por turno capturado" />
              <div className="p-4 sm:p-5">
                {lines.length ? (
                  <HBars
                    format={fmt1}
                    items={lines.map((l) => ({
                      label: l.line,
                      value: l.avg,
                      hint: `· ${l.shifts} turno${l.shifts === 1 ? '' : 's'}`,
                      className: 'bg-amber-500',
                    }))}
                  />
                ) : (
                  <p className="text-[13.5px] text-muted-foreground">Sin personal capturado en el periodo.</p>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Detalle por turno" subtitle="Más reciente primero" />
            {/* Celular: tarjetas por turno */}
            <ul className="divide-y md:hidden">
              {recent.map((r) => (
                <li key={`${r.shiftDate}|${r.shift}`} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[14.5px] font-bold">{fmtYmd(r.shiftDate)}</span>
                    <Badge tone={r.shift === 'T1' ? 'amber' : 'blue'}>{shiftLabel(r.shift)}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-muted/50 px-2 py-2">
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Personas
                      </div>
                      <div className="tabular text-[17px] font-extrabold">{r.people ?? '—'}</div>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-2 py-2">
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Producido
                      </div>
                      <div className="tabular text-[17px] font-extrabold">{fmtInt(r.produced)}</div>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-2 py-2">
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Pzs / pers.
                      </div>
                      <div className="tabular text-[17px] font-extrabold text-emerald-700 dark:text-emerald-300">
                        {fmt1(r.perPerson)}
                      </div>
                    </div>
                  </div>
                  {r.lines.length > 0 && (
                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                      {r.lines.map((l) => `${l.line}: ${l.people}`).join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {/* PC: tabla */}
            <Table className="hidden md:block">
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Turno</Th>
                  <Th>Personas por línea</Th>
                  <Th className="text-right">Personas</Th>
                  <Th className="text-right">Producido</Th>
                  <Th className="text-right">Piezas / persona</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={`${r.shiftDate}|${r.shift}`} className="hover:bg-muted/30">
                    <Td className="whitespace-nowrap font-semibold">{fmtYmd(r.shiftDate)}</Td>
                    <Td>
                      <Badge tone={r.shift === 'T1' ? 'amber' : 'blue'}>{shiftLabel(r.shift)}</Badge>
                    </Td>
                    <Td className="text-[13px] text-muted-foreground">
                      {r.lines.length ? r.lines.map((l) => `${l.line}: ${l.people}`).join(' · ') : '—'}
                    </Td>
                    <Td className="tabular text-right">
                      {r.people ?? <span className="text-amber-600 dark:text-amber-400">sin captura</span>}
                    </Td>
                    <Td className="tabular text-right font-semibold">{fmtInt(r.produced)}</Td>
                    <Td className="tabular text-right font-bold text-emerald-700 dark:text-emerald-300">
                      {fmt1(r.perPerson)}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 text-[13px]">
                  <Td colSpan={3} className="font-semibold text-muted-foreground">
                    Promedio del periodo
                  </Td>
                  <Td className="tabular text-right font-semibold">{fmt1(totals.avgPeople)}</Td>
                  <Td className="tabular text-right font-semibold">{fmtInt(totals.produced)}</Td>
                  <Td className="tabular text-right font-extrabold text-emerald-700 dark:text-emerald-300">
                    {fmt1(totals.perPerson)}
                  </Td>
                </tr>
              </tfoot>
            </Table>
          </Card>
        </>
      ) : null}
    </div>
  )
}
