// Calidad (2026-10-10): la vista depende del usuario, con los roles que ya existen (sin roles nuevos):
//  - Administrador y supervisores sin area: tablero (indicadores, Pareto 80/20, rechazos recientes).
//  - Areas de Planta (Entrada / Salida), Calidad y operadores: estacion de registro de rechazos.
// Los permisos de escritura siguen en el servidor (POST Calidad/supervisor, DELETE supervisor).
import { useSession } from '@/lib/session'
import CalidadAdmin from './CalidadAdmin'
import EstacionRechazo from './EstacionRechazo'

export const isQualityManager = (user) =>
  user?.role === 'admin' || (user?.role === 'supervisor' && !user?.area)

export default function CalidadHome() {
  const { user } = useSession()
  return isQualityManager(user) ? <CalidadAdmin /> : <EstacionRechazo />
}
