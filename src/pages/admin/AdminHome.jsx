// Administracion (rediseno 2026-10-10, imagen de referencia de Roman). Solo admin (AdminOnly + API).
// Datos reales: GET /users (cuentas, rol, activo, fecha de alta), GET /catalogs (lineas, modelos, marcas, defectos con
// su estado) y GET /admin/last-change (ultimo cambio con fecha registrada). No existe bitacora de auditoria: la
// lista "Usuarios recientes" son las altas (fecha de creacion), no inicios de sesion ni cambios de rol.
import {
  BookOpen,
  Boxes,
  ChevronRight,
  Database,
  ExternalLink,
  FileText,
  Home,
  Lightbulb,
  Package,
  Settings,
  ShieldCheck,
  Tag,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '@/lib/hooks'
import { cn, fmtAgo, fmtInt, ROLE_LABEL } from '@/lib/utils'
import { Donut, Sparkline } from '../reportes/personal/charts'
import { AdminOnly } from './AdminOnly'

const ROLES = ['admin', 'supervisor', 'operador', 'calidad']
const CATALOGS = [
  {
    key: 'lines',
    label: 'Líneas',
    hint: 'Configuración y meta',
    color: '#3b82f6',
    bar: 'bg-blue-500',
    icon: Boxes,
    tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  },
  {
    key: 'models',
    label: 'Modelos',
    hint: 'Gestión de modelos',
    color: '#8b5cf6',
    bar: 'bg-violet-500',
    icon: Package,
    tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  },
  {
    key: 'brands',
    label: 'Marcas',
    hint: 'Marcas de producción',
    color: '#10b981',
    bar: 'bg-emerald-500',
    icon: Tag,
    tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  {
    key: 'defects',
    label: 'Defectos',
    hint: 'Tipos de defectos',
    color: '#f59e0b',
    bar: 'bg-amber-500',
    icon: TriangleAlert,
    tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  },
]
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDate = (iso) => {
  const d = new Date(iso)
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Monterrey',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  )
  return { day: `${p.day} ${MON[Number(p.month) - 1]} ${p.year}`, time: `${p.hour}:${p.minute} hrs` }
}
const monthKey = (iso) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' }).slice(0, 7)
const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

function Card({ className, children }) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-2xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.14)]',
        className,
      )}
    >
      {children}
    </section>
  )
}

function Kpi({ icon: Icon, tone, label, value, sub, foot, spark, color, id }) {
  return (
    <Card className="flex min-w-0 flex-col p-4">
      <div className="flex items-start gap-3.5">
        <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl', tone)}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="tabular truncate text-[28px] font-extrabold leading-tight tracking-tight">{value}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">{sub}</p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0 text-[12px] text-muted-foreground">{foot}</div>
        <Sparkline values={spark} color={color} id={id} className="h-10 w-[104px] shrink-0" />
      </div>
    </Card>
  )
}

