import { useState, useRef, useCallback } from 'react'
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
import MPConfigDrawer from './MPConfigDrawer'
import { useAuth } from '../../context/AuthContext'
import { useCajaActiva } from '../../hooks/useCajaActiva'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import { CreditCard, PlusCircle, Printer } from 'lucide-react'

export default function POSModule() {
  const { isWorker } = useAuth()
  const { pathname } = useLocation()
  const { localId } = useParams()
  const { cajaId } = useCajaActiva(localId)
  const { mesas, loading: mesasLoading, error: mesasError, createMesa, updateMesa, deleteMesa, refresh: refreshMesas } = useMesasConEstado(localId)
  const activeView = pathname.endsWith('/cocina') ? 'cocina' : 'mesas'
  const [showModal, setShowModal] = useState(false)
  const [filteredMesas, setFilteredMesas] = useState(null)
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
  const [showMPConfig, setShowMPConfig] = useState(false)
  const kpiRefreshRef = useRef(null)

  const handleSubmitMesa = async (formData) => {
    await createMesa(formData)
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }

  // Handlers memoizados (useCallback): mantienen referencia estable entre renders
  // para que los hijos memoizados (MesasVisualization/MesaCard) no re-rendericen
  // cuando POSModule cambia de estado por otra causa (AC1, H1).
  const handleMesaSelect = useCallback((mesa) => {
    const state = mesa.state || 'libre'
    if (state === 'ocupada' || state === 'en_cobro') {
      setSelectedOrdenMesa(mesa)
    } else {
      setSelectedMesaDetail(mesa)
      setShowMesaDetail(true)
    }
  }, [])

  const handleMesaDetailClose = useCallback(() => {
    setShowMesaDetail(false)
    setSelectedMesaDetail(null)
  }, [])

  const handleOrdenViewBack = useCallback(() => {
    setSelectedOrdenMesa(null)
    refreshMesas()
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }, [refreshMesas])

  const handleTableUpdated = useCallback(() => {
    refreshMesas()
    if (kpiRefreshRef.current) kpiRefreshRef.current()
  }, [refreshMesas])

  const handleFilteredMesasChange = useCallback((filtered) => {
    setFilteredMesas(filtered)
  }, [])

  const handleEditMesa = useCallback((mesa) => {
    setEditingMesa(mesa)
    setShowEditModal(true)
  }, [])

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

  const handleDeleteMesa = useCallback((mesa) => {
    setDeleteError(null)
    setDeletingMesa(mesa)
    setShowDeleteModal(true)
  }, [])

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
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 lg:p-6 flex flex-col min-h-0">
        {activeView === 'mesas' && !selectedOrdenMesa && (
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">Mesas</h1>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Configura el salón y revisa el estado de las mesas en tiempo real.
              </p>
            </div>
            {!isWorker && (
              <div className="flex flex-wrap items-center gap-2">
                {isV2FeatureEnabled('mpConfig') && (
                  <button
                    onClick={() => setShowMPConfig(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                  >
                    <CreditCard size={16} />
                    POS
                  </button>
                )}
                {isV2FeatureEnabled('printers') && (
                  <button
                    onClick={() => setShowPrinterConfig(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                  >
                    <Printer size={16} />
                    Impresora
                  </button>
                )}
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                >
                  <PlusCircle size={16} />
                  Crear mesa
                </button>
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
          <div className="space-y-5">
            <MesasKPICards localId={localId} onRefreshReady={(fn) => { kpiRefreshRef.current = fn }} />
            {mesasError ? (
              <div className="rounded-xl border-2 border-red-200 bg-red-50 p-8 text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base mb-1">Error al cargar mesas</h3>
                      <p className="text-sm">{mesasError}</p>
                      {mesasError.toLowerCase().includes('not found') && (
                        <p className="mt-2 text-sm opacity-80">
                          Verifica que el backend esté corriendo y que tengas permisos para acceder a este local.
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={refreshMesas}
                    className="self-start rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            ) : (
              <section className="space-y-4" data-onboarding="pos-mesas-grid">
                <MesasFilters mesas={mesas} onFilteredMesasChange={handleFilteredMesasChange} />
                <MesasVisualization
                  mesas={filteredMesas ?? mesas}
                  loading={mesasLoading}
                  onMesaSelect={handleMesaSelect}
                  onEditMesa={isWorker ? null : handleEditMesa}
                  onDeleteMesa={isWorker ? null : handleDeleteMesa}
                />
              </section>
            )}
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
          cajaId={cajaId}
          onClose={handleMesaDetailClose}
          onTableUpdated={handleTableUpdated}
        />
      )}

      {isV2FeatureEnabled('printers') && (
      <PrinterConfigModal
        open={showPrinterConfig}
        localId={localId}
        onClose={() => setShowPrinterConfig(false)}
      />
      )}

      {isV2FeatureEnabled('mpConfig') && (
      <MPConfigDrawer
        open={showMPConfig}
        localId={localId}
        onClose={() => setShowMPConfig(false)}
      />
      )}
    </>
  )
}
