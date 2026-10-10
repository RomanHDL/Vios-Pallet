// Calidad, vista de operador (2026-10-10, diseno de referencia): estacion de registro de rechazos en 3 pasos.
// Misma logica que antes: escaneo con pistola o camara (Scanner), GET /rejections/lookup para los datos reales de la
// TV, POST /rejections (Calidad y supervisores; Planta Entrada/Salida es supervisor de su area). Varios defectos por
// rechazo; "Otro" exige describirlo. Comentarios hasta 500 caracteres.
import {
  AlertTriangle,
  Box,
  Cable,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Hammer,
  Lightbulb,
  Loader2,
  MessageSquare,
  MonitorX,
  MoreHorizontal,
  Package,
  Power,
  PowerOff,
  ScanLine,
  Send,
  ShieldCheck,
  Slash,
  Sparkles,
  Tag,
  Tv,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Scanner } from '@/components/Scanner'
import { Badge, Button, Dialog, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useCatalogs, useSession } from '@/lib/session'
import { canDo, cn, feedback, fmtDateTime } from '@/lib/utils'
import { defectList } from '../produccion/common'

const VALID = /^(EL|J0)/
const OTHER = '__otro__'
const MAX_COMMENTS = 500

// Icono por defecto del catalogo (los nuevos que se agreguen usan la etiqueta).
const ICONS = {
  'Pantalla Estrellada': MonitorX,
  'Fuga de Luz': Lightbulb,
  'No Enciende': Power,
  'Se Apaga': PowerOff,
  'Sin Control': Tv,
  'Sin Bases': Box,
  'Sin Tornillos': Wrench,
  'Sin Cable de Alimentación': Cable,
  Rayada: Slash,
  'Mal Procesada': Package,
  'Chasis Golpeado': Hammer,
}

