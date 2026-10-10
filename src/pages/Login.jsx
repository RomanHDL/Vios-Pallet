import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BarChart3,
  ChevronLeft,
  Factory,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ErrorBox } from '@/components/ui'
import { useSession } from '@/lib/session'

// Entrada (2026-10-07, a peticion explicita del usuario: "que nomas le des clic en entrar y de volada"):
// boton "Entrar" con la cuenta compartida Planta. Despues ("quiero que quites el login... que solo sea un
// boton de entrar y ya"): la pantalla es solo el boton; el formulario del administrador se abre con /?admin.
// 2026-10-08: 4 accesos, sin boton "Entrar" general. Entrada / Salida / Produccion por linea entran con Planta
// limitada a su area (shared/areas.js); Admin pide la contrasena del administrador y ve todo.
// 2026-10-10: rediseno "Centro de operaciones" (imagen de referencia de Roman, laptop + celular). Solo visual: la
// logica de los 4 accesos y del formulario de admin es la misma. La foto de pallets es un recorte de esa imagen.
const ADMIN_FORM = new URLSearchParams(window.location.search).has('admin')

const SHORTCUTS = [
  {
    key: 'entrada',
    title: 'Entrada',
    hint: 'Registrar pallets recibidos',
    to: '/pallets/entrada',
    icon: ArrowDownToLine,
    tile: 'bg-[#e3edff] text-[#2563eb]',
    arrow: 'bg-[#e3edff] text-[#2563eb]',
    ring: 'hover:border-[#2563eb]/35 focus-visible:ring-[#2563eb]/40',
  },
  {
    key: 'salida',
    title: 'Salida',
    hint: 'Confirmar pallets despachados',
    to: '/pallets/salida',
    icon: ArrowUpFromLine,
    tile: 'bg-[#efe8ff] text-[#7c3aed]',
    arrow: 'bg-[#efe8ff] text-[#7c3aed]',
    ring: 'hover:border-[#7c3aed]/35 focus-visible:ring-[#7c3aed]/40',
  },
  {
    key: 'lineas',
    title: 'Producción por línea',
    hint: 'Escanear TV y caja',
    to: '/pallets/lineas',
    icon: Factory,
    tile: 'bg-[#d6f6f0] text-[#0d9488]',
    arrow: 'bg-[#d6f6f0] text-[#0d9488]',
    ring: 'hover:border-[#14b8a6]/40 focus-visible:ring-[#14b8a6]/40',
  },
  {
    key: 'admin',
    title: 'Admin',
    hint: 'Panel administrativo',
    icon: ShieldCheck,
    tile: 'bg-[#e8edf4] text-[#334155]',
    arrow: 'bg-[#e8edf4] text-[#334155]',
    ring: 'hover:border-[#475569]/35 focus-visible:ring-[#475569]/40',
  },
]

const FEATURES = [
  { icon: BarChart3, text: ['Proceso', 'confiable'] },
  { icon: ShieldCheck, text: ['Información', 'en tiempo real'] },
  { icon: Users, text: ['Operación', 'más eficiente'] },
]

function Logo({ className = 'h-10 w-10' }) {
  return <img src="/favicon.svg" alt="" className={`${className} rounded-xl`} />
}

