import { Award, CalendarCheck, Factory, Info, LineChart, Gauge, PackageCheck, Tv, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { todayPlant } from '@shared/shift.js'
import { Card, CardHeader, Empty, ErrorBox, PageHeader, Progress, Segmented, Spinner, Stat, Table, Td, Th } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt, fmtPct, fmtYmd } from '@/lib/utils'
import { Legend, TrendChart } from './charts'
import { BackLink, BrandControl, pctTone } from './common'

function ModelCard({ m }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Modelo</div>
          <div className="truncate text-[20px] font-extrabold leading-tight tracking-tight">{m.code}</div>
        </div>
        <span className="tabular shrink-0 text-[22px] font-extrabold text-primary">{m.target ? fmtPct(m.pct) : '—'}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="tabular text-[28px] font-extrabold leading-none">{fmtInt(m.net)}</span>
        <span className="text-[13.5px] font-semibold text-muted-foreground">{m.target ? `/ ${fmtInt(m.target)} objetivo` : 'neto · sin objetivo'}</span>
      </div>
      <Progress value={m.pct} tone={pctTone(m.pct)} className="mt-3" />
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Objetivo MTY</dt>
          <dd className="tabular font-semibold">{fmtInt(m.targetMty)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Objetivo Texas</dt>
          <dd className="tabular font-semibold">{fmtInt(m.targetTexas)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Producido</dt>
          <dd className="tabular font-semibold">{fmtInt(m.produced)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Rechazados</dt>
          <dd className={cn('tabular font-semibold', m.rejected && 'text-red-600 dark:text-red-400')}>{m.rejected ? `−${fmtInt(m.rejected)}` : 0}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-[13px]">
        <span className="font-semibold text-muted-foreground">Faltan</span>
        <span className={cn('tabular text-[15px] font-extrabold', m.target && !m.remaining && 'text-emerald-600 dark:text-emerald-400')}>
          {!m.target ? '—' : m.remaining ? fmtInt(m.remaining) : 'Objetivo cumplido'}
        </span>
      </div>
    </Card>
  )
}

const WINDOWS = [
  { value: 14, label: '14 días' },
  { value: 30, label: '30 días' },
  { value: 0, label: 'Todo' },
]

export default function ReporteModelos() {
  const [brand, setBrand] = useState('')
  const [win, setWin] = useState(30)
  const [showProj, setShowProj] = useState(true)
  const { data, error, loading } = useApi('/reports/models', { query: { brand } })
  const today = todayPlant()

  const t = data?.totals
  const models = useMemo(() => (data?.models || []).filter((m) => m.produced || m.target || m.rejected), [data])
  const points = useMemo(() => {
    const all = (data?.byDay || []).map((d) => ({ date: d.date, value: d.total }))
    return win ? all.slice(-win) : all
  }, [data, win])
  const days = useMemo(() => [...(data?.byDay || [])].reverse(), [data])
  const colTotal = (code) => (data?.byDay || []).reduce((a, d) => a + (d[code] || 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        back={<BackLink to="/reportes" label="Reportes" />}
        title="Producción por modelo"
        subtitle={`VIOS ${brand || 'HY / SILO'} · acumulado contra objetivo`}
        actions={<BrandControl value={brand} onChange={setBrand} />}
      />

      <ErrorBox error={error} />

      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Producido" value={fmtInt(t.produced)} icon={Factory} tone="blue" hint="Total acumulado" />
            <Stat label="Rechazados" value={fmtInt(t.rejected)} icon={XCircle} tone={t.rejected ? 'red' : 'default'} hint="Producidos y rechazados" />
            <Stat label="Neto" value={fmtInt(t.net)} icon={PackageCheck} tone="green" hint="Producido − rechazados" />
            <Stat label="Promedio / día" value={fmtInt(t.avgPerDay)} icon={Gauge} hint={`Meta del día ${fmtInt(t.capacity)}`} />
            <Stat label="Mejor día" value={fmtInt(t.bestDay)} icon={Award} tone="amber" hint="Piezas en un día" />
            <Stat label="Días" value={fmtInt(t.daysWithProduction)} icon={CalendarCheck} hint="Con producción" />
          </div>

          {models.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {models.map((m) => (
                <ModelCard key={m.code} m={m} />
              ))}
            </div>
          )}

          <Card>
            <CardHeader
              icon={LineChart}
              title="Producción diaria"
              subtitle="Total de piezas por día y proyección de los próximos 5 días hábiles"
            />
            <div className="no-print flex flex-wrap items-center justify-between gap-2 px-4 pt-3 sm:px-5">
              <Segmented size="sm" value={win} onChange={setWin} options={WINDOWS} />
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showProj}
                  onChange={(e) => setShowProj(e.target.checked)}
                  className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
                />
                Mostrar proyección
              </label>
            </div>
            <div className="px-2 pb-3 pt-2 sm:px-4">
              {points.length ? (
                <TrendChart
                  points={points}
                  projection={data.projection}
                  showProjection={showProj}
                  today={today}
                  reference={{ value: t.capacity, label: 'Meta del día' }}
                />
              ) : (
                <Empty icon={LineChart} title="Todavía no hay producción" />
              )}
            </div>
            <Legend
              className="border-t px-4 py-3 sm:px-5"
              items={[
                { label: 'Real', color: 'hsl(var(--primary))' },
                ...(showProj && data.projection.length ? [{ label: 'Proyección', color: '#d97706', dashed: true }] : []),
                { label: 'Meta del día', color: '#10b981', dashed: true },
                { label: 'Hoy', color: '#ef4444', dashed: true },
              ]}
            />
          </Card>

          <Card>
            <CardHeader icon={Tv} title="Desglose por modelo" subtitle="Piezas producidas por día (más reciente primero)" />
            {days.length ? (
              <>
                <Table className="max-h-[520px] overflow-y-auto">
                  <thead className="sticky top-0 z-[1] bg-card">
                    <tr>
                      <Th>Día</Th>
                      {data.models.map((m) => (
                        <Th key={m.code} className="text-right">
                          {m.code}
                        </Th>
                      ))}
                      <Th className="text-right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr key={d.date} className={cn(d.date === today && 'bg-accent/50')}>
                        <Td className="whitespace-nowrap font-semibold">
                          {fmtYmd(d.date)}
                          {d.date === today && <span className="ml-2 text-[11px] font-bold text-red-600">HOY</span>}
                        </Td>
                        {data.models.map((m) => (
                          <Td key={m.code} className={cn('tabular text-right', !d[m.code] && 'text-muted-foreground/60')}>
                            {fmtInt(d[m.code] || 0)}
                          </Td>
                        ))}
                        <Td className="tabular text-right font-bold">{fmtInt(d.total)}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-card">
                    <tr className="font-bold">
                      <Td>Producido</Td>
                      {data.models.map((m) => (
                        <Td key={m.code} className="tabular text-right">
                          {fmtInt(colTotal(m.code))}
                        </Td>
                      ))}
                      <Td className="tabular text-right">{fmtInt(t.produced)}</Td>
                    </tr>
                    <tr className="text-red-600 dark:text-red-400">
                      <Td className="font-semibold">Rechazados en prod.</Td>
                      {data.models.map((m) => (
                        <Td key={m.code} className="tabular text-right">
                          {m.rejected ? `−${fmtInt(m.rejected)}` : '0'}
                        </Td>
                      ))}
                      <Td className="tabular text-right font-semibold">{t.rejected ? `−${fmtInt(t.rejected)}` : '0'}</Td>
                    </tr>
                    <tr className="bg-emerald-50/70 font-extrabold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Td>Neto</Td>
                      {data.models.map((m) => (
                        <Td key={m.code} className="tabular text-right">
                          {fmtInt(m.net)}
                        </Td>
                      ))}
                      <Td className="tabular text-right">{fmtInt(t.net)}</Td>
                    </tr>
                  </tfoot>
                </Table>
                <p className="flex items-start gap-2 px-4 py-3 text-[12.5px] text-muted-foreground sm:px-5">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    La tabla cuenta lo <b className="text-foreground">producido</b> (salidas cerradas + escaneo por línea: {fmtInt(t.produced)}). Las piezas rechazadas por
                    Calidad durante producción ({fmtInt(t.rejected)}) se restan aparte para obtener el <b className="text-foreground">neto</b> (
                    {fmtInt(t.net)}), que es lo que cuenta para el objetivo de cada modelo.
                  </span>
                </p>
              </>
            ) : (
              <Empty icon={Tv} title="Sin producción registrada" />
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
