import { ShieldAlert } from 'lucide-react'
import { Card, Empty } from '@/components/ui'
import { useSession } from '@/lib/session'

// Muestra el contenido solo a administradores (el API tambien lo valida).
export function AdminOnly({ children }) {
  const { user } = useSession()
  if (user?.role === 'admin') return children
  return (
    <Card>
      <Empty icon={ShieldAlert} title="Solo administradores">
        Pide a un administrador que haga este cambio.
      </Empty>
    </Card>
  )
}
