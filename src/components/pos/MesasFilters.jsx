import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { EMPTY_MESA_FILTERS } from './filterMesas'

const ESTADO_OPTIONS = ['libre', 'ocupada', 'en_cobro']
const NO_MESAS = []

const selectCls = cn(
  'h-10 min-w-[140px] rounded-xl border border-[hsl(var(--border))]',
  'bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))]',
  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30',
)

/** Filtros de mesas (controlado): el padre guarda `filters` y calcula `filteredCount`. */
export default function MesasFilters({ mesas = NO_MESAS, filters, onFiltersChange, filteredCount }) {
  const zonaOptions = useMemo(() => {
    const zonas = new Set(mesas.map((m) => m.zona).filter(Boolean))
    return Array.from(zonas).sort()
  }, [mesas])

  const handleFiltersChange = onFiltersChange
  const handleLimpiarFiltros = () => handleFiltersChange(EMPTY_MESA_FILTERS)
  const activeCount = [filters.nombre.trim(), filters.estado, filters.zona].filter(Boolean).length

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
        />
        <Input
          type="text"
          placeholder="Buscar mesa..."
          value={filters.nombre}
          onChange={(e) => handleFiltersChange({ ...filters, nombre: e.target.value })}
          className="h-10 rounded-xl border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-10 text-sm"
        />
        {filters.nombre.trim() ? (
          <button
            type="button"
            onClick={() => handleFiltersChange({ ...filters, nombre: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.estado}
          onChange={(e) => handleFiltersChange({ ...filters, estado: e.target.value })}
          className={selectCls}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADO_OPTIONS.map((estado) => (
            <option key={estado} value={estado}>
              {estado === 'libre' && 'Disponible'}
              {estado === 'ocupada' && 'Ocupada'}
              {estado === 'en_cobro' && 'En cobro'}
            </option>
          ))}
        </select>

        <select
          value={filters.zona}
          onChange={(e) => handleFiltersChange({ ...filters, zona: e.target.value })}
          className={selectCls}
          aria-label="Filtrar por zona"
          disabled={zonaOptions.length === 0}
        >
          <option value="">Todas las zonas</option>
          {zonaOptions.map((zona) => (
            <option key={zona} value={zona}>{zona}</option>
          ))}
        </select>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={handleLimpiarFiltros}
            className="h-10 rounded-xl px-3 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          >
            Limpiar · {filteredCount}/{mesas.length}
          </button>
        )}
      </div>
    </div>
  )
}
