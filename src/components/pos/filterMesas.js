export const EMPTY_MESA_FILTERS = { nombre: '', estado: '', zona: '' }

/** Filtra mesas por nombre/número, estado y zona. */
export function applyFilters(mesas, filters) {
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
