import { useState } from 'react'
import { Settings, Trash2, AlertTriangle, Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { eliminarLocal, getResumenBorradoLocal } from '../lib/localsApi'

// ── Summary row labels ──────────────────────────────────────
// Solo estos dos se pueden contar de verdad: sus listados filtran por local.
const SUMMARY_LABELS = {
  mesas:         { label: 'Mesas',         icon: '🪑' },
  cajas_fisicas: { label: 'Cajas físicas', icon: '🗄' },
}

// ── Delete section ──────────────────────────────────────────
function DeleteSection({ locales, onDeleteDone }) {
  const [step, setStep]             = useState('list')        // list | confirm1 | loading | confirm2 | deleting
  const [target, setTarget]         = useState(null)          // local object
  const [summary, setSummary]       = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const handleSelectLocal = (local) => {
    setTarget(local)
    setStep('confirm1')
    setDeleteError(null)
  }

  const handleConfirm1 = async () => {
    setStep('loading')
    try {
      const data = await getResumenBorradoLocal(target.id)
      setSummary(data)
      setStep('confirm2')
    } catch (err) {
      setDeleteError(err.message || 'Error al obtener los datos')
      setStep('confirm1')
    }
  }

  const handleFinalDelete = async () => {
    setStep('deleting')
    try {
      await eliminarLocal(target.id)
      setStep('list')
      setTarget(null)
      setSummary(null)
      onDeleteDone()
    } catch (err) {
      setDeleteError(err.message || 'Error al eliminar')
      setStep('confirm2')
    }
  }

  const handleCancel = () => {
    setStep('list')
    setTarget(null)
    setSummary(null)
    setDeleteError(null)
  }

  if (step === 'list') {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
          Eliminar franquicia
        </h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Selecciona la franquicia que deseas eliminar permanentemente.
        </p>
        {locales.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] italic">No hay franquicias registradas.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {locales.map((local) => (
              <button
                key={local.id}
                type="button"
                onClick={() => handleSelectLocal(local)}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-[hsl(var(--border))] hover:border-red-300 hover:bg-red-50 transition-colors group text-left"
              >
                <span className="text-sm font-medium text-[hsl(var(--foreground))] group-hover:text-red-700 truncate">
                  {local.name}
                </span>
                <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))] group-hover:text-red-600 shrink-0 ml-2">
                  <Trash2 className="h-3.5 w-3.5" />
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (step === 'confirm1') {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
          Eliminar franquicia
        </h3>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              ¿Desea eliminar "{target?.name}"?
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Se borrarán todos los datos del local. Esta acción no se puede deshacer.
            </p>
          </div>
        </div>

        {deleteError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{deleteError}</p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel} className="flex-1">
            No, volver
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleConfirm1}
          >
            Sí, continuar
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando datos del local…</p>
      </div>
    )
  }

  if (step === 'confirm2' || step === 'deleting') {
    const isDeleting = step === 'deleting'
    const hayTurnosAbiertos = (summary?.turnosAbiertos || 0) > 0
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
          Confirmar eliminación
        </h3>

        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">
              ¿Realmente desea eliminar "{target?.name}"?
            </p>
            <p className="text-xs text-red-700 mt-0.5">Se borrarán los siguientes datos permanentemente:</p>
          </div>
        </div>

        {/* Data summary */}
        {summary && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] overflow-hidden">
            {Object.entries(SUMMARY_LABELS).map(([key, { label, icon }]) => {
              const val = summary.conteos?.[key]
              if (val === undefined || val === null) return null
              return (
                <div
                  key={key}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border))] last:border-b-0"
                >
                  <span className="text-sm text-[hsl(var(--foreground))]">
                    {icon} {label}
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${val > 0 ? 'text-red-600' : 'text-[hsl(var(--muted-foreground))]'}`}>
                    {val}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {summary && (
          <div className="space-y-2 text-xs">
            <div>
              <p className="font-bold text-[hsl(var(--foreground))]">También se elimina</p>
              <ul className="mt-1 list-disc pl-4 text-[hsl(var(--muted-foreground))] space-y-0.5">
                {summary.se_elimina.map((linea) => <li key={linea}>{linea}</li>)}
              </ul>
            </div>
            <div>
              <p className="font-bold text-[hsl(var(--foreground))]">Se conserva</p>
              <ul className="mt-1 list-disc pl-4 text-[hsl(var(--muted-foreground))] space-y-0.5">
                {summary.se_conserva.map((linea) => <li key={linea}>{linea}</li>)}
              </ul>
            </div>
            <p className="text-[hsl(var(--muted-foreground))]">
              El local se desactiva y se elimina en el mismo paso. Es permanente: no se puede deshacer.
            </p>
          </div>
        )}

        {hayTurnosAbiertos && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Este local tiene {summary.turnosAbiertos} turno{summary.turnosAbiertos !== 1 ? 's' : ''} de caja
            abierto{summary.turnosAbiertos !== 1 ? 's' : ''}. Ciérralo{summary.turnosAbiertos !== 1 ? 's' : ''} antes
            de eliminar el local: el servidor rechaza el borrado mientras queden abiertos.
          </p>
        )}

        {deleteError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{deleteError}</p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={isDeleting} className="flex-1">
            Cancelar
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            onClick={handleFinalDelete}
            disabled={isDeleting || hayTurnosAbiertos}
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Eliminando…
              </span>
            ) : 'Eliminar definitivamente'}
          </Button>
        </div>
      </div>
    )
  }

  return null
}

// ── Main drawer ─────────────────────────────────────────────
function OpcionesDrawer({ isOpen, onClose, locales, onDeleteDone }) {
  return (
    <>
      {/* Backdrop */}
      <div role="presentation"
        className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ zIndex: 500 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-[hsl(var(--card))] shadow-2xl border-l border-[hsl(var(--border))] flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ zIndex: 501 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
            <Settings className="h-4 w-4 text-[hsl(var(--primary))]" />
          </div>
          <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Opciones</h2>
        </div>

        {/* Body — scrollable; key forces remount on open so unsaved changes are discarded */}
        <div key={String(isOpen)} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-8 no-scrollbar">
          {/* El umbral de flujo tiene su propio botón en Inicio (UmbralFlujoDrawer). */}
          <DeleteSection locales={locales} onDeleteDone={onDeleteDone} />
        </div>
      </div>
    </>
  )
}

export default OpcionesDrawer
