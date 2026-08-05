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
import { CreditCard, PlusCircle, Printer } from 'lucide-react'

export default function POSModule() {
  const { isWorker } = useAuth()
  const { pathname } = useLocation()
  const { localId } = useParams()
  const { cajaId } = useCajaActiva(localId)
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
      {/* Main */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 lg:p-6 flex flex-col min-h-0">
        {/* Fila de acciones — solo visible en vista mesas */}
        {activeView === 'mesas' && !selectedOrdenMesa && !isWorker && (
          <div className="mb-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setShowMPConfig(true)}
                className="min-h-[86px] rounded-2xl border border-[hsl(var(--border))] border-l-4 border-l-blue-700 bg-[hsl(var(--card))] px-4 py-3 text-left text-[hsl(var(--foreground))] shadow-sm ring-1 ring-black/5 transition hover:bg-[hsl(var(--muted)/0.45)] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm">
                    <CreditCard size={23} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black uppercase tracking-wide">Configurar POS</span>
                    <span className="mt-1 block text-xs font-semibold leading-snug text-[hsl(var(--muted-foreground))]">
                      Vincular MercadoPago Point y revisar terminales.
                    </span>
                  </span>
                </span>
              </button>
              <button
                onClick={() => setShowPrinterConfig(true)}
                className="min-h-[86px] rounded-2xl border border-[hsl(var(--border))] border-l-4 border-l-amber-700 bg-[hsl(var(--card))] px-4 py-3 text-left text-[hsl(var(--foreground))] shadow-sm ring-1 ring-black/5 transition hover:bg-[hsl(var(--muted)/0.45)] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-amber-500/60"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-700 text-white shadow-sm">
                    <Printer size={23} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black uppercase tracking-wide">Impresora</span>
                    <span className="mt-1 block text-xs font-semibold leading-snug text-[hsl(var(--muted-foreground))]">
                      Registrar ticketera, IP y prueba de conexión.
                    </span>
                  </span>
                </span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="min-h-[86px] rounded-2xl border border-[hsl(var(--border))] border-l-4 border-l-emerald-700 bg-[hsl(var(--card))] px-4 py-3 text-left text-[hsl(var(--foreground))] shadow-sm ring-1 ring-black/5 transition hover:bg-[hsl(var(--muted)/0.45)] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm">
                    <PlusCircle size={23} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black uppercase tracking-wide">Crear mesa</span>
                    <span className="mt-1 block text-xs font-semibold leading-snug text-[hsl(var(--muted-foreground))]">
                      Agregar una mesa nueva al salón del local.
                    </span>
                  </span>
                </span>
              </button>
            </div>
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
          cajaId={cajaId}
          onClose={handleMesaDetailClose}
          onTableUpdated={handleTableUpdated}
        />
      )}

      <PrinterConfigModal
        open={showPrinterConfig}
        localId={localId}
        onClose={() => setShowPrinterConfig(false)}
      />

      <MPConfigDrawer
        open={showMPConfig}
        localId={localId}
        onClose={() => setShowMPConfig(false)}
      />
    </>
  )
}
