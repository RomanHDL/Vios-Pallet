import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Factory, History, PackageOpen, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MenuCard } from '@/components/MenuCard'
import { CameraScan, CameraToggle, canUseCamera } from '@/components/Scanner'
import { Badge, Button, Card, CardHeader, Dialog, Empty, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { fmtAgo, fmtDateTime, fmtInt } from '@/lib/utils'
import PalletsAdmin from './PalletsAdmin'
import { StatusBadge, TypeBadge, normPallet, resumePath } from './shared'

// Administrador: vista de recorrido Entrada -> Produccion por linea -> Salida. Los demas (cuenta Planta):
// la vista operativa de siempre, sin cambios.
export default function PalletsHome() {
  const { user } = useSession()
  if (user?.role === 'admin') return <PalletsAdmin ScanSerial={ScanSerialAction} />
  return <PalletsOperativo />
}

function PalletsOperativo() {
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
            <ScanSerialAction />
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

      <div className="grid gap-6">
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

// "Escanear serial" (2026-10-15, a peticion explicita del usuario: "debe ser solo uno y quiero que sea el de
// historial, el de arriba"): UN solo boton junto a Historial que abre una ventana con la camara (abierta de
// una vez si el equipo tiene camara), el campo para escribir o escanear con pistola, y en que pallet esta.
// Reemplaza la tarjeta "Buscar serial" que estaba abajo.
export function ScanSerialAction() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        <ScanLine className="h-[18px] w-[18px]" /> Escanear serial
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Escanear serial">
        {open && <FindSerial onPick={() => setOpen(false)} />}
      </Dialog>
    </>
  )
}

// Busca en que pallets esta un serial (dentro de la ventana de "Escanear serial").
function FindSerial({ onPick }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [error, setError] = useState(null)
  const [camera, setCamera] = useState(canUseCamera)

  // `code`: lo leido con la camara (se busca solo).
  const submit = async (e, code) => {
    e?.preventDefault()
    const c = (code ?? q).trim()
    if (!c) return
    if (code) setQ(code)
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
    <div className="space-y-3">
      <p className="text-[13.5px] text-muted-foreground">¿En qué pallet está una pieza?</p>
      {camera && <CameraScan once onCode={(c) => submit(null, c)} onClose={() => setCamera(false)} />}
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escanea o escribe el serial"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          autoFocus={!canUseCamera}
          className="field min-w-0 flex-1 font-mono uppercase placeholder:font-sans placeholder:normal-case"
        />
        {canUseCamera && (
          <CameraToggle open={camera} onClick={() => setCamera((c) => !c)} className="h-auto self-stretch border" />
        )}
        <Button type="submit" loading={busy} disabled={!q.trim()} className="shrink-0">
          Buscar
        </Button>
      </form>
      <ErrorBox error={error} />
      {res && (
        <div className="overflow-hidden rounded-2xl border">
          <p className="px-4 pt-3 font-mono text-[13px] font-semibold text-muted-foreground">{res.code}</p>
          {res.matches.length ? (
            <ul className="divide-y">
              {res.matches.map((m) => (
                <li key={m.pallet_id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick?.()
                      navigate(`/pallets/${m.pallet_id}`)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
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
            <p className="px-4 pb-4 pt-1 text-[13.5px] text-muted-foreground">No está en ningún pallet.</p>
          )}
        </div>
      )}
    </div>
  )
}
