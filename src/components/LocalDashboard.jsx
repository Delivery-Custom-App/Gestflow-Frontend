import { useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLocals } from '../hooks/useLocals'
import '../styles/LocalDashboard.css'

function LocalDashboard({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { localId } = useParams()
  const { locales } = useLocals()

  const selectedLocal = useMemo(() => {
    if (location.state?.local) {
      return location.state.local
    }

    return locales.find((local) => String(local.id) === String(localId)) || null
  }, [location.state, locales, localId])

  const modules = [
    {
      id: 'administrativo',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" role="presentation" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.9" />
          <rect x="14" y="3" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.9" />
          <rect x="3" y="14" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.9" />
          <rect x="14" y="14" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.9" />
        </svg>
      ),
      title: 'Administrativo',
      subtitle: 'Gestión financiera y operativa del negocio',
      features: ['Dashboard', 'Rendiciones', 'Flujo de Caja', 'Bonos', 'Ventas', 'Reportes', 'Alertas'],
    },
    {
      id: 'pos',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" role="presentation" aria-hidden="true">
          <path d="M4 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M7 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M10 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M7 11V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M16 3V11C16 12.7 17.3 14 19 14V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: 'POS Restaurante',
      subtitle: 'Sistema punto de venta para restaurante y bar',
      features: ['Gestión de Mesas', 'Pantalla Cocina', 'Menú', 'Toma de Pedidos', 'Pantalla Bar'],
    },
    {
      id: 'inventario',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" role="presentation" aria-hidden="true">
          <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M4 7.5L12 12L20 7.5" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M12 12V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      ),
      title: 'Inventario',
      subtitle: 'Control de stock, recetas y proveedores',
      features: ['Recetas', 'Proveedores', 'Control de Stock', 'Órdenes de Compra'],
    },
    {
      id: 'configuracion',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" role="presentation" aria-hidden="true">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.9" />
          <path d="M19.4 15A1 1 0 0 0 19.6 16.1L19.7 16.2A1.2 1.2 0 1 1 18 17.9L17.9 17.8A1 1 0 0 0 16.8 17.6A1 1 0 0 0 16.2 18.5V18.8A1.2 1.2 0 1 1 13.8 18.8V18.6A1 1 0 0 0 13.2 17.7A1 1 0 0 0 12.1 17.9L12 18A1.2 1.2 0 1 1 10.3 16.3L10.4 16.2A1 1 0 0 0 10.6 15A1 1 0 0 0 9.7 14.4H9.4A1.2 1.2 0 1 1 9.4 12H9.6A1 1 0 0 0 10.5 11.4A1 1 0 0 0 10.3 10.3L10.2 10.2A1.2 1.2 0 1 1 11.9 8.5L12 8.6A1 1 0 0 0 13.1 8.4A1 1 0 0 0 13.7 7.5V7.2A1.2 1.2 0 1 1 16.1 7.2V7.4A1 1 0 0 0 16.7 8.3A1 1 0 0 0 17.8 8.1L17.9 8A1.2 1.2 0 1 1 19.6 9.7L19.5 9.8A1 1 0 0 0 19.3 10.9A1 1 0 0 0 20.2 11.5H20.5A1.2 1.2 0 1 1 20.5 13.9H20.3A1 1 0 0 0 19.4 14.5V15Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: 'Configuración',
      subtitle: 'Administración del sistema y usuarios',
      features: ['Gestión de Usuarios', 'Parámetros del Sistema', 'Configuración General'],
    },
  ]

  const handleLogoutClick = () => {
    onLogout()
    navigate('/')
  }

  const handleBackClick = () => {
    navigate('/admin')
  }

  const handleModuleAccess = (moduleId) => {
    if (!selectedLocal?.id) return

    if (moduleId === 'administrativo') {
      navigate(`/local/${selectedLocal.id}/administrativo/dashboard`, { state: { local: selectedLocal } })
      return
    }
  }

  return (
    <main className="local-dashboard">
      <header className="local-header">
        <div className="local-header-content">
          <div className="ld-brand-section">
            <div className="brand-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" fill="currentColor" opacity="0.15" />
                <path d="M12 4L18 7.4V16.6L12 20L6 16.6V7.4L12 4Z" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </div>
            <div className="brand-text">
              <h1>SibaGestión</h1>
              <p>Sistema Comercial Integral</p>
            </div>
          </div>

          <div className="ld-header-user">
            <div>
              <p className="ld-header-user-name">{user?.email || 'Administrador Demo'}</p>
              <p className="ld-header-user-role">{userRole || 'Usuario'}</p>
            </div>
            <button className="ld-logout-button" onClick={handleLogoutClick} type="button">
              Salir
            </button>
          </div>
        </div>
      </header>

      <section className="welcome-section">
        <h2>¡Bienvenido, {userRole || 'Usuario'}!</h2>
        <p className="welcome-subtitle">Selecciona el módulo con el que deseas trabajar</p>
        <p className="welcome-local">
          Local seleccionado: <strong>{selectedLocal?.name || localId || 'No identificado'}</strong>
        </p>
      </section>

      <section className="modules-section">
        <div className="ld-modules-grid">
          {modules.map((module) => (
            <article key={module.id} className="ld-module-card">
              <div className="ld-module-header">
                <span className="ld-module-icon">{module.icon}</span>
                <div className="ld-module-title-section">
                  <h3>{module.title}</h3>
                  <p className="ld-module-subtitle">{module.subtitle}</p>
                </div>
                <span className="ld-module-arrow">→</span>
              </div>

              <div className="ld-module-content">
                <h4>FUNCIONALIDADES:</h4>
                <ul className="ld-features-list">
                  {module.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>

                <button className="ld-module-button" type="button" onClick={() => handleModuleAccess(module.id)}>
                  Acceder al Módulo <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="stats-section">
        <div className="stats-grid">
          <article className="stat-card">
            <span className="stat-number">4</span>
            <span className="stat-label">Módulos Disponibles</span>
          </article>
          <article className="stat-card">
            <span className="stat-number stat-number-role">{userRole || 'Usuario'}</span>
            <span className="stat-label">Tu Rol</span>
          </article>
          <article className="stat-card">
            <span className="stat-number">95%</span>
            <span className="stat-label">Sistema Funcional</span>
          </article>
          <article className="stat-card">
            <span className="stat-number">v1</span>
            <span className="stat-label">Versión Modular</span>
          </article>
        </div>
      </section>

      <footer className="local-footer">
        <button className="ld-back-button" type="button" onClick={handleBackClick}>
          Volver a Locales
        </button>
        <p>Sibaritico desde 1991</p>
      </footer>
    </main>
  )
}

export default LocalDashboard
