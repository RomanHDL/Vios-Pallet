import { ClipboardList, Lock, Save, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { shiftOf } from '@shared/shift.js'
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Spinner, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useApi } from '@/lib/hooks'
import { useCatalogs, useSession } from '@/lib/session'
import { canDo, cn, fmtInt, fmtShift } from '@/lib/utils'
import { BackLink, ShiftPicker } from './common'

const toStr = (v) => (v === null || v === undefined ? '' : String(v))
const digits = (v) => v.replace(/[^\d]/g, '').slice(0, 5)

export default function PlanPersonal() {
  const { user } = useSession()
  const { lines, loaded, all } = useCatalogs()
  const toast = useToast()
  const editable = canDo(user, ['supervisor'])

  const [sel, setSel] = useState(shiftOf)
  const query = { shiftDate: sel.shiftDate, shift: sel.shift }
  const plans = useApi('/plans', { query })
  const staff = useApi('/staffing', { query })

  const original = useMemo(() => {
    if (!plans.data || !staff.data) return null
    const pBy = Object.fromEntries(plans.data.plans.map((p) => [p.line, p.planned]))
    const sBy = Object.fromEntries(staff.data.staffing.map((s) => [s.line, s.people]))
    return Object.fromEntries(lines.map((l) => [l.name, { plan: toStr(pBy[l.name]), people: toStr(sBy[l.name]) }]))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lines` se recrea en cada render; `all` es estable
  }, [plans.data, staff.data, all])

  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (original) setForm(original)
  }, [original])

  const dirty = original && lines.some((l) => form[l.name]?.plan !== original[l.name]?.plan || form[l.name]?.people !== original[l.name]?.people)
  const setVal = (line, k, v) => setForm((f) => ({ ...f, [line]: { ...f[line], [k]: digits(v) } }))

  const totals = lines.reduce(
    (a, l) => {
      const row = form[l.name] || {}
      a.goal += row.plan !== '' && row.plan !== undefined ? Number(row.plan) : l.goal
      a.people += Number(row.people || 0)
      return a
    },
    { goal: 0, people: 0 },
  )

  const save = async () => {
    setSaving(true)
    try {
      const planBody = {}
      const staffBody = {}
      for (const l of lines) {
        const row = form[l.name] || {}
        planBody[l.name] = row.plan === '' || row.plan === undefined ? null : Number(row.plan)
        if (row.people !== '' && row.people !== undefined) staffBody[l.name] = Number(row.people)
        else if (original[l.name]?.people !== '') staffBody[l.name] = 0
      }
      await api('/plans', { method: 'PUT', body: { ...query, lines: planBody } })
      await api('/staffing', { method: 'PUT', body: { ...query, lines: staffBody } })
      toast('Plan y personal guardados')
      await Promise.all([plans.reload(true), staff.reload(true)])
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const loading = !loaded || ((plans.loading || staff.loading) && !original)

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <PageHeader
        back={<BackLink to="/produccion">Producción</BackLink>}
        title="Plan y personal del turno"
        subtitle={fmtShift(sel.shiftDate, sel.shift)}
        actions={<ShiftPicker shiftDate={sel.shiftDate} shift={sel.shift} onChange={setSel} />}
      />

      {!editable && (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/50 px-4 py-3 text-[13.5px] font-medium text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" /> Solo lectura. Un supervisor captura el plan y el personal.
        </div>
      )}

      <ErrorBox error={plans.error || staff.error} />

      {loading ? (
        <Spinner />
      ) : !lines.length ? (
        <Card>
          <Empty icon={ClipboardList} title="No hay líneas activas" />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Meta total</span>
              <p className="tabular mt-1 text-[26px] font-extrabold leading-none">{fmtInt(totals.goal)}</p>
            </Card>
            <Card className="p-4">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Personal total</span>
              <p className="tabular mt-1 text-[26px] font-extrabold leading-none">{fmtInt(totals.people)}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lines.map((l) => {
              const row = form[l.name] || { plan: '', people: '' }
              const hasPlan = row.plan !== ''
              return (
                <Card key={l.id} className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="truncate text-[16px] font-extrabold">Línea {l.name}</h3>
                    <Badge tone={hasPlan ? 'violet' : 'gray'}>{hasPlan ? 'Plan capturado' : `Meta estándar ${fmtInt(l.goal)}`}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumField
                      label="Plan (materiales)"
                      icon={ClipboardList}
                      value={row.plan}
                      placeholder={String(l.goal)}
                      disabled={!editable}
                      onChange={(v) => setVal(l.name, 'plan', v)}
                    />
                    <NumField
                      label="Personal"
                      icon={Users}
                      value={row.people}
                      placeholder="0"
                      disabled={!editable}
                      onChange={(v) => setVal(l.name, 'people', v)}
                    />
                  </div>
                </Card>
              )
            })}
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

function NumField({ label, icon: Icon, value, placeholder, disabled, onChange }) {
  return (
    <label className="block min-w-0">
      <span className="label flex items-center gap-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn('field tabular h-12 text-center text-[19px] font-extrabold', disabled && 'cursor-not-allowed')}
      />
    </label>
  )
}
