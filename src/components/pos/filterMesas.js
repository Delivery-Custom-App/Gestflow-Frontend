export const EMPTY_MESA_FILTERS = { nombre: '', estado: '', zona: '' }

/** Valor del filtro para las mesas sin zona. */
export const SIN_ZONA = '__sin_zona__'

/** Zonas presentes en las mesas, ordenadas (para el filtro). */
export function zonasDe(mesas = []) {
  return [...new Set(mesas.map((m) => m.zona).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Filtra mesas por nombre/número y estado. */
export function applyFilters(mesas, filters) {
  return mesas.filter((mesa) => {
    if (filters.nombre.trim()) {
      const nombre = `${mesa.name || ''}`.toLowerCase()
      const numero = `${mesa.numero || ''}`.toLowerCase()
      const searchTerm = filters.nombre.toLowerCase()
      if (!nombre.includes(searchTerm) && !numero.includes(searchTerm)) return false
    }
    if (filters.zona) {
      if (filters.zona === SIN_ZONA ? Boolean(mesa.zona) : mesa.zona !== filters.zona) return false
    }
    if (filters.estado) {
      const mesaState = !mesa.is_active ? 'inactiva' : (mesa.state || 'libre')
      if (mesaState !== filters.estado) return false
    }
    return true
  })
}
