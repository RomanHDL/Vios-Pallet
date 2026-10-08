import { ClipboardList, Clock3, Gauge, History, MonitorPlay, ScanBarcode, Target, TrendingUp, Users } from 'lucide-react'
import { shiftLabel } from '@shared/shift.js'
import { MenuCard } from '@/components/MenuCard'
import { Badge, Card, ErrorBox, PageHeader, Stat } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { canDo, fmtInt, fmtYmd } from '@/lib/utils'
import { BackLink, CountVsGoal } from './common'

export default function ProduccionHome() {
  const { user } = useSession()
  // Mismo conteo y meta que Inicio y Hora por Hora: piezas de salidas cerradas contra la meta del dia (765).
  const { data, error } = useApi('/hourly', { refreshMs: 20000 })
  const p = data?.pace
  const sec = p?.secPerPiece

  return (
    <div className="space-y-6">
      <PageHeader
        back={<BackLink to="/">Inicio</BackLink>}
        title="Producción"
        subtitle="Piezas de pallets de salida cerrados"
        actions={data && <Badge tone="blue" dot>{shiftLabel(data.shift)} · {fmtYmd(data.shiftDate)}</Badge>}
      />

      <ErrorBox error={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="col-span-2 p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Total del turno</span>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <CountVsGoal count={data?.total} goal={data?.goal} pct={data?.goal ? data.total / data.goal : null} size="lg" />
        </Card>
        <Stat
          label="Tiempo por pieza"
          value={sec ? `${Math.round(sec)} s` : '—'}
          icon={Gauge}
          tone="blue"
          hint={p ? `${sec ? `${Math.round(3600 / sec)} pzs por hora · ` : ''}meta 1 pz cada ${Math.round(p.goalSecPerPiece)} s` : ' '}
        />
        <Stat
          label="Proyección"
          value={fmtInt(p?.projection)}
          icon={TrendingUp}
          tone={data && p.projection >= data.goal ? 'green' : 'amber'}
          hint="Al cierre del turno, a este ritmo"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {canDo(user, ['supervisor', 'operador']) && (
          <MenuCard to="/produccion/registro" icon={ScanBarcode} title="Registrar producto terminado" description="Escanea serial de TV y de caja" tone="green" />
        )}
        <MenuCard to="/produccion/lineas" icon={MonitorPlay} title="Líneas en vivo" description="Avance contra meta por línea" tone="blue" />
        <MenuCard to="/hora-por-hora" icon={Clock3} title="Hora por Hora VIOS" description="Conteo por hora contra la meta del turno" tone="navy" />
        <MenuCard
          to="/produccion/plan"
          icon={canDo(user, ['supervisor']) ? Users : ClipboardList}
          title="Plan y personal del turno"
          description={canDo(user, ['supervisor']) ? 'Materiales disponibles y personas por línea' : 'Consulta el plan del turno'}
          tone="amber"
        />
        <MenuCard to="/produccion/historial" icon={History} title="Historial" description="Busca seriales registrados" tone="violet" />
      </div>
    </div>
  )
}
