import { ArrowDownToLine, CheckCircle2, Lock, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Scanner, ScanResult } from '@/components/Scanner'
import { Badge, Button, Card, Dialog, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { useStored } from '@/lib/hooks'
import { useCatalogs, useSession } from '@/lib/session'
import { feedback, fmtInt } from '@/lib/utils'
import { RemoveItemDialog, ScannedList } from './ScannedList'
import {
  BackLink,
  BigCount,
  ChipGroup,
  PALLET_ID,
  StatusBadge,
  normPallet,
  useScanFeedback,
  useSerialQueue,
} from './shared'

export default function ScanEntrada() {
  const { user } = useSession()
  const [params, setParams] = useSearchParams()
  const urlId = params.get('id')
  const [stage, setStage] = useState(urlId ? 'loading' : 'id') // id | loading | setup | scan | done
  const [newId, setNewId] = useState(null)
  const [pallet, setPallet] = useState(null)
  const [items, setItems] = useState([])
  const [idError, setIdError] = useState(null)
  const fb = useScanFeedback()
  const { enqueue, pending } = useSerialQueue()
  const [removing, setRemoving] = useState(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeBusy, setCloseBusy] = useState(false)
  const [closeError, setCloseError] = useState(null)

  const openPallet = async (id) => {
    setIdError(null)
    if (!PALLET_ID.test(id)) {
      setStage('id')
      setIdError({ title: 'ID inválido', detail: 'El ID del pallet debe tener exactamente 6 dígitos.' })
      return
    }
    setStage('loading')
    try {
      const d = await api(`/pallets/${id}`)
      const p = normPallet(d.pallet)
      if (p.type !== 'entrada') {
        setStage('id')
        setIdError({ title: 'No es un pallet de entrada', detail: `${p.id} es una salida.`, id: p.id })
      } else if (p.status !== 'abierto') {
        setStage('id')
        setIdError({
          title: `El pallet ${p.id} ya está cerrado`,
          detail: 'Un supervisor puede reabrirlo desde el detalle.',
          id: p.id,
        })
      } else {
        setPallet(p)
        setItems(d.items || [])
        fb.reset()
        setStage('scan')
        if (urlId !== p.id) setParams({ id: p.id }, { replace: true })
      }
    } catch (e) {
      if (e.status === 404) {
        setNewId(id)
        setStage('setup')
      } else {
        setStage('id')
        setIdError({ title: 'No se pudo abrir el pallet', detail: e.message })
      }
    }
  }

  useEffect(() => {
    if (idError) feedback(false)
  }, [idError])

  // Retomar desde la URL (?id=123456).
  useEffect(() => {
    if (urlId && urlId !== pallet?.id) openPallet(urlId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlId])

  const startOver = () => {
    setPallet(null)
    setItems([])
    setNewId(null)
    setIdError(null)
    fb.reset()
    setStage('id')
    setParams({}, { replace: true })
  }

  const scanItem = (code) =>
    enqueue(async () => {
      if (PALLET_ID.test(code) && code !== pallet.id) {
        fb.show('error', 'Eso es un ID de pallet', `Cierra el pallet ${pallet.id} antes de empezar el ${code}.`)
        return
      }
      try {
        const r = await api(`/pallets/${pallet.id}/items`, { method: 'POST', body: { code } })
        setItems((list) => [
          { code: r.code, scanned_at: new Date().toISOString(), scanned_by_name: user?.name },
          ...list.filter((x) => x.code !== r.code),
        ])
        if (r.otherPallets?.length)
          fb.show('warn', `${r.code} registrada`, `Ojo: también está en pallet ${r.otherPallets.join(', ')}.`)
        else fb.show('ok', r.code, `Pieza #${fmtInt(r.count)} registrada`)
      } catch (e) {
        fb.show('error', e.body?.duplicate ? 'Pieza duplicada' : 'No se registró', e.message)
      }
    })

  const confirmRemove = async () => {
    setRemoveBusy(true)
    try {
      await api(`/pallets/${pallet.id}/items/${encodeURIComponent(removing)}`, { method: 'DELETE' })
      setItems((list) => list.filter((x) => x.code !== removing))
      fb.show('warn', 'Pieza quitada', removing)
      setRemoving(null)
    } catch (e) {
      fb.show('error', 'No se pudo quitar', e.message)
      setRemoving(null)
    } finally {
      setRemoveBusy(false)
    }
  }

  const closePallet = async () => {
    setCloseBusy(true)
    setCloseError(null)
    try {
      const r = await api(`/pallets/${pallet.id}/close`, { method: 'POST' })
      setPallet(normPallet(r.pallet))
      setCloseOpen(false)
      setStage('done')
      setParams({}, { replace: true })
    } catch (e) {
      setCloseError(e)
    } finally {
      setCloseBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        back={<BackLink />}
        title="Entrada de pallet"
        subtitle={
          stage === 'scan' ? 'Escanea cada pieza del pallet' : stage === 'setup' ? 'Pallet nuevo' : 'Registrar pallet recibido'
        }
      />

      {stage === 'loading' && <Spinner />}

      {stage === 'id' && (
        <Card className="mx-auto max-w-xl p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              <ArrowDownToLine className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[16px] font-bold">Escanea el ID del pallet</p>
              <p className="text-[13px] text-muted-foreground">6 dígitos. Si ya está abierto, se retoma.</p>
            </div>
          </div>
          <Scanner onScan={openPallet} placeholder="ID del pallet (6 dígitos)" status={idError ? 'error' : null} />
          {idError && <ScanResult result={{ tone: 'error', title: idError.title, detail: idError.detail, at: idError.title }} />}
          {idError?.id && (
            <Link to={`/pallets/${idError.id}`} className="mt-3 inline-flex h-11 items-center rounded-xl border border-input bg-card px-4 text-[14.5px] font-semibold hover:bg-muted">
              Ver detalle del pallet {idError.id}
            </Link>
          )}
        </Card>
      )}

      {stage === 'setup' && (
        <NewPalletSetup
          id={newId}
          onCancel={startOver}
          onCreated={(id) => openPallet(id)}
        />
      )}

      {stage === 'scan' && pallet && (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <Card className="p-4 sm:p-5 lg:sticky lg:top-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[22px] font-extrabold tracking-tight">{pallet.id}</span>
                  <StatusBadge status={pallet.status} />
                </div>
                <p className="mt-0.5 text-[13.5px] text-muted-foreground">
                  {pallet.model} · {pallet.brand}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={startOver}>
                <RotateCcw className="h-4 w-4" /> Cambiar pallet
              </Button>
            </div>

            <div className="my-5">
              <BigCount label="Piezas en el pallet" value={fmtInt(items.length)} />
            </div>

            <Scanner onScan={scanItem} status={fb.status} placeholder="Escanea el serial de la pieza" />
            <ScanResult result={fb.result} />
            {pending > 1 && <p className="mt-2 text-center text-[12.5px] text-muted-foreground">Procesando {pending} lecturas…</p>}

            <Button
              variant="success"
              size="lg"
              className="mt-5 w-full"
              disabled={!items.length}
              onClick={() => {
                setCloseError(null)
                setCloseOpen(true)
              }}
            >
              <Lock className="h-5 w-5" /> Cerrar pallet
            </Button>
          </Card>

          <ScannedList items={items} onRemove={setRemoving} highlight={items[0]?.code} />
        </div>
      )}

      {stage === 'done' && pallet && (
        <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
          <h2 className="mt-3 text-[22px] font-extrabold tracking-tight">Pallet {pallet.id} cerrado</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {pallet.model} · {pallet.brand}
          </p>
          <div className="mt-5">
            <BigCount label="Piezas registradas" value={fmtInt(pallet.itemCount)} tone="green" />
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button size="lg" onClick={startOver}>
              <Plus className="h-5 w-5" /> Nuevo pallet
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

      <RemoveItemDialog
        code={removing}
        palletId={pallet?.id}
        busy={removeBusy}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />

      <Dialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Cerrar pallet"
        footer={
          <>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Seguir escaneando
            </Button>
            <Button variant="success" loading={closeBusy} onClick={closePallet}>
              <Lock className="h-4 w-4" /> Cerrar pallet
            </Button>
          </>
        }
      >
        <p className="text-[14.5px]">
          Vas a cerrar el pallet <span className="font-mono font-bold">{pallet?.id}</span>. Después ya no se podrán agregar piezas.
        </p>
        <div className="my-5">
          <BigCount label="Piezas" value={fmtInt(items.length)} />
        </div>
        <p className="text-center text-[13px] text-muted-foreground">Confirma que el conteo coincide con el pallet físico.</p>
        <ErrorBox error={closeError} className="mt-3" />
      </Dialog>
    </div>
  )
}

// Paso para pallets nuevos: elegir modelo y marca.
function NewPalletSetup({ id, onCancel, onCreated }) {
  const { loaded, models, brands } = useCatalogs()
  const [last, setLast] = useStored('vp:entrada:last', {})
  const [model, setModel] = useState(last.model || null)
  const [brand, setBrand] = useState(last.brand || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Descarta selecciones recordadas que ya no esten activas.
  useEffect(() => {
    if (!loaded) return
    if (model && !models.some((m) => m.code === model)) setModel(null)
    if (brand && !brands.some((b) => b.code === brand)) setBrand(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      await api('/pallets/entrada', { method: 'POST', body: { id, model, brand } })
      setLast({ model, brand })
      onCreated(id)
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  if (!loaded) return <Spinner />

  return (
    <Card className="mx-auto max-w-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[24px] font-extrabold tracking-tight">{id}</span>
        <Badge tone="blue">Nuevo</Badge>
      </div>
      <p className="mt-1 text-[13.5px] text-muted-foreground">Este pallet no existe todavía. Elige modelo y marca para crearlo.</p>

      <section className="mt-5">
        <h3 className="label">Modelo</h3>
        {models.length ? (
          <ChipGroup options={models.map((m) => m.code)} value={model} onChange={setModel} />
        ) : (
          <p className="text-[13.5px] text-muted-foreground">No hay modelos activos. Pide a un administrador que los dé de alta.</p>
        )}
      </section>
      <section className="mt-5">
        <h3 className="label">Marca</h3>
        <ChipGroup options={brands.map((b) => b.code)} value={brand} onChange={setBrand} />
      </section>

      <ErrorBox error={error} className="mt-5" />

      <div className="mt-6 grid gap-2 sm:grid-cols-[auto_1fr]">
        <Button variant="outline" size="lg" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="lg" loading={busy} disabled={!model || !brand} onClick={create}>
          <Plus className="h-5 w-5" /> Crear pallet {id}
        </Button>
      </div>
    </Card>
  )
}
