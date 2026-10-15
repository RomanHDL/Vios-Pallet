import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Factory, History, PackageOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MenuCard } from '@/components/MenuCard'
import { Badge, Card, CardHeader, Empty, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { fmtAgo, fmtInt } from '@/lib/utils'
import PalletsAdmin from './PalletsAdmin'
import { ScanSerialAction } from './ScanSerial'
import { normPallet, resumePath } from './shared'

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
