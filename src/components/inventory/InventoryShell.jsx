import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import '../../styles/inventory/InventoryShell.css'

/**
 * Layout común del módulo Inventario (sidebar + cabecera).
 * active: 'hub' | 'stock'
 */
function InventoryShell({ children, user, userRole, onLogout, active = 'hub' }) {
  const navigate = useNavigate()
  const { localId } = useParams()
  const location = useLocation()
  const selectedLocal = location.state?.local

  const backToModules = () => {
    navigate(`/local/${localId}`, { state: { local: selectedLocal } })
  }

  return (
    <div className="inv-shell">
      <aside className="inv-shell__sidebar" aria-label="Navegación inventario">
        <div className="inv-shell__sidebar-head">
          <span className="inv-shell__cube" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <div>
            <p className="inv-shell__sidebar-title">Inventario</p>
            <p className="inv-shell__sidebar-sub">Módulo activo</p>
          </div>
        </div>

        <button type="button" className="inv-shell__back-modules" onClick={backToModules}>
          ← Volver a Módulos
        </button>

        <div className="inv-shell__user">
          <p className="inv-shell__user-name">{user?.email || 'Usuario'}</p>
          <span className="inv-shell__user-badge">{userRole || 'Usuario'}</span>
        </div>

        <nav className="inv-shell__nav">
          <p className="inv-shell__nav-label">Navegación</p>
          <Link
            className={`inv-shell__nav-link ${active === 'hub' ? 'is-active' : ''}`}
            to={`/local/${localId}/inventario`}
            state={{ local: selectedLocal }}
          >
            Inventario
          </Link>
          <Link
            className={`inv-shell__nav-link ${active === 'stock' ? 'is-active' : ''}`}
            to={`/local/${localId}/inventario/stock`}
            state={{ local: selectedLocal }}
          >
            Control de stock
          </Link>
        </nav>
      </aside>

      <div className="inv-shell__body">
        <header className="inv-shell__topbar">
          <p className="inv-shell__brand">SibaGestión — Sistema Comercial Integral</p>
          <button type="button" className="inv-shell__logout" onClick={onLogout}>
            Salir
          </button>
        </header>
        <div className="inv-shell__content">{children}</div>
      </div>
    </div>
  )
}

export default InventoryShell
