import { Box, CheckCircle2, History, Monitor, RotateCcw, Settings2, Target, XCircle } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { shiftOf } from '@shared/shift.js'
import { Scanner } from '@/components/Scanner'
import { Badge, Button, Card, CardHeader, Dialog, Empty, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi, useStored } from '@/lib/hooks'
import { useCatalogs, useSession } from '@/lib/session'
import { canDo, cn, feedback, fmtDateTime, fmtInt, fmtShift, fmtTime } from '@/lib/utils'
import { BackLink, CountVsGoal } from './common'

const norm = (v) => String(v || '').replace(/\s+/g, '').toUpperCase()
const EMPTY_STATION = { line: '', model: '', brand: '' }

export default function Registro() {
  const { user } = useSession()
  const cat = useCatalogs()
  const [stored, setStored] = useStored('vp:station', EMPTY_STATION)
  const [editing, setEditing] = useState(false)

  // Solo vale lo que siga activo en catalogos.
  const station = {
    line: cat.lines.some((l) => l.name === stored?.line) ? stored.line : '',
    model: cat.models.some((m) => m.code === stored?.model) ? stored.model : '',
    brand: cat.brands.some((b) => b.code === stored?.brand) ? stored.brand : '',
  }
  const ready = Boolean(station.line && station.model && station.brand)
  const model = cat.models.find((m) => m.code === station.model)
  const lineInfo = cat.lines.find((l) => l.name === station.line)

  const allowed = canDo(user, ['supervisor', 'operador'])

  if (!cat.loaded) return <Spinner />

  return (
    <div>
      <PageHeader back={<BackLink to="/produccion">Producción</BackLink>} title="Registrar producto terminado" subtitle="Serial de la TV = serial de la caja" />

      {!allowed ? (
        <Card>
          <Empty icon={XCircle} title="Sin permiso para registrar">
            Solo operadores y supervisores pueden registrar producto terminado.
          </Empty>
        </Card>
      ) : !ready ? (
        <Card>
          <CardHeader icon={Settings2} title="Configura la estación" subtitle="Elige línea, modelo y marca antes de escanear. Se guarda en este equipo." />
          <div className="p-4 sm:p-5">
            <StationForm initial={station} catalogs={cat} onSave={(s) => setStored(s)} />
          </div>
        </Card>
      ) : (
        <>
          <StationBar station={station} onChange={() => setEditing(true)} />
          <ScanStation station={station} prefix={model?.prefix} defaultGoal={lineInfo?.goal} />
        </>
      )}

      <Dialog open={editing} onClose={() => setEditing(false)} title="Cambiar estación" wide>
        <StationForm
          initial={station}
          catalogs={cat}
          onSave={(s) => {
            setStored(s)
            setEditing(false)
          }}
        />
      </Dialog>
    </div>
  )
}

function StationBar({ station, onChange }) {
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <Settings2 className="hidden h-5 w-5 text-muted-foreground sm:block" />
      <Pair label="Línea" value={station.line} />
      <Pair label="Modelo" value={station.model} />
      <Pair label="Marca" value={station.brand} />
      <Button variant="outline" size="sm" className="ml-auto" onClick={onChange}>
        Cambiar
      </Button>
    </div>
  )
}

const Pair = ({ label, value }) => (
  <span className="min-w-0">
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="block truncate text-[15px] font-extrabold">{value}</span>
  </span>
)

function Chips({ label, options, value, onChange }) {
  return (
    <div>
      <span className="label">{label}</span>
      {options.length ? (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                'min-h-12 min-w-[4.5rem] rounded-xl border-2 px-4 py-2 text-[15px] font-bold transition active:scale-[.98]',
                value === o.value
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-input bg-card hover:border-primary/40 hover:bg-muted',
              )}
            >
              {o.label}
              {o.hint && <span className={cn('block text-[11px] font-semibold', value === o.value ? 'opacity-80' : 'text-muted-foreground')}>{o.hint}</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">No hay opciones activas en el catálogo.</p>
      )}
    </div>
  )
}

