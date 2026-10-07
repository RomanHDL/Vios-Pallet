import { KeyRound, Pencil, Search, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardHeader, Dialog, Empty, ErrorBox, Field, Input, PageHeader, Select, Spinner, useToast } from '@/components/ui'
import { initials } from '@/components/Layout'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { cn, ROLE_LABEL } from '@/lib/utils'
import { BackLink } from '../reportes/common'
import { AdminOnly } from './AdminOnly'
import { Toggle } from './Toggle'

const ROLES = ['admin', 'supervisor', 'operador', 'calidad']
const ROLE_HELP = {
  admin: 'Todo, incluidos usuarios y catálogos.',
  supervisor: 'Plan y personal del turno, borrar registros, reabrir pallets y todo lo del operador y calidad.',
  operador: 'Escanear pallets (entrada y salida) y registrar producción.',
  calidad: 'Registrar rechazos por defecto y escanear pallets.',
}
const ROLE_TONE = { admin: 'violet', supervisor: 'blue', operador: 'gray', calidad: 'amber' }

function RoleField({ value, onChange, disabled }) {
  return (
    <Field label="Rol" hint={ROLE_HELP[value]}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </Select>
    </Field>
  )
}

function CreateDialog({ open, onClose, onSaved }) {
  const toast = useToast()
  const blank = { username: '', name: '', role: 'operador', password: '' }
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const close = () => {
    setF(blank)
    setError(null)
    onClose()
  }
  const save = async (e) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/users', { method: 'POST', body: f })
      toast(`Usuario ${f.username.trim().toLowerCase()} creado`)
      onSaved()
      close()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onClose={close}
      title="Nuevo usuario"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={save} loading={busy}>
            Crear usuario
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <Field label="Usuario" hint="Para iniciar sesión. Mínimo 3: letras, números, punto o guion.">
          <Input
            value={f.username}
            onChange={(e) => set('username')(e.target.value.toLowerCase().replace(/\s/g, ''))}
            autoCapitalize="none"
            autoComplete="off"
            placeholder="jperez"
            autoFocus
          />
        </Field>
        <Field label="Nombre completo">
          <Input value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="Juan Pérez" />
        </Field>
        <RoleField value={f.role} onChange={set('role')} />
        <Field label="Contraseña" hint="Mínimo 6 caracteres. Compártela con la persona; puede cambiarla en su perfil.">
          <Input type="text" value={f.password} onChange={(e) => set('password')(e.target.value)} autoComplete="new-password" />
        </Field>
        <ErrorBox error={error} />
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

function EditDialog({ user, isSelf, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState(() => ({ name: user.name, role: user.role, active: user.active, password: '' }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const save = async (e) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    const body = {}
    if (f.name.trim() !== user.name) body.name = f.name
    if (f.role !== user.role) body.role = f.role
    if (f.active !== user.active) body.active = f.active
    if (f.password) body.password = f.password
    try {
      if (Object.keys(body).length) await api(`/users/${user.id}`, { method: 'PATCH', body })
      toast(body.password ? 'Cambios y contraseña guardados' : 'Cambios guardados')
      onSaved()
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Editar · ${user.username}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={busy}>
            Guardar
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <Field label="Nombre completo">
          <Input value={f.name} onChange={(e) => set('name')(e.target.value)} />
        </Field>
        <RoleField value={f.role} onChange={set('role')} disabled={isSelf} />
        <div className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3">
          <div>
            <div className="text-[14px] font-semibold">Acceso activo</div>
            <div className="text-[12px] text-muted-foreground">
              {isSelf ? 'No puedes desactivar tu propia cuenta.' : 'Si lo apagas, ya no podrá iniciar sesión (su historial se conserva).'}
            </div>
          </div>
          <Toggle checked={f.active} onChange={set('active')} disabled={isSelf} label="Acceso activo" />
        </div>
        <Field label="Nueva contraseña" hint="Déjalo vacío para no cambiarla. Mínimo 6 caracteres.">
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="text" value={f.password} onChange={(e) => set('password')(e.target.value)} autoComplete="new-password" className="pl-10" placeholder="Restablecer contraseña" />
          </div>
        </Field>
        <ErrorBox error={error} />
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

function UsuariosInner() {
  const { user: me } = useSession()
  const { data, error, loading, reload } = useApi('/users')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (data?.users || [])
      .filter((u) => !s || u.name.toLowerCase().includes(s) || u.username.includes(s))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  }, [data, q])
  const activeCount = (data?.users || []).filter((u) => u.active).length

  return (
    <>
      <PageHeader
        back={<BackLink to="/admin" label="Administración" />}
        title="Usuarios"
        subtitle={data ? `${activeCount} activos de ${data.users.length}` : 'Cuentas y roles'}
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus className="h-[18px] w-[18px]" /> Nuevo usuario
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0">
          <div className="border-b p-3 sm:p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o usuario" className="pl-10" />
            </div>
          </div>
          <ErrorBox error={error} className="m-4" />
          {loading && !data ? (
            <Spinner />
          ) : list.length ? (
            <ul className="divide-y">
              {list.map((u) => (
                <li key={u.id} className={cn('flex items-center gap-3 px-4 py-3 sm:px-5', !u.active && 'opacity-60')}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-foreground">
                    {initials(u.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-[14.5px] font-semibold">{u.name}</span>
                      {u.id === me?.id && <Badge tone="blue">Tú</Badge>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                      <span className="font-mono">@{u.username}</span>
                      <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role] || u.role}</Badge>
                      {!u.active && <Badge tone="red">Inactivo</Badge>}
                    </span>
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setEditing(u)} aria-label={`Editar ${u.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={Users} title={q ? 'Nadie coincide con la búsqueda' : 'Sin usuarios'} />
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Roles" subtitle="Qué puede hacer cada uno" />
          <ul className="divide-y">
            {ROLES.map((r) => (
              <li key={r} className="px-4 py-3 sm:px-5">
                <Badge tone={ROLE_TONE[r]}>{ROLE_LABEL[r]}</Badge>
                <p className="mt-1.5 text-[13px] text-muted-foreground">{ROLE_HELP[r]}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <CreateDialog open={creating} onClose={() => setCreating(false)} onSaved={() => reload(true)} />
      {editing && (
        <EditDialog
          key={editing.id}
          user={editing}
          isSelf={editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={() => reload(true)}
        />
      )}
    </>
  )
}

export default function Usuarios() {
  return (
    <div>
      <AdminOnly>
        <UsuariosInner />
      </AdminOnly>
    </div>
  )
}
