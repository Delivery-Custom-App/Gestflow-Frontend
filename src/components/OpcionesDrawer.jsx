import { useState } from 'react'
import { Settings, Trash2, AlertTriangle, Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest, getOptionalAuthContext } from '../lib/apiClient'

// ── Summary row labels ──────────────────────────────────────
const SUMMARY_LABELS = {
  mesas:          { label: 'Mesas',           icon: '🪑' },
  categorias:     { label: 'Categorías',       icon: '📂' },
  productos:      { label: 'Productos',        icon: '📦' },
  recetas:        { label: 'Recetas / Menú',   icon: '🍽' },
  proveedores:    { label: 'Proveedores',      icon: '🚚' },
  inventario:     { label: 'Registros inventario', icon: '📊' },
  ordenes:        { label: 'Órdenes',          icon: '🛒' },
  gastos:         { label: 'Gastos',           icon: '💸' },
  transferencias: { label: 'Transferencias',   icon: '🔄' },
  cajas:          { label: 'Cajas',            icon: '🗄' },
  alertas:        { label: 'Alertas',          icon: '🔔' },
}

// ── Thresholds section ──────────────────────────────────────
function ThresholdsSection({ thresholds, onSave }) {
  const [medium,   setMedium]   = useState(String(thresholds.medium))
  const [high,     setHigh]     = useState(String(thresholds.high))
  const [salesDays, setSalesDays] = useState(String(thresholds.salesDays ?? 1))
  const [error,    setError]    = useState(null)
  const [saved,    setSaved]    = useState(false)

  const handleSave = () => {
    const m = parseInt(medium, 10)
    const h = parseInt(high, 10)
    const d = parseInt(salesDays, 10)
    if (isNaN(m) || isNaN(h) || m < 1 || h < 1) {
      setError('Los valores de umbral deben ser enteros positivos')
      return
    }
    if (m >= h) {
      setError('El umbral "Flujo medio" debe ser menor que "Alto flujo"')
      return
    }
    if (isNaN(d) || d < 1) {
      setError('El período debe ser un entero positivo (días)')
      return
    }
    onSave({ medium: m, high: h, salesDays: d })
    setError(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Período de ventas ── */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-1">
            Período de ventas
          </h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Días a acumular en el indicador de flujo (entero).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="1"
            max="365"
            step="1"
            value={salesDays}
            onChange={(e) => { setError(null); setSalesDays(e.target.value) }}
            onKeyDown={(e) => { if (e.key === '.' || e.key === ',') e.preventDefault() }}
          />
          <span className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">días</span>
        </div>
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* ── Umbrales de color ── */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-1">
            Umbrales de flujo
          </h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Cuántas ventas acumuladas determinan el color de cada franquicia.
          </p>
        </div>

        {/* Preview */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            0 – {medium || '?'} · Flujo bajo
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            {medium || '?'} – {high || '?'} · Flujo medio
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            ≥ {high || '?'} · Alto flujo
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="thr-medium" className="text-xs">Umbral flujo medio</Label>
          <Input
            id="thr-medium"
            type="number"
            min="1"
            value={medium}
            onChange={(e) => {
              setError(null); setSaved(false)
              const val = e.target.value
              setMedium(val)
              const m = parseInt(val, 10)
              const h = parseInt(high, 10)
              if (!isNaN(m) && !isNaN(h) && m >= h) setHigh(String(m + 1))
            }}
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">ventas → amarillo</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="thr-high" className="text-xs">Umbral alto flujo</Label>
          <Input
            id="thr-high"
            type="number"
            min="1"
            value={high}
            onChange={(e) => {
              setError(null); setSaved(false)
              const val = e.target.value
              setHigh(val)
              const h = parseInt(val, 10)
              const m = parseInt(medium, 10)
              if (!isNaN(h) && !isNaN(m) && h <= m) {
                setMedium(String(Math.max(0, h - 1)))
              }
            }}
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">ventas → rojo</p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <Button size="sm" onClick={handleSave} className="self-end">
        {saved ? '✓ Guardado' : 'Guardar umbrales'}
      </Button>
    </div>
  )
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
      const { token } = await getOptionalAuthContext()
      const data = await apiRequest(`/locals/${target.id}/deletion-summary`, { token })
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
      const { token } = await getOptionalAuthContext()
      await apiRequest(`/locals/${target.id}/cascade`, { method: 'DELETE', token })
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
              const val = summary[key]
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
            disabled={isDeleting}
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
function OpcionesDrawer({ isOpen, onClose, locales, thresholds, onSaveThresholds, isSuperAdmin, onDeleteDone }) {
  return (
    <>
      {/* Backdrop */}
      <div
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
          <ThresholdsSection thresholds={thresholds} onSave={onSaveThresholds} />

          {isSuperAdmin && (
            <>
              <div className="h-px bg-[hsl(var(--border))]" />
              <DeleteSection locales={locales} onDeleteDone={onDeleteDone} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default OpcionesDrawer
