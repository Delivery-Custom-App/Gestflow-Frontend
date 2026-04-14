import { useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import InventoryShell from './InventoryShell'

function InventoryHub({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { localId } = useParams()

  const selectedLocal = useMemo(() => {
    if (location.state?.local) return location.state.local
    return { id: localId, name: `Local ${localId ?? ''}` }
  }, [location.state, localId])

  const openStock = () => {
    navigate(`/local/${localId}/inventario/stock`, { state: { local: selectedLocal } })
  }

  return (
    <InventoryShell user={user} userRole={userRole} onLogout={onLogout} active="hub">
      <div className="inv-hub">
        <h1 className="inv-hub-title">Módulo inventario</h1>
        <p className="inv-hub-lead">Elige una sección para gestionar el inventario de este local.</p>
        <div className="inv-hub-cards">
          <button type="button" className="inv-hub-card" onClick={openStock}>
            <span className="inv-hub-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3l8 4v10l-8 4-8-4V7l8-4z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <span className="inv-hub-card-title">Control de stock</span>
            <span className="inv-hub-card-desc">KPIs, listado de productos y alta de ítems (HU-42 / SCRUM-382).</span>
          </button>
        </div>
      </div>
    </InventoryShell>
  )
}

export default InventoryHub
