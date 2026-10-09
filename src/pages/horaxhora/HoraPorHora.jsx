// Hora por Hora VIOS: conteo por hora del turno contra la meta (diseno de Centro de Trabajo).
// Pantalla completa pensada para una tablet vertical: la grafica crece a lo alto, no a lo ancho.

import { shiftOf } from '@shared/shift.js'
import { Gauge, Maximize2, Minimize2, Target, TrendingUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, Card, Dialog, ErrorBox, Input, Segmented, Spinner, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { canDo, cn, fmtInt, fmtPct, fmtYmd } from '@/lib/utils'
import { BrandSplit } from '@/components/BrandSplit'
import { HourlyChart, HourlyLegend } from './HourlyChart'
import { buildSlots, shiftRange } from './slots'

// 47 -> "47 s", 94 -> "1 min 34 s"
function fmtSec(s) {
  if (s === null || s === undefined || !Number.isFinite(s)) return '—'
  const t = Math.round(s)
  if (t < 60) return `${t} s`
  const m = Math.floor(t / 60)
  const r = t % 60
  return r ? `${m} min ${r} s` : `${m} min`
}

const TONE = {
  green: 'text-emerald-600 dark:text-emerald-400',
  red: 'text-red-600 dark:text-red-400',
  blue: 'text-blue-600 dark:text-blue-400',
}

function PaceCard({ icon: Icon, label, value, hint, tone, big }) {
  return (
    <Card className={cn('p-3 sm:p-4', big && 'sm:p-5')}>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[12px]">
          {label}
        </span>
        <Icon className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
      </div>
      <div
        className={cn(
          'tabular mt-1.5 font-extrabold leading-tight tracking-tight',
          big ? 'text-[24px] sm:text-[34px]' : 'text-[21px] sm:text-[28px]',
          TONE[tone],
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium leading-snug text-muted-foreground sm:text-[12.5px]">
        {hint}
      </div>
    </Card>
  )
}

const SHIFT_OPTIONS = [
  { value: 'T1', label: 'Día' },
  { value: 'T2', label: 'Noche' },
]

function GoalControl({ data, editable, onSaved }) {
  const toast = useToast()
  const [draft, setDraft] = useState(String(data.goal))
  const [busy, setBusy] = useState(false)
  const dirty = draft !== String(data.goal)
  const key = `${data.shiftDate}|${data.shift}|${data.goal}`

  // Al cambiar de turno o al refrescar con otra meta, el campo vuelve al valor guardado.
  useEffect(() => setDraft(String(data.goal)), [key])

  async function save() {
    const goal = Number(draft)
    if (!Number.isInteger(goal) || goal < 1)
      return toast('Escribe una meta válida (piezas enteras).', 'error')
    setBusy(true)
    try {
      await api('/hourly/goal', {
        method: 'PUT',
        body: { shiftDate: data.shiftDate, shift: data.shift, goal },
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
          Meta {data.shift === 'T1' ? 'del día' : 'de la noche'}:
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
            aria-label="Meta del turno"
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

// Ajuste por marca: el supervisor captura cuantas piezas se hicieron de verdad en el turno.
function AdjustDialog({ target, adjustment, shiftDate, shift, onClose, onSaved }) {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (target) setValue(String(target.pieces))
  }, [target])
  const raw = target ? target.pieces - adjustment : 0
  async function save(pieces) {
    setSaving(true)
    try {
      await api('/hourly/brand-count', {
        method: 'PUT',
        body: { shiftDate, shift, brand: target.brand, pieces },
      })
      toast(pieces === null ? 'Ajuste quitado' : `${target.brand}: ${pieces} piezas en el turno`)
      onSaved()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog
      open={Boolean(target)}
      onClose={() => !saving && onClose()}
      title={target ? `Ajustar ${target.brand}` : ''}
      footer={
        <>
          {adjustment !== 0 && (
            <Button variant="outline" onClick={() => save(null)} disabled={saving} className="mr-auto">
              Quitar ajuste
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => save(Number(value))} loading={saving} disabled={value === '' || Number(value) < 0}>
            Guardar
          </Button>
        </>
      }
    >
      {target && (
        <div className="space-y-3 text-[14px]">
          <p>
            Piezas de {target.brand} que de verdad se hicieron en este turno. Escaneadas:{' '}
            <b className="tabular">{fmtInt(raw)}</b>.
          </p>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-12 text-[20px] font-bold"
            autoFocus
          />
          <p className="text-[12.5px] text-muted-foreground">
            Cambia el total del turno en Hora x Hora, Inicio y Reportes.
          </p>
        </div>
      )}
    </Dialog>
  )
}

export default function HoraPorHora() {
  const { user } = useSession()
  const now = shiftOf()
  const [shiftDate, setShiftDate] = useState(now.shiftDate)
  const [shift, setShift] = useState(now.shift)
  const { data, error, loading, reload } = useApi('/hourly', {
    query: { shiftDate, shift },
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

  const [adjust, setAdjust] = useState(null)
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
                {fmtYmd(shiftDate)} · {shift === 'T1' ? 'Día' : 'Noche'}
              </p>
            </div>
          )}
          {!full && (
            <Input
              type="date"
              value={shiftDate}
              max={now.shiftDate}
              onChange={(e) => e.target.value && setShiftDate(e.target.value)}
              className="h-10 w-[150px]"
              aria-label="Fecha del turno"
            />
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

        {/* Ritmo: llevan, tiempo por pieza y proyeccion al fin del turno */}
        {data && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <PaceCard
              big={full}
              icon={Target}
              label="Llevan"
              value={fmtInt(data.total)}
              tone={data.total >= data.pace.expectedNow ? 'green' : 'red'}
              hint={`de ${fmtInt(data.goal)} (${fmtPct(data.goal ? data.total / data.goal : null)}) · deberían llevar ${fmtInt(data.pace.expectedNow)}`}
            />
            <PaceCard
              big={full}
              icon={Gauge}
              label="Tiempo por pieza"
              value={data.pace.secPerPiece === null ? '—' : fmtSec(data.pace.secPerPiece)}
              tone={
                data.pace.secPerPiece === null
                  ? undefined
                  : data.pace.secPerPiece <= data.pace.goalSecPerPiece
                    ? 'green'
                    : 'red'
              }
              hint={`La meta pide 1 pz cada ${fmtSec(data.pace.goalSecPerPiece)}`}
            />
            <PaceCard
              big={full}
              icon={TrendingUp}
              label="Proyección fin turno"
              value={fmtInt(data.pace.projection)}
              tone={data.pace.projection >= data.goal ? 'green' : 'red'}
              hint={
                data.pace.remainingHours > 0
                  ? `${data.pace.projection >= data.goal ? '+' : ''}${fmtInt(data.pace.projection - data.goal)} contra la meta, a este ritmo`
                  : 'Turno terminado'
              }
            />
          </div>
        )}

        {data && (
          <BrandSplit
            brands={data.brands}
            big={full}
            adjustments={data.adjustments}
            onAdjust={editable && !full ? setAdjust : undefined}
          />
        )}
        <AdjustDialog
          target={adjust}
          adjustment={adjust ? data?.adjustments?.[adjust.brand] || 0 : 0}
          shiftDate={shiftDate}
          shift={shift}
          onClose={() => setAdjust(null)}
          onSaved={() => {
            setAdjust(null)
            reload(true)
          }}
        />

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
                  ≈ {fmtInt(built.hourly)} pzs por hora · 1 pz cada {fmtSec(data.pace.goalSecPerPiece)}.{' '}
                  {data.manual
                    ? `Meta capturada desde el ${fmtYmd(data.goalSince, { dow: false })}.`
                    : 'Meta por defecto.'}
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
