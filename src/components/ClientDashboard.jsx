import { useNavigate } from 'react-router-dom'
import { useLocals } from '../hooks/useLocals'
import LoadingSpinner from './LoadingSpinner'
import '../styles/ClientDashboard.css'

/**
 * Panel de control para clientes
 * Permite navegar al carrito y seleccionar sucursal
 */
function ClientDashboard({ user, onLogout }) {
  const navigate = useNavigate()
  const { locales, loading, error } = useLocals()

  const handleGoToCart = () => {
    navigate('/cart')
  }

  const handleLogout = () => {
    onLogout()
  }

  return (
    <main className="client-dashboard">
      <header className="client-header">
        <div className="header-content">
          <div className="brand-section">
            <img src="/sibaritco-logo.svg" alt="Sibarítco" className="brand-logo-small" />
            <div>
              <h1>¡Bienvenido, Cliente!</h1>
              <p className="header-subtitle">Realiza tu pedido ahora</p>
            </div>
          </div>

          <div className="user-section">
            <span className="user-email">{user?.email}</span>
            <span className="user-badge">CLIENTE</span>
            <button
              className="logout-button"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
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

      <section className="client-content">
        {/* Locales disponibles */}
        {loading ? (
          <LoadingSpinner message="Cargando sucursales..." />
        ) : (
          <>
            <div className="locales-section">
              <h2>Selecciona tu Sucursal</h2>
              {error && <p className="error-text">Error: {error}</p>}

              {!error && locales.length === 0 && (
                <p className="empty-text">No hay sucursales disponibles</p>
              )}

              {!error && locales.length > 0 && (
                <div className="locales-grid">
                  {locales.map((local) => (
                    <div key={local.id} className="local-card">
                      <div className="local-info">
                        <h3>{local.name}</h3>
                        {local.address && <p className="local-address">{local.address}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Acciones principales */}
            <div className="actions-section">
              <button
                className="btn-primary btn-large"
                onClick={handleGoToCart}
                aria-label="Ir al carrito"
              >
                <span className="btn-icon">🛒</span>
                <span>Mi Carrito</span>
              </button>

              <button
                className="btn-secondary btn-large"
                onClick={handleGoToCart}
                aria-label="Ver menú"
              >
                <span className="btn-icon">📋</span>
                <span>Ver Menú</span>
              </button>
            </div>

            {/* Info de bienvenida */}
            <div className="welcome-info">
              <p>
                Selecciona una sucursal, explora nuestro menú y agrega productos a tu
                carrito. ¡Tu pedido te espera! 
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default ClientDashboard
