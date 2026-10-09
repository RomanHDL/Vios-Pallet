import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, ChevronLeft, Factory, Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ErrorBox } from '@/components/ui'
import { useSession } from '@/lib/session'

// Entrada (2026-10-07, a peticion explicita del usuario: "que nomas le des clic en entrar y de volada"):
// boton "Entrar" con la cuenta compartida Planta. Despues ("quiero que quites el login... que solo sea un
// boton de entrar y ya"): la pantalla es solo el boton; el formulario del administrador se abre con /?admin.
// 2026-10-08: 4 accesos directos. Entrada / Salida / Produccion por linea entran con Planta y abren su pantalla;
// Admin pide la contrasena del administrador.
const ADMIN_FORM = new URLSearchParams(window.location.search).has('admin')

const SHORTCUTS = [
  { key: 'entrada', title: 'Entrada', hint: 'Registrar pallets recibidos', to: '/pallets/entrada', icon: ArrowDownToLine, tone: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300' },
  { key: 'salida', title: 'Salida', hint: 'Confirmar pallets despachados', to: '/pallets/salida', icon: ArrowUpFromLine, tone: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300' },
  { key: 'lineas', title: 'Producción por línea', hint: 'Escanear TV y caja', to: '/pallets/lineas', icon: Factory, tone: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300' },
  { key: 'admin', title: 'Admin', hint: 'Pide contraseña', icon: ShieldCheck, tone: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200' },
]

export default function Login() {
  const { login, enter } = useSession()
  const navigate = useNavigate()
  const [withUser, setWithUser] = useState(ADMIN_FORM)
  const [going, setGoing] = useState(null)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function go(s) {
    if (s.key === 'admin') {
      setError(null)
      setWithUser(true)
      return
    }
    setGoing(s.key)
    await run(async () => {
      await enter()
      navigate(s.to)
    })
    setGoing(null)
  }

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
    run(async () => {
      await login(username.trim(), password.trim())
      navigate('/pallets')
    })
  }

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

          {!withUser ? (
            <>
              <h2 className="text-[28px] font-extrabold tracking-tight">Bienvenido</h2>
              <p className="mt-1 text-[14.5px] text-muted-foreground">Control de pallets, producción y calidad VIOS.</p>
              <div className="mt-7 grid grid-cols-2 gap-3">
                {SHORTCUTS.map((s) => {
                  const Icon = s.icon
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => go(s)}
                      disabled={busy}
                      className="card flex min-h-[132px] flex-col items-start gap-2.5 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md disabled:opacity-60"
                    >
                      <span className={`grid h-11 w-11 place-items-center rounded-xl ${s.tone}`}>
                        <Icon className="h-[22px] w-[22px]" />
                      </span>
                      <span>
                        <span className="block text-[15px] font-bold leading-tight">{s.title}</span>
                        <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                          {going === s.key ? 'Entrando…' : s.hint}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <Button size="lg" className="mt-4 h-14 w-full text-[17px]" loading={busy && !going} disabled={busy} onClick={() => run(enter)}>
                Entrar <ArrowRight className="h-5 w-5" />
              </Button>
              <ErrorBox error={error} className="mt-4" />
            </>
          ) : (
            <form onSubmit={submit}>
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
              <h2 className="text-[26px] font-extrabold tracking-tight">Administrador</h2>
              <p className="mt-1 text-[14px] text-muted-foreground">Escribe la contraseña del administrador.</p>
              <div className="mt-7 space-y-4">
                <input type="hidden" value={username} autoComplete="username" readOnly onChange={(e) => setUsername(e.target.value)} />
                <label className="block">
                  <span className="label">Contraseña</span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <input className="field h-12 pl-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
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
