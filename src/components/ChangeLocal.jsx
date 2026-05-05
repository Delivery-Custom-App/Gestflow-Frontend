import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useOrderSummary } from '../hooks/useOrderSummary'
import { useAvailableLocals } from '../hooks/useAvailableLocals'
import LoadingSpinner from './LoadingSpinner'
import '../styles/ChangeLocal.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ChangeLocal() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { summary, loading: summaryLoading } = useOrderSummary(orderId)
  const [selectedLocalId, setSelectedLocalId] = useState(null)
  const [isChanging, setIsChanging] = useState(false)
  const [error, setError] = useState(null)

  // Get business ID from summary
  const businessId = summary?.local_info?.id
    ? summary.id.split('-')[0] // Placeholder, ideally from summary
    : null

  const { locals = [], loading: localsLoading = false } = useAvailableLocals(businessId) || {}

  const handleSelectLocal = async (localId) => {
    setSelectedLocalId(localId)
  }

  const handleConfirmChange = async () => {
    if (!selectedLocalId) {
      setError('Selecciona un local para continuar')
      return
    }

    try {
      setIsChanging(true)
      setError(null)

      // Get auth token from localStorage (or your auth context)
      const token = localStorage.getItem('authToken')

      const response = await fetch(`${API_URL}/api/orders/${orderId}/local`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          local_id: selectedLocalId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Error: ${response.status}`)
      }

      // Success - go back to summary
      navigate(`/order/${orderId}/summary`)
    } catch (err) {
      console.error('Error changing local:', err)
      setError(err instanceof Error ? err.message : 'Error al cambiar local')
      setIsChanging(false)
    }
  }

  if (summaryLoading || localsLoading) {
    return (
      <main className="loading-page-minimal">
        <LoadingSpinner message="Cargando locales..." />
      </main>
    )
  }

  if (!summary) {
    return <div className="change-local-error">No se encontró el pedido</div>
  }

  const currentLocalId = summary?.local_info?.id

  return (
    <div className="change-local-container">
      <header className="change-local-header">
        <h1>Seleccionar Punto de Retiro</h1>
        <p className="subtitle">Elige otro local para retirar tu pedido</p>
      </header>

      {error && <div className="change-local-error-message">{error}</div>}

      {/* Current Local Info */}
      <section className="current-local-section">
        <h3>Local Actual</h3>
        {summary.local_info && (
          <div className="current-local-card">
            <p className="local-name">{summary.local_info.name}</p>
            <p className="local-address">{summary.local_info.address}</p>
          </div>
        )}
      </section>

      {/* Available Locals */}
      <section className="available-locals-section">
        <h3>Locales Disponibles</h3>
        {locals && locals.length > 0 ? (
          <div className="locals-grid">
            {locals.map((local) => (
              <div
                key={local.id}
                className={`local-card ${
                  selectedLocalId === local.id ? 'selected' : ''
                } ${local.id === currentLocalId ? 'current' : ''}`}
                onClick={() => handleSelectLocal(local.id)}
              >
                <div className="local-card-content">
                  <h4>{local.name}</h4>
                  <p className="address">{local.address}</p>
                  <p className="phone">{local.phone}</p>
                </div>
                {local.id === currentLocalId && (
                  <span className="current-badge">Actual</span>
                )}
                {selectedLocalId === local.id && (
                  <span className="selected-badge">✓ Seleccionado</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-locals">No hay otros locales disponibles</p>
        )}
      </section>

      {/* Action Buttons */}
      <section className="change-local-actions">
        <button
          onClick={() => navigate(`/order/${orderId}/summary`)}
          className="btn btn-secondary"
          disabled={isChanging}
        >
          ← Volver sin cambiar
        </button>
        <button
          onClick={handleConfirmChange}
          className="btn btn-primary"
          disabled={!selectedLocalId || isChanging}
        >
          {isChanging ? 'Cambiando...' : 'Confirmar Cambio'}
        </button>
      </section>
    </div>
  )
}
