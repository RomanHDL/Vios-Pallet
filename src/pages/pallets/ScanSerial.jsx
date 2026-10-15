// "Escanear serial" (2026-10-15, a peticion explicita del usuario: "debe ser solo uno ... el de arriba", y
// despues "que sea como antes: si es escaner nomas se escanea, pero si tengo celular le doy clic al boton"):
// UN boton que abre una ventana con el campo de serial ya enfocado (la pistola escanea directo + Enter) y el
// boton de camara para el celular. Muestra en que pallet esta la pieza; tocar el pallet lo abre.
// Lo usan Control de Pallet (PalletsHome / PalletsAdmin) y el Dashboard de pallets de Reportes.
import { ChevronRight, ScanLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CameraScan, CameraToggle, canUseCamera } from '@/components/Scanner'
import { Button, Dialog, ErrorBox } from '@/components/ui'
import { api } from '@/lib/api'
import { fmtDateTime } from '@/lib/utils'
import { StatusBadge, TypeBadge } from './shared'

// `initial`: serial que llega de otra pantalla (Centro de reportes -> ?q=): abre la ventana y busca solo.
export function ScanSerialAction({ initial = '' }) {
  const [open, setOpen] = useState(Boolean(initial))
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        <ScanLine className="h-[18px] w-[18px]" /> Buscar serial
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Buscar serial">
        {open && <FindSerial initial={initial} onPick={() => setOpen(false)} />}
      </Dialog>
    </>
  )
}

function FindSerial({ initial, onPick }) {
  const navigate = useNavigate()
  const [q, setQ] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [error, setError] = useState(null)
  const [camera, setCamera] = useState(false)

  // `code`: lo leido con la camara o el que llego de otra pantalla (se busca solo).
  const submit = async (e, code) => {
    e?.preventDefault()
    const c = (code ?? q).trim()
    if (!c) return
    if (code) setQ(code)
    setBusy(true)
    setError(null)
    try {
      setRes(await api(`/pallets/find/${encodeURIComponent(c)}`))
    } catch (err) {
      setError(err)
      setRes(null)
    } finally {
      setBusy(false)
    }
  }

  // Solo una vez al abrir con un serial ya dado.
  useEffect(() => {
    if (initial) submit(null, initial)
  }, [])

  return (
    <div className="space-y-3">
      <p className="text-[13.5px] text-muted-foreground">
        ¿En qué pallet está una pieza? Escanea con la pistola o, en el celular, toca la cámara.
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escanea o escribe el serial"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          // biome-ignore lint/a11y/noAutofocus: la pistola lectora escribe donde esta el foco.
          autoFocus
          className="field min-w-0 flex-1 font-mono uppercase placeholder:font-sans placeholder:normal-case"
        />
        {canUseCamera && (
          <CameraToggle open={camera} onClick={() => setCamera((c) => !c)} className="h-auto self-stretch border" />
        )}
        <Button type="submit" loading={busy} disabled={!q.trim()} className="shrink-0">
          Buscar
        </Button>
      </form>
      {camera && <CameraScan once onCode={(c) => submit(null, c)} onClose={() => setCamera(false)} />}
      <ErrorBox error={error} />
      {res && (
        <div className="overflow-hidden rounded-2xl border">
          <p className="px-4 pt-3 font-mono text-[13px] font-semibold text-muted-foreground">{res.code}</p>
          {res.matches.length ? (
            <ul className="divide-y">
              {res.matches.map((m) => (
                <li key={m.pallet_id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick?.()
                      navigate(`/pallets/${m.pallet_id}`)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[15px] font-bold">{m.pallet_id}</span>
                        <TypeBadge type={m.type} />
                        <StatusBadge status={m.status} />
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                        {[m.model, m.brand].filter(Boolean).join(' · ')} · {fmtDateTime(m.scanned_at)}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-4 pt-1 text-[13.5px] text-muted-foreground">No está en ningún pallet.</p>
          )}
        </div>
      )}
    </div>
  )
}
