// /calidad/nuevo: la estacion de registro de rechazos (la misma que ven los operadores en /calidad).
import { useSession } from '@/lib/session'
import { BackLink } from '../produccion/common'
import { isQualityManager } from './CalidadHome'
import EstacionRechazo from './EstacionRechazo'

export default function NuevoRechazo() {
  const { user } = useSession()
  return <EstacionRechazo back={isQualityManager(user) ? <BackLink to="/calidad">Calidad</BackLink> : null} />
}
