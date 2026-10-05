import { useState, useCallback, useMemo } from 'react'
import { Link2, X as XIcon } from 'lucide-react'
import { useParams, useLocation } from 'react-router'
import { useMesasConEstado } from '../../hooks/useMesasConEstado'
import { useMesasKPIs } from '../../hooks/useMesasKPIs'
import MesasKPICards from './MesasKPICards'
import MesasFilters from './MesasFilters'
import { applyFilters, EMPTY_MESA_FILTERS } from './filterMesas'
import MesasVisualization from './MesasVisualization'
import { useGruposDeMesas } from '../../hooks/useGruposDeMesas'
import KitchenDisplay from './KitchenDisplay'
import CreateMesaModal from './CreateMesaModal'
import EditMesaModal from './EditMesaModal'
import DeleteMesaModal from './DeleteMesaModal'
import MesaWorkspace from './MesaWorkspace'
import PrinterConfigModal from './PrinterConfigModal'
import MPConfigDrawer from './MPConfigDrawer'
import { useAuth } from '../../context/AuthContext'
import { useCajaActiva } from '../../hooks/useCajaActiva'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import {
  atencionDeMesa, fueTraspasada, nombreDePersona, useDatosDeAtencion, vendedoresDelLocal,
} from '../../lib/atencionMesas'
import TraspasarMesasModal from './TraspasarMesasModal'
import { toast } from 'sonner'
import { ArrowRightLeft, CreditCard, PlusCircle, Printer } from 'lucide-react'

