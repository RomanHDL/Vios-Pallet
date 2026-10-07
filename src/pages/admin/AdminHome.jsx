import { Database, Users } from 'lucide-react'
import { MenuCard } from '@/components/MenuCard'
import { PageHeader } from '@/components/ui'
import { AdminOnly } from './AdminOnly'

export default function AdminHome() {
  return (
    <div>
      <PageHeader title="Administración" subtitle="Usuarios y catálogos de la planta" />
      <AdminOnly>
        <div className="grid gap-3 sm:grid-cols-2">
          <MenuCard to="/admin/usuarios" icon={Users} title="Usuarios" description="Altas, roles, contraseñas y bajas" tone="blue" />
          <MenuCard to="/admin/catalogos" icon={Database} title="Catálogos" description="Líneas, modelos, marcas y defectos" tone="violet" />
        </div>
      </AdminOnly>
    </div>
  )
}
