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
  const kpiRefreshRef = useRef(null)

  const selectedLocal = useMemo(
    () => locales.find((l) => String(l.id) === String(localId)) || null,
    [locales, localId],
  )

  const handleSubmitMesa = async (formData) => {
    await createMesa(formData)
    // Refresh KPIs after creation (SCRUM-481)
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }

  const handleMesaSelect = (mesa) => {
    // HU-60 SCRUM-486: Navegar a detalle de mesa
    navigate(`/local/${localId}/pos/mesa/${mesa.id}`)
  }

  const handleFilteredMesasChange = (filtered, activeFilters) => {
    // HU-63: Actualizar mesas filtradas cuando cambian los filtros
    setFilteredMesas(filtered)
  }

  const handleEditMesa = (mesa) => {
    // HU-64 SCRUM-519: Abrir modal para editar mesa
    setEditingMesa(mesa)
    setShowEditModal(true)
  }

  const handleUpdateMesa = async (formData) => {
    // HU-64 SCRUM-520: Actualizar mesa desde el modal
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
    // HU-64 SCRUM-521: Abrir modal de confirmación para eliminar
    setDeleteError(null)
    setDeletingMesa(mesa)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    // HU-64 SCRUM-521: Confirmar eliminación de mesa
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
    <main className="pos-module">
      <header className="pos-header">
        <div className="pos-header-content">
          <div className="pos-brand">
            <div className="pos-brand-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                <path d="M7 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                <path d="M10 3V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                <path d="M7 11V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                <path d="M16 3V11C16 12.7 17.3 14 19 14V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1>POS Restaurante</h1>
              <p>{selectedLocal?.name || 'Local'}</p>
            </div>
          </div>

          <div className="pos-header-user">
            <div>
              <p className="pos-user-email">{user?.email}</p>
              <p className="pos-user-role">{userRole}</p>
            </div>
            <button className="pos-logout-btn" type="button" onClick={() => { onLogout(); navigate('/') }}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="pos-body">
        {/* KPIs — le pasamos ref para poder triggerear refresh desde fuera */}
        <MesasKPICards localId={localId} onRefreshReady={(fn) => { kpiRefreshRef.current = fn }} />

        {/* HU-59/HU-63: Visualización de listado de mesas en formato gráfico con filtros */}
        <section className="mesas-section">
          <div className="mesas-section-header">
            <h3>Visualización de Mesas</h3>
            <div className="mesas-section-actions">
              <button
                className="btn-menu"
                type="button"
                onClick={() => setShowMenu(true)}
              >
                🍽 Menú
              </button>
              {!isWorker && (
                <button
                  className="btn-reportes"
                  type="button"
                  onClick={() => setShowReportes(true)}
                >
                  📊 Reportes
                </button>
              )}
              {!isWorker && (
                <button
                  className="btn-crear-mesa"
                  type="button"
                  onClick={() => setShowModal(true)}
                >
                  + Crear Mesa
                </button>
              )}
            </div>
          </div>
          
          {/* HU-63 SCRUM-497: UI de filtros */}
          <MesasFilters 
            mesas={mesas}
            onFilteredMesasChange={handleFilteredMesasChange}
          />
          
          {/* Mostrar mesas filtradas o todas las mesas si no hay filtros activos */}
          <MesasVisualization
            mesas={filteredMesas.length > 0 ? filteredMesas : mesas}
            loading={mesasLoading}
            onMesaSelect={handleMesaSelect}
            onEditMesa={isWorker ? null : handleEditMesa}
            onDeleteMesa={isWorker ? null : handleDeleteMesa}
          />
        </section>
      </div>

      <footer className="pos-footer">
        <button
          className="pos-back-btn"
          type="button"
          onClick={() => navigate(isWorker ? '/' : `/local/${localId}`)}
        >
          {isWorker ? '← Cambiar Local' : '← Volver a Módulos'}
        </button>
      </footer>

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
    </main>
  )
}
