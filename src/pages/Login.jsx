import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  BarChart3,
  Eye,
  EyeOff,
  Factory,
  Loader2,
  Lock,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/lib/session'
import { CHANGELOG } from '@/pages/docs/changelog'

// Entrada (2026-10-07, a peticion explicita del usuario: "que nomas le des clic en entrar y de volada"):
// boton "Entrar" con la cuenta compartida Planta. Despues ("quiero que quites el login... que solo sea un
// boton de entrar y ya"): la pantalla es solo el boton; el formulario del administrador se abre con /?admin.
// 2026-10-08: 4 accesos, sin boton "Entrar" general. Entrada / Salida / Produccion por linea entran con Planta
// limitada a su area (shared/areas.js); Admin pide la contrasena del administrador y ve todo.
// 2026-10-10: rediseno "Centro de operaciones" (imagen de referencia de Roman, laptop + celular). Solo visual: la
// logica de los 4 accesos y del formulario de admin es la misma. La foto de pallets es un recorte de esa imagen.
// 2026-10-17 (v1.51.0): rediseno en la familia de logins MI (Centro de Calidad / Centro de Trabajo / Cubicaje):
// panel azul con la foto a la izquierda (>= lg) y panel claro con las tarjetas de area a la derecha. En celular la
// foto es una banda arriba y las tarjetas se enciman. Solo visual: mismos handlers (enter / login), Planta = un clic,
// Admin pide usuario + contrasena. La foto es UN solo <img> (banda en celular, panel en PC).
const ADMIN_FORM = new URLSearchParams(window.location.search).has('admin')
const VERSION = CHANGELOG[0]?.version

const SHORTCUTS = [
  {
    key: 'entrada',
    title: 'Entrada',
    hint: 'Registrar pallets recibidos',
    to: '/pallets/entrada',
    icon: ArrowDownToLine,
    tile: 'bg-[#e3edff] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300',
    ring: 'hover:border-[#2563eb]/40 focus-visible:ring-[#2563eb]/40',
  },
  {
    key: 'salida',
    title: 'Salida',
    hint: 'Confirmar pallets despachados',
    to: '/pallets/salida',
    icon: ArrowUpFromLine,
    tile: 'bg-[#efe8ff] text-[#7c3aed] dark:bg-violet-500/15 dark:text-violet-300',
    ring: 'hover:border-[#7c3aed]/40 focus-visible:ring-[#7c3aed]/40',
  },
  {
    key: 'lineas',
    title: 'Producción por línea',
    hint: 'Escanear TV y caja',
    to: '/pallets/lineas',
    icon: Factory,
    tile: 'bg-[#d6f6f0] text-[#0d9488] dark:bg-teal-500/15 dark:text-teal-300',
    ring: 'hover:border-[#14b8a6]/45 focus-visible:ring-[#14b8a6]/40',
  },
  {
    key: 'admin',
    title: 'Admin',
    hint: 'Panel administrativo',
    icon: ShieldCheck,
    tile: 'bg-[#e8edf4] text-[#334155] dark:bg-slate-500/20 dark:text-slate-200',
    ring: 'hover:border-[#475569]/40 focus-visible:ring-[#475569]/40',
    locked: true,
  },
]

const FEATURES = [
  { icon: BarChart3, text: 'Proceso confiable' },
  { icon: ShieldCheck, text: 'Información en tiempo real' },
  { icon: Users, text: 'Operación más eficiente' },
]

