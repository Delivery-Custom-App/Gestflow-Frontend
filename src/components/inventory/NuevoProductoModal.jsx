import { useCallback, useEffect, useState } from 'react'
import { getAuthContext } from '../../lib/apiClient'
import {
  getInventorySuppliersForLocal,
  getLocalById,
  postInventoryNewProduct,
  postSupplier,
  resolveCategoryNameForLocal,
} from '../../lib/inventoryApi'
import CategoryTypeahead from './CategoryTypeahead'

const UNITS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'ml', label: 'ml' },
]

function NuevoProductoModal({ open, localId, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('unidad')
  const [currentStock, setCurrentStock] = useState('0')
  const [minStock, setMinStock] = useState('0')
  const [maxStock, setMaxStock] = useState('0')
  const [unitCost, setUnitCost] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [suppliersError, setSuppliersError] = useState('')
  const [newSupplierName, setNewSupplierName] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)

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
  }, [open])

  useEffect(() => {
    if (!open || !localId) {
      setSuppliers([])
      setSupplierId('')
      setSuppliersError('')
      setNewSupplierName('')
      return
    }
    loadSuppliers()
  }, [open, localId, loadSuppliers])

  const handleAddSupplier = async (e) => {
    e?.preventDefault()
    const name = newSupplierName.trim()
    if (!name) {
      setError('Escribe el nombre del proveedor.')
      return
    }
    setAddingSupplier(true)
    setError('')
    try {
      const { businessId: bidFromToken } = await getAuthContext()
      let businessId = bidFromToken != null ? String(bidFromToken) : null
      if (!businessId && localId) {
        const loc = await getLocalById(localId)
        if (loc?.business_id != null) businessId = String(loc.business_id)
      }
      if (!businessId) {
        setError('No se pudo determinar el negocio del local. No se puede crear el proveedor.')
        return
      }
      const body = { name, business_id: businessId }
      const created = await postSupplier(body)
      setNewSupplierName('')
      await loadSuppliers()
      if (created?.id) setSupplierId(String(created.id))
    } catch (err) {
      setError(err?.message || 'No se pudo crear el proveedor.')
    } finally {
      setAddingSupplier(false)
    }
  }

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const cost = Number(unitCost)
    if (!productName.trim() || !category.trim()) {
      setError('Completa nombre y categoría.')
      return
    }
    if (!supplierId) {
      setError('Selecciona un proveedor o agrega uno nuevo abajo.')
      return
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      setError('El costo unitario debe ser mayor que 0.')
      return
    }

    setSubmitting(true)
    try {
      const resolvedCategory = await resolveCategoryNameForLocal(localId, category)
      setCategory(resolvedCategory)
      await postInventoryNewProduct(localId, {
        productName: productName.trim(),
        category: resolvedCategory,
        unit,
        currentStock: Number(currentStock) || 0,
        minStock: Number(minStock) || 0,
        maxStock: Number(maxStock) || 0,
        unitCost: Math.round(cost),
        supplierId,
      })
      onSuccess?.()
      onClose?.()
      setProductName('')
      setCategory('')
      setUnit('unidad')
      setCurrentStock('0')
      setMinStock('0')
      setMaxStock('0')
      setUnitCost('')
      setSupplierId(suppliers[0]?.id != null ? String(suppliers[0].id) : '')
    } catch (err) {
      setError(err?.message || 'No se pudo crear el producto.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = suppliers.length > 0 && !!supplierId

  return (
    <div className="npmodal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="npmodal npmodal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="npmodal-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="npmodal-head">
          <h2 id="npmodal-title">Nuevo producto</h2>
          <button type="button" className="npmodal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <form className="npmodal-form" onSubmit={handleSubmit}>
          {error ? <p className="npmodal-error">{error}</p> : null}
          {suppliersError ? <p className="npmodal-error npmodal-error--muted">{suppliersError}</p> : null}
          <label className="npmodal-field">
            <span>Nombre</span>
            <input value={productName} onChange={(ev) => setProductName(ev.target.value)} required />
          </label>
          <label className="npmodal-field npmodal-field--category">
            <span>Categoría</span>
            <CategoryTypeahead
              localId={localId}
              value={category}
              onChange={setCategory}
              disabled={submitting}
            />
          </label>
          <label className="npmodal-field">
            <span>Formato de medida</span>
            <select value={unit} onChange={(ev) => setUnit(ev.target.value)}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="npmodal-fieldset-stock">
            <legend className="npmodal-fieldset-stock__legend">Niveles de stock</legend>
            <div className="npmodal-row npmodal-row--stock">
              <label className="npmodal-field">
                <span>Stock actual</span>
                <input type="number" min={0} value={currentStock} onChange={(ev) => setCurrentStock(ev.target.value)} />
              </label>
              <label className="npmodal-field">
                <span>Stock mínimo</span>
                <input type="number" min={0} value={minStock} onChange={(ev) => setMinStock(ev.target.value)} />
              </label>
              <label className="npmodal-field">
                <span>Stock máximo</span>
                <input type="number" min={0} value={maxStock} onChange={(ev) => setMaxStock(ev.target.value)} />
              </label>
            </div>
          </fieldset>
          <label className="npmodal-field">
            <span>Costo unitario (CLP)</span>
            <input type="number" min={1} step={1} value={unitCost} onChange={(ev) => setUnitCost(ev.target.value)} required />
          </label>

          <div className="npmodal-field npmodal-field--supplier">
            <span>Proveedor</span>
            <select
              value={supplierId}
              onChange={(ev) => setSupplierId(ev.target.value)}
              required
              disabled={suppliersLoading || suppliers.length === 0}
              aria-busy={suppliersLoading}
              aria-label="Proveedor del producto"
            >
              {suppliersLoading ? (
                <option value="">Cargando proveedores…</option>
              ) : suppliers.length === 0 ? (
                <option value="">Sin proveedores — agrega uno abajo</option>
              ) : (
                suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
            {!suppliersLoading && suppliers.length === 0 ? (
              <div className="npmodal-supplier-quickadd">
                <input
                  type="text"
                  className="npmodal-supplier-quickadd-input"
                  placeholder="Nombre del proveedor"
                  value={newSupplierName}
                  onChange={(ev) => setNewSupplierName(ev.target.value)}
                  disabled={addingSupplier}
                  aria-label="Nombre del nuevo proveedor"
                />
                <button
                  type="button"
                  className="npmodal-btn npmodal-btn--secondary"
                  onClick={handleAddSupplier}
                  disabled={addingSupplier || !newSupplierName.trim()}
                >
                  {addingSupplier ? 'Guardando…' : 'Agregar proveedor'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="npmodal-actions">
            <button type="button" className="npmodal-btn npmodal-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="npmodal-btn npmodal-btn--primary" disabled={submitting || !canSubmit}>
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NuevoProductoModal
