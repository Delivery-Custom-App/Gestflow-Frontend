import { formatCLP } from '../../../lib/formatCLP'
import { cn } from '@/lib/utils'

export default function MenuItemRow({ item, qty, onAdd, onRemove }) {
  return (
    <div
      className={cn(
        'group flex min-h-[92px] items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all',
        qty > 0
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 shadow-sm'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--accent))]'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold leading-tight text-[hsl(var(--foreground))] line-clamp-2">{item.name}</p>
        {item.description && <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">{item.description}</p>}
        <p className="mt-2 text-lg font-black text-[hsl(var(--primary))]">${formatCLP(item.price || 0)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {qty > 0 && <button onClick={(event) => { event.stopPropagation(); onRemove(item.key) }}
          className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-2xl font-black shadow-sm transition-colors hover:bg-[hsl(var(--accent))]">−</button>}
        {qty > 0 && <span className="min-w-8 text-center text-xl font-black text-[hsl(var(--primary))]">{qty}</span>}
        <button onClick={(event) => { event.stopPropagation(); onAdd(item.key) }}
          className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-[hsl(var(--primary))] text-2xl font-black text-white shadow-md transition-colors hover:bg-[hsl(var(--primary))]/90">+</button>
      </div>
    </div>
  )
}
