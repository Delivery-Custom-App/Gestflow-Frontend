import { useNavigate, useParams, useLocation } from 'react-router-dom'
import '../../styles/inventory/StockControlDashboard.css'

function InventoryShell({ user, userRole, onLogout, active, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { localId } = useParams()
  const state = location.state

  const goHub = () => navigate(`/local/${localId}/inventario`, { state })
  const goStock = () => navigate(`/local/${localId}/inventario/stock`, { state })

  return (
    <div className="inv-shell">
      <header className="inv-shell-header">
        <div className="inv-shell-brand">
          <span className="inv-shell-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <div>
            <p className="inv-shell-title">Inventario</p>
            <p className="inv-shell-sub">{userRole || 'Administración'}</p>
          </div>
        </div>
        <div className="inv-shell-actions">
          <span className="inv-shell-user">{user?.email || '—'}</span>
          {onLogout ? (
            <button type="button" className="inv-shell-logout" onClick={onLogout}>
              Cerrar sesión
            </button>
          ) : null}
        </div>
      </header>

      <nav className="inv-shell-nav" aria-label="Secciones de inventario">
        <button type="button" className={active === 'hub' ? 'inv-shell-tab is-active' : 'inv-shell-tab'} onClick={goHub}>
          Resumen
        </button>
        <button
          type="button"
          className={active === 'stock' ? 'inv-shell-tab is-active' : 'inv-shell-tab'}
          onClick={goStock}
        >
          Control de stock
        </button>
      </nav>

      <main className="inv-shell-body">{children}</main>
    </div>
  )
}

export default InventoryShell
