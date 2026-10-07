// Hora por Hora VIOS: conteo por hora del turno contra la meta (diseno de Centro de Trabajo).
// Pantalla completa pensada para una tablet vertical: la grafica crece a lo alto, no a lo ancho.

import { shiftOf } from '@shared/shift.js'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, Card, ErrorBox, Input, Segmented, Select, Spinner, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { useCatalogs, useSession } from '@/lib/session'
import { canDo, cn, fmtInt, fmtYmd } from '@/lib/utils'
import { HourlyChart, HourlyLegend } from './HourlyChart'
import { buildSlots, shiftRange } from './slots'

const SHIFT_OPTIONS = [
  { value: 'T1', label: 'Día' },
  { value: 'T2', label: 'Noche' },
]

function GoalControl({ data, editable, onSaved }) {
  const toast = useToast()
  const [draft, setDraft] = useState(String(data.goal))
  const [busy, setBusy] = useState(false)
  const dirty = draft !== String(data.goal)
  const key = `${data.shiftDate}|${data.shift}|${data.line}|${data.goal}`

  // Al cambiar de turno/linea o al refrescar con otra meta, el campo vuelve al valor guardado.
  useEffect(() => setDraft(String(data.goal)), [key])

  async function save() {
    const goal = Number(draft)
    if (!Number.isInteger(goal) || goal < 1)
      return toast('Escribe una meta válida (piezas enteras).', 'error')
    setBusy(true)
    try {
      await api('/hourly/goal', {
        method: 'PUT',
        body: { shiftDate: data.shiftDate, shift: data.shift, line: data.line || undefined, goal },
      })
      toast('Meta guardada')
      await onSaved()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex items-center gap-2">
        <span className="text-[13.5px] font-semibold text-muted-foreground">
          Plan del turno ({data.shift === 'T1' ? 'día' : 'noche'}):
        </span>
        {editable ? (
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setDraft(String(data.goal))
            }}
            className="h-10 w-[104px] text-right font-mono text-[17px] font-bold"
            aria-label="Plan del turno"
          />
        ) : (
          <span className="rounded-lg bg-muted px-3 py-1.5 font-mono text-[17px] font-bold">
            {fmtInt(data.goal)}
          </span>
        )}
        <span className="text-[13.5px] font-semibold text-muted-foreground">pzs</span>
        {dirty && (
          <Button size="sm" loading={busy} onClick={save}>
            Guardar
          </Button>
        )}
      </div>
    </div>
  )
}

export default function HoraPorHora() {
  const { user } = useSession()
  const { lines: activeLines } = useCatalogs()
  const now = shiftOf()
  const [shiftDate, setShiftDate] = useState(now.shiftDate)
  const [shift, setShift] = useState(now.shift)
  const [line, setLine] = useState('')
  const { data, error, loading, reload } = useApi('/hourly', {
    query: { shiftDate, shift, line },
    refreshMs: 20000,
  })

  const boxRef = useRef(null)
  const [full, setFull] = useState(false)
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) setFull(false)
    }
    const onKey = (e) => e.key === 'Escape' && setFull(false)
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  function toggleFull() {
    const el = boxRef.current
    if (!full) {
      setFull(true)
      // Si el navegador no deja pantalla completa real (iPad viejo), queda como capa sobre toda la pagina.
      const req = el?.requestFullscreen || el?.webkitRequestFullscreen
      req?.call(el)?.catch?.(() => {})
    } else {
      setFull(false)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
      else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.()
    }
  }

  const built = data && buildSlots(data)
  const editable = canDo(user, ['supervisor'])

  return (
    <div
      ref={boxRef}
      className={cn(
        full ? 'fixed inset-0 z-50 overflow-y-auto bg-background px-3 py-3 sm:px-5 sm:py-5' : 'space-y-4',
      )}
    >
      <div className={cn(full && 'mx-auto flex h-full min-h-[600px] w-full max-w-[900px] flex-col gap-3')}>
        {/* Controles */}
        <div className="flex flex-wrap items-center gap-2">
          {!full && (
            <div className="mr-auto min-w-0">
              <h1 className="text-[22px] font-extrabold tracking-tight sm:text-[26px]">Hora por Hora VIOS</h1>
              <p className="mt-0.5 text-[13.5px] text-muted-foreground">
                Piezas por hora contra la meta del turno
              </p>
            </div>
          )}
          {full && (
            <div className="mr-auto min-w-0">
              <p className="text-[19px] font-extrabold tracking-tight">Hora por Hora VIOS</p>
              <p className="text-[13px] font-semibold text-muted-foreground">
                {fmtYmd(shiftDate)} · {shift === 'T1' ? 'Día' : 'Noche'} · {line || 'Todas las líneas'}
              </p>
            </div>
          )}
          {!full && (
            <>
              <Input
                type="date"
                value={shiftDate}
                max={now.shiftDate}
                onChange={(e) => e.target.value && setShiftDate(e.target.value)}
                className="h-10 w-[150px]"
                aria-label="Fecha del turno"
              />
              <Select
                value={line}
                onChange={(e) => setLine(e.target.value)}
                className="h-10 w-[160px]"
                aria-label="Línea"
              >
                <option value="">Todas las líneas</option>
                {activeLines.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </>
          )}
          <div className="flex items-center gap-2">
            <Segmented value={shift} onChange={setShift} options={SHIFT_OPTIONS} />
            <span className="hidden text-[12.5px] font-semibold text-muted-foreground sm:inline">
              {shiftRange(shift)}
            </span>
          </div>
          <Button
            variant="secondary"
            onClick={toggleFull}
            aria-label={full ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{full ? 'Salir' : 'Pantalla completa'}</span>
          </Button>
        </div>

        <ErrorBox error={error} />

        {/* Tarjeta de la grafica */}
        <Card className={cn('overflow-hidden', full && 'flex min-h-0 flex-1 flex-col')}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-4 py-4 sm:px-6">
            <div>
              <h2 className="text-[19px] font-extrabold tracking-tight">Conteo por hora</h2>
              <p className="text-[13.5px] text-muted-foreground">
                Piezas producidas por hora{data ? ` · ${fmtInt(data.total)} en el turno` : ''}
              </p>
            </div>
            {data && (
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <GoalControl data={data} editable={editable} onSaved={() => reload(true)} />
                <p className="text-[11.5px] text-muted-foreground">
                  ≈ {fmtInt(built.hourly)} pzs por hora.{' '}
                  {data.manual
                    ? `Meta capturada desde el ${fmtYmd(data.goalSince, { dow: false })} (plan: ${fmtInt(data.plan)}).`
                    : 'El planeado cambia automáticamente si se actualiza el plan.'}
                </p>
              </div>
            )}
          </div>

          <div className={cn('px-2 pb-3 pt-4 sm:px-4', full && 'flex min-h-0 flex-1 flex-col')}>
            {loading && !data ? (
              <Spinner />
            ) : (
              built && (
                <HourlyChart
                  slots={built.slots}
                  big={full}
                  className={cn(full ? 'min-h-[420px] flex-1' : 'h-[320px] sm:h-[360px] lg:h-[420px]')}
                />
              )
            )}
            <HourlyLegend className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 px-2 text-[12.5px] font-semibold text-muted-foreground" />
          </div>
        </Card>
      </div>
    </div>
  )
}
