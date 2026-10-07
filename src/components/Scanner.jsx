// Campo de escaneo: funciona con pistola lectora (teclado + Enter) y, en celulares con
// BarcodeDetector (Chrome Android), tambien con la camara. Mantiene el foco para escanear seguido.
import { Camera, CameraOff, ScanLine } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

export const Scanner = forwardRef(function Scanner(
  { onScan, placeholder = 'Escanea o escribe el código', label, disabled, busy, status, autoFocus = true, keepFocus = true, className },
  ref,
) {
  const inputRef = useRef(null)
  const [value, setValue] = useState('')
  const [camera, setCamera] = useState(false)

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus(), clear: () => setValue('') }))

  // Recupera el foco si se pierde (pistola lectora), salvo que el usuario este en otro campo.
  useEffect(() => {
    if (!keepFocus || disabled) return
    const id = setInterval(() => {
      const a = document.activeElement
      const typing = a && a !== inputRef.current && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)
      const dialog = document.querySelector('[data-dialog-open]')
      if (!typing && !dialog && a !== inputRef.current) inputRef.current?.focus({ preventScroll: true })
    }, 800)
    return () => clearInterval(id)
  }, [keepFocus, disabled])

  const submit = (raw) => {
    const v = String(raw || '').trim()
    if (!v || disabled || busy) return
    setValue('')
    onScan(v)
  }

  const tone =
    status === 'ok'
      ? 'border-emerald-500 ring-4 ring-emerald-500/20'
      : status === 'error'
        ? 'border-red-500 ring-4 ring-red-500/20'
        : 'border-input focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15'

  return (
    <div className={className}>
      {label && <span className="label">{label}</span>}
      <div className={cn('flex items-center gap-2 rounded-2xl border-2 bg-card px-3 transition', tone)}>
        <ScanLine className="h-6 w-6 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit(value)
            }
          }}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          className="h-14 min-w-0 flex-1 bg-transparent font-mono text-[18px] font-semibold uppercase tracking-wide outline-none placeholder:font-sans placeholder:text-[15px] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/70"
        />
        {hasDetector && (
          <button
            type="button"
            onClick={() => setCamera((c) => !c)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
            aria-label={camera ? 'Cerrar cámara' : 'Escanear con cámara'}
          >
            {camera ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
          </button>
        )}
      </div>
      {camera && <CameraScan onCode={(c) => submit(c)} onClose={() => setCamera(false)} />}
    </div>
  )
})

function CameraScan({ onCode, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let stream
    let stop = false
    let last = ''
    let lastAt = 0
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const v = videoRef.current
        v.srcObject = stream
        await v.play()
        const detector = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'data_matrix', 'itf'],
        })
        const tick = async () => {
          if (stop) return
          try {
            const codes = await detector.detect(v)
            const c = codes[0]?.rawValue
            // Evita leer el mismo codigo varias veces seguidas.
            if (c && (c !== last || Date.now() - lastAt > 2500)) {
              last = c
              lastAt = Date.now()
              onCode(c)
            }
          } catch {
            /* frame sin codigo */
          }
          setTimeout(tick, 250)
        }
        tick()
      } catch {
        setError('No se pudo abrir la cámara. Revisa los permisos del navegador.')
      }
    })()
    return () => {
      stop = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onCode])
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border bg-black">
      {error ? (
        <p className="p-4 text-center text-[13.5px] text-white">{error}</p>
      ) : (
        <div className="relative">
          <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,.9)]" />
        </div>
      )}
      <button type="button" onClick={onClose} className="w-full bg-slate-900 py-2.5 text-[13.5px] font-semibold text-white">
        Cerrar cámara
      </button>
    </div>
  )
}

// Mensaje grande de resultado del ultimo escaneo.
export function ScanResult({ result }) {
  if (!result) return null
  const ok = result.tone === 'ok'
  const warn = result.tone === 'warn'
  return (
    <div
      key={result.at}
      className={cn(
        'animate-pop mt-3 flex items-start gap-3 rounded-2xl border px-4 py-3',
        ok && 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
        warn && 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
        !ok && !warn && 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
      )}
    >
      <span className="text-[22px] leading-none">{ok ? '✓' : warn ? '!' : '✕'}</span>
      <div className="min-w-0">
        <p className="text-[15px] font-bold">{result.title}</p>
        {result.detail && <p className="mt-0.5 text-[13px] opacity-90">{result.detail}</p>}
      </div>
    </div>
  )
}