function StationForm({ initial, catalogs, onSave }) {
  const [s, setS] = useState(initial)
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }))
  const ok = s.line && s.model && s.brand
  return (
    <div className="space-y-5">
      <Chips label="Línea" value={s.line} onChange={set('line')} options={catalogs.lines.map((l) => ({ value: l.name, label: l.name, hint: `Meta ${fmtInt(l.goal)}` }))} />
      <Chips label="Modelo" value={s.model} onChange={set('model')} options={catalogs.models.map((m) => ({ value: m.code, label: m.code, hint: `Serial inicia ${m.prefix}` }))} />
      <Chips label="Marca" value={s.brand} onChange={set('brand')} options={catalogs.brands.map((b) => ({ value: b.code, label: b.code }))} />
      <Button size="lg" className="w-full" disabled={!ok} onClick={() => onSave(s)}>
        Guardar estación
      </Button>
    </div>
  )
}

function ScanStation({ station, prefix, defaultGoal }) {
  const [step, setStep] = useState('tv') // tv | box
  const [tv, setTv] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { tone, title, detail, count, goal, at }
  const scanRef = useRef(null)

  const { shiftDate, shift } = shiftOf()
  const live = useApi('/production/live', { query: { shiftDate, shift }, refreshMs: 30000 })
  const recent = useApi('/production', { query: { line: station.line, shiftDate, shift, limit: 20 }, refreshMs: 60000 })
  const lineLive = live.data?.lines.find((l) => l.line === station.line)
  const count = lineLive?.count ?? null
  const goal = lineLive?.goal ?? defaultGoal

  const fail = useCallback((title, detail, tone = 'error') => {
    feedback(false)
    setResult({ tone, title, detail, at: Date.now() })
  }, [])

  const reset = () => {
    setStep('tv')
    setTv('')
    setResult(null)
    scanRef.current?.focus()
  }

  const onScan = async (raw) => {
    const v = norm(raw)
    if (step === 'tv') {
      if (prefix && !v.startsWith(prefix)) {
        fail('Serial de TV inválido', `El serial debe empezar con ${prefix} (modelo ${station.model}). Leído: ${v}`)
        return
      }
      setTv(v)
      setStep('box')
      setResult(null)
      feedback(true)
      return
    }
    if (v !== tv) {
      fail('Los seriales no coinciden', `TV ${tv} · Caja ${v}. Escanea la caja correcta o reinicia.`)
      return
    }
    setBusy(true)
    try {
      const d = await api('/production', { method: 'POST', body: { serialTv: tv, serialBox: v, ...station } })
      feedback(true)
      setResult({ tone: 'ok', title: 'Registrado', detail: tv, count: d.lineCount, goal: d.goal, at: Date.now() })
      live.reload(true)
      recent.reload(true)
    } catch (e) {
      const b = e.body || {}
      if (b.duplicate) {
        const p = b.previous || {}
        fail('Serial ya registrado', `${tv} · ${p.registered_by_name || 'Desconocido'} · ${fmtDateTime(p.registered_at)} · Línea ${p.line || '—'}`, 'warn')
      } else if (b.rejected) fail('Rechazado por Calidad', `${tv} tiene un rechazo registrado. No se puede registrar.`)
      else fail(e.message || 'No se pudo registrar', tv)
    } finally {
      setBusy(false)
      setStep('tv')
      setTv('')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <Stepper step={step} tv={tv} />
          <Scanner
            ref={scanRef}
            onScan={onScan}
            busy={busy}
            status={result?.tone === 'ok' ? 'ok' : result && result.tone !== 'ok' ? 'error' : undefined}
            label={step === 'tv' ? 'Paso 1 · Escanea el serial de la TV' : 'Paso 2 · Escanea el serial de la CAJA'}
            placeholder={step === 'tv' ? `Serial de TV (${prefix || ''}…)` : 'Serial de la caja'}
            className="mt-4"
          />
          {step === 'box' && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="h-4 w-4" /> Reiniciar
              </Button>
            </div>
          )}
          <ResultPanel result={result} />
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Línea {station.line} · {fmtShift(shiftDate, shift)}
            </span>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <CountVsGoal count={count} goal={goal} pct={goal && count !== null ? count / goal : null} />
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader icon={History} title="Últimos registros" subtitle={`Línea ${station.line} · este turno`} />
        {recent.loading && !recent.data ? (
          <Spinner className="py-10" />
        ) : recent.error ? (
          <ErrorBox error={recent.error} className="m-4" />
        ) : recent.data?.records.length ? (
          <ul className="max-h-[480px] divide-y overflow-y-auto">
            {recent.data.records.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[13.5px] font-semibold">{r.serial}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {r.model} · {r.brand} · {r.registered_by_name || '—'}
                  </span>
                </span>
                <span className="tabular shrink-0 text-[12.5px] font-semibold text-muted-foreground">{fmtTime(r.registered_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={Box} title="Sin registros en este turno" />
        )}
      </Card>
    </div>
  )
}

function Stepper({ step, tv }) {
  const items = [
    { key: 'tv', n: 1, icon: Monitor, title: 'Serial TV', value: tv },
    { key: 'box', n: 2, icon: Box, title: 'Serial caja' },
  ]
  return (
    <ol className="grid grid-cols-2 gap-2">
      {items.map((it) => {
        const current = step === it.key
        const done = it.key === 'tv' && step === 'box'
        return (
          <li
            key={it.key}
            className={cn(
              'flex min-w-0 items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 transition',
              current && 'border-primary bg-accent',
              done && 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10',
              !current && !done && 'border-transparent bg-muted/60 opacity-70',
            )}
          >
            <span
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-extrabold',
                current ? 'bg-primary text-primary-foreground' : done ? 'bg-emerald-600 text-white' : 'bg-card text-muted-foreground',
              )}
            >
              {done ? <CheckCircle2 className="h-5 w-5" /> : it.n}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[13.5px] font-bold">
                <it.icon className="h-4 w-4 shrink-0" /> {it.title}
              </span>
              <span className="block truncate font-mono text-[12px] text-muted-foreground">
                {done ? it.value : current ? 'Esperando escaneo…' : 'Pendiente'}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ResultPanel({ result }) {
  if (!result) return null
  if (result.tone === 'ok') {
    const pct = result.goal ? result.count / result.goal : null
    return (
      <div key={result.at} className="animate-pop mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-10 w-10 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0">
            <p className="text-[20px] font-extrabold leading-tight">{result.title}</p>
            <p className="truncate font-mono text-[14px] font-semibold opacity-90">{result.detail}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="tabular text-[26px] font-extrabold leading-none">{fmtInt(result.count)}</p>
            <p className="text-[12px] font-semibold opacity-80">de {fmtInt(result.goal)}</p>
          </div>
        </div>
        {pct !== null && pct >= 1 && (
          <Badge tone="green" className="mt-3">
            ¡Meta alcanzada!
          </Badge>
        )}
      </div>
    )
  }
  const warn = result.tone === 'warn'
  return (
    <div
      key={result.at}
      className={cn(
        'animate-pop mt-4 flex items-start gap-3 rounded-2xl border p-4',
        warn
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
          : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100',
      )}
    >
      <XCircle className={cn('h-8 w-8 shrink-0', warn ? 'text-amber-600' : 'text-red-600')} />
      <div className="min-w-0">
        <p className="text-[17px] font-extrabold leading-tight">{result.title}</p>
        {result.detail && <p className="mt-1 break-words text-[13.5px] opacity-90">{result.detail}</p>}
      </div>
    </div>
  )
}
