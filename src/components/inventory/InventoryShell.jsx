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
  const goRecipes = () => navigate(`/local/${localId}/inventario/recipes`, { state })
  const goSuppliers = () => navigate(`/local/${localId}/inventario/proveedores`, { state })
  const goWeeklyPurchases = () => navigate(`/local/${localId}/inventario/compras-semanales`, { state })
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
          <button
            type="button"
            className={active === 'recipes' ? 'inv-nav-link is-active' : 'inv-nav-link'}
            onClick={goRecipes}
          >
            <span className="inv-nav-link__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 5c-2 3-6 4-6 8a6 6 0 1012 0c0-4-4-5-6-8z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            Gestión de recetas
          </button>
          <button
            type="button"
            className={active === 'suppliers' ? 'inv-nav-link is-active' : 'inv-nav-link'}
            onClick={goSuppliers}
            title="KPIs del mes, listado con métricas y registro de proveedores"
          >
            <span className="inv-nav-link__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 10h3l2-4h6l2 4h3v8H4V10z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 18v-4h6v4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            Proveedores
          </button>
          <button
            type="button"
            className={active === 'weekly-purchases' ? 'inv-nav-link is-active' : 'inv-nav-link'}
            onClick={goWeeklyPurchases}
            title="Órdenes de compra semanales y reporte comparativo (HU-34)"
          >
            <span className="inv-nav-link__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M8 7V3h8v4M8 7h8M6 21h12a2 2 0 002-2V9a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            Compras semanales
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
      </aside>

      <div className="inv-main-column">
        <header className="inv-topbar">
          <div className="inv-brand-section">
            <img src="/sibaritco-logo.svg" alt="Sibarítco" className="inv-brand-logo" />
            <div className="inv-brand-text">
              <h1>Centro de Inventario</h1>
              <p className="inv-header-subtitle">Gestión integral de stock</p>
            </div>
          </div>

          <div className="inv-user-section">
            <div className="inv-info-stack">
              <span className="inv-user-email">{user?.email}</span>
              <span className="inv-user-badge">{userRole || 'Usuario'}</span>
            </div>
            {onLogout && (
              <button
                className="inv-logout-button"
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
            )}
          </div>
        </header>

        <main className="inv-main">{children}</main>
      </div>
    </div>
  )
}

export default InventoryShell
