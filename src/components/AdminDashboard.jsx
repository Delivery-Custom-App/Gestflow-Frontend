import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocals } from '../hooks/useLocals'
import CreateLocalModal from './CreateLocalModal'
import '../styles/AdminDashboard.css'

function AdminDashboard({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const [selectedLocal, setSelectedLocal] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { locales, loading, error, refetch } = useLocals()

  const currentLocal = locales[selectedLocal] || null

  const handleCreateSuccess = () => {
    refetch()
    setSelectedLocal(0)
  }

  const handleGestionarClick = () => {
    if (currentLocal) {
      navigate(`/local/${currentLocal.id}`, { state: { local: currentLocal } })
    }
  }

  const handleLocalCardClick = (local, index) => {
    setSelectedLocal(index)
    navigate(`/local/${local.id}`, { state: { local } })
  }

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
            <span className="user-badge">{userRole || 'Usuario'}</span>
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
        <div className="locales-header">
          <h2>Selecciona un Local</h2>
          <button className="btn-create-local" onClick={() => setIsModalOpen(true)}>
            <span aria-hidden="true">+</span> Crear Local
          </button>
        </div>
        {loading && <p className="loading-text">Cargando locales...</p>}
        {error && <p className="error-text">Error: {error}</p>}
        {!loading && !error && locales.length === 0 && (
          <p className="empty-text">No hay locales disponibles</p>
        )}
        {!loading && !error && locales.length > 0 && (
          <div className="locales-grid">
            {locales.map((local, index) => (
              <button
                key={local.id}
                className={`local-button ${selectedLocal === index ? 'active' : ''}`}
                onClick={() => handleLocalCardClick(local, index)}
              >
                <span className="local-name">{local.name}</span>
                <span className="local-address">{local.address}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* El cuadro descriptivo y los botones han sido eliminados. Los datos del local se muestran en la tarjeta interactiva. */}
      {!loading && !error && !currentLocal && locales.length > 0 && (
        <section className="local-content">
          <p className="empty-text">Selecciona un local para ver detalles</p>
        </section>
      )}

      <CreateLocalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </main>
  )
}

export default AdminDashboard
