import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  ClipboardCheck,
  Factory,
  PackageCheck,
  Target,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { shiftLabel } from '@shared/shift.js'
import { MenuCard } from '@/components/MenuCard'
import { Badge, Card, CardHeader, Empty, Progress, Spinner, Stat } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { canDo, fmtAgo, fmtInt, fmtPct, fmtYmd } from '@/lib/utils'

const KIND = {
  produccion: { label: 'Producción', tone: 'green' },
  rechazo: { label: 'Rechazo', tone: 'red' },
  pallet: { label: 'Pallet', tone: 'blue' },
}

export default function Home() {
  const { user } = useSession()
  const { data, loading } = useApi('/dashboard', { refreshMs: 20000 })
  const pct = data?.goal ? data.produced / data.goal : null
  const first = user?.name?.split(' ')[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-semibold text-muted-foreground">
            {data ? `${shiftLabel(data.shift)} · ${fmtYmd(data.shiftDate)}` : ' '}
          </p>
          <h1 className="text-[24px] font-extrabold tracking-tight sm:text-[28px]">Hola, {first}</h1>
        </div>
        <div className="flex gap-2">
          {canDo(user, ['supervisor', 'operador']) && (
            <Link to="/pallets/salida" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
              <ArrowUpFromLine className="h-[18px] w-[18px]" /> Escanear salida
            </Link>
          )}
        </div>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="col-span-2 flex flex-col justify-center p-4 sm:p-5 lg:row-span-2 lg:p-6">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Producción del turno</span>
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="tabular text-[40px] font-extrabold leading-none tracking-tight">{fmtInt(data?.produced)}</span>
                <span className="pb-1 text-[15px] font-semibold text-muted-foreground">/ {fmtInt(data?.goal)} meta</span>
                <span className="ml-auto pb-1 text-[18px] font-extrabold text-primary">{fmtPct(pct)}</span>
              </div>
              <Progress value={pct} className="mt-3" tone={pct >= 1 ? 'green' : 'primary'} />
              {data?.pace && (
                <Link to="/hora-por-hora" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
                  <span>
                    Proyección fin de turno:{' '}
                    <b className={data.pace.projection >= data.goal ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {fmtInt(data.pace.projection)}
                    </b>
                  </span>
                  <span>
                    1 pz cada <b className="text-foreground">{data.pace.secPerPiece ? `${Math.round(data.pace.secPerPiece)} s` : '—'}</b> (meta{' '}
                    {Math.round(data.pace.goalSecPerPiece)} s)
                  </span>
                </Link>
              )}
            </Card>
            <Stat label="Rechazos hoy" value={fmtInt(data?.rejected)} icon={ClipboardCheck} tone={data?.rejected ? 'red' : 'default'} hint="Calidad" />
            <Stat label="Con faltantes" value={fmtInt(data?.withMissing7d)} icon={AlertTriangle} tone={data?.withMissing7d ? 'amber' : 'default'} hint="Salidas, últimos 7 días" />
            <Stat label="Entradas abiertas" value={fmtInt(data?.openEntrada)} icon={ArrowDownToLine} tone="blue" hint="Escaneando" />
            <Stat label="Salidas abiertas" value={fmtInt(data?.openSalida)} icon={ArrowUpFromLine} tone="violet" hint="Por conciliar" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="grid content-start gap-3 sm:grid-cols-2">
              <MenuCard to="/pallets" icon={PackageCheck} title="Control de Pallet" description="Entrada, salida y conciliación" tone="blue" />
              <MenuCard to="/produccion" icon={Factory} title="Producción" description="Conteo del turno, ritmo y proyección" tone="green" />
              <MenuCard to="/calidad" icon={ClipboardCheck} title="Calidad" description="Rechazos por defecto" tone="red" />
              <MenuCard to="/reportes" icon={BarChart3} title="Reportes" description="Plan vs Real, modelos y pallets" tone="violet" />
            </div>
            <Card>
              <CardHeader title="Actividad reciente" subtitle="Últimos movimientos" />
              {data?.recent?.length ? (
                <ul className="divide-y">
                  {data.recent.map((r, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <Badge tone={KIND[r.kind]?.tone}>{KIND[r.kind]?.label}</Badge>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[13.5px] font-semibold">{r.ref}</span>
                        <span className="block truncate text-[12px] text-muted-foreground">{r.detail}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-muted-foreground">{fmtAgo(r.at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="Sin actividad todavía" />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
