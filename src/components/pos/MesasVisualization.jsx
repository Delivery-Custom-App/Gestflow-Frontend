import '../../styles/MesasVisualization.css'

/**
 * HU-59: Visualización de listado de mesas en formato gráfico
 */
export default function MesasVisualization({ mesas = [], loading = false, onMesaSelect = null, onEditMesa = null, onDeleteMesa = null }) {

  if (loading) {
    return (
      <div className="mesas-visualization-container">
        <div className="mesas-visualization-loading">
          <p>Cargando mesas...</p>
        </div>
      </div>
    )
  }

  if (!mesas || mesas.length === 0) {
    return (
      <div className="mesas-visualization-container">
        <div className="mesas-visualization-empty">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <p>No hay mesas para mostrar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mesas-visualization-container">
      <div className="mesas-grid">
        {mesas.map((mesa) => (
          <MesaCard
            key={mesa.id}
            mesa={mesa}
            onMesaSelect={onMesaSelect}
            onEditMesa={onEditMesa}
            onDeleteMesa={onDeleteMesa}
          />
        ))}
      </div>
    </div>
  )
}

function MesaCard({ mesa, onMesaSelect, onEditMesa, onDeleteMesa }) {
  const stateKey = mesa.is_active ? (mesa.state || 'libre') : 'inactiva'

  const stateLabel = {
    libre: 'Libre',
    ocupada: 'Ocupada',
    en_cobro: 'En Cobro',
    inactiva: 'Inactiva',
  }[stateKey] || 'Libre'

  const handleOpen = () => onMesaSelect && onMesaSelect(mesa)

  const handleEdit = (e) => {
    e.stopPropagation()
    onEditMesa && onEditMesa(mesa)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    onDeleteMesa && onDeleteMesa(mesa)
  }

  return (
    <div className={`mesa-card mesa-state-${stateKey}`}>
      {/* Header: nombre + badge */}
      <div className="mesa-card-header">
        <span className="mesa-card-name">{mesa.name || mesa.numero}</span>
        <span className={`mesa-state-badge mesa-state-badge-${stateKey}`}>{stateLabel}</span>
      </div>

      {/* Zona */}
      <p className="mesa-card-zone">{mesa.zona || 'General'}</p>

      {/* Capacidad */}
      <div className="mesa-card-capacity">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 19C5 15.686 8.134 13 12 13C15.866 13 19 15.686 19 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span>{mesa.capacidad || 4} personas</span>
      </div>

      {/* Footer: botón + acciones */}
      <div className="mesa-card-footer">
        <button
          className={`mesa-btn-abrir mesa-btn-abrir-${stateKey}`}
          onClick={handleOpen}
          disabled={!mesa.is_active}
        >
          {stateKey === 'inactiva' ? 'Inactiva' : 'Abrir Mesa'}
        </button>

        <div className="mesa-card-actions">
          {onEditMesa && (
            <button className="mesa-action-btn mesa-action-edit" onClick={handleEdit} title="Editar mesa" aria-label="Editar mesa">
              ✎
            </button>
          )}
          {onDeleteMesa && (
            <button className="mesa-action-btn mesa-action-delete" onClick={handleDelete} title="Eliminar mesa" aria-label="Eliminar mesa">
              🗑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
