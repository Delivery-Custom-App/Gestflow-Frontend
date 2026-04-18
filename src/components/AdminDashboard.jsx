import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLocals } from '../hooks/useLocals'
import CreateLocalModal from './CreateLocalModal'
import ModulesGrid from './ModulesGrid'
import LocalsGrid from './LocalsGrid'
import LoadingSpinner from './LoadingSpinner'
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
              <img src="/sibaritco-logo.svg" alt="Sibarítco" className="brand-logo-small" />
              <div>
                <h1>
                  SibaGestion
                  <span className="demo-badge">DEMO</span>
                </h1>
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
                  <path d="M19 12H5M12 5L5 12L12 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
              <img src="/sibaritco-logo.svg" alt="Sibarítco" className="brand-logo-small" />
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
        <main className="admin-main">
          <LoadingSpinner message="Cargando locales..." />
        </main>
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
