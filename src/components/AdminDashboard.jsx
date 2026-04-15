import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLocals } from '../hooks/useLocals'
import CreateLocalModal from './CreateLocalModal'
import ModulesGrid from './ModulesGrid'
import LocalsGrid from './LocalsGrid'
import '../styles/AdminDashboard.css'

function AdminDashboard({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedLocal, setSelectedLocal] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { locales, loading, error, refetch } = useLocals()

  const currentLocal = selectedLocal !== null ? locales[selectedLocal] : null

  useEffect(() => {
    if (loading) return
    const st = location.state
    const fid = st?.focusLocalId
    const loc = st?.local
    if (!fid && !loc?.id) return
    if (!locales?.length) return

    let idx = -1
    if (loc?.id) {
      idx = locales.findIndex((l) => String(l.id) === String(loc.id))
    } else if (fid) {
      idx = locales.findIndex((l) => String(l.id) === String(fid))
    }

    const path = location.pathname === '/' ? '/admin' : location.pathname
    if (idx >= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizar con react-router al volver desde módulos
      setSelectedLocal(idx)
    }
    navigate(path, { replace: true, state: {} })
  }, [loading, locales, location.state, location.pathname, navigate])

  const handleCreateSuccess = () => {
    refetch()
    setSelectedLocal(null)
  }

  const handleLocalCardClick = (local, index) => {
    setSelectedLocal(index)
  }

  // Show modules grid when a local is selected
  if (currentLocal) {
    return (
      <>
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
                <p className="header-subtitle">{currentLocal.name}</p>
              </div>
            </div>

            <div className="user-section">
              <span className="user-email">{user?.email}</span>
              <span className="user-badge">{userRole || 'Usuario'}</span>
              {/*
                SUPERADMIN ONLY: Back to Locales button
                This button navigates back to the locale selector
                Backend Consideration: Ensure role-based access control validates SUPERADMIN permissions
              */}
              <button
                className="back-button"
                onClick={() => setSelectedLocal(null)}
                aria-label="Volver a selector de locales"
                title="Volver a seleccionar un local"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor" />
                  <path d="M12 6C10.34 6 9 7.34 9 9H11C11 8.45 11.45 8 12 8C12.55 8 13 8.45 13 9C13 10 12 10.5 12 12H14C14 10.67 15 9.5 15 9C15 7.34 13.66 6 12 6Z" fill="currentColor" />
                  <path d="M13 18H11V16H13Z" fill="currentColor" />
                </svg>
              </button>
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
        <ModulesGrid localId={currentLocal.id} localName={currentLocal.name} userRole={userRole} />
      </>
    )
  }

  // Show local selector with new LocalsGrid component
  if (loading) {
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
        <p className="loading-text">Cargando locales...</p>
      </main>
    )
  }

  if (error) {
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
        <p className="error-text">Error: {error}</p>
      </main>
    )
  }

  return (
    <>
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

      <LocalsGrid
        locales={locales}
        onLocalSelect={handleLocalCardClick}
        onCreateLocal={() => setIsModalOpen(true)}
      />

      <CreateLocalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </>
  )
}

export default AdminDashboard
