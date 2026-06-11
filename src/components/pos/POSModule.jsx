import { useState, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
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
import { Button } from '@/components/ui/button'
import { LogOut, Printer } from 'lucide-react'

export default function POSModule() {
  const { isWorker, logout } = useAuth()
  const { pathname } = useLocation()
  const { localId } = useParams()
  const { mesas, loading: mesasLoading, createMesa, updateMesa, deleteMesa, refresh: refreshMesas } = useMesasConEstado(localId)
  const activeView = pathname.endsWith('/cocina') ? 'cocina' : 'mesas'
  const [showModal, setShowModal] = useState(false)
  const [filteredMesas, setFilteredMesas] = useState([])
  const [editingMesa, setEditingMesa] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deletingMesa, setDeletingMesa] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [selectedMesaDetail, setSelectedMesaDetail] = useState(null)
  const [showMesaDetail, setShowMesaDetail] = useState(false)
  const [selectedOrdenMesa, setSelectedOrdenMesa] = useState(null)
  const [showPrinterConfig, setShowPrinterConfig] = useState(false)
  const kpiRefreshRef = useRef(null)

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

  const handleFilteredMesasChange = (filtered) => {
    setFilteredMesas(filtered)
  }

  const handleEditMesa = (mesa) => {
    setEditingMesa(mesa)
    setShowEditModal(true)
  }

  const handleUpdateMesa = async (formData) => {
    try {
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
      {/* Main */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 lg:p-6 flex flex-col min-h-0">
        {/* Fila de acciones — solo visible en vista mesas */}
        {activeView === 'mesas' && !selectedOrdenMesa && (
          <div className="flex items-center justify-end mb-4 pr-20">
            {isWorker && (
              <button
                onClick={logout}
                title="Cerrar sesión"
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut size={15} />
              </button>
            )}
            {!isWorker && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrinterConfig(true)}
                  title="Configurar ticketera"
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                >
                  <Printer size={15} />
                </button>
                <Button size="sm" onClick={() => setShowModal(true)}>Crear Mesa</Button>
              </div>
            )}
          </div>
        )}
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

      <PrinterConfigModal
        open={showPrinterConfig}
        localId={localId}
        onClose={() => setShowPrinterConfig(false)}
      />
    </>
  )
}
