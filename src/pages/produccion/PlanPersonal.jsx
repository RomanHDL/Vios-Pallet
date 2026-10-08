// Personal del turno (en Reportes): personas por linea, alimenta "Personal y productividad".
// El plan por linea ya no se captura aqui: la meta del dia se ajusta en Hora por Hora (2026-10-07).
import { shiftOf } from '@shared/shift.js'
import { ClipboardList, Lock, Save, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { useCatalogs, useSession } from '@/lib/session'
import { canDo, fmtInt, fmtShift } from '@/lib/utils'
import { BackLink, ShiftPicker } from './common'

const toStr = (v) => (v === null || v === undefined ? '' : String(v))
const digits = (v) => v.replace(/[^\d]/g, '').slice(0, 4)

export default function PlanPersonal() {
  const { user } = useSession()
  const { lines, loaded, all } = useCatalogs()
  const toast = useToast()
  const editable = canDo(user, ['supervisor'])

  const [sel, setSel] = useState(shiftOf)
  const query = { shiftDate: sel.shiftDate, shift: sel.shift }
  const staff = useApi('/staffing', { query })

  const original = useMemo(() => {
    if (!staff.data) return null
    const sBy = Object.fromEntries(staff.data.staffing.map((s) => [s.line, s.people]))
    return Object.fromEntries(lines.map((l) => [l.name, toStr(sBy[l.name])]))
  }, [staff.data, all])

  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (original) setForm(original)
  }, [original])

  const dirty = original && lines.some((l) => (form[l.name] ?? '') !== (original[l.name] ?? ''))
  const total = lines.reduce((a, l) => a + Number(form[l.name] || 0), 0)

  const save = async () => {
    setSaving(true)
    try {
      const body = {}
      for (const l of lines) {
        const v = form[l.name]
        if (v !== '' && v !== undefined) body[l.name] = Number(v)
        else if (original[l.name] !== '') body[l.name] = 0
      }
      await api('/staffing', { method: 'PUT', body: { ...query, lines: body } })
      toast('Personal guardado')
      await staff.reload(true)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const loading = !loaded || (staff.loading && !original)

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <PageHeader
        back={<BackLink to="/reportes">Reportes</BackLink>}
        title="Personal del turno"
        subtitle={fmtShift(sel.shiftDate, sel.shift)}
        actions={<ShiftPicker shiftDate={sel.shiftDate} shift={sel.shift} onChange={setSel} />}
      />

      {!editable && (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/50 px-4 py-3 text-[13.5px] font-medium text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" /> Solo lectura. Un supervisor captura el personal.
        </div>
      )}

      <ErrorBox error={staff.error} />

      {loading ? (
        <Spinner />
      ) : !lines.length ? (
        <Card>
          <Empty icon={ClipboardList} title="No hay líneas activas" />
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Personal total</span>
            <p className="tabular mt-1 text-[26px] font-extrabold leading-none">{fmtInt(total)}</p>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lines.map((l) => (
              <Card key={l.id} className="p-4">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-[15px] font-extrabold">
                    <Users className="h-4 w-4 text-muted-foreground" /> {l.name}
                  </span>
                  <input
                    className="field h-12 text-[18px] font-bold tabular"
                    inputMode="numeric"
                    placeholder="0"
                    value={form[l.name] ?? ''}
                    disabled={!editable}
                    onChange={(e) => setForm((f) => ({ ...f, [l.name]: digits(e.target.value) }))}
                    aria-label={`Personas en ${l.name}`}
                  />
                </label>
              </Card>
            ))}
          </div>

          {editable && (
            <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 border-t bg-card/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
              <div className="mx-auto flex max-w-7xl items-center justify-end gap-3">
                {dirty && <span className="text-[13px] font-semibold text-amber-700 dark:text-amber-300">Cambios sin guardar</span>}
                <Button size="lg" onClick={save} loading={saving} disabled={!dirty} className="w-full sm:w-auto">
                  <Save className="h-5 w-5" /> Guardar
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