function Logo({ className = 'h-12 w-12' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl bg-white shadow-[0_8px_24px_-8px_rgba(5,20,45,0.55)] ${className}`}
    >
      <img src="/favicon.svg" alt="" className="h-[70%] w-[70%] rounded-lg" />
    </span>
  )
}

// Aviso de error (rojo suave, solido para que se lea tambien encima de la foto en celular).
function Alert({ error }) {
  return (
    <div aria-live="polite">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] font-medium text-red-700 shadow-sm dark:border-red-500/40 dark:bg-red-950 dark:text-red-200"
        >
          <AlertTriangle className="mt-px h-[18px] w-[18px] shrink-0" />
          <span>{error.message || String(error)}</span>
        </div>
      )}
    </div>
  )
}

function AreaCard({ s, busy, going, onClick }) {
  const Icon = s.icon
  const loading = going === s.key
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={loading || undefined}
      aria-label={`${s.title}: ${s.hint}${s.locked ? ' (pide contraseña)' : ''}`}
      className={`group flex min-h-[76px] w-full items-center gap-3.5 rounded-2xl border bg-card px-4 py-3 text-left text-card-foreground shadow-[0_10px_28px_-14px_rgba(15,35,80,0.35)] outline-none transition duration-200 hover:shadow-[0_16px_36px_-14px_rgba(15,35,80,0.4)] focus-visible:ring-4 disabled:cursor-not-allowed motion-safe:hover:-translate-y-0.5 sm:gap-4 sm:px-5 lg:min-h-[88px] ${s.ring} ${busy && !loading ? 'opacity-50' : ''}`}
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl ${s.tile}`}
      >
        <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[16.5px] font-extrabold leading-tight tracking-tight sm:text-[18px]">
          {s.title}
          {s.locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground sm:text-[14px]">
          {loading ? 'Entrando…' : s.hint}
        </span>
      </span>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-200 motion-safe:group-hover:translate-x-1 ${s.tile}`}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.25} />
        ) : (
          <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
        )}
      </span>
    </button>
  )
}

export default function Login() {
  const { login, enter } = useSession()
  const navigate = useNavigate()
  const [withUser, setWithUser] = useState(ADMIN_FORM)
  const [going, setGoing] = useState(null)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const passwordRef = useRef(null)
  const submitRef = useRef(null)
  useEffect(() => {
    if (withUser) passwordRef.current?.focus()
  }, [withUser])

  async function go(s) {
    if (s.key === 'admin') {
      setError(null)
      setWithUser(true)
      return
    }
    setGoing(s.key)
    await run(async () => {
      await enter(s.key)
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

  // En celular, al abrir el teclado deja visible el boton "Entrar".
  const keepSubmitVisible = () => {
    setTimeout(() => submitRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 320)
  }

  const back = () => {
    setWithUser(false)
    setError(null)
    setShowPassword(false)
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground lg:flex-row">
      {/* PANEL AZUL: banda superior en celular/tablet, panel izquierdo (45%) en PC. Una sola foto. */}
      <aside className="relative h-44 shrink-0 overflow-hidden bg-[#0D3B66] text-white lg:sticky lg:top-0 lg:h-dvh lg:w-[45%]">
        <img
          src="/img/pallets-hero.webp"
          alt=""
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-center"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top_right,rgba(13,59,102,0.93)_0%,rgba(16,74,138,0.86)_50%,rgba(21,101,192,0.78)_100%)]" />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] lg:-bottom-56 lg:-right-56 lg:h-[820px] lg:w-[820px]"
          viewBox="0 0 800 800"
          fill="none"
        >
          <circle cx="400" cy="400" r="390" stroke="white" strokeOpacity=".07" strokeWidth="2" />
          <circle cx="400" cy="400" r="300" stroke="white" strokeOpacity=".08" strokeWidth="2" />
          <circle cx="400" cy="400" r="210" stroke="white" strokeOpacity=".06" strokeWidth="2" />
        </svg>

        <div className="relative flex h-full flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-12 lg:py-10 xl:px-16">
          <div className="mx-auto flex w-full max-w-lg items-center gap-3 lg:mx-0 lg:max-w-none lg:gap-4">
            <Logo className="h-11 w-11 lg:h-14 lg:w-14" />
            <div>
              <p className="text-[19px] font-extrabold leading-tight lg:text-[22px]">VIOS Pallet</p>
              <p className="text-[12.5px] text-white/80 lg:text-[14px]">MI Technologies · Monterrey</p>
            </div>
          </div>

          {/* Celular / tablet: invitacion corta dentro de la banda */}
          <p className="mx-auto mt-4 w-full max-w-lg text-[17px] font-bold leading-snug text-white lg:hidden">
            {withUser ? 'Acceso de administrador' : 'Selecciona tu área de trabajo'}
          </p>

          {/* PC: titular, subtitulo y beneficios */}
          <div className="my-auto hidden max-w-xl py-10 motion-safe:animate-rise lg:block">
            <h1 className="text-5xl font-extrabold leading-[1.02] tracking-[-0.03em] xl:text-6xl">
              Centro de
              <br />
              <span className="bg-[linear-gradient(90deg,#60a5fa_0%,#38bdf8_45%,#2dd4bf_100%)] bg-clip-text text-transparent">
                operaciones
              </span>
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-white/85 xl:text-[18px]">
              Entradas, salidas y producción de pallets VIOS escaneando TV y caja, con información en tiempo
              real.
            </p>
            <ul className="mt-9 space-y-4">
              {FEATURES.map((f) => {
                const Icon = f.icon
                return (
                  <li key={f.text} className="flex items-center gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/25 bg-white/10 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[15.5px] font-semibold text-white/95">{f.text}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <p className="hidden text-[12.5px] text-white/60 lg:block">
            © MI Technologies, Inc. Solo para uso de la empresa{VERSION ? ` · v${VERSION}` : ''}
          </p>
        </div>
      </aside>

      {/* PANEL CLARO: tarjetas de area / formulario de admin */}
      <main className="relative z-10 -mt-10 flex flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 lg:mt-0 lg:items-center lg:justify-center lg:px-12 lg:py-10">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col lg:flex-none">
          <div className="hidden lg:block">
            <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-[#1565C0] dark:text-blue-300">
              Bienvenido
            </p>
            <h2 className="mt-2 text-[30px] font-extrabold leading-tight tracking-tight">
              Selecciona tu área de trabajo
            </h2>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Toca tu área y entras de inmediato. Admin pide contraseña.
            </p>
          </div>

          {!withUser ? (
            <div className="space-y-3 lg:mt-8">
              <Alert error={error} />
              <div className="grid gap-3 sm:gap-3.5">
                {SHORTCUTS.map((s, i) => (
                  <div
                    key={s.key}
                    className="motion-safe:animate-rise"
                    style={{ animationDelay: `${60 + i * 50}ms` }}
                  >
                    <AreaCard s={s} busy={busy} going={going} onClick={() => go(s)} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="rounded-2xl border bg-card p-5 text-card-foreground shadow-[0_14px_36px_-16px_rgba(15,35,80,0.4)] motion-safe:animate-rise sm:p-7 lg:mt-8"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e8edf4] text-[#334155] dark:bg-slate-500/20 dark:text-slate-200">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-[20px] font-extrabold tracking-tight">Administrador</h3>
                  <p className="text-[13.5px] text-muted-foreground">Escribe tu usuario y contraseña.</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="label">Usuario</span>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="field h-12 pl-10"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={keepSubmitVisible}
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="label">Contraseña</span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="field h-12 pl-10 pr-12"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={keepSubmitVisible}
                      autoComplete="current-password"
                      ref={passwordRef}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={showPassword}
                      className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {showPassword ? (
                        <EyeOff className="h-[18px] w-[18px]" />
                      ) : (
                        <Eye className="h-[18px] w-[18px]" />
                      )}
                    </button>
                  </div>
                </label>
                <Alert error={error} />
                <button
                  ref={submitRef}
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1565C0] text-[15.5px] font-bold text-white shadow-sm outline-none transition hover:bg-[#0f4f9a] focus-visible:ring-4 focus-visible:ring-[#1565C0]/35 disabled:opacity-70 motion-safe:active:scale-[.99]"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? 'Entrando…' : 'Entrar'}
                </button>
              </div>
              <button
                type="button"
                onClick={back}
                className="mx-auto mt-4 flex items-center gap-1.5 rounded-md px-2 py-1 text-[13.5px] font-semibold text-[#1565C0] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-blue-300"
              >
                <ArrowLeft className="h-4 w-4" /> Volver a las áreas
              </button>
            </form>
          )}

          <footer className="mt-auto pt-8 lg:mt-10">
            <div className="h-px bg-border" />
            <p className="pt-4 text-center text-[12.5px] text-muted-foreground">
              MI Technologies · Monterrey · VIOS Pallet
            </p>
            <p className="pt-1 text-center text-[11.5px] text-muted-foreground lg:hidden">
              © MI Technologies, Inc.{VERSION ? ` · v${VERSION}` : ''}
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
