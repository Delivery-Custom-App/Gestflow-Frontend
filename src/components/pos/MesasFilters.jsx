import { useState, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function applyFilters(mesas, filters) {
  return mesas.filter((mesa) => {
    if (filters.nombre.trim()) {
      const nombre = `${mesa.name || ''}`.toLowerCase()
      const numero = `${mesa.numero || ''}`.toLowerCase()
      const searchTerm = filters.nombre.toLowerCase()
      if (!nombre.includes(searchTerm) && !numero.includes(searchTerm)) return false
    }
    if (filters.estado) {
      const mesaState = !mesa.is_active ? 'inactiva' : (mesa.state || 'libre')
      if (mesaState !== filters.estado) return false
    }
    if (filters.zona) {
      if (mesa.zona !== filters.zona) return false
    }
    return true
  })
}

export default function MesasFilters({ mesas = [], onFilteredMesasChange = null }) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState({ nombre: '', estado: '', zona: '' })

  const estadoOptions = useMemo(() => ['libre', 'ocupada', 'en_cobro'], [])
  const zonaOptions = useMemo(() => {
    const zonas = new Set(mesas.map((m) => m.zona).filter(Boolean))
    return Array.from(zonas).sort()
  }, [mesas])

  const filteredMesas = useMemo(() => applyFilters(mesas, filters), [mesas, filters])

  const handleFiltersChange = useCallback(
    (newFilters) => {
      setFilters(newFilters)
      const filtered = applyFilters(mesas, newFilters)
      if (onFilteredMesasChange) onFilteredMesasChange(filtered, newFilters)
    },
    [mesas, onFilteredMesasChange]
  )

  const handleLimpiarFiltros = () => handleFiltersChange({ nombre: '', estado: '', zona: '' })

  const activeCount = [filters.nombre.trim(), filters.estado, filters.zona].filter(Boolean).length

  return (
    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl overflow-hidden">
      {/* Header clickable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--accent))] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className={`w-4 h-4 text-[hsl(var(--muted-foreground))] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Filtros de Mesas</span>
          {activeCount > 0 && (
            <Badge className="text-[10px] py-0 px-1.5 bg-[hsl(var(--primary))] text-white">
              {activeCount}
            </Badge>
          )}
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {filteredMesas.length} / {mesas.length} mesas
        </span>
      </button>

      {/* Panel colapsable */}
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-[hsl(var(--border))] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Nombre */}
            <div className="space-y-1">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Nombre / Número</p>
              <Input
                type="text"
                placeholder="Ej: mesa 1, A3..."
                value={filters.nombre}
                onChange={(e) => handleFiltersChange({ ...filters, nombre: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            {/* Estado */}
            <div className="space-y-1">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Estado</p>
              <select
                value={filters.estado}
                onChange={(e) => handleFiltersChange({ ...filters, estado: e.target.value })}
                className="w-full h-8 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] px-2 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
              >
                <option value="">Todos</option>
                {estadoOptions.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado === 'libre' && '✓ Disponible'}
                    {estado === 'ocupada' && '⊙ Ocupada'}
                    {estado === 'en_cobro' && '💳 En Cobro'}
                  </option>
                ))}
              </select>
            </div>

            {/* Zona */}
            <div className="space-y-1">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Zona</p>
              <select
                value={filters.zona}
                onChange={(e) => handleFiltersChange({ ...filters, zona: e.target.value })}
                className="w-full h-8 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] px-2 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
              >
                <option value="">Todas</option>
                {zonaOptions.map((zona) => (
                  <option key={zona} value={zona}>{zona}</option>
                ))}
              </select>
            </div>
          </div>

          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
              onClick={handleLimpiarFiltros}
            >
              ✕ Limpiar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
