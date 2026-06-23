import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, getAuthContext } from '../../lib/apiClient'
import {
  getInventorySuppliersForLocal,
  getLocalById,
  postCategory,
  postInventoryNewProduct,
  postSupplier,
} from '../../lib/inventoryApi'
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
import { X, Package } from 'lucide-react'

const UNITS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'kg',     label: 'kg'     },
  { value: 'g',      label: 'g'      },
  { value: 'L',      label: 'L'      },
  { value: 'ml',     label: 'ml'     },
]

const numInputCls =
  'h-9 w-full rounded-md border border-[hsl(var(--border))] px-3 text-sm shadow-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] ' +
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

function NuevoProductoModal({ open, localId, onClose, onSuccess }) {
  const [submitting,       setSubmitting]       = useState(false)
  const [error,            setError]            = useState('')
  const [productName,      setProductName]      = useState('')
  const [categoryName,     setCategoryName]     = useState('')
  const [unit,             setUnit]             = useState('unidad')
  const [currentStock,     setCurrentStock]     = useState('0')
  const [minStock,         setMinStock]         = useState('0')
  const [maxStock,         setMaxStock]         = useState('0')
  const [unitCost,         setUnitCost]         = useState('')
  const [supplierId,       setSupplierId]       = useState('')
  const [suppliers,        setSuppliers]        = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [suppliersError,   setSuppliersError]   = useState('')
  const [newSupplierName,  setNewSupplierName]  = useState('')
  const [addingSupplier,   setAddingSupplier]   = useState(false)
  const [categories,       setCategories]       = useState([])
  const [catsLoading,      setCatsLoading]      = useState(false)

  const loadSuppliers = useCallback(async () => {
    if (!localId) return
    setSuppliersLoading(true)
    setSuppliersError('')
    try {
      const rows = await getInventorySuppliersForLocal(localId)
      const list = Array.isArray(rows) ? rows : []
      setSuppliers(list)
      setSupplierId((prev) => {
        if (prev && list.some((s) => String(s.id) === prev)) return prev
        return list[0]?.id != null ? String(list[0].id) : ''
      })
    } catch (err) {
      setSuppliers([])
      setSupplierId('')
      setSuppliersError(err?.message || 'No se pudieron cargar los proveedores.')
    } finally {
      setSuppliersLoading(false)
    }
  }, [localId])

  useEffect(() => {
    if (!open) return
    setError('')
    setSubmitting(false)
    setProductName('')
    setCategoryName('')
    setUnit('unidad')
    setCurrentStock('0')
    setMinStock('0')
    setMaxStock('0')
    setUnitCost('')
    setNewSupplierName('')
  }, [open])

  useEffect(() => {
    if (!open || !localId) {
      setSuppliers([])
      setSupplierId('')
      setSuppliersError('')
      return
    }
    loadSuppliers()
  }, [open, localId, loadSuppliers])

  useEffect(() => {
    if (!open || !localId) { setCategories([]); return }
    setCatsLoading(true)
    apiRequest(`/categories?local_id=${localId}`)
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
      .finally(() => setCatsLoading(false))
  }, [open, localId])

  const handleAddSupplier = async (e) => {
    e?.preventDefault()
    const name = newSupplierName.trim()
    if (!name) { setError('Escribe el nombre del proveedor.'); return }
    setAddingSupplier(true)
    setError('')
    try {
      const { businessId: bidFromToken } = await getAuthContext()
      let businessId = bidFromToken != null ? String(bidFromToken) : null
      if (!businessId && localId) {
        const loc = await getLocalById(localId)
        if (loc?.business_id != null) businessId = String(loc.business_id)
      }
      if (!businessId) { setError('No se pudo determinar el negocio del local.'); return }
      const created = await postSupplier({ name, business_id: businessId })
      setNewSupplierName('')
      await loadSuppliers()
      if (created?.id) setSupplierId(String(created.id))
    } catch (err) {
      setError(err?.message || 'No se pudo crear el proveedor.')
    } finally {
      setAddingSupplier(false)
    }
  }

  // Filtra proveedores por categoría del producto (si el proveedor tiene campo category)
  const displayedSuppliers = useMemo(() => {
    const cat = categoryName.trim().toLowerCase()
    if (!cat || suppliers.length === 0) return suppliers
    const matching = suppliers.filter((s) =>
      (s.category || '').toLowerCase().includes(cat)
    )
    return matching.length > 0 ? matching : suppliers
  }, [suppliers, categoryName])

  const supplierHint = useMemo(() => {
    const cat = categoryName.trim().toLowerCase()
    if (!cat || suppliers.length === 0) return null
    const matching = suppliers.filter((s) =>
      (s.category || '').toLowerCase().includes(cat)
    )
    if (matching.length === 0) return 'Sin coincidencias para esta categoría — mostrando todos'
    if (matching.length < suppliers.length) return `${matching.length} proveedor${matching.length !== 1 ? 'es' : ''} para "${categoryName.trim()}"`
    return null
  }, [suppliers, categoryName])

  const onlyDigits = (val) => val.replace(/\D/g, '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const cost = Number(unitCost)
    if (!productName.trim())                    { setError('Ingresa el nombre del producto.'); return }
    if (!categoryName.trim())                   { setError('Escribe la categoría y pulsa Enter para confirmarla.'); return }
    if (!supplierId)                            { setError('Selecciona un proveedor o agrega uno nuevo.'); return }
    if (!Number.isFinite(cost) || cost <= 0)    { setError('El costo unitario debe ser mayor que 0.'); return }

    setSubmitting(true)
    try {
      await postInventoryNewProduct(localId, {
        productName: productName.trim(),
        category:    categoryName.trim(),
        unit,
        currentStock: Number(currentStock) || 0,
        minStock:     Number(minStock)     || 0,
        maxStock:     Number(maxStock)     || 0,
        unitCost:     Math.round(cost),
        supplierId,
      })
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'No se pudo crear el producto.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => { if (!submitting) onClose?.() }
  const canSubmit = suppliers.length > 0 && !!supplierId

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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <Package className="h-4 w-4 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Nuevo producto</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Ingrese los datos del producto</p>
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
        <form id="np-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col gap-5 px-6 py-6">

          {error && (
            <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
              {error}
            </p>
          )}
          {suppliersError && (
            <p className="rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2">
              {suppliersError}
            </p>
          )}

          {/* Nombre + Categoría */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-name">Nombre <span className="text-red-500">*</span></Label>
              <Input
                id="np-name"
                value={productName}
                onChange={(ev) => setProductName(ev.target.value)}
                placeholder="Ingrese datos"
                required
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-category">Categoría <span className="text-red-500">*</span></Label>
              {catsLoading ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))] py-2">Cargando categorías…</p>
              ) : (
                <CategoryTypeaheadField
                  categories={categories}
                  value={categoryName}
                  onConfirm={async (name) => {
                    setCategoryName(name)
                    if (!name || !localId) return
                    const exists = categories.some(
                      (c) => c.name.toLowerCase() === name.toLowerCase()
                    )
                    if (!exists) {
                      try {
                        const created = await postCategory({ local_id: localId, name, is_active: true })
                        setCategories((prev) => [...prev, created])
                      } catch { /* no crítico */ }
                    }
                  }}
                  disabled={submitting}
                />
              )}
            </div>
          </div>

          {/* Formato + Costo unitario */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-unit">Formato del Producto</Label>
              <Select value={unit} onValueChange={setUnit} disabled={submitting}>
                <SelectTrigger id="np-unit" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[600]">
                  {UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-unit-cost">Costo unitario (CLP) <span className="text-red-500">*</span></Label>
              <input
                id="np-unit-cost"
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

          {/* Niveles de stock */}
          <fieldset className="border border-[hsl(var(--border))] rounded-lg px-4 pb-4 pt-2">
            <legend className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-1">
              Niveles de stock actuales
            </legend>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="np-stock-current">Actual</Label>
                <input
                  id="np-stock-current"
                  type="text"
                  inputMode="numeric"
                  value={currentStock}
                  onChange={(ev) => setCurrentStock(onlyDigits(ev.target.value))}
                  disabled={submitting}
                  className={numInputCls}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="np-stock-min">Mínimo</Label>
                <input
                  id="np-stock-min"
                  type="text"
                  inputMode="numeric"
                  value={minStock}
                  onChange={(ev) => setMinStock(onlyDigits(ev.target.value))}
                  disabled={submitting}
                  className={numInputCls}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="np-stock-max">Máximo</Label>
                <input
                  id="np-stock-max"
                  type="text"
                  inputMode="numeric"
                  value={maxStock}
                  onChange={(ev) => setMaxStock(onlyDigits(ev.target.value))}
                  disabled={submitting}
                  className={numInputCls}
                />
              </div>
            </div>
          </fieldset>

          {/* Proveedor */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="np-supplier">Proveedor <span className="text-red-500">*</span></Label>
              {supplierHint && (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{supplierHint}</span>
              )}
            </div>
            <Select
              value={supplierId}
              onValueChange={setSupplierId}
              disabled={suppliersLoading || suppliers.length === 0 || submitting}
            >
              <SelectTrigger id="np-supplier" className="h-9 text-sm" aria-busy={suppliersLoading}>
                <SelectValue
                  placeholder={
                    suppliersLoading
                      ? 'Cargando proveedores…'
                      : suppliers.length === 0
                        ? 'Sin proveedores — agrega uno abajo'
                        : 'Seleccionar proveedor'
                  }
                />
              </SelectTrigger>
              <SelectContent className="z-[600]">
                {displayedSuppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!suppliersLoading && suppliers.length === 0 && (
              <div className="flex gap-2 mt-1">
                <Input
                  type="text"
                  placeholder="Nombre del nuevo proveedor"
                  value={newSupplierName}
                  onChange={(ev) => setNewSupplierName(ev.target.value)}
                  disabled={addingSupplier}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddSupplier}
                  disabled={addingSupplier || !newSupplierName.trim()}
                  className="shrink-0"
                >
                  {addingSupplier ? 'Guardando…' : 'Agregar'}
                </Button>
              </div>
            )}
          </div>

        </form>

        {/* Footer */}
        <div className="shrink-0 border-t border-[hsl(var(--border))] px-6 py-4 flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="np-form" disabled={submitting || !canSubmit}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </>
  )
}

export default NuevoProductoModal
