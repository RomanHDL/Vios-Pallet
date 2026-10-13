// Produccion del turno (diseno de la pantalla de linea de PalletScan, pedido 2026-10-07): numero grande contra
// la meta, desde ultimo scan, piezas por hora, promedio por unidad, proyeccion (con tiempo extra) y la grafica
// por hora. Mismo conteo que Inicio y Hora por Hora: salidas cerradas + escaneo por linea, contra la meta del dia.
import { shiftLabel } from '@shared/shift.js'
import { BarChart3, ChevronRight, Maximize2, Minimize2, Target, Timer, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { useCatalogs } from '@/lib/session'
import { cn, fmtInt, fmtYmd } from '@/lib/utils'
import { HourlyChart, HourlyLegend } from '../horaxhora/HourlyChart'
import { buildSlots } from '../horaxhora/slots'
import { BackLink } from './common'

// 88 -> "01:28", 4000 -> "1:06:40"
function clock(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '—'
  const t = Math.max(0, Math.round(sec))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// Segundos desde `iso`, actualizandose cada segundo.
function useSince(iso) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return iso ? (now - new Date(iso).getTime()) / 1000 : null
}

function Tile({ icon: Icon, iconClass, value, valueClass, extra, label }) {
  return (
    <Card className="flex flex-col items-center justify-center px-3 py-5 text-center sm:py-6">
      <Icon className={cn('h-6 w-6', iconClass)} />
      <div
        className={cn(
          'tabular mt-2 text-[34px] font-extrabold leading-none tracking-tight text-navy dark:text-foreground sm:text-[40px]',
          valueClass,
        )}
      >
        {value}
      </div>
      {extra}
      <div className="mt-2 text-[14px] text-muted-foreground">{label}</div>
    </Card>
  )
}

// Piezas del turno por modelo y marca (2026-10-12, Roman: "5 cards arriba del 90, con HY y SILO y las 5 pulgadas,
// al mismo nivel"). Mismo conteo que el numero grande: /dashboard/brand (turno actual, una vez por serial).
function ModelRow() {
  const { models } = useCatalogs()
  const hy = useApi('/dashboard/brand', { query: { brand: 'HY' }, refreshMs: 15000 })
  const silo = useApi('/dashboard/brand', { query: { brand: 'SILO' }, refreshMs: 15000 })
  const count = (q, code) => q.data?.models.find((m) => m.model === code)?.pieces || 0
  const list = models.length ? models : []
  if (!list.length) return null
  return (
    <div
      className="grid gap-2 sm:gap-3"
      style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}
    >
      {list.map((m) => {
        const h = count(hy, m.code)
        const sl = count(silo, m.code)
        return (
          <Card
            key={m.code}
            className={cn(
              'flex min-w-0 flex-col px-2 py-3 text-center sm:px-3',
              h + sl > 0 && 'ring-2 ring-primary/30',
            )}
          >
            <div className="truncate text-[13px] font-extrabold text-primary sm:text-[15px]">{m.code}</div>
            <div className="tabular mt-1 text-[30px] font-extrabold leading-none text-navy dark:text-foreground sm:text-[38px]">
              {fmtInt(h + sl)}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] sm:text-[12.5px]">
              <span className="rounded-md bg-blue-50 px-1 py-1 font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                HY{' '}
                <span className="tabular block text-[15px] text-foreground sm:text-[17px]">{fmtInt(h)}</span>
              </span>
              <span className="rounded-md bg-violet-50 px-1 py-1 font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                SILO{' '}
                <span className="tabular block text-[15px] text-foreground sm:text-[17px]">{fmtInt(sl)}</span>
              </span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// Pantalla completa del navegador (para la tele de la linea).
function useFullscreen() {
  const ref = useRef(null)
  const [full, setFull] = useState(false)
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else ref.current?.requestFullscreen?.().catch(() => {})
  }
  return [ref, full, toggle]
}

export default function ProduccionHome() {
  const { data, error, loading } = useApi('/hourly', { refreshMs: 15000 })
  const [boxRef, full, toggleFull] = useFullscreen()
  const idle = useSince(data?.lastScanAt)
  const p = data?.pace
  const pct = data?.goal ? data.total / data.goal : 0
  const built = data && buildSlots(data)

  return (
    <div
      ref={boxRef}
      className={cn(
        'mx-auto max-w-5xl space-y-4',
        full && 'h-full max-w-none overflow-y-auto bg-background p-4 sm:p-6',
      )}
    >
      <PageHeader
        back={full ? null : <BackLink to="/">Inicio</BackLink>}
        title="Producción"
        subtitle={
          data
            ? `${shiftLabel(data.shift)} · ${fmtYmd(data.shiftDate)} · salidas + escaneo por línea`
            : 'Salidas + escaneo por línea'
        }
        actions={
          <button
            type="button"
            onClick={toggleFull}
            className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3.5 text-[13.5px] font-semibold hover:bg-muted"
          >
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {full ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </button>
        }
      />

      <ErrorBox error={error} />

      {loading && !data ? (
        <Spinner />
      ) : (
        data && (
          <>
            <ModelRow />
            <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
              {/* Conteo contra la meta */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-navy px-6 py-8 text-white shadow-sm sm:py-10">
                <div className="tabular text-[96px] font-extrabold leading-none tracking-tight sm:text-[120px]">
                  {fmtInt(data.total)}
                </div>
                <div className="mt-3 text-[17px] text-white/70">
                  de {fmtInt(data.goal)} meta · {shiftLabel(data.shift)}
                </div>
                <div className="mt-5 h-3 w-full max-w-md overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white/85 transition-all"
                    style={{ width: `${Math.min(100, pct * 100)}%` }}
                  />
                </div>
                <div className="mt-4 text-[22px] font-bold text-white/90">{Math.round(pct * 100)}%</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Tile
                  icon={Timer}
                  iconClass="text-slate-700 dark:text-slate-300"
                  value={clock(idle)}
                  valueClass={
                    idle > 1800
                      ? 'text-red-600 dark:text-red-400'
                      : idle > 600
                        ? 'text-amber-600 dark:text-amber-400'
                        : ''
                  }
                  label="Desde último scan"
                />
                <Tile
                  icon={Zap}
                  iconClass="text-amber-500"
                  value={p.secPerPiece && Number.isFinite(p.perHour) ? p.perHour.toFixed(1) : '—'}
                  label="Por hora (turno)"
                />
                <Tile
                  icon={BarChart3}
                  iconClass="text-blue-600"
                  value={clock(p.secPerPiece)}
                  label="Promedio / unidad"
                />
                <Tile
                  icon={Target}
                  iconClass="text-red-500"
                  value={fmtInt(p.projection)}
                  valueClass={p.projection >= data.goal ? 'text-emerald-600 dark:text-emerald-400' : ''}
                  extra={
                    p.projectionExtra != null &&
                    p.projectionExtra > p.projection && (
                      <div className="mt-1.5 text-[15px] font-bold text-amber-600 dark:text-amber-400">
                        ~{fmtInt(p.projectionExtra)} c/T. Extra
                      </div>
                    )
                  }
                  label="Proyección turno"
                />
              </div>
            </div>

            {/* Produccion por hora (no en pantalla completa: ahi solo modelos, numero y las 4 tarjetas) */}
            {!full && (
              <Card className="px-3 pb-3 pt-4 sm:px-5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                    Producción por hora
                  </h2>
                  <Link
                    to="/hora-por-hora"
                    className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-primary hover:underline"
                  >
                    Hora x Hora <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                <HourlyChart slots={built.slots} className="mt-2 h-[240px] sm:h-[300px]" />
                <HourlyLegend className="mt-1 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-[12.5px] font-semibold text-muted-foreground" />
              </Card>
            )}
          </>
        )
      )}
    </div>
  )
}
