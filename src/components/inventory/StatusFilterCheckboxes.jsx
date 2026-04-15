/** Filtro por uno o varios estados de stock (query `status` repetida). */
const OPTIONS = [
  { value: 'CRITICO', label: 'Crítico' },
  { value: 'BAJO', label: 'Bajo' },
  { value: 'OPTIMO', label: 'Óptimo' },
]

function StatusFilterCheckboxes({ value, onChange }) {
  const toggle = (v) => {
    const set = new Set(value)
    if (set.has(v)) set.delete(v)
    else set.add(v)
    onChange([...set].sort())
  }

  return (
    <fieldset className="scd-status-filter">
      <legend className="scd-status-filter__legend">Estado</legend>
      <div className="scd-status-filter__row">
        {OPTIONS.map((opt) => (
          <label key={opt.value} className="scd-status-filter__item">
            <input
              type="checkbox"
              checked={value.includes(opt.value)}
              onChange={() => toggle(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default StatusFilterCheckboxes
