import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ListChecks,
  PackagePlus,
  Printer,
  ScanLine,
  Trash2,
  Unlock,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  Empty,
  ErrorBox,
  PageHeader,
  Segmented,
  Spinner,
  Stat,
  useToast,
} from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { canDo, cn, fmtDateTime, fmtInt } from '@/lib/utils'
import { ScannedList } from './ScannedList'
import {
  BackLink,
  canPrintExit,
  ElsewhereNote,
  InfoRow,
  isOpen,
  normPallet,
  ReconSummary,
  resumePath,
  SearchBox,
  StatusBadge,
  TypeBadge,
} from './shared'

const linkBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14.5px] font-semibold transition active:scale-[.98]'

export default function PalletDetail() {
  const { id } = useParams()
  const { user } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, error, loading, reload } = useApi(`/pallets/${encodeURIComponent(id)}`)
  const [dialog, setDialog] = useState(null) // reopen | delete | item-remove | item-move
  const [itemCode, setItemCode] = useState(null)
  const [moveTo, setMoveTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [confirmText, setConfirmText] = useState('')

  if (loading && !data) return <Spinner />
  if (error)
    return (
      <div>
        <PageHeader back={<BackLink />} title={`Pallet ${id}`} />
        <ErrorBox error={error} />
      </div>
    )

  const p = normPallet(data.pallet)
  const items = data.items || []
  const salida = data.salida ? normPallet(data.salida) : null
  const isAdmin = user?.role === 'admin'
  // Reporte impreso = solo de salida cerrada. En una entrada se ofrece el de su salida si ya se cerro.
  const exitForReport = p.type === 'salida' ? p : salida
  const printable = canPrintExit(exitForReport)

  const openDialog = (d) => {
    setActionError(null)
    setConfirmText('')
    setDialog(d)
  }

  const reopen = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await api(`/pallets/${p.id}/reopen`, { method: 'POST' })
      toast(`Pallet ${p.id} reabierto`)
      setDialog(null)
      reload(true)
    } catch (e) {
      setActionError(e)
    } finally {
      setBusy(false)
    }
  }

  // Administrador: quitar o mover una tele de una entrada (si su salida no esta cerrada).
  const canEditItems = isAdmin && p.type === 'entrada' && (!salida || isOpen(salida))
  const openItem = (d, c) => {
    setActionError(null)
    setItemCode(c)
    setMoveTo('')
    setDialog(d)
  }
  const itemAction = async () => {
    setBusy(true)
    setActionError(null)
    try {
      if (dialog === 'item-remove') {
        await api(`/pallets/${p.id}/admin/remove-item`, { method: 'POST', body: { code: itemCode } })
        toast(`${itemCode} quitada del pallet ${p.id}`, 'warn')
      } else {
        const r = await api(`/pallets/${p.id}/admin/move-item`, {
          method: 'POST',
          body: { code: itemCode, to: moveTo.trim() },
        })
        toast(`${itemCode} movida al pallet ${r.to}`)
      }
      setDialog(null)
      reload(true)
    } catch (e) {
      setActionError(e)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await api(`/pallets/${p.id}`, { method: 'DELETE' })
      toast(`Pallet ${p.id} eliminado`, 'warn')
      navigate('/pallets', { replace: true })
    } catch (e) {
      setActionError(e)
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="no-print">
        <PageHeader
          back={<BackLink />}
          title={<span className="font-mono">{p.id}</span>}
          subtitle={
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <TypeBadge type={p.type} />
              <StatusBadge status={p.status} />
              {p.type === 'salida' && p.missingCount > 0 && (
                <Badge tone="red">{p.missingCount} faltantes</Badge>
              )}
              <span>
                {p.model} · {p.brand}
              </span>
            </span>
          }
          actions={
            <>
              {isOpen(p) && (
                <Link
                  to={resumePath(p)}
                  className={cn(linkBtn, 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90')}
                >
                  <ScanLine className="h-[18px] w-[18px]" /> Seguir escaneando
                </Link>
              )}
              {printable ? (
                <Link
                  to={`/pallets/${encodeURIComponent(exitForReport.id)}/reporte`}
                  className={cn(linkBtn, 'border border-input bg-card hover:bg-muted')}
                >
                  <Printer className="h-[18px] w-[18px]" /> Imprimir reporte de salida
                </Link>
              ) : (
                <Button variant="outline" disabled title="Disponible al registrar la salida">
                  <Printer className="h-[18px] w-[18px]" /> Disponible al registrar la salida
                </Button>
              )}
              {!isOpen(p) && canDo(user, ['supervisor']) && (
                <Button variant="outline" onClick={() => openDialog('reopen')}>
                  <Unlock className="h-[18px] w-[18px]" /> Reabrir
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                  onClick={() => openDialog('delete')}
                >
                  <Trash2 className="h-[18px] w-[18px]" /> Eliminar
                </Button>
              )}
            </>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
          <Card>
            <CardHeader title="Datos del pallet" />
            <dl className="divide-y px-4 sm:px-5">
              <InfoRow label="Modelo">{p.model || '—'}</InfoRow>
              <InfoRow label="Marca">{p.brand || '—'}</InfoRow>
              <InfoRow label="Creado por">{p.createdByName || '—'}</InfoRow>
              <InfoRow label="Creado">{fmtDateTime(p.createdAt)}</InfoRow>
              <InfoRow label="Cerrado por">{p.closedByName || '—'}</InfoRow>
              <InfoRow label="Cerrado">{fmtDateTime(p.closedAt)}</InfoRow>
              {p.type === 'salida' && <InfoRow label="Línea">{p.line || 'Sin línea'}</InfoRow>}
              {p.type === 'salida' ? (
                <InfoRow label="Entrada">
                  <Link
                    to={`/pallets/${p.linkedPalletId}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {p.linkedPalletId}
                  </Link>
                </InfoRow>
              ) : (
                <InfoRow label="Salida">
                  {salida ? (
                    <Link
                      to={`/pallets/${salida.id}`}
                      className="inline-flex items-center gap-2 font-mono text-primary hover:underline"
                    >
                      {salida.id} <StatusBadge status={salida.status} />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Sin salida</span>
                  )}
                </InfoRow>
              )}
            </dl>
            {p.type === 'entrada' && !salida && p.status === 'cerrado' && (
              <div className="border-t p-4 sm:px-5">
                <Link
                  to={`/pallets/salida?id=${p.id}`}
                  className={cn(linkBtn, 'w-full border border-input bg-card hover:bg-muted')}
                >
                  <PackagePlus className="h-[18px] w-[18px]" /> Iniciar salida
                </Link>
              </div>
            )}
          </Card>

          {p.type === 'entrada' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Piezas" value={fmtInt(items.length)} icon={ListChecks} tone="blue" />
                <Stat
                  label="Salida"
                  value={salida ? fmtInt(salida.itemCount) : '—'}
                  hint={
                    salida
                      ? isOpen(salida)
                        ? 'En proceso'
                        : `${fmtInt(salida.missingCount)} faltantes`
                      : 'Aún no sale'
                  }
                  tone={salida?.missingCount ? 'red' : 'default'}
                />
              </div>
              {isAdmin && salida && !isOpen(salida) && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Para quitar o mover teles de este pallet, primero reabre su salida {salida.id}.
                </p>
              )}
              <ScannedList
                items={items}
                actions={
                  canEditItems
                    ? (it) => (
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openItem('item-move', it.code)}
                            className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10"
                            aria-label={`Mover ${it.code} a otro pallet`}
                            title="Mover a otro pallet"
                          >
                            <ArrowRightLeft className="h-[18px] w-[18px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openItem('item-remove', it.code)}
                            className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                            aria-label={`Eliminar ${it.code} del pallet`}
                            title="Eliminar del pallet"
                          >
                            <Trash2 className="h-[18px] w-[18px]" />
                          </button>
                        </span>
                      )
                    : undefined
                }
              />
            </div>
          ) : (
            <SalidaReconciliation
              pallet={p}
              rec={data.reconciliation}
              reasons={data.missingReasons}
              elsewhere={data.missingElsewhere || {}}
            />
          )}
        </div>
      </div>

      <Dialog
        open={dialog === 'item-remove' || dialog === 'item-move'}
        onClose={() => !busy && setDialog(null)}
        title={dialog === 'item-move' ? 'Mover tele a otro pallet' : 'Eliminar tele del pallet'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancelar
            </Button>
            {dialog === 'item-move' ? (
              <Button loading={busy} disabled={!/^\d{6}$/.test(moveTo.trim())} onClick={itemAction}>
                <ArrowRightLeft className="h-4 w-4" /> Mover
              </Button>
            ) : (
              <Button variant="danger" loading={busy} onClick={itemAction}>
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3 text-[14px]">
          <p className="rounded-xl bg-muted px-3 py-2 font-mono text-[15px] font-bold">{itemCode}</p>
          {dialog === 'item-move' ? (
            <>
              <label className="block">
                <span className="label">Pallet ID destino (entrada)</span>
                <input
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="6 dígitos"
                  className="field font-mono"
                  autoComplete="off"
                />
              </label>
              <p className="text-[12.5px] text-muted-foreground">
                Sale de {p.id}
                {salida ? ` y de su salida ${salida.id}` : ''} y entra al pallet destino con su fecha de
                escaneo original. Si la salida del destino ya está cerrada, no se puede.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Se quita del pallet {p.id}
              {salida ? ` y de su salida ${salida.id} (las piezas esperadas se recalculan)` : ''}. No se puede
              deshacer, pero se puede volver a escanear.
            </p>
          )}
          <ErrorBox error={actionError} />
        </div>
      </Dialog>

      <Dialog
        open={dialog === 'reopen'}
        onClose={() => setDialog(null)}
        title="Reabrir pallet"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={reopen}>
              <Unlock className="h-4 w-4" /> Reabrir
            </Button>
          </>
        }
      >
        <p className="text-[14.5px]">
          El pallet <span className="font-mono font-bold">{p.id}</span> volverá a quedar abierto para
          escanear.
          {p.type === 'salida' && ' Los motivos de faltantes se capturarán de nuevo al conciliar.'}
        </p>
        <ErrorBox error={actionError} className="mt-3" />
      </Dialog>

      <Dialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Eliminar pallet"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={confirmText.trim().toUpperCase() !== p.id}
              onClick={remove}
            >
              <Trash2 className="h-4 w-4" /> Eliminar definitivamente
            </Button>
          </>
        }
      >
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[13.5px] text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            Se borrarán el pallet y sus {fmtInt(items.length)} piezas escaneadas. Esta acción{' '}
            <b>no se puede deshacer</b>.
          </p>
        </div>
        <label className="mt-4 block">
          <span className="label">
            Escribe <span className="font-mono font-bold">{p.id}</span> para confirmar
          </span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="field font-mono uppercase"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
        </label>
        <ErrorBox error={actionError} className="mt-3" />
      </Dialog>
    </div>
  )
}

const REC_TABS = {
  faltantes: { label: 'Faltantes', tone: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  extras: { label: 'Extras', tone: 'text-amber-800 dark:text-amber-300', dot: 'bg-amber-500' },
  confirmados: {
    label: 'Confirmados',
    tone: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  esperados: { label: 'Esperados', tone: 'text-foreground', dot: 'bg-slate-400' },
}

function SalidaReconciliation({ pallet, rec, reasons, elsewhere = {} }) {
  const reasonOf = useMemo(() => Object.fromEntries((reasons || []).map((r) => [r.code, r])), [reasons])
  const [tab, setTab] = useState(
    rec.missing.length ? 'faltantes' : rec.extras.length ? 'extras' : 'confirmados',
  )
  const [q, setQ] = useState('')
  const confirmedSet = useMemo(() => new Set(rec.confirmed), [rec])

  const lists = {
    faltantes: rec.missing,
    extras: rec.extras,
    confirmados: rec.confirmed,
    esperados: [...rec.confirmed, ...rec.missing],
  }
  const t = q.trim().toUpperCase()
  const shown = t ? lists[tab].filter((c) => c.includes(t)) : lists[tab]
  const open = isOpen(pallet)

  return (
    <div className="space-y-4">
      <ReconSummary rec={rec} />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Segmented
            value={tab}
            onChange={setTab}
            size="sm"
            options={Object.entries(REC_TABS).map(([k, v]) => ({
              value: k,
              label: `${v.label} (${fmtInt(lists[k].length)})`,
            }))}
          />
          <SearchBox value={q} onChange={setQ} className="sm:w-56" />
        </div>
        {open && tab === 'faltantes' && rec.missing.length > 0 && (
          <p className="border-b bg-amber-50 px-4 py-2 text-[12.5px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 sm:px-5">
            La salida sigue abierta: estas piezas aún están pendientes de escanear.
          </p>
        )}
        {!lists[tab].length ? (
          <Empty icon={CheckCircle2} title={`Sin ${REC_TABS[tab].label.toLowerCase()}`} />
        ) : !shown.length ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-muted-foreground">Sin coincidencias.</p>
        ) : (
          <ul className="max-h-[65dvh] divide-y overflow-y-auto">
            {shown.map((c) => {
              const kind = tab === 'esperados' ? (confirmedSet.has(c) ? 'confirmados' : 'faltantes') : tab
              const r = reasonOf[c]
              return (
                <li key={c} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', REC_TABS[kind].dot)} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate font-mono text-[14.5px] font-semibold',
                        REC_TABS[kind].tone,
                      )}
                    >
                      {c}
                    </span>
                    {kind === 'faltantes' && <ElsewhereNote where={elsewhere[c]} />}
                    {kind === 'faltantes' && r && (
                      <span className="block truncate text-[12.5px] text-muted-foreground">
                        <b className="text-foreground">{r.reason}</b>
                        {r.noted_by_name && ` · ${r.noted_by_name}`}
                      </span>
                    )}
                  </span>
                  {tab === 'esperados' && (
                    <Badge tone={kind === 'confirmados' ? 'green' : 'red'}>
                      {kind === 'confirmados' ? 'Salió' : 'Falta'}
                    </Badge>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
