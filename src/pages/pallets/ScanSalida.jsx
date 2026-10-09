import {
  AlertTriangle,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  ListTodo,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Scanner, ScanResult } from '@/components/Scanner'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Empty,
  ErrorBox,
  PageHeader,
  Progress,
  Segmented,
  Spinner,
} from '@/components/ui'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { cn, feedback, fmtInt } from '@/lib/utils'
import { PendingPallets } from './PendingPallets'
import { RemoveItemDialog, ScannedList } from './ScannedList'
import {
  BackLink,
  ChipGroup,
  ElsewhereNote,
  MISSING_REASONS,
  normPallet,
  PALLET_ID,
  ReconSummary,
  SearchBox,
  StatusBadge,
  useScanFeedback,
  useSerialQueue,
  StartOverLink,
} from './shared'

const entradaOf = (raw) =>
  String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/-S$/, '')

export default function ScanSalida() {
  const { user } = useSession()
  const [params, setParams] = useSearchParams()
  const urlId = params.get('id') ? entradaOf(params.get('id')) : null
  const [stage, setStage] = useState(urlId ? 'loading' : 'id') // id | loading | scan | reconcile | done
  const [pallet, setPallet] = useState(null)
  const [items, setItems] = useState([])
  const [rec, setRec] = useState(null)
  const [idError, setIdError] = useState(null)
  const [final, setFinal] = useState(null)
  const fb = useScanFeedback()
  const { enqueue, pending } = useSerialQueue()
  const [removing, setRemoving] = useState(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [tab, setTab] = useState('pendientes')
  const [showPending, setShowPending] = useState(false)
  const [elsewhere, setElsewhere] = useState({}) // faltante -> otros pallets donde esta
  // Tele repetida (tambien en otro pallet de entrada): un supervisor la quita de esta entrada.
  const canFix = user?.role === 'admin' || user?.role === 'supervisor'
  const removeDup = async (c) => {
    try {
      const r = await api(`/pallets/${pallet.linkedPalletId}/remove-duplicate`, {
        method: 'POST',
        body: { code: c },
      })
      await loadDetail(pallet.id)
      fb.show(
        'ok',
        `${c} quitada de ${pallet.linkedPalletId}`,
        `Va en el pallet ${r.belongsTo}. Ahora la entrada tiene ${fmtInt(r.count)} piezas.`,
      )
    } catch (e) {
      fb.show('error', 'No se pudo quitar', e.message)
    }
  }

  const loadDetail = async (salidaId) => {
    const d = await api(`/pallets/${salidaId}`)
    setPallet(normPallet(d.pallet))
    setItems(d.items || [])
    setRec(d.reconciliation)
    setElsewhere(d.missingElsewhere || {})
  }

  const openSalida = async (raw) => {
    const entradaId = entradaOf(raw)
    setIdError(null)
    if (!PALLET_ID.test(entradaId)) {
      setStage('id')
      setIdError({ title: 'ID inválido', detail: 'Escanea el ID del pallet de entrada (6 dígitos).' })
      return
    }
    setStage('loading')
    try {
      const r = await api('/pallets/salida', { method: 'POST', body: { entradaId } })
      await loadDetail(r.pallet.id)
      fb.reset()
      setTab('pendientes')
      setStage('scan')
      if (urlId !== entradaId) setParams({ id: entradaId }, { replace: true })
    } catch (e) {
      setStage('id')
      setIdError({ title: 'No se puede iniciar la salida', detail: e.message, id: e.body?.pallet?.id })
    }
  }

  useEffect(() => {
    if (idError) feedback(false)
  }, [idError])

  // Retomar desde la URL (?id=123456).
  useEffect(() => {
    if (urlId && urlId !== pallet?.linkedPalletId) openSalida(urlId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlId])

  const startOver = () => {
    setPallet(null)
    setItems([])
    setRec(null)
    setFinal(null)
    setIdError(null)
    fb.reset()
    setStage('id')
    setParams({}, { replace: true })
  }

  const scanItem = (code) =>
    enqueue(async () => {
      try {
        const r = await api(`/pallets/${pallet.id}/items`, { method: 'POST', body: { code } })
        setItems((list) => [
          { code: r.code, scanned_at: new Date().toISOString(), scanned_by_name: user?.name },
          ...list.filter((x) => x.code !== r.code),
        ])
        setRec((x) =>
          r.extra
            ? { ...x, extras: [...x.extras, r.code] }
            : { ...x, confirmed: [...x.confirmed, r.code], missing: x.missing.filter((c) => c !== r.code) },
        )
        if (r.extra)
          fb.show('warn', `${r.code}: pieza extra`, `No estaba en la entrada ${pallet.linkedPalletId}.`)
        else fb.show('ok', r.code, 'Confirmada')
      } catch (e) {
        fb.show(
          'error',
          e.body?.duplicate
            ? 'Pieza duplicada'
            : e.body?.notInEntrada
              ? 'No es de este pallet'
              : 'No se registró',
          e.message,
        )
      }
    })

  const confirmRemove = async () => {
    setRemoveBusy(true)
    try {
      await api(`/pallets/${pallet.id}/items/${encodeURIComponent(removing)}`, { method: 'DELETE' })
      await loadDetail(pallet.id)
      fb.show('warn', 'Pieza quitada', removing)
    } catch (e) {
      fb.show('error', 'No se pudo quitar', e.message)
    } finally {
      setRemoving(null)
      setRemoveBusy(false)
    }
  }

  const extrasSet = useMemo(() => new Set(rec?.extras || []), [rec])
  const confirmed = rec?.confirmed.length || 0
  const expected = rec?.expected || 0
  const complete = expected > 0 && confirmed === expected

  return (
    <div>
      <PageHeader
        back={stage === 'id' || stage === 'loading' ? <BackLink /> : <StartOverLink onClick={startOver} label="Inicio de salida" />}
        title="Salida de pallet"
        subtitle={
          stage === 'scan'
            ? 'Escanea cada pieza que sale'
            : stage === 'reconcile'
              ? 'Conciliación de faltantes y extras'
              : 'Confirmar pallet despachado'
        }
      />

      {stage === 'loading' && <Spinner />}

      {stage === 'id' && (
        <Card className="mx-auto max-w-xl p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
              <ArrowUpFromLine className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[16px] font-bold">Escanea el ID del pallet de entrada</p>
              <p className="text-[13px] text-muted-foreground">El pallet de entrada debe estar cerrado.</p>
            </div>
          </div>
          <Scanner
            onScan={openSalida}
            placeholder="ID del pallet de entrada"
            status={idError ? 'error' : null}
          />
          {idError && (
            <ScanResult
              result={{ tone: 'error', title: idError.title, detail: idError.detail, at: idError.detail }}
            />
          )}
          {idError?.id && (
            <Link
              to={`/pallets/${idError.id}`}
              className="mt-3 inline-flex h-11 items-center rounded-xl border border-input bg-card px-4 text-[14.5px] font-semibold hover:bg-muted"
            >
              Ver detalle de {idError.id}
            </Link>
          )}
        </Card>
      )}
      {stage === 'id' && <PendingPallets area="salida" />}

      {stage === 'scan' && pallet && rec && (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <Card className="p-4 sm:p-5 lg:sticky lg:top-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[22px] font-extrabold tracking-tight">{pallet.id}</span>
                  <StatusBadge status={pallet.status} />
                </div>
                <p className="mt-0.5 text-[13.5px] text-muted-foreground">
                  Entrada <span className="font-mono font-semibold">{pallet.linkedPalletId}</span> ·{' '}
                  {pallet.model} · {pallet.brand}
                  {pallet.line && <b className="text-foreground"> · {pallet.line}</b>}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={startOver}>
                <RotateCcw className="h-4 w-4" /> Cambiar pallet
              </Button>
            </div>

            <div className="my-5 rounded-2xl bg-muted/50 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Confirmados
                  </div>
                  <div className="mt-1 flex items-end gap-1.5">
                    <span
                      className={cn(
                        'tabular text-[52px] font-extrabold leading-none tracking-tight',
                        complete && 'text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      {fmtInt(confirmed)}
                    </span>
                    <span className="tabular pb-1.5 text-[18px] font-bold text-muted-foreground">
                      / {fmtInt(expected)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-right text-[13px]">
                  <div>
                    <span className="tabular font-bold">{fmtInt(rec.missing.length)}</span>{' '}
                    <span className="text-muted-foreground">pendientes</span>
                  </div>
                  {rec.extras.length > 0 && (
                    <div className="text-amber-700 dark:text-amber-300">
                      <span className="tabular font-bold">{fmtInt(rec.extras.length)}</span> extras
                    </div>
                  )}
                </div>
              </div>
              <Progress
                value={expected ? confirmed / expected : 0}
                tone={complete ? 'green' : 'primary'}
                className="mt-3"
              />
            </div>

            <Scanner onScan={scanItem} status={fb.status} placeholder="Escanea el serial de la pieza" />
            <ScanResult result={fb.result} />
            {pending > 1 && (
              <p className="mt-2 text-center text-[12.5px] text-muted-foreground">
                Procesando {pending} lecturas…
              </p>
            )}

            {/* Piezas que faltan por salir de esta entrada: se abren y se buscan. */}
            <button
              type="button"
              onClick={() => setShowPending(true)}
              className={cn(
                'mt-4 flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition',
                rec.missing.length
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
              )}
            >
              <span className="flex items-center gap-2 text-[15px] font-bold">
                <ListTodo className="h-5 w-5" /> Piezas pendientes
              </span>
              <span className="tabular text-[20px] font-extrabold">{fmtInt(rec.missing.length)}</span>
            </button>

            <Button
              variant={complete ? 'success' : 'primary'}
              size="lg"
              className="mt-5 w-full"
              onClick={() => setStage('reconcile')}
            >
              <ClipboardCheck className="h-5 w-5" /> Conciliar y cerrar
            </Button>
          </Card>

          <div className="space-y-3">
            <Segmented
              value={tab}
              onChange={setTab}
              className="w-full sm:w-auto"
              options={[
                { value: 'pendientes', label: `Pendientes (${fmtInt(rec.missing.length)})` },
                { value: 'escaneadas', label: `Escaneadas (${fmtInt(items.length)})` },
              ]}
            />
            {tab === 'pendientes' ? (
              <PendingList
                codes={rec.missing}
                elsewhere={elsewhere}
                onRemoveDup={canFix ? removeDup : null}
                entradaId={pallet.linkedPalletId}
              />
            ) : (
              <ScannedList
                items={items}
                extras={extrasSet}
                onRemove={setRemoving}
                highlight={items[0]?.code}
              />
            )}
          </div>
        </div>
      )}

      {stage === 'reconcile' && pallet && rec && (
        <ReconcilePanel
          pallet={pallet}
          rec={rec}
          elsewhere={elsewhere}
          onBack={() => setStage('scan')}
          onDone={(out) => {
            setFinal(out)
            setPallet(normPallet(out.pallet))
            setStage('done')
            setParams({}, { replace: true })
          }}
        />
      )}

      {stage === 'done' && final && (
        <Card className="mx-auto max-w-2xl p-6 sm:p-8">
          <div className="text-center">
            {final.reconciliation.missing.length ? (
              <AlertTriangle className="mx-auto h-16 w-16 text-amber-500" />
            ) : (
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            )}
            <h2 className="mt-3 text-[22px] font-extrabold tracking-tight">Salida {pallet.id} cerrada</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {final.reconciliation.missing.length
                ? `Se registraron ${final.reconciliation.missing.length} faltante(s) con motivo.`
                : 'Todas las piezas de la entrada salieron completas.'}
            </p>
          </div>
          <ReconSummary rec={final.reconciliation} className="mt-6" />
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button size="lg" onClick={startOver}>
              <Plus className="h-5 w-5" /> Nueva salida
            </Button>
            <Link
              to={`/pallets/${pallet.id}`}
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-input bg-card px-5 text-[16px] font-semibold hover:bg-muted"
            >
              Ver detalle
            </Link>
          </div>
        </Card>
      )}

      <Dialog
        open={showPending}
        onClose={() => setShowPending(false)}
        title={`Piezas pendientes · ${pallet?.linkedPalletId || ''}`}
        wide
      >
        {rec && (
          <PendingList
            codes={rec.missing}
            elsewhere={elsewhere}
            onRemoveDup={canFix ? removeDup : null}
            entradaId={pallet?.linkedPalletId}
            bare
          />
        )}
      </Dialog>

      <RemoveItemDialog
        code={removing}
        palletId={pallet?.id}
        busy={removeBusy}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  )
}

// Piezas de la entrada que aun no se escanean en la salida.
function PendingList({ codes, bare, elsewhere = {}, onRemoveDup, entradaId }) {
  const [q, setQ] = useState('')
  const t = q.trim().toUpperCase()
  const shown = useMemo(() => (t ? codes.filter((c) => c.includes(t)) : codes), [codes, t])
  return (
    <Card className={cn('overflow-hidden', bare && 'border-0 shadow-none')}>
      {!bare && (
        <CardHeader
          icon={ListTodo}
          title="Pendientes por escanear"
          subtitle={`${fmtInt(codes.length)} de la entrada`}
        />
      )}
      {codes.length > 0 && (
        <div className="border-b p-3 sm:px-5">
          <SearchBox value={q} onChange={setQ} />
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {t
              ? `${fmtInt(shown.length)} de ${fmtInt(codes.length)} pendientes`
              : `${fmtInt(codes.length)} piezas de la entrada aún no salen`}
          </p>
        </div>
      )}
      {!codes.length ? (
        <Empty icon={CheckCircle2} title="¡Completo!">
          Todas las piezas de la entrada ya se confirmaron.
        </Empty>
      ) : (
        <ul className="grid max-h-[60dvh] grid-cols-1 gap-px overflow-y-auto bg-border sm:grid-cols-2 lg:max-h-[calc(100dvh-260px)]">
          {shown.map((c) => (
            <li key={c} className="bg-card px-4 py-2.5 sm:px-5">
              <span className="block truncate font-mono text-[14px] font-semibold">{c}</span>
              <ElsewhereNote where={elsewhere[c]} />
              {onRemoveDup && elsewhere[c]?.some((w) => w.type === 'entrada') && (
                <button
                  type="button"
                  onClick={() => onRemoveDup(c)}
                  className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-[13px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  Quitar de la entrada {entradaId} (no va en este pallet)
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// Conciliacion: cada faltante necesita motivo antes de cerrar.
function ReconcilePanel({ pallet, rec, elsewhere = {}, onBack, onDone }) {
  const [reasons, setReasons] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [lacking, setLacking] = useState(new Set())
  const set = (code, reason) => {
    setReasons((r) => ({ ...r, [code]: reason }))
    setLacking((s) => {
      if (!s.has(code)) return s
      const n = new Set(s)
      n.delete(code)
      return n
    })
  }
  const applyAll = (reason) => {
    setReasons(Object.fromEntries(rec.missing.map((c) => [c, reason])))
    setLacking(new Set())
  }
  const done = rec.missing.filter((c) => reasons[c]?.trim()).length

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const out = await api(`/pallets/${pallet.id}/reconcile`, { method: 'POST', body: { reasons } })
      onDone(out)
    } catch (e) {
      setError(e)
      if (e.body?.lacking) setLacking(new Set(e.body.lacking))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[20px] font-extrabold tracking-tight">{pallet.id}</span>
          <span className="text-[13.5px] text-muted-foreground">
            Entrada {pallet.linkedPalletId} · {pallet.model} · {pallet.brand}
          </span>
        </div>
        <ReconSummary rec={rec} className="mt-4" />
      </Card>

      {rec.missing.length > 0 ? (
        <Card className="overflow-hidden">
          <CardHeader
            icon={AlertTriangle}
            title={`Faltantes (${fmtInt(rec.missing.length)})`}
            subtitle={`Indica el motivo de cada pieza · ${done} de ${rec.missing.length} listos`}
          />
          {rec.missing.length > 1 && (
            <div className="border-b bg-muted/40 px-4 py-3 sm:px-5">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Aplicar a todos
              </p>
              <ChipGroup size="sm" options={MISSING_REASONS} value={null} onChange={applyAll} />
            </div>
          )}
          <ul className="divide-y">
            {rec.missing.map((c) => (
              <li
                key={c}
                className={cn('px-4 py-3.5 sm:px-5', lacking.has(c) && 'bg-red-50 dark:bg-red-500/10')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[15px] font-bold">{c}</span>
                  {reasons[c]?.trim() ? (
                    <Badge tone="green">Listo</Badge>
                  ) : (
                    <Badge tone="red">Sin motivo</Badge>
                  )}
                </div>
                <ElsewhereNote where={elsewhere[c]} className="mb-1" />
                <ChipGroup
                  size="sm"
                  className="mt-2"
                  options={MISSING_REASONS}
                  value={reasons[c]}
                  onChange={(v) => set(c, v)}
                />
                <input
                  value={reasons[c] || ''}
                  onChange={(e) => set(c, e.target.value)}
                  placeholder="Otro motivo…"
                  maxLength={200}
                  className="field mt-2 h-10 text-[14px]"
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" />
            <p className="text-[14.5px] font-semibold">
              Sin faltantes: todas las piezas de la entrada fueron confirmadas.
            </p>
          </div>
        </Card>
      )}

      {rec.extras.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader
            title={`Extras (${fmtInt(rec.extras.length)})`}
            subtitle="Escaneadas en la salida pero no estaban en la entrada"
          />
          <ul className="grid gap-px bg-border sm:grid-cols-2">
            {rec.extras.map((c) => (
              <li
                key={c}
                className="truncate bg-card px-4 py-2.5 font-mono text-[14px] font-semibold text-amber-800 dark:text-amber-300 sm:px-5"
              >
                {c}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ErrorBox error={error} />

      <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
        <Button variant="outline" size="lg" onClick={onBack} disabled={busy}>
          <ChevronLeft className="h-5 w-5" /> Seguir escaneando
        </Button>
        <Button
          variant="success"
          size="lg"
          loading={busy}
          onClick={submit}
          disabled={done < rec.missing.length}
        >
          <ClipboardCheck className="h-5 w-5" /> Confirmar y cerrar salida
        </Button>
      </div>
    </div>
  )
}
