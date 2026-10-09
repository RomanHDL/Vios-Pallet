// Pendientes de cada area (2026-10-08): en Entrada, las entradas abiertas por terminar; en Salida, los pallets
// por dar salida (entrada cerrada sin salida) y las salidas abiertas. De cualquier dia. Tocar uno lo retoma.
import { ChevronRight, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card } from '@/components/ui'
import { useApi } from '@/lib/hooks'
import { fmtAgo, fmtInt } from '@/lib/utils'

const TEXT = {
  entrada: { title: 'Pendientes por dar entrada', subtitle: 'Entradas abiertas: termina de escanear y ciérralas' },
  salida: { title: 'Pendientes por dar salida', subtitle: 'Pallets sin salida y salidas abiertas' },
}

export function PendingPallets({ area }) {
  const { data } = useApi('/pallets/pending', { query: { area }, refreshMs: 30000 })
  const list = data?.pallets || []
  if (!data) return null
  const t = TEXT[area]
  return (
    <Card className="mx-auto mt-5 max-w-xl overflow-hidden">
      <div className="flex items-center gap-3 border-b px-4 py-3.5 sm:px-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight">{t.title}</p>
          <p className="text-[12.5px] text-muted-foreground">{t.subtitle}</p>
        </div>
        <span className="tabular rounded-full bg-amber-100 px-2.5 py-0.5 text-[13px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {fmtInt(list.length)}
        </span>
      </div>
      {list.length ? (
        <ul className="divide-y">
          {list.map((p) => (
            <li key={p.id}>
              <Link
                to={`/pallets/${area}?id=${p.id}`}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[16px] font-extrabold">{p.id}</span>
                    {p.kind === 'sin_salida' ? (
                      <Badge tone="amber" dot>
                        Sin salida
                      </Badge>
                    ) : p.kind === 'salida_abierta' ? (
                      <Badge tone="violet" dot>
                        Salida abierta
                      </Badge>
                    ) : (
                      <Badge tone="blue" dot>
                        Entrada abierta
                      </Badge>
                    )}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {[p.model, p.brand].filter(Boolean).join(' · ')} · {fmtAgo(p.since)}
                  </span>
                </span>
                <span className="tabular text-right text-[15px] font-extrabold">
                  {p.kind === 'salida_abierta' ? `${fmtInt(p.done)} / ${fmtInt(p.total)}` : fmtInt(p.total)}
                  <span className="block text-[11px] font-medium text-muted-foreground">piezas</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-[13.5px] text-muted-foreground sm:px-5">No hay pendientes. 👍</p>
      )}
    </Card>
  )
}
