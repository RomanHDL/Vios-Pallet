import { ArrowRight, ChevronLeft, Lock, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, ErrorBox } from '@/components/ui'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'

// Entrada (2026-10-07, a peticion explicita del usuario: "que nomas le des clic en entrar y de volada"):
// boton "Entrar" con la cuenta compartida Planta; el login con usuario queda para el administrador.
export default function Login() {
  const { login, enter } = useSession()
  const [guest, setGuest] = useState(true)
  const [withUser, setWithUser] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/auth/options')
      .then((d) => setGuest(d.guest))
      .catch(() => {})
  }, [])

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    run(() => login(username.trim(), password.trim()))
  }

  const showForm = withUser || !guest

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-11 w-11 rounded-xl" />
          <span className="text-[20px] font-extrabold">VIOS Pallet</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-[40px] font-extrabold leading-[1.1] tracking-tight">
            Pallets, producción y calidad en un solo lugar.
          </h1>
          <p className="mt-4 text-[16px] text-white/70">
            Entrada y salida de pallets con conciliación pieza por pieza, registro de producto terminado por línea,
            rechazos de calidad y reportes Plan vs Real.
          </p>
        </div>
        <p className="relative mt-10 text-[13px] text-white/50">MI Technologies · Monterrey</p>
      </div>

      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/favicon.svg" alt="" className="h-11 w-11 rounded-xl" />
            <span className="text-[20px] font-extrabold">VIOS Pallet</span>
          </div>

          {!showForm ? (
            <>
              <h2 className="text-[28px] font-extrabold tracking-tight">Bienvenido</h2>
              <p className="mt-1 text-[14.5px] text-muted-foreground">Control de pallets, producción y calidad VIOS.</p>
              <Button size="lg" className="mt-8 h-16 w-full text-[18px]" loading={busy} onClick={() => run(enter)} autoFocus>
                Entrar <ArrowRight className="h-5 w-5" />
              </Button>
              <ErrorBox error={error} className="mt-4" />
              <button
                type="button"
                onClick={() => {
                  setWithUser(true)
                  setError(null)
                }}
                className="mt-6 w-full text-center text-[13.5px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Entrar con usuario (administrador)
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              {guest && (
                <button
                  type="button"
                  onClick={() => {
                    setWithUser(false)
                    setError(null)
                  }}
                  className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" /> Volver
                </button>
              )}
              <h2 className="text-[26px] font-extrabold tracking-tight">Iniciar sesión</h2>
              <p className="mt-1 text-[14px] text-muted-foreground">Entra con tu usuario.</p>
              <div className="mt-7 space-y-4">
                <label className="block">
                  <span className="label">Usuario</span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <input className="field h-12 pl-10" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" autoFocus required />
                  </div>
                </label>
                <label className="block">
                  <span className="label">Contraseña</span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <input className="field h-12 pl-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                  </div>
                </label>
                <ErrorBox error={error} />
                <Button type="submit" size="lg" className="w-full" loading={busy}>
                  Entrar
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
