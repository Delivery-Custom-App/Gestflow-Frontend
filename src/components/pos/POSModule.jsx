import { useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import { useMesasConEstado } from '../../hooks/useMesasConEstado'
import MesasKPICards from './MesasKPICards'
import MesasFilters from './MesasFilters'
import MesasVisualization from './MesasVisualization'
import KitchenDisplay from './KitchenDisplay'
import CreateMesaModal from './CreateMesaModal'
import EditMesaModal from './EditMesaModal'
import DeleteMesaModal from './DeleteMesaModal'
import MesaDetailModal from './MesaDetailModal'
import OrdenView from './OrdenView'
import PrinterConfigModal from './PrinterConfigModal'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Sun, Moon, LogOut, Printer } from 'lucide-react'

export default function POSModule() {
  const { isWorker, logout } = useAuth()
  const { darkMode, toggleDarkMode } = useTheme()
  const navigate = useNavigate()
  const { state: locState, pathname } = useLocation()
  const { localId } = useParams()
  const { mesas, loading: mesasLoading, createMesa, updateMesa, deleteMesa, refresh: refreshMesas } = useMesasConEstado(localId)
  const activeView = pathname.endsWith('/cocina') ? 'cocina' : 'mesas'
  const [showModal, setShowModal] = useState(false)
  const [filteredMesas, setFilteredMesas] = useState([])
  const [editingMesa, setEditingMesa] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deletingMesa, setDeletingMesa] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [selectedMesaDetail, setSelectedMesaDetail] = useState(null)
  const [showMesaDetail, setShowMesaDetail] = useState(false)
  const [selectedOrdenMesa, setSelectedOrdenMesa] = useState(null)
  const [showPrinterConfig, setShowPrinterConfig] = useState(false)
  const kpiRefreshRef = useRef(null)

  const selectedLocal = useSelectedLocal(localId, 'locales-only')

  const handleSubmitMesa = async (formData) => {
    await createMesa(formData)
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }

  const handleMesaSelect = (mesa) => {
    const state = mesa.state || 'libre'
    if (state === 'ocupada' || state === 'en_cobro') {
      setSelectedOrdenMesa(mesa)
    } else {
      setSelectedMesaDetail(mesa)
      setShowMesaDetail(true)
    }
  }

  const handleMesaDetailClose = () => {
    setShowMesaDetail(false)
    setSelectedMesaDetail(null)
  }

  const handleOrdenViewBack = () => {
    setSelectedOrdenMesa(null)
    refreshMesas()
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }

  const handleTableUpdated = () => {
    refreshMesas()
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }

  const handleFilteredMesasChange = (filtered, activeFilters) => {
    setFilteredMesas(filtered)
  }

  const handleEditMesa = (mesa) => {
    setEditingMesa(mesa)
    setShowEditModal(true)
  }

  const handleUpdateMesa = async (formData) => {
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
      if (kpiRefreshRef.current) kpiRefreshRef.current()
    } catch (error) {
      console.error('Error updating mesa:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteMesa = (mesa) => {
    setDeleteError(null)
    setDeletingMesa(mesa)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingMesa) return
    try {
      setIsDeleting(true)
      setDeleteError(null)
      await deleteMesa(deletingMesa.id)
      setShowDeleteModal(false)
      setDeletingMesa(null)
      if (kpiRefreshRef.current) kpiRefreshRef.current()
    } catch (error) {
      console.error('Error deleting mesa:', error)
      let errorMsg = 'Error al eliminar la mesa'
      if (error.message) {
        const match = error.message.match(/^\d+:\s*(.+)$/)
        errorMsg = match ? match[1] : error.message
      }
      setDeleteError(errorMsg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {/* Topbar */}
      <header className="flex items-center justify-between px-6 h-14 shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center gap-3">
          {activeView === 'cocina' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/local/${localId}/pos`, { state: locState })}
            >
              ← Mesas
            </Button>
          )}
          {activeView === 'mesas' && (
            <button
              data-onboarding="pos-kitchen-btn"
              onClick={() => navigate(`/local/${localId}/pos/cocina`, { state: locState })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              🍳 Vista Cocina
            </button>
          )}
          <div>
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] leading-none">
              {selectedLocal?.name || 'Local'}
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Punto de venta</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón día / noche */}
          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              cursor: 'pointer',
              color: darkMode ? '#facc15' : '#6b7280',
            }}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Cerrar sesión */}
          <button
            onClick={logout}
            title="Cerrar sesión"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              cursor: 'pointer',
              color: '#ef4444',
            }}
          >
            <LogOut size={16} />
          </button>

          {!isWorker && (
            <button
              onClick={() => setShowPrinterConfig(true)}
              title="Configurar ticketera"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                cursor: 'pointer',
                color: '#3b82f6',
              }}
            >
              <Printer size={16} />
            </button>
          )}
          {!isWorker && activeView === 'mesas' && !selectedOrdenMesa && (
            <Button size="sm" onClick={() => setShowModal(true)}>+ Nueva Mesa</Button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col min-h-0">
        {selectedOrdenMesa ? (
          <OrdenView
            mesa={selectedOrdenMesa}
            localId={localId}
            onBack={handleOrdenViewBack}
            onTableUpdated={handleTableUpdated}
          />
        ) : activeView === 'mesas' ? (
          <div className="space-y-6">
            <MesasKPICards localId={localId} onRefreshReady={(fn) => { kpiRefreshRef.current = fn }} />
            <section className="space-y-4" data-onboarding="pos-mesas-grid">
              <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">Visualización de Mesas</h3>
              <MesasFilters mesas={mesas} onFilteredMesasChange={handleFilteredMesasChange} />
              <MesasVisualization
                mesas={filteredMesas.length > 0 ? filteredMesas : mesas}
                loading={mesasLoading}
                onMesaSelect={handleMesaSelect}
                onEditMesa={isWorker ? null : handleEditMesa}
                onDeleteMesa={isWorker ? null : handleDeleteMesa}
              />
            </section>
          </div>
        ) : (
          <KitchenDisplay localId={localId} mesas={mesas} />
        )}
      </main>

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

      {showMesaDetail && selectedMesaDetail && (
        <MesaDetailModal
          mesa={selectedMesaDetail}
          localId={localId}
          onClose={handleMesaDetailClose}
          onTableUpdated={handleTableUpdated}
        />
      )}

      {showPrinterConfig && (
        <PrinterConfigModal
          localId={localId}
          onClose={() => setShowPrinterConfig(false)}
        />
      )}
    </>
  )
}
