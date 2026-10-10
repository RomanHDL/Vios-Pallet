// Centro de reportes (2026-10-10, diseno de referencia de Roman): 4 tarjetas con datos reales y filtros propios
// cada una (se guardan por tarjeta al ir y volver de un reporte completo). Cada tarjeta abre su reporte completo con
// los mismos filtros.
import { History } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtAgo } from '@/lib/utils'
import { DiaCard } from './centro/DiaCard'
import { ModelosCard } from './centro/ModelosCard'
import { PalletsCard } from './centro/PalletsCard'
import { PersonalCard } from './centro/PersonalCard'

export default function ReportesHome() {
  const [updatedAt, setUpdatedAt] = useState(null)
  const [, tick] = useState(0)
  const onUpdate = useCallback(() => setUpdatedAt(new Date().toISOString()), [])
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-[32px]">
            Centro de reportes
          </h1>
          <p className="mt-1 text-[15px] font-semibold text-muted-foreground">
            Analiza producción, productividad y trazabilidad desde un solo lugar.
          </p>
          <p className="text-[13.5px] text-muted-foreground">
            Selecciona un reporte para consultar indicadores y resultados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span
              className={`h-2 w-2 rounded-full ${updatedAt ? 'bg-emerald-500' : 'animate-pulse bg-muted-foreground'}`}
            />
            {updatedAt ? `Actualizado ${fmtAgo(updatedAt)}` : 'Cargando…'}
          </span>
          <Link
            to="/pallets/historial"
            className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-primary/80 bg-card px-3.5 text-[13.5px] font-bold text-primary transition hover:bg-primary/5"
          >
            <History className="h-4 w-4" /> Ver historial
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        <DiaCard onUpdate={onUpdate} />
        <ModelosCard onUpdate={onUpdate} />
        <PersonalCard onUpdate={onUpdate} />
        <PalletsCard onUpdate={onUpdate} />
      </div>
    </div>
  )
}
