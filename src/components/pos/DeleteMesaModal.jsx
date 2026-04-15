import { useState } from 'react'
import '../../styles/DeleteMesaModal.css'

/**
 * Modal de confirmación para borrar una mesa
 * Solo superadmin puede borrar mesas
 * Muestra error del backend si hay órdenes activas
 */
export default function DeleteMesaModal({ mesa, onClose, onConfirm, isDeleting = false, error = null }) {
  const [showError, setShowError] = useState(error)
  return (
    <div className="delete-mesa-modal-overlay">
      <div className="delete-mesa-modal">
        <div className="delete-mesa-modal-header">
          <div className="delete-mesa-modal-icon">⚠️</div>
          <h2>Eliminar Mesa</h2>
        </div>

        <div className="delete-mesa-modal-content">
          <p className="delete-warning">
            ¿Estás seguro que deseas eliminar la mesa <strong>{mesa.name}</strong>?
          </p>
          <p className="delete-info">
            Esta acción <strong>no se puede deshacer</strong>. Se eliminarán todos los datos asociados.
          </p>

          {/* Información de la mesa */}
          <div className="mesa-info-summary">
            <div className="info-row">
              <span className="info-label">Nombre:</span>
              <span className="info-value">{mesa.name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Zona:</span>
              <span className="info-value">{mesa.zona || 'General'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Capacidad:</span>
              <span className="info-value">{mesa.capacidad} personas</span>
            </div>
          </div>

          {/* Error si hay órdenes activas */}
          {showError && (
            <div className="delete-mesa-error">
              <strong>⚠️ No se puede eliminar:</strong>
              <p>{showError}</p>
            </div>
          )}
        </div>

        <div className="delete-mesa-modal-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
            disabled={isDeleting || showError}
          >
            {showError ? 'Cerrar' : 'Cancelar'}
          </button>
          <button
            type="button"
            className="btn-delete"
            onClick={() => onConfirm(mesa.id)}
            disabled={isDeleting || showError}
          >
            {isDeleting ? 'Eliminando...' : 'Eliminar Mesa'}
          </button>
        </div>
      </div>
    </div>
  )
}
