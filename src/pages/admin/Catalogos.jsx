import { Check, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, CardHeader, Empty, ErrorBox, Field, Input, PageHeader, Segmented, Spinner, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { cn, fmtInt } from '@/lib/utils'
import { BackLink } from '../reportes/common'
import { AdminOnly } from './AdminOnly'
import { Toggle } from './Toggle'

// Definicion de cada catalogo: campos editables y como se muestran.
const KINDS = {
  lines: {
    tab: 'Líneas',
    title: 'Líneas de producción',
    help: 'La meta por turno se usa como plan cuando el supervisor no captura uno.',
    titleField: 'name',
    fields: [
      { key: 'name', label: 'Nombre', placeholder: 'Línea 1', wide: true },
      { key: 'goal', label: 'Meta / turno', type: 'number', default: 400, show: (v) => `Meta ${fmtInt(v)} / turno` },
      { key: 'sort', label: 'Orden', type: 'number', default: 0, show: (v) => `Orden ${v}` },
    ],
  },
  models: {
    tab: 'Modelos',
    title: 'Modelos de TV',
    help: 'El serial debe empezar con el prefijo del modelo (ej. EL, J0). Objetivos MTY + Texas alimentan el reporte por modelo.',
    titleField: 'code',
    fields: [
      { key: 'code', label: 'Código', placeholder: 'EL-50"', wide: true },
      { key: 'prefix', label: 'Prefijo serial', placeholder: 'EL', upper: true, show: (v) => `Prefijo ${v}` },
      { key: 'targetMty', label: 'Objetivo MTY', type: 'number', default: 0, show: (v) => `MTY ${fmtInt(v)}` },
      { key: 'targetTexas', label: 'Objetivo Texas', type: 'number', default: 0, show: (v) => `Texas ${fmtInt(v)}` },
      { key: 'sort', label: 'Orden', type: 'number', default: 0, show: (v) => `Orden ${v}` },
    ],
  },
  brands: {
    tab: 'Marcas',
    title: 'Marcas',
    help: 'Marcas que se eligen al abrir un pallet y al registrar producción.',
    titleField: 'code',
    fields: [{ key: 'code', label: 'Código', placeholder: 'HY', upper: true, wide: true }],
  },
  defects: {
    tab: 'Defectos',
    title: 'Defectos de calidad',
    help: 'Lista que usa Calidad al registrar un rechazo.',
    titleField: 'name',
    fields: [
      { key: 'name', label: 'Defecto', placeholder: 'Pantalla rota', wide: true },
      { key: 'sort', label: 'Orden', type: 'number', default: 0, show: (v) => `Orden ${v}` },
    ],
  },
}

const blankOf = (def) => Object.fromEntries(def.fields.map((f) => [f.key, f.default ?? '']))

function FieldsForm({ def, value, onChange, onSubmit, autoFocus }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className={cn('grid gap-3', def.fields.length > 2 ? 'grid-cols-2 md:grid-cols-6' : 'grid-cols-2 md:grid-cols-4')}
    >
      {def.fields.map((f, i) => (
        <Field key={f.key} label={f.label} className={f.wide ? 'col-span-2' : 'col-span-1'}>
          <Input
            type={f.type || 'text'}
            inputMode={f.type === 'number' ? 'numeric' : undefined}
            min={f.type === 'number' ? 0 : undefined}
            value={value[f.key] ?? ''}
            placeholder={f.placeholder}
            autoFocus={autoFocus && i === 0}
            onChange={(e) => onChange({ ...value, [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value })}
          />
        </Field>
      ))}
      <button type="submit" className="hidden" />
    </form>
  )
}

function ItemRow({ kind, def, item, onChanged }) {
  const toast = useToast()
  const [edit, setEdit] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const patch = async (body, msg) => {
    setBusy(true)
    setError(null)
    try {
      await api(`/catalogs/${kind}/${item.id}`, { method: 'PATCH', body })
      toast(msg)
      setEdit(null)
      await onChanged()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  const startEdit = () => setEdit(Object.fromEntries(def.fields.map((f) => [f.key, item[f.key] ?? ''])))
  const title = item[def.titleField]

  return (
    <li className={cn('px-4 py-3 sm:px-5', edit && 'bg-muted/40')}>
      {edit ? (
        <div className="space-y-3">
          <FieldsForm def={def} value={edit} onChange={setEdit} onSubmit={() => patch(edit, 'Cambios guardados')} autoFocus />
          <ErrorBox error={error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEdit(null)}>
              <X className="h-4 w-4" /> Cancelar
            </Button>
            <Button size="sm" loading={busy} onClick={() => patch(edit, 'Cambios guardados')}>
              {!busy && <Check className="h-4 w-4" />} Guardar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className={cn('min-w-0 flex-1', !item.active && 'opacity-55')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[14.5px] font-bold">{title}</span>
                {!item.active && <Badge tone="gray">Inactivo</Badge>}
              </div>
              {def.fields.some((f) => f.show) && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {def.fields
                    .filter((f) => f.show)
                    .map((f) => (
                      <span key={f.key} className="tabular rounded-md bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
                        {f.show(item[f.key])}
                      </span>
                    ))}
                </div>
              )}
            </div>
            <Toggle
              checked={item.active}
              disabled={busy}
              label={item.active ? `Desactivar ${title}` : `Activar ${title}`}
              onChange={(v) => patch({ active: v }, v ? `${title} activado` : `${title} desactivado`)}
            />
            <Button variant="ghost" size="icon" onClick={startEdit} aria-label={`Editar ${title}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <ErrorBox error={error} className="mt-2" />
        </>
      )}
    </li>
  )
}

function AddForm({ kind, def, onChanged, onClose }) {
  const toast = useToast()
  const [value, setValue] = useState(() => blankOf(def))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await api(`/catalogs/${kind}`, { method: 'POST', body: value })
      toast(`${value[def.titleField]} agregado`)
      setValue(blankOf(def))
      await onChanged()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3 border-b bg-accent/40 px-4 py-4 sm:px-5">
      <FieldsForm def={def} value={value} onChange={setValue} onSubmit={save} autoFocus />
      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cerrar
        </Button>
        <Button size="sm" loading={busy} onClick={save}>
          {!busy && <Plus className="h-4 w-4" />} Agregar
        </Button>
      </div>
    </div>
  )
}

function CatalogosInner() {
  const { catalogs, reloadCatalogs } = useSession()
  const [kind, setKind] = useState('lines')
  const [adding, setAdding] = useState(false)
  const def = KINDS[kind]
  const items = catalogs?.[kind] || []
  const active = items.filter((x) => x.active).length

  const changeTab = (k) => {
    setKind(k)
    setAdding(false)
  }

  return (
    <>
      <PageHeader back={<BackLink to="/admin" label="Administración" />} title="Catálogos" subtitle="Líneas, modelos, marcas y defectos" />
      <Segmented
        value={kind}
        onChange={changeTab}
        options={Object.entries(KINDS).map(([k, d]) => ({ value: k, label: d.tab }))}
        className="mb-4"
      />
      <Card>
        <CardHeader
          title={def.title}
          subtitle={def.help}
          action={
            !adding && (
              <Button size="sm" className="shrink-0" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            )
          }
        />
        {adding && <AddForm key={kind} kind={kind} def={def} onChanged={reloadCatalogs} onClose={() => setAdding(false)} />}
        {!catalogs ? (
          <Spinner />
        ) : items.length ? (
          <>
            <ul className="divide-y">
              {items.map((it) => (
                <ItemRow key={it.id} kind={kind} def={def} item={it} onChanged={reloadCatalogs} />
              ))}
            </ul>
            <p className="border-t px-4 py-2.5 text-[12px] text-muted-foreground sm:px-5">
              {active} activos de {items.length}. Los inactivos no aparecen en las listas, pero su historial se conserva.
            </p>
          </>
        ) : (
          <Empty title="Sin registros">Usa “Agregar” para crear el primero.</Empty>
        )}
      </Card>
    </>
  )
}

export default function Catalogos() {
  return (
    <div>
      <AdminOnly>
        <CatalogosInner />
      </AdminOnly>
    </div>
  )
}
