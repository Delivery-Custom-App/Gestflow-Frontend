import { useState, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLocals } from '../../hooks/useLocals'
import { useMesasConEstado } from '../../hooks/useMesasConEstado'
import MesasKPICards from './MesasKPICards'
import MesasFilters from './MesasFilters'
import MesasVisualization from './MesasVisualization'
import CreateMesaModal from './CreateMesaModal'
import EditMesaModal from './EditMesaModal'
import DeleteMesaModal from './DeleteMesaModal'
import ReportesModal from './ReportesModal'
import MenuModal from './MenuModal'
import MesaDetailModal from './MesaDetailModal'
import '../../styles/POSModule.css'

const WORKER_ROLES = ['Empleado', 'Cajero']

export default function POSModule({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const { localId } = useParams()
  const isWorker = WORKER_ROLES.includes(userRole)
  const { locales } = useLocals()
  const { mesas, loading: mesasLoading, createMesa, updateMesa, deleteMesa, refresh: refreshMesas } = useMesasConEstado(localId)
  const [showModal, setShowModal] = useState(false)
  const [filteredMesas, setFilteredMesas] = useState([])
  const [editingMesa, setEditingMesa] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deletingMesa, setDeletingMesa] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [showReportes, setShowReportes] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [selectedMesaDetail, setSelectedMesaDetail] = useState(null)
  const [showMesaDetail, setShowMesaDetail] = useState(false)
  const kpiRefreshRef = useRef(null)

  const selectedLocal = useMemo(
    () => locales.find((l) => String(l.id) === String(localId)) || null,
    [locales, localId],
  )

  const handleSubmitMesa = async (formData) => {
    await createMesa(formData)
    // Refrescar KPIs tras crear mesa
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }

  const handleMesaSelect = (mesa) => {
    setSelectedMesaDetail(mesa)
    setShowMesaDetail(true)
  }

  const handleMesaDetailClose = () => {
    setShowMesaDetail(false)
    setSelectedMesaDetail(null)
  }

  const handleTableUpdated = () => {
    // Refrescar mesas y KPIs después de procesar pago
    refreshMesas()
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }

  const handleFilteredMesasChange = (filtered, activeFilters) => {
    // Sincronizar lista cuando cambian los filtros
    setFilteredMesas(filtered)
  }

  const handleEditMesa = (mesa) => {
    // Abrir modal de edición
    setEditingMesa(mesa)
    setShowEditModal(true)
  }

  const handleUpdateMesa = async (formData) => {
    // Persistir cambios de la mesa
    try {
      setIsUpdating(true)
      await updateMesa({
        id: formData.id,
        name: formData.name,
        capacidad: formData.capacidad,
        zona: formData.zona,
        is_active: formData.is_active,
      })
      setShowEditModal(false)
      setEditingMesa(null)
      // Refresh KPIs after update
      if (kpiRefreshRef.current) kpiRefreshRef.current()
    } catch (error) {
      console.error('Error updating mesa:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteMesa = (mesa) => {
    // Abrir confirmación de borrado
    setDeleteError(null)
    setDeletingMesa(mesa)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    // Ejecutar borrado de mesa
    if (!deletingMesa) return
    try {
      setIsDeleting(true)
      setDeleteError(null)
      await deleteMesa(deletingMesa.id)
      setShowDeleteModal(false)
      setDeletingMesa(null)
      // Refresh KPIs after delete
      if (kpiRefreshRef.current) kpiRefreshRef.current()
    } catch (error) {
      console.error('Error deleting mesa:', error)
      // Extraer mensaje de error del backend
      // Formato: "409: Cannot delete mesa with X active order(s)..."
      let errorMsg = 'Error al eliminar la mesa'
      if (error.message) {
        // Extraer solo la parte después del código de estado
        const match = error.message.match(/^\d+:\s*(.+)$/)
        errorMsg = match ? match[1] : error.message
      }
      setDeleteError(errorMsg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="pos-layout">
      {/* ── Sidebar ── */}
      <aside className="pos-sidebar" aria-label="Menú POS">
        <div className="pos-sidebar__brand">
          <div className="pos-sidebar__brand-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              <path d="M7 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              <path d="M10 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              <path d="M7 11V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              <path d="M16 3V11C16 12.7 17.3 14 19 14V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="pos-sidebar__brand-title">POS</h2>
          <p className="pos-sidebar__brand-sub">Módulo activo</p>
        </div>

        <button
          type="button"
          className="pos-sidebar__back"
          onClick={() => navigate(isWorker ? '/' : '/admin', { state: { focusLocalId: localId } })}
        >
          {isWorker ? '← Cambiar Local' : '← Volver a Módulos'}
        </button>

        <div className="pos-sidebar__user-card">
          <p className="pos-sidebar__user-name">{user?.email || '—'}</p>
          {userRole && <span className="pos-sidebar__badge">{userRole}</span>}
        </div>

        <p className="pos-sidebar__nav-heading">Navegación</p>
        <nav className="pos-sidebar__nav" aria-label="Secciones POS">
          <button type="button" className="pos-nav-link is-active">
            <span className="pos-nav-link__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="13" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="13" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            Mesas
          </button>
        </nav>

        <p className="pos-sidebar__nav-heading">Acciones</p>
        <div className="pos-sidebar__actions">
          <button type="button" className="pos-sidebar__action-btn" onClick={() => setShowMenu(true)}>
            <span aria-hidden="true">🍽</span> Menú
          </button>
          {!isWorker && (
            <button type="button" className="pos-sidebar__action-btn" onClick={() => setShowReportes(true)}>
              <span aria-hidden="true">📊</span> Reportes
            </button>
          )}
          {!isWorker && (
            <button type="button" className="pos-sidebar__action-btn pos-sidebar__action-btn--primary" onClick={() => setShowModal(true)}>
              <span aria-hidden="true">+</span> Nueva Mesa
            </button>
          )}
        </div>

        <div className="pos-sidebar__footer">
          <span className="pos-sidebar__footer-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
          <p className="pos-sidebar__footer-text">SibaGestión</p>
          <p className="pos-sidebar__footer-sub">desde 1991</p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="pos-main-wrapper">
        <header className="pos-topbar">
          <div className="pos-topbar__left">
            <div className="pos-brand-section">
              <img src="/sibaritco-logo.svg" alt="Sibarítco" className="pos-brand-logo" />
              <div className="pos-brand-text">
                <h2 className="pos-topbar__local">
                  {selectedLocal?.name || 'Local'}
                  <span className="demo-badge">DEMO</span>
                </h2>
                <p className="pos-header-subtitle">Punto de venta</p>
              </div>
            </div>
          </div>
          <div className="pos-topbar__right">
            <div className="pos-info-stack">
              <p className="pos-topbar__email">{user?.email}</p>
              <span className="pos-topbar__badge">{userRole || 'Usuario'}</span>
            </div>
            <button
              className="pos-logout-button"
              onClick={() => { onLogout(); navigate('/') }}
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
          </div>
        </header>

        <main className="pos-main-content">
          <MesasKPICards localId={localId} onRefreshReady={(fn) => { kpiRefreshRef.current = fn }} />

          <section className="mesas-section">
            <div className="mesas-section-header">
              <h3>Visualización de Mesas</h3>
              <div className="mesas-section-actions">
                <button className="btn-menu" type="button" onClick={() => setShowMenu(true)}>
                  🍽 Menú
                </button>
                {!isWorker && (
                  <button className="btn-reportes" type="button" onClick={() => setShowReportes(true)}>
                    📊 Reportes
                  </button>
                )}
                {!isWorker && (
                  <button className="btn-crear-mesa" type="button" onClick={() => setShowModal(true)}>
                    + Crear Mesa
                  </button>
                )}
              </div>
            </div>

            <MesasFilters mesas={mesas} onFilteredMesasChange={handleFilteredMesasChange} />

            <MesasVisualization
              mesas={filteredMesas.length > 0 ? filteredMesas : mesas}
              loading={mesasLoading}
              onMesaSelect={handleMesaSelect}
              onEditMesa={isWorker ? null : handleEditMesa}
              onDeleteMesa={isWorker ? null : handleDeleteMesa}
            />
          </section>
        </main>
      </div>

      {showModal && (
        <CreateMesaModal
          mesas={mesas}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitMesa}
        />
      )}

      {showEditModal && editingMesa && (
        <EditMesaModal
          mesa={editingMesa}
          onClose={() => {
            setShowEditModal(false)
            setEditingMesa(null)
          }}
          onSubmit={handleUpdateMesa}
        />
      )}

      {showDeleteModal && deletingMesa && (
        <DeleteMesaModal
          mesa={deletingMesa}
          onClose={() => {
            setShowDeleteModal(false)
            setDeletingMesa(null)
            setDeleteError(null)
          }}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
          error={deleteError}
        />
      )}

      {showMenu && (
        <MenuModal localId={localId} onClose={() => setShowMenu(false)} />
      )}

      {showReportes && (
        <ReportesModal localId={localId} onClose={() => setShowReportes(false)} />
      )}

      {showMesaDetail && selectedMesaDetail && (
        <MesaDetailModal
          mesa={selectedMesaDetail}
          localId={localId}
          onClose={handleMesaDetailClose}
          onTableUpdated={handleTableUpdated}
        />
      )}
    </div>
  )
}