function AreaCard({ s, index, busy, going, onClick }) {
  const Icon = s.icon
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{ animationDelay: `${120 + index * 60}ms` }}
      className={`group flex w-full items-center gap-3 rounded-[20px] border border-white bg-white px-3.5 py-4 min-[380px]:gap-4 min-[380px]:px-4 text-left shadow-[0_10px_30px_-12px_rgba(15,35,80,0.28)] outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-14px_rgba(15,35,80,0.35)] focus-visible:ring-4 disabled:opacity-60 motion-safe:animate-rise motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:gap-5 sm:rounded-[22px] sm:px-6 sm:py-6 lg:py-7 ${s.ring}`}
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl min-[380px]:h-14 min-[380px]:w-14 sm:h-[68px] sm:w-[68px] sm:rounded-[18px] ${s.tile}`}
      >
        <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-extrabold leading-tight min-[380px]:text-[17px] tracking-tight text-[#0f1f3d] sm:text-[21px]">
          {s.title}
        </span>
        <span className="mt-1 block text-[12.5px] leading-snug text-slate-500 min-[380px]:text-[13px] sm:text-[15.5px]">
          {going === s.key ? 'Entrando…' : s.hint}
        </span>
      </span>
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-transform min-[380px]:h-10 min-[380px]:w-10 duration-200 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0 sm:h-12 sm:w-12 ${s.arrow}`}
      >
        <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
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
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const passwordRef = useRef(null)
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

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#eef3fa] text-[#0f1f3d]">
      {/* Fondo claro inferior con curvas azuladas */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] w-full"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
      >
        <path d="M0 220 C 360 120, 760 330, 1440 160 L1440 400 L0 400 Z" fill="#e3ebf7" />
        <path d="M0 300 C 420 220, 900 380, 1440 260 L1440 400 L0 400 Z" fill="#dae4f3" opacity=".7" />
      </svg>

      {/* HERO */}
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0a1a3f_0%,#0d2659_45%,#123a7c_100%)] pb-28 text-white sm:pb-36 lg:pb-44">
        {/* Foto de pallets: derecha, fundida con el azul */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[78%] sm:w-[62%] lg:w-[52%]">
          <img
            src="/img/pallets-hero.webp"
            alt=""
            decoding="async"
            className="h-full w-full object-cover object-[70%_center] opacity-[0.55] [mask-image:linear-gradient(to_right,transparent_0%,black_38%,black_100%),linear-gradient(to_bottom,black_70%,transparent_100%)] [mask-composite:intersect] sm:opacity-80 lg:opacity-95"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#0d2659_0%,rgba(13,38,89,0.55)_30%,rgba(18,58,124,0.12)_70%,rgba(14,165,233,0.10)_100%)]" />
        </div>

        {/* Arcos cian translucidos */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-[150%] w-[85%] sm:w-[70%] lg:-right-10 lg:w-[62%]"
          viewBox="0 0 800 800"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="arcA" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset=".45" stopColor="#38bdf8" stopOpacity=".9" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="arcB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3b82f6" stopOpacity=".35" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M760 40 C 380 60, 160 300, 260 760" stroke="url(#arcA)" strokeWidth="5" />
          <path
            d="M800 0 C 360 30, 90 310, 220 800 L 120 800 C -10 330, 300 10, 800 -40 Z"
            fill="url(#arcB)"
          />
        </svg>
        <div className="pointer-events-none absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full bg-[#1d4ed8]/20 blur-3xl" />

        <div className="relative mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-12">
          {/* Encabezado */}
          <header className="flex items-center justify-between gap-3 pt-5 sm:pt-8">
            <div className="flex items-center gap-3">
              <Logo className="h-10 w-10 sm:h-11 sm:w-11" />
              <div>
                <p className="text-[19px] font-extrabold leading-tight sm:text-[22px]">VIOS Pallet</p>
                <p className="text-[12px] text-white/70 sm:hidden">MI Technologies · MTY</p>
              </div>
            </div>
            <p className="hidden text-[14px] text-white/80 sm:block">MI Technologies · Monterrey</p>
          </header>

          {/* Titulo */}
          <div className="pt-8 motion-safe:animate-rise sm:pt-14 lg:pt-16">
            <h1 className="sm:hidden text-[34px] font-extrabold leading-tight tracking-tight">
              ¡Bienvenido!
            </h1>
            <h1 className="hidden text-[56px] font-extrabold leading-[0.98] tracking-[-0.03em] sm:block lg:text-[84px]">
              Centro de
              <br />
              <span className="bg-[linear-gradient(90deg,#60a5fa_0%,#38bdf8_45%,#2dd4bf_100%)] bg-clip-text text-transparent">
                operaciones
              </span>
            </h1>
            <p className="mt-2 text-[15px] leading-snug text-white/85 sm:mt-4 sm:max-w-none sm:text-[19px] lg:text-[22px]">
              Selecciona tu área de trabajo <br className="sm:hidden" />
              para continuar<span className="sm:hidden">.</span>
            </p>

            {/* Indicadores decorativos */}
            <ul className="mt-7 hidden flex-wrap items-center gap-y-3 md:flex">
              {FEATURES.map((f, i) => {
                const Icon = f.icon
                return (
                  <li
                    key={f.text[0]}
                    className={`flex items-center gap-3 pr-6 ${i > 0 ? 'border-l border-white/15 pl-6' : ''}`}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-[#7dd3fc] ring-1 ring-white/10">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[13.5px] leading-tight text-white/85">
                      {f.text[0]}
                      <br />
                      {f.text[1]}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Curva inferior: transicion al fondo claro */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full sm:h-24"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
        >
          <path d="M0 70 C 380 130, 980 10, 1440 60 L1440 120 L0 120 Z" fill="#eef3fa" />
        </svg>
      </section>

      {/* TARJETAS (se enciman con el hero) */}
      <main className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col -mt-20 px-4 sm:-mt-28 sm:px-8 lg:-mt-36 lg:px-12">
        {!withUser ? (
          <>
            <div className="grid gap-3.5 sm:gap-4 lg:grid-cols-2 lg:gap-5">
              {SHORTCUTS.map((s, i) => (
                <AreaCard key={s.key} s={s} index={i} busy={busy} going={going} onClick={() => go(s)} />
              ))}
            </div>
            <ErrorBox error={error} className="mt-4" />
          </>
        ) : (
          <form
            onSubmit={submit}
            className="mx-auto max-w-md rounded-[22px] bg-white p-6 shadow-[0_18px_40px_-14px_rgba(15,35,80,0.35)] motion-safe:animate-rise sm:p-8"
          >
            <button
              type="button"
              onClick={() => {
                setWithUser(false)
                setError(null)
              }}
              className="mb-4 inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-slate-500 outline-none hover:text-[#0f1f3d] focus-visible:ring-2 focus-visible:ring-[#475569]/40"
            >
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e8edf4] text-[#334155]">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-[22px] font-extrabold tracking-tight">Administrador</h2>
                <p className="text-[13.5px] text-slate-500">Escribe la contraseña del administrador.</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <input
                type="hidden"
                value={username}
                autoComplete="username"
                readOnly
                onChange={(e) => setUsername(e.target.value)}
              />
              <label className="block">
                <span className="label">Contraseña</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="field h-12 pl-10"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    ref={passwordRef}
                    required
                  />
                </div>
              </label>
              <ErrorBox error={error} />
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                Entrar
              </Button>
            </div>
          </form>
        )}

        {/* Pie */}
        <footer className="relative mt-auto flex items-center justify-center gap-4 pb-6 pt-8 text-[12.5px] text-slate-500 sm:pt-10 sm:justify-between sm:pb-8 sm:text-[13px]">
          <span>MI Technologies · Monterrey</span>
          <span className="hidden h-px flex-1 bg-slate-300/70 sm:block" />
          <span className="hidden items-center gap-2 font-semibold text-[#0f1f3d] sm:flex">
            <Logo className="h-5 w-5 rounded-md" /> VIOS Pallet
          </span>
        </footer>
      </main>
    </div>
  )
}