function Quick({ to, icon: Icon, tone, title, hint, disabled }) {
  const body = (
    <>
      <span className={cn('grid h-11 w-11 place-items-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="mt-2 block text-[13.5px] font-bold">{title}</span>
      <span className="block text-[11.5px] text-muted-foreground">{hint}</span>
    </>
  )
  const cls = 'flex min-w-0 flex-col items-center rounded-xl border bg-muted/30 px-2 py-3.5 text-center'
  if (disabled)
    return (
      <div className={cn(cls, 'cursor-not-allowed opacity-60')} title={hint} aria-disabled="true">
        {body}
      </div>
    )
  return (
    <Link
      to={to}
      className={cn(
        cls,
        'outline-none transition hover:-translate-y-0.5 hover:bg-card hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40',
      )}
    >
      {body}
    </Link>
  )
}

function PanelHead({ icon: Icon, tone, grad, title, subtitle, to, cta }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3.5 rounded-t-2xl border-b px-5 py-4', grad)}>
      <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', tone)}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">{title}</h2>
        <p className="text-[13px] text-muted-foreground">{subtitle}</p>
      </div>
      <Link
        to={to}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-card/80 px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-card"
      >
        {cta} <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

// Ilustracion tenue: almacen isometrico con pallets y montacargas.
function HeaderArt() {
  return (
    <svg
      viewBox="0 0 460 130"
      aria-hidden="true"
      className="pointer-events-none absolute -top-2 right-0 hidden h-[130px] w-[460px] text-blue-500 opacity-[.14] lg:block dark:opacity-[.09]"
    >
      <g fill="currentColor">
        <path d="M200 40l130-34 120 30v80l-120 14-130-20z" opacity=".35" />
        <path d="M200 40l130 20v80l-130-20z" opacity=".25" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${222 + i * 34} ${62 + i * 5}l24 4v52l-24-4z`} opacity=".45" />
        ))}
        {[
          [120, 96],
          [150, 82],
          [90, 82],
          [120, 68],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <path d={`M${x} ${y}l16-8 16 8-16 8z`} opacity=".75" />
            <path d={`M${x} ${y}v14l16 8v-14z`} opacity=".55" />
            <path d={`M${x + 32} ${y}v14l-16 8v-14z`} opacity=".65" />
          </g>
        ))}
        {/* montacargas */}
        <rect x="372" y="88" width="34" height="22" rx="3" opacity=".7" />
        <path d="M380 88v-22h18l8 22" fill="none" stroke="currentColor" strokeWidth="3" opacity=".7" />
        <path d="M410 70v44M410 112h18" stroke="currentColor" strokeWidth="3" opacity=".7" />
        <circle cx="380" cy="114" r="6" opacity=".8" />
        <circle cx="400" cy="114" r="6" opacity=".8" />
        <path d="M60 30l8-4 8 4-8 4zM40 50l10-5 10 5-10 5z" opacity=".5" />
      </g>
    </svg>
  )
}

function AdminInner() {
  const usersQ = useApi('/users')
  const catQ = useApi('/catalogs')
  const lastQ = useApi('/admin/last-change')
  const [catView, setCatView] = useState('all')

  const users = usersQ.data?.users || []
  const active = users.filter((u) => u.active).length
  const thisMonth = monthKey(new Date().toISOString())
  const newThisMonth = users.filter((u) => u.createdAt && monthKey(u.createdAt) === thisMonth).length
  // Minigrafica: usuarios registrados al cierre de cada uno de los ultimos 6 meses (por fecha de alta).
  const userSpark = useMemo(() => {
    if (!users.length) return []
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1))
      return d.toISOString().slice(0, 7)
    })
    const series = months.map((m) => users.filter((u) => u.createdAt && monthKey(u.createdAt) <= m).length)
    return new Set(series).size > 1 ? series : []
  }, [users])
  const recent = useMemo(
    () =>
      [...users]
        .filter((u) => u.createdAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
    [users],
  )
  const rolesInUse = ROLES.filter((r) => users.some((u) => u.active && u.role === r)).length

  const cat = CATALOGS.map((c) => {
    const list = catQ.data?.[c.key] || []
    return { ...c, total: list.length, active: list.filter((x) => x.active).length }
  })
  const catActive = cat.reduce((a, c) => a + c.active, 0)
  const catAll = cat.reduce((a, c) => a + c.total, 0)
  const sel = cat.find((c) => c.key === catView)
  const parts = sel
    ? [
        { key: 'act', label: 'Activos', value: sel.active, color: sel.color, bar: sel.bar },
        {
          key: 'inact',
          label: 'Inactivos',
          value: sel.total - sel.active,
          color: '#94a3b8',
          bar: 'bg-slate-400',
        },
      ]
    : cat.map((c) => ({ key: c.key, label: c.label, value: c.active, color: c.color, bar: c.bar }))
  const partsTotal = parts.reduce((a, x) => a + x.value, 0)

  const last = lastQ.data?.last
  const lastFmt = last ? fmtDate(last.at) : null

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="relative min-h-[104px]">
        <HeaderArt />
        <nav
          aria-label="Ruta"
          className="relative flex items-center gap-1.5 text-[13px] text-muted-foreground"
        >
          <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="h-4 w-4" /> <span className="sr-only">Inicio</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">Administración</span>
        </nav>
        <h1 className="relative mt-1 text-[32px] font-extrabold leading-tight tracking-tight sm:text-[38px]">
          Administración
        </h1>
        <p className="relative text-[15px] text-muted-foreground">Usuarios y catálogos de la planta</p>
      </div>

      {/* Indicadores */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Users}
          tone="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
          label="Usuarios activos"
          value={usersQ.data ? fmtInt(active) : '…'}
          sub={usersQ.data ? `de ${fmtInt(users.length)} registrados` : ' '}
          foot={
            newThisMonth ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                +{newThisMonth} alta{newThisMonth === 1 ? '' : 's'} este mes
              </span>
            ) : (
              'Sin altas este mes'
            )
          }
          spark={userSpark}
          color="#2563eb"
          id="ad-u"
        />
        <Kpi
          icon={Database}
          tone="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
          label="Elementos de catálogo"
          value={catQ.data ? fmtInt(catActive) : '…'}
          sub="Activos en líneas, modelos, marcas y defectos"
          foot={catQ.data ? `${fmtInt(catAll)} en total con inactivos · 4 catálogos` : ' '}
        />
        <Kpi
          icon={ShieldCheck}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
          label="Roles configurados"
          value={fmtInt(ROLES.length)}
          sub="Perfiles de acceso"
          foot={usersQ.data ? `${rolesInUse} con usuarios activos` : ' '}
        />
        <Kpi
          icon={Settings}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
          label="Último cambio registrado"
          value={lastQ.data ? (lastFmt ? lastFmt.day : 'Sin datos') : '…'}
          sub={lastFmt ? lastFmt.time : 'Sin cambios con fecha'}
          foot={last ? `${last.what}${last.detail ? ` · ${last.detail}` : ''}` : ' '}
        />
      </div>

      {/* Paneles */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="flex flex-col">
          <PanelHead
            icon={Users}
            tone="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
            grad="bg-gradient-to-r from-blue-50/80 to-transparent dark:from-blue-500/10"
            title="Usuarios"
            subtitle="Gestiona usuarios, roles, contraseñas y accesos al sistema."
            to="/admin/usuarios"
            cta="Ir a usuarios"
          />
          <div className="flex flex-1 flex-col p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Quick
                to="/admin/usuarios"
                icon={Users}
                tone="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
                title="Ver usuarios"
                hint="Lista y búsqueda"
              />
              <Quick
                to="/admin/usuarios?nuevo=1"
                icon={UserPlus}
                tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                title="Nuevo usuario"
                hint="Alta de usuarios"
              />
              <Quick
                to="/admin/usuarios"
                icon={ShieldCheck}
                tone="bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300"
                title="Roles y permisos"
                hint="Asignar rol a cada usuario"
              />
              <Quick
                disabled
                icon={FileText}
                tone="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
                title="Bitácora"
                hint="No disponible: el sistema no guarda historial de cambios"
              />
            </div>
            <div className="mt-5 flex items-start gap-3 border-t pt-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-extrabold">Usuarios recientes</h3>
                <p className="text-[12.5px] text-muted-foreground">Últimas altas registradas</p>
              </div>
              <Link
                to="/admin/usuarios"
                className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-[12.5px] font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300"
              >
                Ver todos
              </Link>
            </div>
            {recent.length ? (
              <ul className="mt-2 divide-y">
                {recent.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-[12.5px] font-extrabold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      {initials(u.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold">{u.name}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {u.username === 'planta'
                          ? 'Cuenta compartida de las áreas'
                          : ROLE_LABEL[u.role] || u.role}
                        {u.active ? '' : ' · inactivo'}
                      </span>
                    </span>
                    <span className="hidden shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-emerald-700 sm:inline dark:bg-emerald-500/15 dark:text-emerald-300">
                      Alta de usuario
                    </span>
                    <span className="w-24 shrink-0 text-right text-[12px] text-muted-foreground">
                      {fmtAgo(u.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed p-5 text-center text-[13px] text-muted-foreground">
                {usersQ.loading ? 'Cargando…' : 'Sin usuarios registrados'}
              </p>
            )}
            <p className="mt-auto pt-3 text-[11.5px] text-muted-foreground">
              Sin bitácora: no se registran inicios de sesión, cambios de rol ni restablecimientos de
              contraseña.
            </p>
          </div>
        </Card>

        <Card className="flex flex-col">
          <PanelHead
            icon={Database}
            tone="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300"
            grad="bg-gradient-to-r from-violet-50/80 to-transparent dark:from-violet-500/10"
            title="Catálogos"
            subtitle="Administra líneas, modelos, marcas y defectos de la planta."
            to="/admin/catalogos"
            cta="Ir a catálogos"
          />
          <div className="flex flex-1 flex-col p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {CATALOGS.map((c) => (
                <Quick
                  key={c.key}
                  to={`/admin/catalogos?tipo=${c.key}`}
                  icon={c.icon}
                  tone={c.tone}
                  title={c.label}
                  hint={c.hint}
                />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-start gap-3 border-t pt-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-extrabold">Uso de catálogos</h3>
                <p className="text-[12.5px] text-muted-foreground">
                  {sel ? `${sel.label}: activos e inactivos` : 'Distribución de elementos activos'}
                </p>
              </div>
              <select
                value={catView}
                onChange={(e) => setCatView(e.target.value)}
                aria-label="Catálogo"
                className="h-9 shrink-0 appearance-none rounded-xl border bg-card bg-[length:14px] bg-[position:right_10px_center] bg-no-repeat pl-3 pr-8 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                }}
              >
                <option value="all">Todos los catálogos</option>
                {CATALOGS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {catQ.data ? (
              <div className="mt-4 flex flex-1 flex-col items-center gap-6 sm:flex-row">
                <Donut
                  parts={parts.map((x) => ({
                    key: x.key,
                    value: x.value,
                    color: x.color,
                    title: `${x.label}: ${x.value}`,
                  }))}
                  total={partsTotal}
                  unit={sel ? `elementos de ${sel.label.toLowerCase()}` : 'elementos activos'}
                  size={176}
                />
                <ul className="w-full min-w-0 flex-1 space-y-3.5">
                  {parts.map((x) => {
                    const pct = partsTotal ? x.value / partsTotal : 0
                    return (
                      <li
                        key={x.key}
                        className="flex items-center gap-3 text-[13.5px]"
                        title={`${x.label}: ${x.value} (${(pct * 100).toFixed(1)}%)`}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.color }} />
                        <span className="w-20 shrink-0 font-semibold">{x.label}</span>
                        <span className="tabular w-8 shrink-0 text-right font-extrabold">
                          {fmtInt(x.value)}
                        </span>
                        <span className="tabular w-12 shrink-0 text-right text-muted-foreground">
                          {Math.round(pct * 100)}%
                        </span>
                        <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn('block h-full rounded-full transition-all duration-500', x.bar)}
                            style={{ width: `${pct * 100}%` }}
                          />
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed p-5 text-center text-[13px] text-muted-foreground">
                {catQ.error ? 'No se pudieron cargar los catálogos' : 'Cargando…'}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Ayuda */}
      <Card className="flex flex-wrap items-center gap-4 bg-emerald-50/50 p-4 sm:px-5 dark:bg-emerald-500/[0.06]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
          <Lightbulb className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-extrabold">Ayuda y soporte</h3>
          <p className="text-[13px] text-muted-foreground">
            ¿Necesitas ayuda para administrar usuarios o catálogos? Consulta la documentación o contacta al
            administrador del sistema.
          </p>
        </div>
        <Link
          to="/ayuda/manual"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border-2 border-emerald-500/60 bg-card px-4 text-[13.5px] font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          <BookOpen className="h-4 w-4" /> Ver documentación <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </Card>
    </div>
  )
}

export default function AdminHome() {
  return (
    <AdminOnly>
      <AdminInner />
    </AdminOnly>
  )
}