function Steps({ step1, step2 }) {
  const steps = [
    { n: 1, title: 'Escanear serial', hint: 'Escanea el serial de la TV', done: step1 },
    { n: 2, title: 'Seleccionar defectos', hint: 'Marca uno o más defectos', done: step2 },
    { n: 3, title: 'Registrar', hint: 'Confirma el rechazo', done: false },
  ]
  const active = !step1 ? 1 : !step2 ? 2 : 3
  return (
    <ol className="grid gap-2 rounded-2xl border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:grid-cols-3">
      {steps.map((s) => {
        const on = s.n === active
        return (
          <li
            key={s.n}
            className="flex items-center gap-3 sm:justify-center"
            aria-current={on ? 'step' : undefined}
          >
            <span
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-extrabold transition',
                s.done
                  ? 'bg-emerald-500 text-white'
                  : on
                    ? 'bg-blue-600 text-white shadow-[0_0_0_4px_rgba(37,99,235,0.15)]'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {s.done ? <CheckCircle2 className="h-5 w-5" /> : s.n}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-[14px] font-bold',
                  on
                    ? 'text-blue-700 dark:text-blue-300'
                    : s.done
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {s.title}
              </span>
              <span className="block text-[12px] text-muted-foreground">{s.hint}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Box3({ title, icon: Icon, subtitle, children, className }) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-2xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.14)]',
        className,
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold leading-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">{children}</div>
    </section>
  )
}

function Row({ icon: Icon, label, children }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-[13.5px] font-semibold">
        {children || <span className="text-muted-foreground">—</span>}
      </span>
    </li>
  )
}

export default function EstacionRechazo({ back }) {
  const { user } = useSession()
  const { defects, loaded } = useCatalogs()
  const toast = useToast()
  const scanRef = useRef(null)
  const sending = useRef(false)

  const [info, setInfo] = useState(null)
  const [looking, setLooking] = useState(false)
  const [lookError, setLookError] = useState(null)
  const [picked, setPicked] = useState([])
  const [other, setOther] = useState('')
  const [comments, setComments] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const [help, setHelp] = useState(false)

  const canAdd = canDo(user, ['calidad', 'supervisor'])

  const reset = () => {
    setInfo(null)
    setLookError(null)
    setPicked([])
    setOther('')
    setComments('')
    setError(null)
    scanRef.current?.focus()
  }

  const onScan = async (raw) => {
    const s = raw.replace(/\s+/g, '').toUpperCase()
    reset()
    setDone(null)
    if (!VALID.test(s)) {
      feedback(false)
      setLookError(`El serial debe empezar con EL o J0. Leído: ${s}`)
      return
    }
    setLooking(true)
    try {
      const d = await api(`/rejections/lookup/${encodeURIComponent(s)}`)
      setInfo(d)
      feedback(true)
    } catch (e) {
      feedback(false)
      setLookError(e.message)
    } finally {
      setLooking(false)
    }
  }

  const toggle = (name) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]))
  const finalDefects = [
    ...picked.filter((x) => x !== OTHER),
    ...(picked.includes(OTHER) && other.trim() ? [other.trim()] : []),
  ]
  const otherMissing = picked.includes(OTHER) && !other.trim()
  const ready = Boolean(info) && finalDefects.length > 0 && !otherMissing && canAdd

  const submit = async () => {
    if (!ready || sending.current) return
    sending.current = true
    setSaving(true)
    setError(null)
    try {
      await api('/rejections', {
        method: 'POST',
        body: { serial: info.serial, defects: finalDefects, comments: comments.trim() },
      })
      feedback(true)
      toast(`Rechazo registrado · ${info.serial}`)
      setDone({ serial: info.serial, defects: finalDefects })
      reset()
    } catch (e) {
      // Se conserva lo capturado para reintentar.
      feedback(false)
      setError(e)
    } finally {
      sending.current = false
      setSaving(false)
    }
  }

  const catalog = [
    ...defects.map((d) => ({ key: d.name, label: d.name, icon: ICONS[d.name] || Tag })),
    { key: OTHER, label: 'Otro', icon: MoreHorizontal },
  ]
  const previous = info?.previous || []

  return (
    <div className="space-y-4">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">Calidad</h1>
            <p className="text-[13.5px] text-muted-foreground">Registra los defectos de las televisiones</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHelp(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted"
        >
          <CircleHelp className="h-4 w-4" /> ¿Cómo registrar un rechazo?
        </button>
      </div>

      <Steps step1={Boolean(info)} step2={finalDefects.length > 0 && !otherMissing} />

      {!canAdd && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <XCircle className="h-4 w-4 shrink-0" /> Tu usuario puede consultar seriales, pero solo Calidad y
          supervisores pueden registrar rechazos.
        </div>
      )}

      {done && (
        <div className="animate-pop flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13.5px] font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> Rechazo registrado:{' '}
          <span className="font-mono">{done.serial}</span> · {done.defects.join(', ')}.
          <span className="font-normal">Escanea el siguiente serial.</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.8fr)]">
        {/* 1. Serial e informacion */}
        <div className="flex min-w-0 flex-col gap-4">
          <Box3 title="Serial de la TV">
            <Scanner
              ref={scanRef}
              onScan={onScan}
              busy={looking}
              status={lookError ? 'error' : info ? 'ok' : undefined}
              placeholder="Serial (EL… / J0…)"
            />
            {looking && (
              <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando la TV…
              </p>
            )}
            {lookError && (
              <div className="animate-pop mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13.5px] font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {lookError}
              </div>
            )}
          </Box3>
          <Box3 title="Información de la TV" className="flex-1">
            {info ? (
              <div className="animate-pop">
                <ul className="divide-y">
                  <Row icon={ScanLine} label="Serial">
                    <span className="break-all font-mono">{info.serial}</span>
                  </Row>
                  <Row icon={Tv} label="Modelo">
                    {info.model}
                  </Row>
                  <Row icon={Tag} label="Marca">
                    {info.brand}
                  </Row>
                  <Row icon={Package} label="Pallet">
                    {info.pallet ? (
                      <span className="font-mono">{info.pallet.id}</span>
                    ) : (
                      <Badge>No encontrado</Badge>
                    )}
                  </Row>
                  <Row icon={Sparkles} label="Producción">
                    {info.production ? (
                      <span>
                        <Badge tone="amber" dot>
                          Ya producido
                        </Badge>
                        <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">
                          {info.production.source === 'salida'
                            ? `Salida ${info.production.pallet_id}`
                            : `Línea ${info.production.line}`}{' '}
                          · {fmtDateTime(info.production.at)}
                        </span>
                      </span>
                    ) : (
                      <Badge tone="green">No producido</Badge>
                    )}
                  </Row>
                </ul>
                {previous.length > 0 && (
                  <div className="mt-2 rounded-xl bg-amber-50/70 px-3 py-2.5 dark:bg-amber-500/5">
                    <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" /> {previous.length} rechazo
                      {previous.length > 1 ? 's' : ''} anterior
                      {previous.length > 1 ? 'es' : ''}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {previous.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                          <span className="text-muted-foreground">{fmtDateTime(p.registered_at)}</span>
                          {defectList(p.defects).map((d) => (
                            <Badge key={d} tone="red">
                              {d}
                            </Badge>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center">
                <Box className="h-9 w-9 text-muted-foreground/60" />
                <p className="mt-3 text-[14px] font-semibold">Escanea un serial para ver la información</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Modelo, marca, pallet y detalles de producción.
                </p>
              </div>
            )}
          </Box3>
        </div>

        {/* 2. Defectos */}
        <Box3
          title="Defectos"
          icon={ClipboardList}
          subtitle={info ? 'Selecciona uno o varios' : 'Primero escanea un serial'}
          className={cn(!info && 'opacity-70')}
        >
          {!loaded ? (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando catálogo…
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 min-[1800px]:grid-cols-4">
              {catalog.map((d) => {
                const on = picked.includes(d.key)
                const Icon = d.icon
                return (
                  <button
                    key={d.key}
                    type="button"
                    disabled={!info}
                    onClick={() => toggle(d.key)}
                    aria-pressed={on}
                    className={cn(
                      'flex min-h-[56px] min-w-0 items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-[13.5px] font-semibold leading-tight transition [overflow-wrap:anywhere] active:scale-[.98] disabled:cursor-not-allowed',
                      on
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-sm dark:border-red-400 dark:bg-red-500/15 dark:text-red-200'
                        : 'border-input bg-card hover:border-red-300 hover:bg-muted/60',
                    )}
                  >
                    {on ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                    ) : (
                      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <span>{d.label}</span>
                  </button>
                )
              })}
            </div>
          )}
          {picked.includes(OTHER) && (
            <label className="mt-3 block">
              <span className="text-[13px] font-semibold">Describe el otro defecto</span>
              <input
                value={other}
                onChange={(e) => setOther(e.target.value)}
                maxLength={80}
                placeholder="Ej. Bisel rayado"
                className={cn('field mt-1 h-11', otherMissing && 'border-red-400')}
              />
              {otherMissing && (
                <span className="mt-1 block text-[12px] text-red-600 dark:text-red-400">
                  Escribe cuál es el otro defecto.
                </span>
              )}
            </label>
          )}
          <label className="mt-4 block">
            <span className="text-[13px] font-semibold">Comentarios (opcional)</span>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              disabled={!info}
              maxLength={MAX_COMMENTS}
              rows={3}
              className="field mt-1 h-auto resize-y py-2.5"
              placeholder="Detalles para el reporte (opcional)…"
            />
            <span className="mt-0.5 block text-right text-[11.5px] text-muted-foreground">
              {comments.length}/{MAX_COMMENTS}
            </span>
          </label>
        </Box3>

        {/* 3. Resumen */}
        <Box3
          title="Resumen del rechazo"
          subtitle="Completa los pasos para registrar"
          className="lg:col-span-2 xl:col-span-1"
        >
          <ul className="divide-y">
            <Row icon={ScanLine} label="Serial">
              {info && <span className="break-all font-mono">{info.serial}</span>}
            </Row>
            <Row icon={Tv} label="Modelo">
              {info?.model}
            </Row>
            <Row icon={Tag} label="Marca">
              {info?.brand}
            </Row>
            <Row icon={Package} label="Pallet">
              {info?.pallet?.id && <span className="font-mono">{info.pallet.id}</span>}
            </Row>
            <Row icon={AlertTriangle} label="Defectos">
              {finalDefects.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {finalDefects.map((d) => (
                    <Badge key={d} tone="red">
                      {d}
                    </Badge>
                  ))}
                </span>
              )}
            </Row>
            <Row icon={MessageSquare} label="Comentarios">
              {comments.trim() && <span className="break-words font-normal italic">“{comments.trim()}”</span>}
            </Row>
          </ul>
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> No se guardó: {error.message}
            </div>
          )}
          <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={submit}
              disabled={!ready || saving}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-500 text-[16px] font-bold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300 dark:disabled:bg-red-500/30"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {saving
                ? 'Registrando…'
                : `Registrar rechazo${finalDefects.length > 1 ? ` (${finalDefects.length})` : ''}`}
            </button>
          </div>
        </Box3>
      </div>

      <Dialog
        open={help}
        onClose={() => setHelp(false)}
        title="¿Cómo registrar un rechazo?"
        footer={<Button onClick={() => setHelp(false)}>Entendido</Button>}
      >
        <ol className="list-decimal space-y-2 pl-5 text-[14px]">
          <li>
            <b>Escanea el serial</b> de la TV con la pistola (o escríbelo y presiona Enter). Debe empezar con
            EL o J0.
          </li>
          <li>
            Revisa la información: modelo, marca, pallet y si ya se produjo. Si ya tiene rechazos anteriores,
            aparecen en amarillo.
          </li>
          <li>
            <b>Marca uno o varios defectos.</b> Si eliges <b>Otro</b>, escribe cuál es.
          </li>
          <li>Agrega un comentario si hace falta (opcional).</li>
          <li>
            Revisa el resumen y presiona <b>Registrar rechazo</b>. El campo queda listo para el siguiente
            serial.
          </li>
        </ol>
      </Dialog>
    </div>
  )
}
