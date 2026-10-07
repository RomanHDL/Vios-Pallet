import { AlertTriangle, BarChart3, Factory, Gauge, Users } from 'lucide-react'
import { useMemo } from 'react'
import { shiftLabel } from '@shared/shift.js'
import { Badge, Card, CardHeader, Empty, ErrorBox, PageHeader, Spinner, Stat, Table, Td, Th } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { fmtInt, fmtYmd } from '@/lib/utils'
import { HBars } from './charts'
import { BackLink, PeriodControls, periodText, usePeriod } from './common'

const fmt1 = (v) => (v === null || v === undefined ? '—' : v.toLocaleString('es-MX', { maximumFractionDigits: 1 }))

function summarize(rows) {
  const byLine = new Map()
  for (const r of rows) {
    const s = byLine.get(r.line) || { line: r.line, shifts: 0, people: 0, staffed: 0, produced: 0, producedStaffed: 0 }
    s.shifts++
    s.produced += r.produced
    if (r.people) {
      s.staffed++
      s.people += r.people
      s.producedStaffed += r.produced
    }
    byLine.set(r.line, s)
  }
  return [...byLine.values()]
    .map((s) => ({
      ...s,
      avgPeople: s.staffed ? s.people / s.staffed : null,
      perPerson: s.people ? s.producedStaffed / s.people : null,
    }))
    .sort((a, b) => a.line.localeCompare(b.line))
}

export default function ReportePersonal() {
  const p = usePeriod('semana')
  const { data, error, loading } = useApi('/reports/staffing', { query: { from: p.from, to: p.to } })
  const rows = useMemo(() => data?.rows || [], [data])
  const lines = useMemo(() => summarize(rows), [rows])

  const groups = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      const k = `${r.shiftDate}|${r.shift}`
      if (!m.has(k)) m.set(k, { shiftDate: r.shiftDate, shift: r.shift, rows: [] })
      m.get(k).rows.push(r)
    }
    return [...m.values()].reverse()
  }, [rows])

  const totals = useMemo(() => {
    const staffed = rows.filter((r) => r.people)
    const people = staffed.reduce((a, r) => a + r.people, 0)
    const producedStaffed = staffed.reduce((a, r) => a + r.produced, 0)
    return {
      produced: rows.reduce((a, r) => a + r.produced, 0),
      avgPeople: groups.length ? people / groups.length : null,
      perPerson: people ? producedStaffed / people : null,
      missing: rows.filter((r) => !r.people && r.produced > 0).length,
    }
  }, [rows, groups])

  return (
    <div className="space-y-5">
      <PageHeader
        back={<BackLink to="/reportes" label="Reportes" />}
        title="Personal y productividad"
        subtitle={`Personas por línea y piezas por persona · ${periodText(p.from, p.to)}`}
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
            El personal se captura por línea y turno en Producción → Plan y personal.
          </Empty>
        </Card>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Producido" value={fmtInt(totals.produced)} icon={Factory} tone="blue" hint={`${groups.length} turnos`} />
            <Stat label="Personas / turno" value={fmt1(totals.avgPeople)} icon={Users} hint="Promedio, todas las líneas" />
            <Stat label="Piezas / persona" value={fmt1(totals.perPerson)} icon={Gauge} tone="green" hint="Solo turnos con personal" />
            <Stat
              label="Sin personal"
              value={fmtInt(totals.missing)}
              icon={AlertTriangle}
              tone={totals.missing ? 'amber' : 'default'}
              hint="Líneas con producción sin captura"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon={Users} title="Personas por línea" subtitle="Promedio por turno trabajado" />
              <div className="p-4 sm:p-5">
                <HBars
                  format={fmt1}
                  items={lines.map((l) => ({
                    label: l.line,
                    value: l.avgPeople || 0,
                    hint: `· ${l.staffed}/${l.shifts} turnos`,
                    className: 'bg-amber-500',
                  }))}
                />
              </div>
            </Card>
            <Card>
              <CardHeader icon={BarChart3} title="Piezas por persona" subtitle="Producido ÷ personas, por línea" />
              <div className="p-4 sm:p-5">
                <HBars
                  format={fmt1}
                  items={lines.map((l) => ({
                    label: l.line,
                    value: l.perPerson || 0,
                    hint: `· ${fmtInt(l.produced)} pzas`,
                    className: 'bg-emerald-500',
                  }))}
                />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Detalle por turno" subtitle="Más reciente primero" />
            {/* Celular: tarjetas por turno */}
            <ul className="divide-y md:hidden">
              {groups.map((g) => (
                <li key={`${g.shiftDate}|${g.shift}`} className="px-4 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[14.5px] font-bold">{fmtYmd(g.shiftDate)}</span>
                    <Badge tone={g.shift === 'T1' ? 'amber' : 'blue'}>{shiftLabel(g.shift)}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {g.rows.map((r) => (
                      <div key={r.line} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2 text-[13px]">
                        <span className="min-w-0 flex-1 truncate font-semibold">{r.line}</span>
                        <span className="tabular w-14 text-right">
                          <Users className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                          {r.people ?? '—'}
                        </span>
                        <span className="tabular w-14 text-right font-semibold">{fmtInt(r.produced)}</span>
                        <span className="tabular w-14 text-right font-bold text-emerald-700 dark:text-emerald-300">{fmt1(r.perPerson)}</span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
              <li className="px-4 py-2 text-[11.5px] text-muted-foreground">Columnas: personas · producido · piezas por persona</li>
            </ul>
            {/* PC: tabla */}
            <Table className="hidden md:block">
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Turno</Th>
                  <Th>Línea</Th>
                  <Th className="text-right">Personas</Th>
                  <Th className="text-right">Producido</Th>
                  <Th className="text-right">Piezas / persona</Th>
                </tr>
              </thead>
              <tbody>
                {groups.flatMap((g) =>
                  g.rows.map((r, i) => (
                    <tr key={`${g.shiftDate}|${g.shift}|${r.line}`} className="hover:bg-muted/30">
                      <Td className="whitespace-nowrap font-semibold">{i === 0 ? fmtYmd(g.shiftDate) : ''}</Td>
                      <Td>{i === 0 ? <Badge tone={g.shift === 'T1' ? 'amber' : 'blue'}>{shiftLabel(g.shift)}</Badge> : null}</Td>
                      <Td className="font-semibold">{r.line}</Td>
                      <Td className="tabular text-right">
                        {r.people ?? <span className="text-amber-600 dark:text-amber-400">sin captura</span>}
                      </Td>
                      <Td className="tabular text-right font-semibold">{fmtInt(r.produced)}</Td>
                      <Td className="tabular text-right font-bold text-emerald-700 dark:text-emerald-300">{fmt1(r.perPerson)}</Td>
                    </tr>
                  )),
                )}
              </tbody>
              <tfoot>
                {lines.map((l) => (
                  <tr key={l.line} className="bg-muted/30 text-[13px]">
                    <Td colSpan={2} className="font-semibold text-muted-foreground">
                      Promedio
                    </Td>
                    <Td className="font-bold">{l.line}</Td>
                    <Td className="tabular text-right font-semibold">{fmt1(l.avgPeople)}</Td>
                    <Td className="tabular text-right font-semibold">{fmtInt(l.produced)}</Td>
                    <Td className="tabular text-right font-extrabold text-emerald-700 dark:text-emerald-300">{fmt1(l.perPerson)}</Td>
                  </tr>
                ))}
              </tfoot>
            </Table>
          </Card>
        </>
      ) : null}
    </div>
  )
}
