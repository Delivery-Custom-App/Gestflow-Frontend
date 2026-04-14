import { useState, useCallback, useMemo } from 'react'
import '../../styles/MesasFilters.css'

/**
 * Aplica filtros a las mesas
 */
function applyFilters(mesas, filters) {
  return mesas.filter((mesa) => {
    // Filtro por nombre
    if (filters.nombre.trim()) {
      const nombre = `${mesa.name || ''}`.toLowerCase()
      const numero = `${mesa.numero || ''}`.toLowerCase()
      const searchTerm = filters.nombre.toLowerCase()
      if (!nombre.includes(searchTerm) && !numero.includes(searchTerm)) {
        return false
      }
    }

    // Filtro por estado
    if (filters.estado) {
      const mesaState = !mesa.is_active ? 'inactiva' : (mesa.state || 'libre')
      if (mesaState !== filters.estado) {
        return false
      }
    }

    // Filtro por zona
    if (filters.zona) {
      if (mesa.zona !== filters.zona) {
        return false
      }
    }

    return true
  })
}

/**
 * HU-63: Filtro de mesas
 * SCRUM-497/498/499/500
 * 
 * Permite filtrar mesas por:
 * - Nombre/número
 * - Estado (libre, ocupada, en_cobro)
 * - Zona
 * - Combinaciones de filtros
 * 
 * Props:
 * - mesas: array de mesas a filtrar
 * - onFilteredMesasChange: callback que recibe (filteredMesas, activeFilters)
 */
export default function MesasFilters({ mesas = [], onFilteredMesasChange = null }) {
  const [filters, setFilters] = useState({
    nombre: '',
    estado: '',
    zona: '',
  })

  // Obtener valores únicos para los selects
  const estadoOptions = useMemo(() => ['libre', 'ocupada', 'en_cobro'], [])
  
  const zonaOptions = useMemo(() => {
    const zonas = new Set(mesas.map((m) => m.zona).filter(Boolean))
    return Array.from(zonas).sort()
  }, [mesas])

  // Aplicar filtros
  const filteredMesas = useMemo(() => applyFilters(mesas, filters), [mesas, filters])

  // Notificar cambios al padre
  const handleFiltersChange = useCallback(
    (newFilters) => {
      setFilters(newFilters)
      // Aplicar filtros y notificar al padre
      const filtered = applyFilters(mesas, newFilters)
      if (onFilteredMesasChange) {
        onFilteredMesasChange(filtered, newFilters)
      }
    },
    [mesas, onFilteredMesasChange]
  )

  const handleNombreChange = (e) => {
    handleFiltersChange({
      ...filters,
      nombre: e.target.value,
    })
  }

  const handleEstadoChange = (e) => {
    handleFiltersChange({
      ...filters,
      estado: e.target.value,
    })
  }

  const handleZonaChange = (e) => {
    handleFiltersChange({
      ...filters,
      zona: e.target.value,
    })
  }

  const handleLimpiarFiltros = () => {
    handleFiltersChange({
      nombre: '',
      estado: '',
      zona: '',
    })
  }

  // Determinar si hay filtros activos
  const tieneFilterosActivos = filters.nombre.trim() !== '' || filters.estado !== '' || filters.zona !== ''

  return (
    <div className="mesas-filters-container">
      <div className="mesas-filters-header">
        <h3>Filtros de Mesas</h3>
        {tieneFilterosActivos && (
          <button
            className="btn-limpiar-filtros"
            type="button"
            onClick={handleLimpiarFiltros}
            title="Limpiar todos los filtros"
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      <div className="mesas-filters-grid">
        {/* Filtro por nombre/número */}
        <div className="filter-group">
          <label htmlFor="filter-nombre">
            Nombre/Número
            {filters.nombre && <span className="filter-badge">{filters.nombre}</span>}
          </label>
          <input
            id="filter-nombre"
            type="text"
            placeholder="Ej: mesa 1, A3..."
            value={filters.nombre}
            onChange={handleNombreChange}
            className="filter-input"
          />
        </div>

        {/* Filtro por estado */}
        <div className="filter-group">
          <label htmlFor="filter-estado">
            Estado
            {filters.estado && <span className="filter-badge">{filters.estado}</span>}
          </label>
          <select
            id="filter-estado"
            value={filters.estado}
            onChange={handleEstadoChange}
            className="filter-select"
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

        {/* Filtro por zona */}
        <div className="filter-group">
          <label htmlFor="filter-zona">
            Zona
            {filters.zona && <span className="filter-badge">{filters.zona}</span>}
          </label>
          <select
            id="filter-zona"
            value={filters.zona}
            onChange={handleZonaChange}
            className="filter-select"
          >
            <option value="">Todas</option>
            {zonaOptions.map((zona) => (
              <option key={zona} value={zona}>
                {zona}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resultado del filtrado */}
      <div className="mesas-filters-result">
        <p className="result-text">
          Mostrando <strong>{filteredMesas.length}</strong> de <strong>{mesas.length}</strong> mesas
          {tieneFilterosActivos && ' (filtrado)'}
        </p>
      </div>
    </div>
  )
}
