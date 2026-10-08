import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Factory, History, PackageOpen, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MenuCard } from '@/components/MenuCard'
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { fmtAgo, fmtDateTime, fmtInt } from '@/lib/utils'
import { StatusBadge, TypeBadge, normPallet, resumePath } from './shared'

export default function PalletsHome() {
  const summary = useApi('/pallets/summary', { refreshMs: 15000 })
  const open = useApi('/pallets', { query: { status: 'abierto' }, refreshMs: 15000 })
  const list = (open.data?.pallets || []).map(normPallet)
  const entradas = list.filter((p) => p.type === 'entrada')
  const salidas = list.filter((p) => p.type === 'salida')
  const s = summary.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Control de Pallet"
        subtitle="Entrada, salida y conciliación de piezas"
        actions={
          <>
            <Link to="/pallets/lineas" className="inline-flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-[14.5px] font-semibold hover:bg-muted">
              <Factory className="h-[18px] w-[18px]" /> Producción por línea
            </Link>
            <Link to="/pallets/historial" className="inline-flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-[14.5px] font-semibold hover:bg-muted">
              <History className="h-[18px] w-[18px]" /> Historial
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <MenuCard
          to="/pallets/entrada"
          icon={ArrowDownToLine}
          tone="blue"
          title="Entrada"
          description="Registrar pallets recibidos"
          className="sm:p-6"
          badge={<OpenCount n={s?.entradaAbiertos} tone="blue" />}
        />
        <MenuCard
          to="/pallets/salida"
          icon={ArrowUpFromLine}
          tone="violet"
          title="Salida"
          description="Confirmar pallets despachados"
          className="sm:p-6"
          badge={<OpenCount n={s?.salidaAbiertos} tone="violet" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader icon={PackageOpen} title="Pallets abiertos" subtitle="Toca uno para seguir escaneando" />
          {open.loading && !open.data ? (
            <Spinner />
          ) : open.error ? (
            <ErrorBox error={open.error} className="m-4" />
          ) : !list.length ? (
            <Empty icon={PackageOpen} title="No hay pallets abiertos">
              Todo está cerrado. Inicia una entrada nueva cuando llegue un pallet.
            </Empty>
          ) : (
            <div className="grid gap-px bg-border sm:grid-cols-2">
              <OpenColumn title="Entrada" items={entradas} />
              <OpenColumn title="Salida" items={salidas} />
            </div>
          )}
        </Card>
        <FindSerial />
      </div>
    </div>
  )
}

function OpenCount({ n, tone }) {
  if (!n) return null
  return (
    <Badge tone={tone} className="text-[13px]">
      {fmtInt(n)} {n === 1 ? 'abierto' : 'abiertos'}
    </Badge>
  )
}

function OpenColumn({ title, items }) {
  return (
    <div className="bg-card">
      <div className="flex items-center justify-between px-4 pb-1 pt-3 sm:px-5">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <span className="tabular text-[12px] font-semibold text-muted-foreground">{items.length}</span>
      </div>
      {items.length ? (
        <ul>
          {items.map((p) => (
            <li key={p.id}>
              <Link to={resumePath(p)} className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/60 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[15px] font-bold">{p.id}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {[p.model, p.brand].filter(Boolean).join(' · ')}
                    {p.createdByName && ` · ${p.createdByName}`}
                  </span>
                  <span className="block text-[12px] text-muted-foreground" title={fmtDateTime(p.createdAt)}>
                    {fmtAgo(p.createdAt)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="tabular block text-[20px] font-extrabold leading-none">
                    {fmtInt(p.liveCount)}
                    {p.type === 'salida' && p.expected != null && (
                      <span className="text-[13px] font-semibold text-muted-foreground"> / {fmtInt(p.expected)}</span>
                    )}
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">piezas</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 pt-1 text-[13px] text-muted-foreground sm:px-5">Sin pallets abiertos.</p>
      )}
    </div>
  )
}

// Busca en que pallets esta un serial.
function FindSerial() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const c = q.trim()
    if (!c) return
    setBusy(true)
    setError(null)
    try {
      setRes(await api(`/pallets/find/${encodeURIComponent(c)}`))
    } catch (err) {
      setError(err)
      setRes(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="self-start">
      <CardHeader icon={Search} title="Buscar serial" subtitle="¿En qué pallet está una pieza?" />
      <form onSubmit={submit} className="flex gap-2 p-4 sm:px-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escanea o escribe el serial"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          className="field min-w-0 flex-1 font-mono uppercase placeholder:font-sans placeholder:normal-case"
        />
        <Button type="submit" loading={busy} disabled={!q.trim()} className="shrink-0">
          Buscar
        </Button>
      </form>
      <ErrorBox error={error} className="mx-4 mb-4" />
      {res && (
        <div className="border-t">
          <p className="px-4 pt-3 font-mono text-[13px] font-semibold text-muted-foreground sm:px-5">{res.code}</p>
          {res.matches.length ? (
            <ul className="divide-y">
              {res.matches.map((m) => (
                <li key={m.pallet_id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/pallets/${m.pallet_id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[15px] font-bold">{m.pallet_id}</span>
                        <TypeBadge type={m.type} />
                        <StatusBadge status={m.status} />
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                        {[m.model, m.brand].filter(Boolean).join(' · ')} · {fmtDateTime(m.scanned_at)}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-4 pt-1 text-[13.5px] text-muted-foreground sm:px-5">No está en ningún pallet.</p>
          )}
        </div>
      )}
    </Card>
  )
}
