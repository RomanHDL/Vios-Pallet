import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MoreVertical,
  Package,
  PackageX,
  ScanBarcode,
  Search,
  Timer,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, Input, PageHeader, Spinner, Table, Td, Th } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { cn, fmtDateTime, fmtInt } from '@/lib/utils'
import { BackLink, BrandControl, PeriodControls, periodText, usePeriod } from './common'
import { PalletProgress } from './PalletProgress'

const TILE_TONE = {
  default: { icon: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300', value: 'text-foreground' },
  blue: { icon: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300', value: 'text-blue-600 dark:text-blue-400' },
  violet: { icon: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', value: 'text-violet-600 dark:text-violet-400' },
  amber: { icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', value: 'text-amber-600 dark:text-amber-400' },
  red: { icon: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300', value: 'text-red-600 dark:text-red-400' },
  green: { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', value: 'text-emerald-600 dark:text-emerald-400' },
}

// Tarjeta del resumen: icono a la izquierda, etiqueta, valor y explicacion.
function Tile({ label, value, hint, icon: Icon, tone = 'default' }) {
  const t = TILE_TONE[tone]
  return (
    <div className="card flex items-start gap-3 p-4">
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full', t.icon)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn('tabular mt-1 text-[24px] font-extrabold leading-none tracking-tight sm:text-[28px]', t.value)}>{value}</p>
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

const STATES = {
  escaneando: { label: 'Escaneando', tone: 'blue', icon: ScanBarcode },
  en_proceso: { label: 'En proceso', tone: 'violet', icon: Timer },
  sin_salida: { label: 'Sin salida', tone: 'amber', icon: PackageX },
  con_faltantes: { label: 'Con faltantes', tone: 'red', icon: AlertTriangle },
  consolidado: { label: 'Consolidado', tone: 'green', icon: CheckCircle2 },
}
const CHIP_ACTIVE = {
  all: 'bg-primary text-primary-foreground border-primary',
  blue: 'bg-blue-600 text-white border-blue-600',
  violet: 'bg-violet-600 text-white border-violet-600',
  amber: 'bg-amber-500 text-white border-amber-500',
  red: 'bg-red-600 text-white border-red-600',
  green: 'bg-emerald-600 text-white border-emerald-600',
}

function StateBadge({ state }) {
  const s = STATES[state]
  return (
    <Badge tone={s?.tone} dot>
      {s?.label || state}
    </Badge>
  )
}

function SerialSearch() {
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const search = async (e) => {
    e.preventDefault()
    const code = q.trim()
    if (!code) return
    setBusy(true)
    setErr(null)
    try {
      setRes(await api(`/pallets/find/${encodeURIComponent(code)}`))
    } catch (e2) {
      setErr(e2)
      setRes(null)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader icon={Search} title="Buscar serial" subtitle="¿En qué pallet está una pieza?" />
      <form onSubmit={search} className="flex gap-2 p-4 sm:p-5">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escanea o escribe el serial"
          autoCapitalize="characters"
          autoComplete="off"
          className="min-w-0 flex-1 font-mono"
        />
        <Button type="submit" loading={busy} disabled={!q.trim()} className="shrink-0">
          {!busy && <Search className="h-4 w-4" />}
          <span className="hidden sm:inline">Buscar</span>
        </Button>
      </form>
      <ErrorBox error={err} className="mx-4 mb-4 sm:mx-5" />
      {res && (
        <div className="border-t">
          {res.matches.length ? (
            <ul className="divide-y">
              {res.matches.map((m) => (
                <li key={m.pallet_id}>
                  <Link to={`/pallets/${m.pallet_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                      {m.type === 'salida' ? <ArrowUpFromLine className="h-4 w-4" /> : <ArrowDownToLine className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[14px] font-bold">{m.pallet_id}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {m.type === 'salida' ? 'Salida' : 'Entrada'} · {m.model || '—'} {m.brand || ''} · {fmtDateTime(m.scanned_at)}
                      </span>
                    </span>
                    <Badge tone={m.status === 'abierto' ? 'blue' : 'gray'}>{m.status === 'abierto' ? 'Abierto' : 'Cerrado'}</Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-[13.5px] text-muted-foreground sm:px-5">
              El serial <b className="font-mono text-foreground">{res.code}</b> no está en ningún pallet.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function PiecesCell({ x }) {
  return (
    <span className="tabular whitespace-nowrap">
      <b>{fmtInt(x.pieces_in)}</b>
      <span className="text-muted-foreground"> → </span>
      <b>{x.salida_id ? fmtInt(x.pieces_out) : '—'}</b>
    </span>
  )
}

export default function ReportePallets() {
  const p = usePeriod('hoy')
  const [brand, setBrand] = useState('')
  const [filter, setFilter] = useState('all')
  const { data, error, loading } = useApi('/reports/pallets', {
    query: { from: p.from, to: p.to, brand },
    refreshMs: p.isToday ? 30000 : undefined,
  })
  const t = data?.totals
  const list = useMemo(
    () => (data?.pallets || []).filter((x) => filter === 'all' || x.state === filter),
    [data, filter],
  )

  const chips = [{ key: 'all', label: 'Todos', n: t?.total, tone: 'all' }, ...Object.entries(STATES).map(([k, s]) => ({ key: k, label: s.label, n: t?.[k], tone: s.tone }))]

  return (
    <div className="space-y-5">
      <PageHeader
        back={<BackLink to="/reportes" label="Reportes" />}
        title="Dashboard de pallets"
        subtitle={`Entrada → salida · ${periodText(p.from, p.to)}${p.isToday ? ' · se actualiza cada 30 s' : ''}`}
        actions={
          <Card className="flex w-full flex-col gap-3 p-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <PeriodControls p={p} options={['hoy', 'semana', 'rango']} />
            <BrandControl value={brand} onChange={setBrand} />
          </Card>
        }
      />

      <ErrorBox error={error} />

      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Pallets" value={fmtInt(t.total)} icon={Package} hint="Del periodo + pendientes" />
            <Tile label="Escaneando" value={fmtInt(t.escaneando)} icon={ScanBarcode} tone="blue" hint="Entrada abierta" />
            <Tile label="Sin salida" value={fmtInt(t.sin_salida)} icon={PackageX} tone={t.sin_salida ? 'amber' : 'default'} hint="Entrada cerrada" />
            <Tile label="En proceso" value={fmtInt(t.en_proceso)} icon={Timer} tone="violet" hint="Salida abierta" />
            <Tile label="Con faltantes" value={fmtInt(t.con_faltantes)} icon={AlertTriangle} tone={t.con_faltantes ? 'red' : 'default'} hint="Salida cerrada incompleta" />
            <Tile label="Consolidado" value={fmtInt(t.consolidado)} icon={CheckCircle2} tone="green" hint="Salida completa" />
            <Tile
              label="Piezas"
              icon={Package}
              value={
                <>
                  {fmtInt(t.piecesIn)}
                  <span className="text-muted-foreground"> → </span>
                  {fmtInt(t.piecesOut)}
                </>
              }
              hint="Entrada → salida"
            />
            <Tile label="Faltantes" value={fmtInt(t.missing)} icon={AlertTriangle} tone={t.missing ? 'red' : 'default'} hint="Piezas no encontradas" />
          </div>

          <PalletProgress pallets={data.pallets} />

          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <Card className="min-w-0">
              <CardHeader icon={Package} title="Pallets" subtitle={`${fmtInt(list.length)} de ${fmtInt(t.total)}`} />
              <div className="-mb-px flex gap-2 overflow-x-auto border-b px-4 py-3 sm:px-5">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setFilter(c.key)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition',
                      filter === c.key ? CHIP_ACTIVE[c.tone] : 'bg-card text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {c.label}
                    <span className={cn('tabular rounded-full px-1.5 text-[11px]', filter === c.key ? 'bg-white/20' : 'bg-muted')}>{fmtInt(c.n || 0)}</span>
                  </button>
                ))}
                {loading && <Loader2 className="my-auto h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
              </div>

              {list.length ? (
                <>
                  {/* Celular */}
                  <ul className="divide-y md:hidden">
                    {list.map((x) => (
                      <li key={x.id}>
                        <Link to={`/pallets/${x.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[15px] font-bold">{x.id}</span>
                              <StateBadge state={x.state} />
                            </span>
                            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-muted-foreground">
                              <span>
                                {x.model} · {x.brand}
                              </span>
                              <span>
                                Piezas <PiecesCell x={x} />
                              </span>
                              {x.missing_count > 0 && <span className="font-semibold text-red-600 dark:text-red-400">{fmtInt(x.missing_count)} faltantes</span>}
                              <span>{fmtDateTime(x.created_at)}</span>
                            </span>
                          </span>
                          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {/* PC */}
                  <Table className="hidden md:block">
                    <thead>
                      <tr>
                        <Th>Pallet</Th>
                        <Th>Estado</Th>
                        <Th>Modelo</Th>
                        <Th className="text-right">Entrada → Salida</Th>
                        <Th className="text-right">Faltantes</Th>
                        <Th>Creado</Th>
                        <Th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((x) => (
                        <tr key={x.id} className="group cursor-pointer hover:bg-muted/40">
                          <Td className="p-0">
                            <Link to={`/pallets/${x.id}`} className="block px-4 py-3 font-mono font-bold text-primary group-hover:underline">
                              {x.id}
                            </Link>
                          </Td>
                          <Td>
                            <StateBadge state={x.state} />
                          </Td>
                          <Td className="whitespace-nowrap">
                            {x.model} <span className="text-muted-foreground">· {x.brand}</span>
                          </Td>
                          <Td className="text-right">
                            <PiecesCell x={x} />
                          </Td>
                          <Td className={cn('tabular text-right font-semibold', x.missing_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                            {x.salida_id ? fmtInt(x.missing_count) : '—'}
                          </Td>
                          <Td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(x.created_at)}</Td>
                          <Td className="p-0">
                            <Link to={`/pallets/${x.id}`} className="grid place-items-center px-2 py-3 text-muted-foreground hover:text-foreground" aria-label={`Ver pallet ${x.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Link>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              ) : (
                <Empty icon={Package} title={t.total ? 'Ningún pallet en este estado' : 'Sin pallets en este periodo'} />
              )}
            </Card>

            <div className="min-w-0 space-y-5">
              <SerialSearch />
              <Card className="p-4 sm:p-5">
                <h3 className="text-[14px] font-bold">Estados</h3>
                <ul className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-[13px] text-muted-foreground">
                  <li className="contents"><StateBadge state="consolidado" /><span>Pallet completo (100%).</span></li>
                  <li className="contents"><StateBadge state="en_proceso" /><span>Salida abierta, pallet en llenado.</span></li>
                  <li className="contents"><StateBadge state="escaneando" /><span>Entrada todavía abierta.</span></li>
                  <li className="contents"><Badge tone="gray" dot>Sin iniciar</Badge><span>Salida abierta, aún no se escanea ninguna pieza.</span></li>
                  <li className="contents"><StateBadge state="sin_salida" /><span>Entrada cerrada, falta escanear salida.</span></li>
                  <li className="contents"><StateBadge state="con_faltantes" /><span>Salida cerrada con piezas no encontradas.</span></li>
                </ul>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
