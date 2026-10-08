// Lista de piezas escaneadas (mas reciente primero) con opcion de quitar una pieza equivocada.
import { ListChecks, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardHeader, Dialog, Empty } from '@/components/ui'
import { fmtInt, fmtTime } from '@/lib/utils'
import { SearchBox } from './shared'

export function ScannedList({ items, title = 'Piezas escaneadas', onRemove, extras, highlight, className }) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const t = q.trim().toUpperCase()
    return t ? items.filter((i) => i.code.includes(t)) : items
  }, [items, q])

  return (
    <Card className={className}>
      <CardHeader
        icon={ListChecks}
        title={title}
        subtitle={`${fmtInt(items.length)} ${items.length === 1 ? 'pieza' : 'piezas'}`}
      />
      {items.length > 8 && <SearchBox value={q} onChange={setQ} className="border-b p-3 sm:px-5" />}
      {!items.length ? (
        <Empty icon={ListChecks} title="Aún no hay piezas">
          Escanea el serial de cada TV.
        </Empty>
      ) : !shown.length ? (
        <p className="px-5 py-8 text-center text-[13.5px] text-muted-foreground">Sin coincidencias.</p>
      ) : (
        <ul className="max-h-[60dvh] divide-y overflow-y-auto lg:max-h-[calc(100dvh-260px)]">
          {shown.map((it, i) => {
            const isExtra = extras?.has(it.code)
            return (
              <li
                key={it.code}
                className={
                  'flex items-center gap-3 px-4 py-2.5 sm:px-5 ' +
                  (highlight === it.code ? 'bg-emerald-50/70 dark:bg-emerald-500/10' : '')
                }
              >
                <span className="tabular w-8 shrink-0 text-right text-[12px] font-semibold text-muted-foreground">
                  {q ? '' : items.length - i}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-[14.5px] font-semibold">{it.code}</span>
                    {it.different && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        Diferente
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {fmtTime(it.scanned_at)}
                    {it.scanned_by_name && ` · ${it.scanned_by_name}`}
                  </span>
                </span>
                {isExtra && <Badge tone="amber">Extra</Badge>}
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(it.code)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    aria-label={`Quitar ${it.code}`}
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// Confirmacion para quitar una pieza escaneada por error.
export function RemoveItemDialog({ code, palletId, busy, onCancel, onConfirm }) {
  return (
    <Dialog
      open={Boolean(code)}
      onClose={onCancel}
      title="Quitar pieza"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" loading={busy} onClick={onConfirm}>
            <Trash2 className="h-4 w-4" /> Quitar
          </Button>
        </>
      }
    >
      <p className="text-[14.5px]">
        ¿Quitar esta pieza del pallet <span className="font-mono font-bold">{palletId}</span>?
      </p>
      <p className="mt-3 break-all rounded-xl bg-muted px-4 py-3 text-center font-mono text-[18px] font-bold">
        {code}
      </p>
    </Dialog>
  )
}
