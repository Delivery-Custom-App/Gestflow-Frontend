import { useState } from 'react'
import '../styles/AdminDashboard.css'

function AdminDashboard({ user, onLogout }) {
  const [selectedLocal, setSelectedLocal] = useState(0)

  // Datos de ejemplo de locales
  const locales = [
    {
      id: 1,
      name: 'Local Centro',
      address: 'Calle Principal 123',
      status: 'activo',
      orders: 24,
      revenue: '$2,450',
      staff: 8,
    },
    {
      id: 2,
      name: 'Local Norte',
      address: 'Avenida Libertad 456',
      status: 'activo',
      orders: 18,
      revenue: '$1,850',
      staff: 6,
    },
    {
      id: 3,
      name: 'Local Sur',
      address: 'Boulevar Conexión 789',
      status: 'activo',
      orders: 15,
      revenue: '$1,620',
      staff: 5,
    },
  ]

  const currentLocal = locales[selectedLocal]

  return (
    <main className="admin-dashboard">
      <header className="admin-header">
        <div className="header-content">
          <div className="brand-section">
            <div className="brand-icon-small" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <rect x="5" y="3" width="10" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                <rect x="9" y="7" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
            <div>
              <h1>SibaGestion</h1>
              <p className="header-subtitle">Panel Administrativo</p>
            </div>
          </div>

          <div className="user-section">
            <span className="user-email">{user?.email}</span>
            <span className="user-badge">SUPERADMIN</span>
            <button className="logout-button" onClick={onLogout} aria-label="Cerrar sesión">
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

      <section className="locales-selector">
        <h2>Selecciona un Local</h2>
        <div className="locales-grid">
          {locales.map((local, index) => (
            <button
              key={local.id}
              className={`local-button ${selectedLocal === index ? 'active' : ''}`}
              onClick={() => setSelectedLocal(index)}
            >
              <span className="local-name">{local.name}</span>
              <span className={`local-status status-${local.status}`}>{local.status}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="local-content">
        <div className="local-header">
          <div>
            <h2>{currentLocal.name}</h2>
            <p className="local-address">{currentLocal.address}</p>
          </div>
          <div className={`status-badge status-${currentLocal.status}`}>{currentLocal.status.toUpperCase()}</div>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon orders-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <path
                  d="M9 2H3C2.45 2 2 2.45 2 3V7C2 7.55 2.45 8 3 8H9C9.55 8 10 7.55 10 7V3C10 2.45 9.55 2 9 2Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M21 2H15C14.45 2 14 2.45 14 3V7C14 7.55 14.45 8 15 8H21C21.55 8 22 7.55 22 7V3C22 2.45 21.55 2 21 2Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M9 14H3C2.45 14 2 14.45 2 15V19C2 19.55 2.45 20 3 20H9C9.55 20 10 19.55 10 19V15C10 14.45 9.55 14 9 14Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path d="M14 14H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M14 17H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M14 20H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div className="metric-info">
              <p className="metric-label">Pedidos</p>
              <p className="metric-value">{currentLocal.orders}</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon revenue-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M8 12H16M12 8V12V16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="metric-info">
              <p className="metric-label">Ingresos</p>
              <p className="metric-value">{currentLocal.revenue}</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon staff-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M3 20C3.6 17.5 5.9 16 9 16C12.1 16 14.4 17.5 15 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M13 20C13.5 18 15 17 17 17C19 17 20.5 18 21 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div className="metric-info">
              <p className="metric-label">Personal</p>
              <p className="metric-value">{currentLocal.staff}</p>
            </div>
          </div>
        </div>

        <div className="action-buttons">
          <button className="action-btn primary">Ver Detalles</button>
          <button className="action-btn secondary">Gestionar</button>
        </div>
      </section>
    </main>
  )
}

export default AdminDashboard
