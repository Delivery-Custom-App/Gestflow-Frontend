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
        <div className="header-content">
          <div className="worker-brand-section">
            <img src="/sibaritco-logo.svg" alt="Sibarítco" className="worker-brand-logo" />
            <div className="worker-brand-text">
              <h1>POS - Selecciona tu Local</h1>
              <p className="worker-header-subtitle">Acceso rápido al sistema</p>
            </div>
          </div>

          <div className="worker-user-section">
            <div className="worker-info-stack">
              <span className="worker-user-email">{user?.email}</span>
              <span className="worker-user-badge">{userRole || 'Empleado'}</span>
            </div>
            <button
              className="worker-logout-button"
              onClick={onLogout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <path
                  d="M17 16L21 12M21 12L17 8M21 12H9M13 16V17C13 18.1 12.1 19 11 19H5C3.9 19 3 18.1 3 17V7C3 5.9 3.9 5 5 5H11C12.1 5 13 5.9 13 7V8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
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
