// "Buscar serial" (2026-10-15, a peticion explicita del usuario): el campo de serial va DIRECTO en el
// encabezado, a un lado de Historial ("quita el boton ... y lo que tiene dentro dejalo ahi afuera a un lado de
// historial"). Como antes: con la pistola se escanea en el campo (Enter busca); en el celular se toca el boton
// de camara. La camara y el resultado (en que pallet esta la pieza) se abren justo debajo del campo; tocar el
// pallet lo abre. Lo usan Control de Pallet (PalletsHome / PalletsAdmin) y el Dashboard de pallets de Reportes.
import { ChevronRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CameraScan, CameraToggle, canUseCamera } from '@/components/Scanner'
import { Button, ErrorBox } from '@/components/ui'
import { api } from '@/lib/api'
import { fmtDateTime } from '@/lib/utils'
import { StatusBadge, TypeBadge } from './shared'

// Con mouse (computadora con pistola) el campo toma el foco al abrir la pagina; en el celular no (abriria
// el teclado).
const finePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches

// `initial`: serial que llega de otra pantalla (Centro de reportes -> ?q=): se busca solo.
export function ScanSerialAction({ initial = '' }) {
  const navigate = useNavigate()
  const [q, setQ] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [error, setError] = useState(null)
  const [camera, setCamera] = useState(false)
  const panel = camera || res || error

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
  const closePanel = () => {
    setCamera(false)
    setRes(null)
    setError(null)
  }

  // Solo una vez al abrir con un serial ya dado.
  useEffect(() => {
    if (initial) submit(null, initial)
  }, [])

  return (
    <div className="relative w-full sm:w-[24rem]">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escanea o escribe el serial"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          // biome-ignore lint/a11y/noAutofocus: la pistola lectora escribe donde esta el foco.
          autoFocus={finePointer}
          className="field h-11 min-w-0 flex-1 font-mono uppercase placeholder:font-sans placeholder:normal-case"
        />
        {canUseCamera && (
          <CameraToggle open={camera} onClick={() => setCamera((c) => !c)} className="h-11 w-11 border bg-card" />
        )}
        <Button type="submit" loading={busy} disabled={!q.trim()} className="h-11 shrink-0">
          Buscar
        </Button>
      </form>
      {panel && (
        <div className="absolute right-0 top-full z-30 mt-2 w-full space-y-3 rounded-2xl border bg-card p-3 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-muted-foreground">¿En qué pallet está la pieza?</p>
            <button
              type="button"
              onClick={closePanel}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {camera && <CameraScan once onCode={(c) => submit(null, c)} onClose={() => setCamera(false)} />}
          <ErrorBox error={error} />
          {res && (
            <div className="overflow-hidden rounded-xl border">
              <p className="px-4 pt-3 font-mono text-[13px] font-semibold text-muted-foreground">{res.code}</p>
              {res.matches.length ? (
                <ul className="divide-y">
                  {res.matches.map((m) => (
                    <li key={m.pallet_id}>
                      <button
                        type="button"
                        onClick={() => {
                          closePanel()
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
      )}
    </div>
  )
}
