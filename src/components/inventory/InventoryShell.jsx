import { useNavigate, useParams, useLocation } from 'react-router-dom'
import '../../styles/inventory/StockControlDashboard.css'

function displayUserName(user) {
  const meta = user?.user_metadata || {}
  const n = meta.full_name || meta.name || meta.display_name
  if (n && String(n).trim()) return String(n).trim()
  const email = user?.email
  if (!email) return 'Usuario'
  const local = email.split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function InventoryShell({ user, userRole, onLogout, active, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { localId } = useParams()
  const state = location.state

  const goHub = () => navigate(`/local/${localId}/inventario`, { state })
  const goStock = () => navigate(`/local/${localId}/inventario/stock`, { state })
  const goLocalModules = () =>
    navigate('/admin', { state: { ...(typeof state === 'object' && state !== null ? state : {}), focusLocalId: localId } })
  const goAppHome = () => navigate('/')

  return (
    <div className="inv-app">
      <aside className="inv-sidebar" aria-label="Menú inventario">
        <div className="inv-sidebar__hero">
          <div className="inv-sidebar__hero-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <h1 className="inv-sidebar__hero-title">Inventario</h1>
          <p className="inv-sidebar__hero-sub">Módulo activo</p>
        </div>

        <button type="button" className="inv-sidebar__back-modules" onClick={goLocalModules}>
          ← Volver a Módulos
        </button>

        <div className="inv-sidebar__user-card">
          <p className="inv-sidebar__user-name">{displayUserName(user)}</p>
          <p className="inv-sidebar__user-email">{user?.email || '—'}</p>
          {userRole ? <span className="inv-sidebar__badge">{userRole}</span> : null}
        </div>

        <p className="inv-sidebar__nav-heading">Navegación</p>
        <nav className="inv-sidebar__nav" aria-label="Secciones">
          <button
            type="button"
            className={active === 'hub' ? 'inv-nav-link is-active' : 'inv-nav-link'}
            onClick={goHub}
          >
            <span className="inv-nav-link__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 11.5L12 5l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-8.5z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            Vista general
          </button>
          <button
            type="button"
            className={active === 'stock' ? 'inv-nav-link is-active' : 'inv-nav-link'}
            onClick={goStock}
          >
            <span className="inv-nav-link__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3l8 4v10l-8 4-8-4V7l8-4z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            Control de stock
          </button>
        </nav>

        <div className="inv-sidebar__footer">
          <span className="inv-sidebar__footer-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
          <p className="inv-sidebar__footer-text">SibaGestión</p>
          <p className="inv-sidebar__footer-sub">desde 1991</p>
          <button type="button" className="inv-sidebar__link-quiet" onClick={goAppHome}>
            Inicio / administración
          </button>
        </div>

        {onLogout ? (
          <button type="button" className="inv-sidebar__logout" onClick={onLogout}>
            Cerrar sesión
          </button>
        ) : null}
      </aside>

      <div className="inv-main-column">
        <main className="inv-main">{children}</main>
      </div>
    </div>
  )
}

export default InventoryShell
