import { useNavigate } from 'react-router-dom'
import { useLocals } from '../hooks/useLocals'
import '../styles/WorkerLocalSelector.css'

/**
 * Pantalla de bienvenida para roles EMPLEADO / CAJERO.
 * Muestra solo los locales disponibles del negocio y
 * redirige directo al POS al seleccionar uno.
 */
export default function WorkerLocalSelector({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const { locales, loading, error } = useLocals()

  const handleSelectLocal = (local) => {
    navigate(`/local/${local.id}/pos`)
  }

  return (
    <main className="worker-selector">
      <header className="worker-selector-header">
        <div className="worker-brand">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M7 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M10 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M7 11V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M16 3V11C16 12.7 17.3 14 19 14V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>POS Restaurante</span>
        </div>
        <div className="worker-header-user">
          <span className="worker-email">{user?.email}</span>
          <span className="worker-role-badge">{userRole}</span>
          <button className="worker-logout-btn" onClick={onLogout} type="button">Salir</button>
        </div>
      </header>

      <section className="worker-selector-body">
        <h2>Selecciona tu local</h2>
        <p className="worker-selector-subtitle">Serás dirigido directamente al sistema POS</p>

        {loading && (
          <div className="worker-loading">
            <div className="worker-spinner" />
            <p>Cargando locales...</p>
          </div>
        )}

        {error && (
          <div className="worker-error">
            <p>Error al cargar locales: {error}</p>
          </div>
        )}

        {!loading && !error && locales.length === 0 && (
          <div className="worker-empty">
            <p>No hay locales disponibles para tu cuenta.</p>
          </div>
        )}

        {!loading && !error && locales.length > 0 && (
          <div className="worker-locals-grid">
            {locales.map((local) => (
              <button
                key={local.id}
                className="worker-local-card"
                onClick={() => handleSelectLocal(local)}
                type="button"
              >
                <div className="worker-local-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="worker-local-info">
                  <span className="worker-local-name">{local.name}</span>
                  {local.address && <span className="worker-local-address">{local.address}</span>}
                </div>
                <span className="worker-local-arrow">→</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
