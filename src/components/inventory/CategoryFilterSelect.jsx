/**
 * Selector de categoría para inventario (HU-47).
 * `options`: { id: string (UUID), name: string }[] — id se envía al API como query `category`.
 */
function CategoryFilterSelect({ value, onChange, options }) {
  return (
    <select
      className="scd-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Filtrar por categoría"
    >
      <option value="">Todas las categorías</option>
      {options.map(({ id, name }) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </select>
  )
}

export default CategoryFilterSelect
