import { CalendarDays, PackageSearch, Tv, UserPlus, Users } from 'lucide-react'
import { MenuCard } from '@/components/MenuCard'
import { PageHeader } from '@/components/ui'

export default function ReportesHome() {
  return (
    <div>
      <PageHeader title="Reportes" subtitle="Plan contra real, avance por modelo, personal y pallets" />
      <div className="grid gap-3 sm:grid-cols-2">
        <MenuCard
          to="/reportes/dia"
          icon={CalendarDays}
          title="Reporte del día"
          description="Plan vs Real, Delta y Recovery por turno"
          tone="blue"
        />
        <MenuCard
          to="/reportes/modelos"
          icon={Tv}
          title="Producción por modelo"
          description="Avance VIOS HY / SILO contra objetivo MTY + Texas"
          tone="green"
        />
        <MenuCard
          to="/reportes/personal"
          icon={Users}
          title="Personal y productividad"
          description="Piezas producidas por persona, por turno"
          tone="amber"
        />
        <MenuCard
          to="/reportes/personal-turno"
          icon={UserPlus}
          title="Personal del turno"
          description="Captura cuántas personas hay por línea"
          tone="navy"
        />
        <MenuCard
          to="/reportes/pallets"
          icon={PackageSearch}
          title="Dashboard de pallets"
          description="Entrada → salida, faltantes y búsqueda de serial"
          tone="violet"
        />
      </div>
    </div>
  )
}
