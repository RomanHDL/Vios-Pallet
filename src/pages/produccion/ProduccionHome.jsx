import { ClipboardList, Clock3, Gauge, History, MonitorPlay, ScanBarcode, Target, TrendingUp, Users } from 'lucide-react'
import { shiftLabel } from '@shared/shift.js'
import { MenuCard } from '@/components/MenuCard'
import { Badge, Card, ErrorBox, PageHeader, Stat } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { canDo, fmtInt, fmtYmd } from '@/lib/utils'
import { BackLink, CountVsGoal, fmtDec, totalsOf } from './common'

export default function ProduccionHome() {
  const { user } = useSession()
  const { data, error } = useApi('/production/live', { refreshMs: 20000 })
  const ctx = data && { shiftDate: data.shiftDate, shift: data.shift, now: data.now }
  const t = data ? totalsOf(data.lines, ctx) : null
  const running = data?.lines.filter((l) => l.count > 0).length

  return (
    <div className="space-y-6">
      <PageHeader
        back={<BackLink to="/">Inicio</BackLink>}
        title="Producción"
        subtitle="Producto terminado por línea"
        actions={data && <Badge tone="blue" dot>{shiftLabel(data.shift)} · {fmtYmd(data.shiftDate)}</Badge>}
      />

      <ErrorBox error={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="col-span-2 p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Total del turno</span>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <CountVsGoal count={t?.count} goal={t?.goal} pct={t?.pct} size="lg" />
        </Card>
        <Stat label="Piezas / hora" value={t ? fmtDec(t.uph) : '—'} icon={Gauge} tone="blue" hint={data ? `${running} de ${data.lines.length} líneas con producción` : ' '} />
        <Stat
          label="Proyección"
          value={fmtInt(t?.projection)}
          icon={TrendingUp}
          tone={t && t.goal && t.projection >= t.goal ? 'green' : 'amber'}
          hint={t?.people ? `${fmtInt(t.people)} personas en líneas` : 'Al cierre del turno'}
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
