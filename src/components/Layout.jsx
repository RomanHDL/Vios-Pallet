// PC: menu lateral fijo. Celular: barra superior + navegacion inferior (pulgar).
import {
  BarChart3,
  ClipboardCheck,
  Factory,
  CircleHelp,
  Home,
  LogOut,
  Moon,
  Package,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { shiftLabel, shiftOf } from '@shared/shift.js'
import { useSession } from '@/lib/session'
import { cn, fmtYmd, ROLE_LABEL } from '@/lib/utils'

export const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/pallets', label: 'Pallets', icon: Package },
  { to: '/produccion', label: 'Producción', icon: Factory },
  { to: '/calidad', label: 'Calidad', icon: ClipboardCheck },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
]

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('vp:theme') === 'dark'
    } catch {
      return false
    }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('vp:theme', dark ? 'dark' : 'light')
    } catch {
      /* sin storage */
    }
  }, [dark])
  return [dark, setDark]
}

function ShiftChip({ className }) {
  const [s, setS] = useState(shiftOf())
  useEffect(() => {
    const id = setInterval(() => setS(shiftOf()), 30000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {shiftLabel(s.shift)} · {fmtYmd(s.shiftDate)}
    </span>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl" />
      <div className="leading-tight">
        <div className="text-[16px] font-extrabold tracking-tight text-white">VIOS Pallet</div>
        <div className="text-[11px] font-medium text-white/60">MI Technologies · MTY</div>
      </div>
    </div>
  )
}

export function Layout() {
  const { user, logout } = useSession()
  const [dark, setDark] = useTheme()
  const { pathname } = useLocation()
  const isAdmin = user?.role === 'admin'
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const sideLink = ({ isActive }) =>
    cn(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition',
      isActive ? 'bg-white text-navy shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white',
    )

  return (
    <div className="min-h-dvh">
      {/* PC */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy px-4 py-5 lg:flex">
        <Logo />
        <ShiftChip className="mt-4 self-start text-white/85" />
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={sideLink}>
              <n.icon className="h-[18px] w-[18px]" />
              {n.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin" className={sideLink}>
              <Settings className="h-[18px] w-[18px]" />
              Administración
            </NavLink>
          )}
          <NavLink to="/ayuda" className={sideLink}>
            <CircleHelp className="h-[18px] w-[18px]" />
            Ayuda
          </NavLink>
        </nav>
        <div className="mt-auto space-y-2">
          <button type="button" onClick={() => setDark((d) => !d)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/75 hover:bg-white/10 hover:text-white">
            {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            {dark ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
            <NavLink to="/perfil" className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[13px] font-bold text-navy">
                {initials(user?.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-white">{user?.name}</span>
                <span className="block text-[11.5px] text-white/60">{ROLE_LABEL[user?.role]}</span>
              </span>
            </NavLink>
            <button type="button" onClick={logout} className="grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" aria-label="Salir">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Celular: barra superior */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 bg-navy px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <NavLink to="/ayuda" className="grid h-10 w-10 place-items-center rounded-xl text-white/80 hover:bg-white/10" aria-label="Ayuda">
            <CircleHelp className="h-5 w-5" />
          </NavLink>
          <button type="button" onClick={() => setDark((d) => !d)} className="grid h-10 w-10 place-items-center rounded-xl text-white/80 hover:bg-white/10" aria-label="Cambiar tema">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <NavLink to={isAdmin ? '/admin' : '/perfil'} className="grid h-10 w-10 place-items-center rounded-xl text-white/80 hover:bg-white/10" aria-label="Cuenta">
            {isAdmin ? <Settings className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
          </NavLink>
        </div>
      </header>

      <main className="px-4 pb-28 pt-5 sm:px-6 lg:ml-64 lg:px-8 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Celular: navegacion inferior */}
      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 backdrop-blur lg:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('grid h-8 w-12 place-items-center rounded-full transition', isActive && 'bg-accent')}>
                  <n.icon className="h-5 w-5" />
                </span>
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}
