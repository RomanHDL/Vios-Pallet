// Produccion dividida por marca (HY / SILO): piezas y pallets de salida cerrados. Mismo conteo que el total.
import { Boxes, Package } from 'lucide-react'
import { cn, fmtInt } from '@/lib/utils'

const TONE = {
  HY: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100',
  SILO: 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-100',
}

export function BrandSplit({ brands, className, big, adjustments, onAdjust }) {
  if (!brands?.length) return null
  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:gap-3', className)}>
      {brands.map((b) => (
        <div
          key={b.brand}
          className={cn('rounded-2xl border px-4 py-3', TONE[b.brand] || 'border-border bg-card')}
        >
          <div className="flex items-center gap-2">
            <p className="text-[12.5px] font-bold uppercase tracking-wide opacity-80">{b.brand}</p>
            {adjustments?.[b.brand] ? (
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold dark:bg-black/30">
                ajustado {adjustments[b.brand] > 0 ? '+' : ''}
                {fmtInt(adjustments[b.brand])}
              </span>
            ) : null}
            {onAdjust && (
              <button
                type="button"
                onClick={() => onAdjust(b)}
                className="ml-auto rounded-lg px-2 py-0.5 text-[12px] font-semibold underline-offset-2 hover:underline"
              >
                Ajustar
              </button>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="flex items-baseline gap-1.5">
              <Package className="h-4 w-4 self-center opacity-70" />
              <span className={cn('tabular font-extrabold', big ? 'text-[34px]' : 'text-[26px]')}>
                {fmtInt(b.pieces)}
              </span>
              <span className="text-[13px] font-semibold opacity-75">pzs</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <Boxes className="h-4 w-4 self-center opacity-70" />
              <span className={cn('tabular font-extrabold', big ? 'text-[26px]' : 'text-[20px]')}>
                {fmtInt(b.pallets)}
              </span>
              <span className="text-[13px] font-semibold opacity-75">{b.pallets === 1 ? 'pallet' : 'pallets'}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