export default function POSModule() {
  const { isWorker, user } = useAuth()
  const { pathname } = useLocation()
  const { localId } = useParams()
  const { cajaId } = useCajaActiva(localId)
  const { mesas, loading: mesasLoading, error: mesasError, createMesa, updateMesa, deleteMesa, refresh: refreshMesas } = useMesasConEstado(localId)
  const activeView = pathname.endsWith('/cocina') ? 'cocina' : 'mesas'
  const { kpis, loading: kpisLoading, error: kpisError, refresh: refreshKpis } = useMesasKPIs(activeView === 'mesas' ? localId : null)
  const [showModal, setShowModal] = useState(false)
  const [mesaFilters, setMesaFilters] = useState(EMPTY_MESA_FILTERS)
  const filteredMesas = useMemo(() => applyFilters(mesas, mesaFilters), [mesas, mesaFilters])
  const [editingMesa, setEditingMesa] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deletingMesa, setDeletingMesa] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [selectedMesa, setSelectedMesa] = useState(null)
  const [showPrinterConfig, setShowPrinterConfig] = useState(false)
  const [showMPConfig, setShowMPConfig] = useState(false)

  // ── Quién atiende cada mesa, y traspasar mesas (encargado y dueño) ───────
  const { usuarios, usuariosPorId, duenoDeTurno, recargar: recargarAtencion } = useDatosDeAtencion(localId, { esVendedor: isWorker })
  const [traspasando, setTraspasando] = useState(false)
  const nombre = useCallback(
    (id) => nombreDePersona(id, { yoId: user?.id, usuariosPorId }),
    [user?.id, usuariosPorId],
  )
  const mesasEnCurso = useMemo(
    () => mesas.map((m) => atencionDeMesa(m, duenoDeTurno)).filter(Boolean),
    [mesas, duenoDeTurno],
  )
  const atencionPorMesa = useMemo(() => new Map(mesasEnCurso.map((info) => [String(info.mesa.id), {
    atiende: info.atiendeId ? nombre(info.atiendeId) : 'Sin registrar',
    antes: fueTraspasada(info) ? nombre(info.abrioId) : null,
  }])), [mesasEnCurso, nombre])

  const handleTraspasoHecho = useCallback(({ cantidad, a }) => {
    setTraspasando(false)
    toast.success(`${cantidad} mesa${cantidad === 1 ? '' : 's'} traspasada${cantidad === 1 ? '' : 's'} a ${a}`)
    refreshMesas()
    recargarAtencion()
  }, [refreshMesas, recargarAtencion])

  // ── Agrupar mesas ───────────────────────────────────────────────────
  const { porMesa: gruposPorMesa, crear: crearGrupo, deshacer: deshacerGrupo } = useGruposDeMesas(localId)
  const [modoAgrupar, setModoAgrupar] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState(() => new Set())
  const [grupoError, setGrupoError] = useState(null)
  const [guardandoGrupo, setGuardandoGrupo] = useState(false)

  const salirDeAgrupar = useCallback(() => {
    setModoAgrupar(false)
    setSeleccionadas(new Set())
    setGrupoError(null)
  }, [])

  const handleToggleSeleccion = useCallback((mesa) => {
    setGrupoError(null)
    setSeleccionadas((previas) => {
      const siguiente = new Set(previas)
      const clave = String(mesa.id)
      if (siguiente.has(clave)) siguiente.delete(clave)
      else siguiente.add(clave)
      return siguiente
    })
  }, [])

  const handleCrearGrupo = useCallback(async () => {
    setGuardandoGrupo(true)
    setGrupoError(null)
    try {
      await crearGrupo([...seleccionadas])
      salirDeAgrupar()
      refreshMesas()
      refreshKpis()
    } catch (e) {
      setGrupoError(e?.message || 'No se pudieron juntar las mesas')
    } finally {
      setGuardandoGrupo(false)
    }
  }, [crearGrupo, seleccionadas, salirDeAgrupar, refreshMesas, refreshKpis])

  const handleDeshacerGrupo = useCallback(async (grupo) => {
    setGrupoError(null)
    try {
      await deshacerGrupo(grupo.id)
      refreshMesas()
      refreshKpis()
    } catch (e) {
      setGrupoError(e?.message || 'No se pudo separar el grupo')
    }
  }, [deshacerGrupo, refreshMesas, refreshKpis])

  const capacidadSeleccionada = useMemo(
    () => mesas
      .filter((m) => seleccionadas.has(String(m.id)))
      .reduce((total, m) => total + (Number(m.capacidad) || 0), 0),
    [mesas, seleccionadas],
  )

  const handleSubmitMesa = async (formData) => {
    await createMesa(formData)
    refreshKpis()
  }

  // Handlers memoizados (useCallback): mantienen referencia estable entre renders
  // para que los hijos memoizados (MesasVisualization/MesaCard) no re-rendericen
  // cuando POSModule cambia de estado por otra causa (AC1, H1).
  const handleMesaSelect = useCallback((mesa) => {
    setSelectedMesa(mesa)
  }, [])

  const handleWorkspaceBack = useCallback(() => {
    setSelectedMesa(null)
    refreshMesas()
    refreshKpis()
  }, [refreshMesas, refreshKpis])

  const handleTableUpdated = useCallback(() => {
    refreshMesas()
    refreshKpis()
  }, [refreshMesas, refreshKpis])


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
      refreshKpis()
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
      refreshKpis()
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
        {activeView === 'mesas' && !selectedMesa && (
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
        {selectedMesa ? (
          <MesaWorkspace
            mesa={selectedMesa}
            atencion={atencionPorMesa.get(String(selectedMesa.id)) || null}
            localId={localId}
            cajaId={cajaId}
            onBack={handleWorkspaceBack}
            onTableUpdated={handleTableUpdated}
          />
        ) : activeView === 'mesas' ? (
          <div className="space-y-5">
            <MesasKPICards kpis={kpis} loading={kpisLoading} error={kpisError} />
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
                <MesasFilters mesas={mesas} filters={mesaFilters} onFiltersChange={setMesaFilters} filteredCount={filteredMesas.length} />

                {/* Juntar mesas para un grupo grande: la atención pasa a ser una sola. */}
                {modoAgrupar ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.06)] px-4 py-3">
                    <div className="text-sm text-[hsl(var(--foreground))]">
                      <strong className="font-semibold">{seleccionadas.size} mesa{seleccionadas.size === 1 ? '' : 's'} elegida{seleccionadas.size === 1 ? '' : 's'}</strong>
                      {capacidadSeleccionada > 0 && (
                        <span className="text-[hsl(var(--muted-foreground))]"> · {capacidadSeleccionada} personas en total</span>
                      )}
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Solo se pueden juntar mesas libres que no estén ya en un grupo.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={salirDeAgrupar}
                        className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleCrearGrupo}
                        disabled={seleccionadas.size < 2 || guardandoGrupo}
                        className="rounded-lg bg-[hsl(var(--primary))] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {guardandoGrupo ? 'Juntando…' : 'Juntar mesas'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-end gap-2">
                    {/* Solo encargado y dueño: el vendedor no puede ver a sus compañeros para elegir a quién. */}
                    {!isWorker && (
                      <button
                        type="button"
                        onClick={() => setTraspasando(true)}
                        disabled={mesasEnCurso.length === 0}
                        title={mesasEnCurso.length === 0 ? 'No hay mesas en curso' : undefined}
                        className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary))] transition-colors disabled:opacity-40 disabled:hover:text-[hsl(var(--muted-foreground))] disabled:hover:border-[hsl(var(--border))]"
                      >
                        <ArrowRightLeft size={14} />
                        Traspasar mesas
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setModoAgrupar(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary))] transition-colors"
                    >
                      <Link2 size={14} />
                      Agrupar mesas
                    </button>
                  </div>
                )}

                {grupoError && (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800/50 dark:bg-red-950/30">
                    <p className="text-xs text-red-600 dark:text-red-400">{grupoError}</p>
                    <button type="button" aria-label="Cerrar aviso" onClick={() => setGrupoError(null)} className="text-red-500 hover:opacity-70">
                      <XIcon size={14} />
                    </button>
                  </div>
                )}

                <MesasVisualization
                  mesas={filteredMesas}
                  loading={mesasLoading}
                  onMesaSelect={handleMesaSelect}
                  onEditMesa={isWorker ? null : handleEditMesa}
                  onDeleteMesa={isWorker ? null : handleDeleteMesa}
                  gruposPorMesa={gruposPorMesa}
                  modoAgrupar={modoAgrupar}
                  seleccionadas={seleccionadas}
                  onToggleSeleccion={handleToggleSeleccion}
                  onDeshacerGrupo={handleDeshacerGrupo}
                  atencionPorMesa={atencionPorMesa}
                />
              </section>
            )}
          </div>
        ) : (
          <KitchenDisplay localId={localId} mesas={mesas} />
        )}
      </main>

      {traspasando && (
        <TraspasarMesasModal
          mesas={mesasEnCurso}
          vendedores={vendedoresDelLocal(usuarios, localId)}
          nombre={nombre}
          onClose={() => setTraspasando(false)}
          onDone={handleTraspasoHecho}
        />
      )}

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
