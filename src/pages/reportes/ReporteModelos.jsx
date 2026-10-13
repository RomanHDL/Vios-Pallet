import { projectProduction } from '@shared/projection.js'
import { todayPlant } from '@shared/shift.js'
import { toPng } from 'html-to-image'
import {
  Award,
  CalendarCheck,
  Camera,
  Factory,
  Gauge,
  Info,
  LineChart,
  PackageCheck,
  Tv,
  XCircle,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { BrandSplit } from '@/components/BrandSplit'
import {
  Card,
  CardHeader,
  Empty,
  ErrorBox,
  PageHeader,
  Progress,
  Segmented,
  Spinner,
  Stat,
  Table,
  Td,
  Th,
} from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { cn, fmtInt, fmtPct, fmtYmd } from '@/lib/utils'
import { Legend, TrendChart } from './charts'
import { BackLink, BrandControl, pctTone, useUrlInit } from './common'

// Numeros de un dia (por defecto hoy): total contra la meta, piezas por modelo y HY / SILO.
// "HY 56 · SILO 20" de un modelo (solo marcas con piezas).
function SplitText({ split, className }) {
  const parts = Object.entries(split || {}).filter(([, n]) => n > 0)
  if (!parts.length) return null
  return (
    <span className={cn('ml-1.5 text-[12px] font-semibold text-muted-foreground', className)}>
      {parts.map(([b, n], i) => (
        <span key={b}>
          {i > 0 && ' · '}
          <span
            className={
              b === 'SILO' ? 'text-violet-600 dark:text-violet-300' : 'text-blue-600 dark:text-blue-300'
            }
          >
            {b}
          </span>{' '}
          <span className="tabular font-extrabold text-foreground">{fmtInt(n)}</span>
        </span>
      ))}
    </span>
  )
}

function DayPanel({ data, day, setDay, today }) {
  const row = data.byDay.find((d) => d.date === day)
  const total = row?.total || 0
  const goal = data.totals.capacity
  const perModel = data.models
    .map((m) => ({ code: m.code, n: row?.[m.code] || 0, split: row?.split?.[m.code] }))
    .filter((m) => m.n > 0)
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5">
        <div className="mr-auto">
          <h3 className="text-[16px] font-extrabold">
            {day === today ? 'Hoy' : 'Día'} · {fmtYmd(day)}
          </h3>
          <p className="text-[12.5px] text-muted-foreground">
            Producción de ese día (salidas cerradas + por línea)
          </p>
        </div>
        <input
          type="date"
          value={day}
          max={today}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="no-print field h-10 w-[160px] text-[14px]"
          aria-label="Día"
        />
      </div>
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted-foreground">Producido</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="tabular text-[40px] font-extrabold leading-none">{fmtInt(total)}</span>
            <span className="text-[15px] font-semibold text-muted-foreground">/ {fmtInt(goal)} meta</span>
            <span
              className={cn(
                'ml-auto text-[18px] font-extrabold',
                total >= goal ? 'text-emerald-600' : 'text-red-600',
              )}
            >
              {fmtPct(goal ? total / goal : null)}
            </span>
          </p>
          <Progress
            value={goal ? total / goal : 0}
            tone={total >= goal ? 'green' : 'primary'}
            className="mt-3"
          />
          {perModel.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {perModel.map((m) => (
                <li key={m.code} className="rounded-lg bg-muted px-2.5 py-1 text-[13px] font-semibold">
                  {m.code} <span className="tabular font-extrabold">{fmtInt(m.n)}</span>
                  <SplitText split={m.split} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <BrandSplit
          brands={
            row?.brands || [
              { brand: 'HY', pieces: 0, pallets: 0 },
              { brand: 'SILO', pieces: 0, pallets: 0 },
            ]
          }
        />
      </div>
    </Card>
  )
}

// Tarjeta compacta (2026-10-12, Roman: "que esten chicos, las 5 en el mismo lugar, y abajo de cada modelo HY y SILO
// procesado sin contar lo rechazado de calidad"). Neto = producido - rechazados; HY / SILO tambien netos.
function ModelCard({ m }) {
  const net = (b) => Math.max(0, (m.brands?.[b] || 0) - (m.rejectedBrands?.[b] || 0))
  return (
    <Card className="flex min-w-0 flex-col p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-extrabold text-primary">{m.code}</span>
        <span
          className={cn(
            'tabular text-[12.5px] font-bold',
            m.target ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {m.target ? fmtPct(m.pct) : 'sin objetivo'}
        </span>
      </div>
      <p className="tabular mt-0.5 text-[26px] font-extrabold leading-tight">{fmtInt(m.produced)}</p>
      <p className="text-[11.5px] text-muted-foreground">
        {m.rejected ? (
          <>
            neto <b className="tabular text-foreground">{fmtInt(m.net)}</b>{' '}
            <span className="text-red-600 dark:text-red-400">(−{fmtInt(m.rejected)} rechazadas)</span>
          </>
        ) : (
          'producidas · sin rechazos'
        )}
      </p>
      <Progress value={m.pct} tone={pctTone(m.pct)} className="mt-2 h-1.5" />
      <div className="mt-1 flex justify-between text-[11.5px] text-muted-foreground">
        <span>Obj. {fmtInt(m.target)}</span>
        <span
          className={cn(
            'tabular font-semibold',
            m.target && !m.remaining && 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {!m.target ? '' : m.remaining ? `faltan ${fmtInt(m.remaining)}` : 'cumplido'}
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t pt-2.5">
        {['HY', 'SILO'].map((b) => (
          <div
            key={b}
            className={cn(
              'rounded-lg px-2 py-1.5',
              b === 'SILO' ? 'bg-violet-50 dark:bg-violet-500/10' : 'bg-blue-50 dark:bg-blue-500/10',
            )}
          >
            <p
              className={cn(
                'text-[10.5px] font-bold',
                b === 'SILO' ? 'text-violet-700 dark:text-violet-300' : 'text-blue-700 dark:text-blue-300',
              )}
            >
              {b}
            </p>
            <p className="tabular text-[15px] font-extrabold leading-tight">{fmtInt(m.brands?.[b] || 0)}</p>
            {m.rejectedBrands?.[b] > 0 && (
              <p className="text-[10px] text-muted-foreground">
                neto <b className="text-foreground">{fmtInt(net(b))}</b>{' '}
                <span className="text-red-600 dark:text-red-400">(−{fmtInt(m.rejectedBrands[b])})</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// Vista de un solo modelo (2026-10-12, Roman: "quiero que haya un boton de todos y mas botones desglosados"): los
// mismos datos del reporte, pero contando solo ese modelo (con la marca elegida arriba). HY/SILO con sus piezas y
// pallets de ese modelo; la proyeccion es la misma formula sobre la serie del modelo.
function onlyModel(data, model, today) {
  if (!data || !model) return data
  const m = data.models.find((x) => x.code === model)
  const byDay = data.byDay
    .map((d) => ({
      date: d.date,
      [model]: d[model] || 0,
      total: d[model] || 0,
      split: { [model]: d.split?.[model] },
      brands: ['HY', 'SILO'].map((b) => ({
        brand: b,
        pieces: d.split?.[model]?.[b] || 0,
        pallets: d.palletSplit?.[model]?.[b] || 0,
      })),
    }))
    .filter((d) => d.total > 0)
  const totals = byDay.map((d) => d.total)
  const sum = totals.reduce((a, x) => a + x, 0)
  const rejected = m?.rejected || 0
  return {
    ...data,
    models: m ? [m] : [],
    byDay,
    history: null,
    projection: projectProduction(totals, data.totals.capacity, today),
    totals: {
      ...data.totals,
      produced: sum,
      rejected,
      net: sum - rejected,
      avgPerDay: byDay.length ? Math.round(sum / byDay.length) : 0,
      bestDay: totals.length ? Math.max(...totals) : 0,
      daysWithProduction: byDay.length,
    },
  }
}

const WINDOWS = [
  { value: 14, label: '14 días' },
  { value: 30, label: '30 días' },
  { value: 0, label: 'Todo' },
]

export default function ReporteModelos() {
  const urlWin = useUrlInit('win')
  const urlDay = useUrlInit('day')
  const [brand, setBrand] = useState(useUrlInit('brand'))
  const [win, setWin] = useState(urlWin === 'todo' ? 0 : urlWin === '14' ? 14 : 30)
  const [showProj, setShowProj] = useState(true)
  const [model, setModel] = useState(useUrlInit('model'))
  const { data: raw, error, loading } = useApi('/reports/models', { query: { brand } })
  const today = todayPlant()
  const data = useMemo(() => onlyModel(raw, model, today), [raw, model, today])
  // Botones de modelo: todos los activos del catalogo y cualquiera con produccion.
  const modelButtons = useMemo(
    () => (raw?.models || []).filter((m) => m.active !== false || m.produced).map((m) => m.code),
    [raw],
  )
  const [day, setDay] = useState(/^\d{4}-\d{2}-\d{2}$/.test(urlDay) && urlDay <= today ? urlDay : today)

  const t = data?.totals
  const models = useMemo(
    () => (data?.models || []).filter((m) => m.active !== false || m.produced || m.rejected),
    [data],
  )
  const points = useMemo(() => {
    const all = (data?.byDay || []).map((d) => ({
      date: d.date,
      value: d.total,
      parts: (data.models || [])
        .filter((m) => d[m.code] > 0)
        .map((m) => ({ label: m.code.replace(/"/g, ''), n: d[m.code] })),
    }))
    return win ? all.slice(-win) : all
  }, [data, win])
  const days = useMemo(() => [...(data?.byDay || [])].reverse(), [data])
  const colTotal = (code) => (data?.byDay || []).reduce((a, d) => a + (d[code] || 0), 0)

  // Captura de pantalla (2026-10-12, Roman): solo el dia, los indicadores, las tarjetas de modelo y la grafica
  // (sin menu, filtros ni tabla). Se descarga como PNG; los controles marcados no-print no salen.
  const shotRef = useRef(null)
  const [shooting, setShooting] = useState(false)
  const capture = async () => {
    if (!shotRef.current) return
    setShooting(true)
    try {
      await new Promise((r) => setTimeout(r, 60))
      const bg = getComputedStyle(document.body).backgroundColor || '#f4f6fa'
      const url = await toPng(shotRef.current, {
        pixelRatio: 2,
        backgroundColor: bg,
        cacheBust: true,
        filter: (n) => !n.classList?.contains('no-print'),
      })
      const a = document.createElement('a')
      a.href = url
      a.download = `produccion-por-modelo_${day}${brand ? `_${brand}` : ''}${model ? `_${model.replace(/"/g, '')}` : ''}.png`
      a.click()
    } finally {
      setShooting(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back={<BackLink to="/reportes" label="Reportes" />}
        title="Producción por modelo"
        subtitle={`VIOS ${brand || 'HY / SILO'}${model ? ` · ${model}` : ''} · acumulado contra objetivo`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={capture}
              disabled={!data || shooting}
              className="no-print inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3.5 text-[13.5px] font-semibold hover:bg-muted disabled:opacity-60"
            >
              <Camera className="h-4 w-4" /> {shooting ? 'Generando…' : 'Captura'}
            </button>
            <BrandControl value={brand} onChange={setBrand} />
          </div>
        }
      />

      {modelButtons.length > 0 && (
        <Card className="no-print flex flex-wrap items-center gap-3 p-3 sm:px-4">
          <span className="text-[13px] font-semibold text-muted-foreground">Modelo / pulgadas</span>
          <Segmented
            value={model}
            onChange={setModel}
            options={[{ value: '', label: 'Todos' }, ...modelButtons.map((c) => ({ value: c, label: c }))]}
          />
        </Card>
      )}

      <ErrorBox error={error} />

      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <>
          <div ref={shotRef} className={cn('space-y-5', shooting && 'bg-background p-5')}>
            {shooting && (
              <div className="flex items-baseline justify-between">
                <h2 className="text-[22px] font-extrabold tracking-tight">
                  Producción por modelo · VIOS {brand || 'HY / SILO'}
                  {model ? ` · ${model}` : ''}
                </h2>
                <span className="text-[13px] text-muted-foreground">
                  MI Technologies · {fmtYmd(day)} {day.slice(0, 4)}
                </span>
              </div>
            )}
            <DayPanel data={data} day={day} setDay={setDay} today={today} />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Stat
                label="Producido"
                value={fmtInt(t.produced)}
                icon={Factory}
                tone="blue"
                hint="Total acumulado"
              />
              <Stat
                label="Rechazados"
                value={fmtInt(t.rejected)}
                icon={XCircle}
                tone={t.rejected ? 'red' : 'default'}
                hint="Producidos y rechazados"
              />
              <Stat
                label="Neto"
                value={fmtInt(t.net)}
                icon={PackageCheck}
                tone="green"
                hint="Producido − rechazados"
              />
              <Stat
                label="Promedio / día"
                value={fmtInt(t.avgPerDay)}
                icon={Gauge}
                hint={`Meta del día ${fmtInt(t.capacity)}`}
              />
              <Stat
                label="Mejor día"
                value={fmtInt(t.bestDay)}
                icon={Award}
                tone="amber"
                hint="Piezas en un día"
              />
              <Stat
                label="Días"
                value={fmtInt(t.daysWithProduction)}
                icon={CalendarCheck}
                hint="Con producción"
              />
            </div>

            {models.length > 0 && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
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
                    height={340}
                  />
                ) : (
                  <Empty icon={LineChart} title="Todavía no hay producción" />
                )}
              </div>
              <Legend
                className="border-t px-4 py-3 sm:px-5"
                items={[
                  { label: 'Real', color: 'hsl(var(--primary))' },
                  ...(showProj && data.projection.length
                    ? [{ label: 'Proyección', color: '#d97706', dashed: true }]
                    : []),
                  { label: 'Meta del día', color: '#10b981', dashed: true },
                  { label: 'Hoy', color: '#ef4444', dashed: true },
                ]}
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              icon={Tv}
              title="Desglose por modelo"
              subtitle="Piezas producidas por día (más reciente primero)"
            />
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
                          {d.date === today && (
                            <span className="ml-2 text-[11px] font-bold text-red-600">HOY</span>
                          )}
                        </Td>
                        {data.models.map((m) => (
                          <Td
                            key={m.code}
                            className={cn('tabular text-right', !d[m.code] && 'text-muted-foreground/60')}
                          >
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
                      <Td className="tabular text-right font-semibold">
                        {t.rejected ? `−${fmtInt(t.rejected)}` : '0'}
                      </Td>
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
                    La tabla cuenta lo <b className="text-foreground">producido</b> ({fmtInt(t.produced)}):
                    salidas cerradas + escaneo por línea
                    {data.history?.pieces ? (
                      <>
                        {' '}
                        + <b className="text-foreground">{fmtInt(data.history.pieces)}</b> del histórico de
                        PalletScan ({fmtYmd(data.history.from, { dow: false })} –{' '}
                        {fmtYmd(data.history.to, { dow: false })}, {fmtInt(data.history.rejected)} rechazadas)
                      </>
                    ) : null}
                    . Las piezas rechazadas por Calidad ({fmtInt(t.rejected)}) se restan aparte para obtener
                    el <b className="text-foreground">neto</b> ({fmtInt(t.net)}), que es lo que cuenta para el
                    objetivo de cada modelo.
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
