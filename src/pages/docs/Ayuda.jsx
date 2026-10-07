import { BookOpen, Code2, History } from 'lucide-react'
import { MenuCard } from '@/components/MenuCard'
import { PageHeader } from '@/components/ui'
import { CHANGELOG } from './changelog'

export default function Ayuda() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ayuda" subtitle={`VIOS Pallet · versión ${CHANGELOG[0].version}`} />
      <div className="grid gap-3">
        <MenuCard to="/ayuda/manual" icon={BookOpen} title="Manual de usuario" description="Cómo usar cada módulo paso a paso" tone="blue" />
        <MenuCard to="/ayuda/cambios" icon={History} title="Historial de cambios" description="Qué hay de nuevo en cada versión" tone="green" />
        <MenuCard to="/ayuda/desarrollador" icon={Code2} title="Manual de desarrollador" description="Arquitectura, modelo de datos y API" tone="violet" />
      </div>
    </div>
  )
}
