import { useEffect, useState } from 'react'
import { apiRequest } from '../../lib/apiClient'
import { postInventoryEmergencyRestock } from '../../lib/inventoryApi'
import CategoryTypeaheadField from './CategoryTypeaheadField'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Zap } from 'lucide-react'

const UNITS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'kg',     label: 'kg'     },
  { value: 'g',      label: 'g'      },
  { value: 'L',      label: 'L'      },
  { value: 'ml',     label: 'ml'     },
]

const numInputCls =
  'h-9 w-full rounded-md border border-[hsl(var(--border))] px-3 text-sm shadow-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-amber-400/50 ' +
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

function EmergencyRestockModal({ open, localId, onClose, onSuccess }) {
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState('')
  const [productName,   setProductName]   = useState('')
  const [categoryName,  setCategoryName]  = useState('')
  const [unit,          setUnit]          = useState('unidad')
  const [unitCost,      setUnitCost]      = useState('')
  const [currentStock,  setCurrentStock]  = useState('1')
  const [supplierName,  setSupplierName]  = useState('')
  const [justification, setJustification] = useState('')
  const [categories,    setCategories]    = useState([])
  const [catsLoading,   setCatsLoading]   = useState(false)

  useEffect(() => {
    if (!open) return
    setError('')
    setSubmitting(false)
    setProductName('')
    setCategoryName('')
    setUnit('unidad')
    setUnitCost('')
    setCurrentStock('1')
    setSupplierName('')
    setJustification('')
  }, [open])

  useEffect(() => {
    if (!open || !localId) { setCategories([]); return }
    setCatsLoading(true)
    apiRequest(`/categories?local_id=${localId}`)
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
      .finally(() => setCatsLoading(false))
  }, [open, localId])

  const onlyDigits = (val) => val.replace(/\D/g, '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const cost = Number(unitCost)
    const qty  = Number(currentStock)

    if (!productName.trim())                { setError('Ingresa el nombre del producto.'); return }
    if (!categoryName.trim())               { setError('Escribe la categoría y pulsa Enter para confirmarla.'); return }
    if (!Number.isFinite(cost) || cost <= 0){ setError('El costo unitario debe ser mayor que 0.'); return }
    if (!Number.isFinite(qty)  || qty < 1)  { setError('El stock actual debe ser al menos 1.'); return }
    if (!supplierName.trim())               { setError('Ingresa el nombre del proveedor de emergencia.'); return }
    if (!justification.trim())              { setError('Escribe la justificación de la compra de emergencia.'); return }

    setSubmitting(true)
    try {
      await postInventoryEmergencyRestock(localId, {
        productName:   productName.trim(),
        category:      categoryName.trim(),
        unit,
        unitCost:      Math.round(cost),
        currentStock:  qty,
        supplierName:  supplierName.trim(),
        justification: justification.trim(),
      })
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'No se pudo registrar el re-stock de emergencia.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => { if (!submitting) onClose?.() }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ zIndex: 500 }}
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-lg bg-[hsl(var(--card))] shadow-2xl border-l border-[hsl(var(--border))] flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ zIndex: 501 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Re-stock de emergencia</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Compra urgente sin proveedor registrado</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form id="er-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col gap-5 px-6 py-6">

          {error && (
            <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
              {error}
            </p>
          )}

          {/* Aviso contextual */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
            Usa este formulario solo para compras de urgencia a proveedores no inscritos en el sistema. Deja registro de la justificación para auditoría.
          </div>

          {/* Nombre + Categoría */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="er-name">Nombre <span className="text-red-500">*</span></Label>
              <Input
                id="er-name"
                value={productName}
                onChange={(ev) => setProductName(ev.target.value)}
                placeholder="Ej: Pan"
                required
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="er-category">Categoría <span className="text-red-500">*</span></Label>
              {catsLoading ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))] py-2">Cargando categorías…</p>
              ) : (
                <CategoryTypeaheadField
                  categories={categories}
                  value={categoryName}
                  onConfirm={(name) => setCategoryName(name)}
                  disabled={submitting}
                />
              )}
            </div>
          </div>

          {/* Formato + Costo unitario */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="er-unit">Formato del Producto</Label>
              <Select value={unit} onValueChange={setUnit} disabled={submitting}>
                <SelectTrigger id="er-unit" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="er-unit-cost">Costo unitario (CLP) <span className="text-red-500">*</span></Label>
              <input
                id="er-unit-cost"
                type="text"
                inputMode="numeric"
                value={unitCost}
                onChange={(ev) => setUnitCost(onlyDigits(ev.target.value))}
                placeholder="0"
                required
                disabled={submitting}
                className={numInputCls}
              />
            </div>
          </div>

          {/* Stock actual */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="er-stock">Stock actual <span className="text-red-500">*</span></Label>
            <input
              id="er-stock"
              type="text"
              inputMode="numeric"
              value={currentStock}
              onChange={(ev) => setCurrentStock(onlyDigits(ev.target.value))}
              disabled={submitting}
              className={numInputCls}
            />
          </div>

          {/* Nombre del proveedor (texto libre) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="er-supplier">Nombre del proveedor <span className="text-red-500">*</span></Label>
            <Input
              id="er-supplier"
              value={supplierName}
              onChange={(ev) => setSupplierName(ev.target.value)}
              placeholder="Ej: Panadería de la esquina"
              required
              disabled={submitting}
            />
          </div>

          {/* Justificación */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="er-justification">Justificación <span className="text-red-500">*</span></Label>
            <textarea
              id="er-justification"
              value={justification}
              onChange={(ev) => setJustification(ev.target.value)}
              placeholder="Ej: Se agotó el pan regular y se requería para el servicio del mediodía."
              required
              disabled={submitting}
              rows={3}
              className="w-full rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50"
            />
          </div>

        </form>

        {/* Footer */}
        <div className="shrink-0 border-t border-[hsl(var(--border))] px-6 py-4 flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="er-form"
            disabled={submitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {submitting ? 'Guardando…' : 'Registrar emergencia'}
          </Button>
        </div>
      </div>
    </>
  )
}

export default EmergencyRestockModal
