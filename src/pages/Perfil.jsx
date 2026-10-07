import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { initials } from '@/components/Layout'
import { Button, Card, CardHeader, ErrorBox, Field, Input, PageHeader, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { ROLE_LABEL } from '@/lib/utils'

export default function Perfil() {
  const { user, logout } = useSession()
  const toast = useToast()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    setError(null)
    if (form.next !== form.confirm) return setError(new Error('Las contraseñas nuevas no coinciden.'))
    setBusy(true)
    try {
      await api('/auth/password', { method: 'POST', body: { current: form.current, next: form.next } })
      setForm({ current: '', next: '', confirm: '' })
      toast('Contraseña actualizada')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Mi cuenta" />
      <Card className="mb-5 flex items-center gap-4 p-5">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-[18px] font-bold text-primary-foreground">{initials(user.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold">{user.name}</p>
          <p className="text-[13.5px] text-muted-foreground">
            @{user.username} · {ROLE_LABEL[user.role]}
          </p>
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut className="h-4 w-4" /> Salir
        </Button>
      </Card>
      <Card>
        <CardHeader title="Cambiar contraseña" />
        <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Contraseña actual" className="sm:col-span-2">
            <Input type="password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} required autoComplete="current-password" />
          </Field>
          <Field label="Nueva contraseña" hint="Mínimo 6 caracteres">
            <Input type="password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} required autoComplete="new-password" />
          </Field>
          <Field label="Confirmar nueva">
            <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" />
          </Field>
          <ErrorBox error={error} className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy}>Guardar</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
