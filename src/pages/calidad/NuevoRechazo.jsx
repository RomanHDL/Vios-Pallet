import { AlertTriangle, CheckCircle2, ClipboardX, Factory, Package, RotateCcw, Send, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { Scanner } from '@/components/Scanner'
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, Field, Input, PageHeader, Spinner, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useCatalogs, useSession } from '@/lib/session'
import { canDo, cn, feedback, fmtDateTime } from '@/lib/utils'
import { BackLink, defectList } from '../produccion/common'

const VALID = /^(EL|J0)/
const OTHER = '__otro__'

export default function NuevoRechazo() {
  const { user } = useSession()
  const { defects, loaded } = useCatalogs()
  const toast = useToast()
  const scanRef = useRef(null)

  const [info, setInfo] = useState(null) // respuesta de /rejections/lookup
  const [looking, setLooking] = useState(false)
  const [lookError, setLookError] = useState(null)
  const [picked, setPicked] = useState([])
  const [other, setOther] = useState('')
  const [comments, setComments] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

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
  const finalDefects = [...picked.filter((x) => x !== OTHER), ...(picked.includes(OTHER) && other.trim() ? [other.trim()] : [])]

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await api('/rejections', { method: 'POST', body: { serial: info.serial, defects: finalDefects, comments: comments.trim() } })
      feedback(true)
      toast(`Rechazo registrado · ${info.serial}`)
      reset()
    } catch (e) {
      feedback(false)
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  if (!canDo(user, ['calidad', 'supervisor'])) {
    return (
      <div>
        <PageHeader back={<BackLink to="/calidad">Calidad</BackLink>} title="Nuevo rechazo" />
        <Card>
          <Empty icon={XCircle} title="Sin permiso">
            Solo Calidad y supervisores pueden registrar rechazos.
          </Empty>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader back={<BackLink to="/calidad">Calidad</BackLink>} title="Nuevo rechazo" subtitle="Escanea el serial y marca los defectos" />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <Scanner
              ref={scanRef}
              onScan={onScan}
              busy={looking}
              status={lookError ? 'error' : info ? 'ok' : undefined}
              label="Serial de la TV"
              placeholder="Serial (EL… / J0…)"
            />
            {looking && <Spinner className="py-6" />}
            {lookError && (
              <div className="animate-pop mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13.5px] font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {lookError}
              </div>
            )}
          </Card>

          {info && <SerialInfo info={info} onReset={reset} />}
        </div>

        <Card className={cn('self-start transition', !info && 'opacity-60')}>
          <CardHeader icon={ClipboardX} title="Defectos" subtitle={info ? 'Selecciona uno o varios' : 'Primero escanea un serial'} />
          <div className="space-y-4 p-4 sm:p-5">
            {!loaded ? (
              <Spinner className="py-6" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {[...defects.map((d) => ({ key: d.name, label: d.name })), { key: OTHER, label: 'Otro' }].map((d) => {
                  const on = picked.includes(d.key)
                  return (
                    <button
                      key={d.key}
                      type="button"
                      disabled={!info}
                      onClick={() => toggle(d.key)}
                      aria-pressed={on}
                      className={cn(
                        'inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-3.5 py-2 text-[14px] font-semibold transition active:scale-[.98] disabled:cursor-not-allowed',
                        on
                          ? 'border-red-600 bg-red-600 text-white shadow-sm'
                          : 'border-input bg-card hover:border-red-400/60 hover:bg-muted',
                      )}
                    >
                      {on && <CheckCircle2 className="h-4 w-4" />}
                      {d.label}
                    </button>
                  )
                })}
              </div>
            )}

            {picked.includes(OTHER) && (
              <Field label="Describe el otro defecto">
                <Input value={other} onChange={(e) => setOther(e.target.value)} maxLength={80} placeholder="Ej. Bisel rayado" autoFocus />
              </Field>
            )}

            <Field label="Comentarios (opcional)">
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                disabled={!info}
                maxLength={500}
                rows={3}
                className="field h-auto resize-y py-2.5"
                placeholder="Detalles para el reporte"
              />
            </Field>

            <ErrorBox error={error} />

            <Button size="lg" variant="danger" className="w-full" disabled={!info || !finalDefects.length} loading={saving} onClick={submit}>
              <Send className="h-5 w-5" /> Registrar rechazo{finalDefects.length > 1 ? ` (${finalDefects.length} defectos)` : ''}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function SerialInfo({ info, onReset }) {
  const previous = info.previous || []
  return (
    <Card className="animate-pop">
      <CardHeader
        title={<span className="break-all font-mono text-[16px]">{info.serial}</span>}
        subtitle={[info.model, info.brand].filter(Boolean).join(' · ') || 'Modelo y marca sin identificar'}
        action={
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4" /> Otro
          </Button>
        }
      />
      <ul className="divide-y text-[13.5px]">
        <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-muted-foreground">Pallet de entrada</span>
          {info.pallet ? <span className="font-mono font-bold">{info.pallet.id}</span> : <Badge>No encontrado</Badge>}
        </li>
        <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <Factory className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-muted-foreground">Producción</span>
          {info.production ? (
            <span className="text-right">
              <Badge tone="amber" dot>
                Ya producido
              </Badge>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                {info.production.source === 'salida' ? `Salida ${info.production.pallet_id}` : `Línea ${info.production.line}`} ·{' '}
                {fmtDateTime(info.production.at)}
              </span>
            </span>
          ) : (
            <Badge tone="green">No producido</Badge>
          )}
        </li>
      </ul>
      {previous.length > 0 && (
        <div className="border-t bg-amber-50/60 px-4 py-3 dark:bg-amber-500/5 sm:px-5">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" /> {previous.length} rechazo{previous.length > 1 ? 's' : ''} anterior{previous.length > 1 ? 'es' : ''}
          </p>
          <ul className="mt-2 space-y-1.5">
            {previous.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
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
    </Card>
  )
}
