// Campo de escaneo: funciona con pistola lectora (teclado + Enter) y con la camara del celular.
// Camara: BarcodeDetector nativo cuando existe (Chrome Android); si no (iPhone / Safari), lector
// @zxing/browser que se carga solo al abrir la camara. Mantiene el foco para escanear seguido.
import { Camera, CameraOff, ScanLine } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window
// Cualquier navegador con camara (en https) puede escanear: nativo o con zxing.
export const canUseCamera =
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

const FORMATS = ['code_128', 'code_39', 'qr_code', 'ean_13', 'data_matrix', 'itf']

export const Scanner = forwardRef(function Scanner(
  { onScan, placeholder = 'Escanea o escribe el código', label, disabled, busy, status, autoFocus = true, keepFocus = true, className },
  ref,
) {
  const inputRef = useRef(null)
  const [value, setValue] = useState('')
  const [camera, setCamera] = useState(false)

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus(), clear: () => setValue('') }))

  // Recupera el foco si se pierde (pistola lectora), salvo que el usuario este en otro campo. Con la
  // camara abierta no (en celular abriria el teclado encima de la camara).
  useEffect(() => {
    if (!keepFocus || disabled || camera) return
    const id = setInterval(() => {
      const a = document.activeElement
      const typing = a && a !== inputRef.current && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)
      const dialog = document.querySelector('[data-dialog-open]')
      if (!typing && !dialog && a !== inputRef.current) inputRef.current?.focus({ preventScroll: true })
    }, 800)
    return () => clearInterval(id)
  }, [keepFocus, disabled, camera])

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
        {canUseCamera && (
          <CameraToggle open={camera} onClick={() => setCamera((c) => !c)} disabled={disabled} />
        )}
      </div>
      {camera && <CameraScan onCode={submit} onClose={() => setCamera(false)} />}
    </div>
  )
})

// Boton de camara (mismo icono en todos los campos de escaneo).
export function CameraToggle({ open, onClick, disabled, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50',
        open && 'bg-muted text-foreground',
        className,
      )}
      aria-label={open ? 'Cerrar cámara' : 'Escanear con cámara'}
      title={open ? 'Cerrar cámara' : 'Escanear con cámara'}
    >
      {open ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
    </button>
  )
}

// Lector con la camara trasera. `onCode` puede cambiar en cada render (se lee por ref, asi la camara no
// se reinicia). `once`: cierra al primer codigo (buscadores); sin el, sigue leyendo (escaneo seguido).
export function CameraScan({ onCode, onClose, once = false }) {
  const videoRef = useRef(null)
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [error, setError] = useState(null)
  const [last, setLast] = useState('')

  useEffect(() => {
    let stop = false
    let stream
    let controls
    let timer
    let lastCode = ''
    let lastAt = 0
    const handle = (raw) => {
      const c = String(raw || '').trim()
      if (stop || !c) return
      // Evita leer el mismo codigo varias veces seguidas.
      if (c === lastCode && Date.now() - lastAt < 2500) return
      lastCode = c
      lastAt = Date.now()
      navigator.vibrate?.(60)
      setLast(c)
      onCodeRef.current(c)
      if (once) onCloseRef.current?.()
    }
    ;(async () => {
      try {
        let native = null
        if (hasDetector) {
          const supported = await window.BarcodeDetector.getSupportedFormats?.().catch(() => [])
          const formats = FORMATS.filter((f) => !supported?.length || supported.includes(f))
          if (formats.length) native = new window.BarcodeDetector({ formats })
        }
        if (native) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 } },
            audio: false,
          })
          if (stop) return
          const v = videoRef.current
          v.srcObject = stream
          await v.play()
          const tick = async () => {
            if (stop) return
            try {
              const codes = await native.detect(v)
              handle(codes[0]?.rawValue)
            } catch {
              /* frame sin codigo */
            }
            timer = setTimeout(tick, 200)
          }
          tick()
          return
        }
        // iPhone / Safari / navegadores sin BarcodeDetector: zxing (JS puro, sin servicios externos).
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        if (stop) return
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.EAN_13,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.ITF,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 })
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false },
          videoRef.current,
          (result) => {
            if (result) handle(result.getText())
          },
        )
        if (stop) controls.stop()
      } catch {
        if (!stop) setError('No se pudo abrir la cámara. Revisa que el navegador tenga permiso de usar la cámara.')
      }
    })()
    return () => {
      stop = true
      clearTimeout(timer)
      controls?.stop()
      for (const track of stream?.getTracks() || []) track.stop()
    }
  }, [once])

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border bg-black">
      {error ? (
        <p className="p-4 text-center text-[13.5px] text-white">{error}</p>
      ) : (
        <div className="relative">
          <video ref={videoRef} playsInline muted autoPlay className="aspect-[4/3] w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,.9)]" />
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center">
            <span className="rounded-full bg-black/70 px-3 py-1 font-mono text-[12.5px] font-semibold text-white">
              {last ? `Leído: ${last}` : 'Apunta al código de barras'}
            </span>
          </p>
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
