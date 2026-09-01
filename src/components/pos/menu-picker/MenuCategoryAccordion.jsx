import { useState } from 'react'
import MenuItemRow from './MenuItemRow'

const ChevronIcon = ({ open }) => (
  <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

/**
 * `renderItem` es opcional: si se pasa, reemplaza el `MenuItemRow` por defecto
 * para permitir insertar contenido extra (ej. customizador inline) por fila.
 */
export default function MenuCategoryAccordion({ label, items = [], selectedQtys, onAdd, onRemove, renderItem, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const count = items.reduce((s, it) => s + (selectedQtys[it.key] || 0), 0)
  return (
    <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-sm">
      <button onClick={() => setOpen(o => !o)}
        className="flex min-h-[58px] w-full items-center justify-between bg-[hsl(var(--accent))] px-4 py-3 transition-colors hover:bg-[hsl(var(--accent))]/80">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 text-sm font-black text-[hsl(var(--primary))] shadow-sm">
            {label.slice(0, 2).toUpperCase()}
          </span>
          <div className="text-left">
            <p className="text-base font-black leading-tight">{label}</p>
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{items.length} productos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {count > 0 && <span className="rounded-full bg-[hsl(var(--primary))] px-3 py-1 text-sm font-black text-white">{count}</span>}
          <ChevronIcon open={open} />
        </div>
      </button>
      {open && (
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.length === 0
            ? <p className="col-span-full py-5 text-center text-sm text-[hsl(var(--muted-foreground))]">No dispone de productos</p>
            : items.map(it => renderItem
                ? renderItem(it)
                : <MenuItemRow key={it.key} item={it} qty={selectedQtys[it.key] || 0} onAdd={onAdd} onRemove={onRemove} />
              )
          }
        </div>
      )}
    </div>
  )
}
