import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { useSession } from './lib/session'
import Usuarios from './pages/admin/Usuarios'
import Catalogos from './pages/admin/Catalogos'
import AdminHome from './pages/admin/AdminHome'
import CalidadHome from './pages/calidad/CalidadHome'
import NuevoRechazo from './pages/calidad/NuevoRechazo'
import Ayuda from './pages/docs/Ayuda'
import Cambios from './pages/docs/Cambios'
import Desarrollador from './pages/docs/Desarrollador'
import Manual from './pages/docs/Manual'
import Home from './pages/Home'
import HoraPorHora from './pages/horaxhora/HoraPorHora'
import Login from './pages/Login'
import Perfil from './pages/Perfil'
import PalletDetail from './pages/pallets/PalletDetail'
import PalletHistory from './pages/pallets/PalletHistory'
import PalletsHome from './pages/pallets/PalletsHome'
import ReporteSalida from './pages/pallets/ReporteSalida'
import ScanEntrada from './pages/pallets/ScanEntrada'
import ScanSalida from './pages/pallets/ScanSalida'
import LineaDetalle from './pages/produccion/LineaDetalle'
import Lineas from './pages/produccion/Lineas'
import ProduccionHistorial from './pages/produccion/ProduccionHistorial'
import ProduccionHome from './pages/produccion/ProduccionHome'
import PlanPersonal from './pages/produccion/PlanPersonal'
import Registro from './pages/produccion/Registro'
import ReporteDia from './pages/reportes/ReporteDia'
import ReporteModelos from './pages/reportes/ReporteModelos'
import ReportePallets from './pages/reportes/ReportePallets'
import ReportePersonal from './pages/reportes/ReportePersonal'
import ReportesHome from './pages/reportes/ReportesHome'

export default function App() {
  const { user } = useSession()
  if (user === undefined) return <Spinner className="min-h-dvh" />
  if (!user) return <Login />
  return (
    <Routes>
      {/* Reporte de salida para imprimir: hoja sola, sin menu. */}
      <Route path="pallets/:id/reporte" element={<ReporteSalida />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="perfil" element={<Perfil />} />

        <Route path="pallets" element={<PalletsHome />} />
        <Route path="pallets/entrada" element={<ScanEntrada />} />
        <Route path="pallets/salida" element={<ScanSalida />} />
        <Route path="pallets/historial" element={<PalletHistory />} />
        <Route path="pallets/:id" element={<PalletDetail />} />

        <Route path="produccion" element={<ProduccionHome />} />
        <Route path="produccion/registro" element={<Registro />} />
        <Route path="produccion/lineas" element={<Lineas />} />
        <Route path="produccion/lineas/:line" element={<LineaDetalle />} />
        <Route path="produccion/historial" element={<ProduccionHistorial />} />
        <Route path="produccion/plan" element={<Navigate to="/reportes/personal-turno" replace />} />
        <Route path="reportes/personal-turno" element={<PlanPersonal />} />

        <Route path="hora-por-hora" element={<HoraPorHora />} />

        <Route path="calidad" element={<CalidadHome />} />
        <Route path="calidad/nuevo" element={<NuevoRechazo />} />

        <Route path="reportes" element={<ReportesHome />} />
        <Route path="reportes/dia" element={<ReporteDia />} />
        <Route path="reportes/modelos" element={<ReporteModelos />} />
        <Route path="reportes/personal" element={<ReportePersonal />} />
        <Route path="reportes/pallets" element={<ReportePallets />} />

        <Route path="admin" element={<AdminHome />} />
        <Route path="admin/usuarios" element={<Usuarios />} />
        <Route path="admin/catalogos" element={<Catalogos />} />

        <Route path="ayuda" element={<Ayuda />} />
        <Route path="ayuda/manual" element={<Manual />} />
        <Route path="ayuda/cambios" element={<Cambios />} />
        <Route path="ayuda/desarrollador" element={<Desarrollador />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
