import { useEffect, useState } from 'react'
import { getAuthContext } from '../../lib/apiClient'
import { postInventoryNewProduct } from '../../lib/inventoryApi'

const UNITS = [
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
  const [unit, setUnit] = useState('kg')
  const [currentStock, setCurrentStock] = useState('0')
  const [minStock, setMinStock] = useState('0')
  const [maxStock, setMaxStock] = useState('0')
  const [unitCost, setUnitCost] = useState('')
  const [supplier, setSupplier] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setSubmitting(false)
  }, [open])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const cost = Number(unitCost)
    if (!productName.trim() || !category.trim() || !supplier.trim()) {
      setError('Completa nombre, categoría y proveedor.')
      return
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      setError('El costo unitario debe ser mayor que 0.')
      return
    }

    setSubmitting(true)
    try {
      const { token } = await getAuthContext()
      await postInventoryNewProduct(localId, token, {
        productName: productName.trim(),
        category: category.trim(),
        unit,
        currentStock: Number(currentStock) || 0,
        minStock: Number(minStock) || 0,
        maxStock: Number(maxStock) || 0,
        unitCost: Math.round(cost),
        supplier: supplier.trim(),
      })
      onSuccess?.()
      onClose?.()
      setProductName('')
      setCategory('')
      setUnit('kg')
      setCurrentStock('0')
      setMinStock('0')
      setMaxStock('0')
      setUnitCost('')
      setSupplier('')
    } catch (err) {
      setError(err?.message || 'No se pudo crear el producto.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="npmodal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="npmodal"
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
          <label className="npmodal-field">
            <span>Nombre</span>
            <input value={productName} onChange={(ev) => setProductName(ev.target.value)} required />
          </label>
          <label className="npmodal-field">
            <span>Categoría</span>
            <input value={category} onChange={(ev) => setCategory(ev.target.value)} required />
          </label>
          <label className="npmodal-field">
            <span>Unidad</span>
            <select value={unit} onChange={(ev) => setUnit(ev.target.value)}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <div className="npmodal-row">
            <label className="npmodal-field">
              <span>Stock actual</span>
              <input type="number" min={0} value={currentStock} onChange={(ev) => setCurrentStock(ev.target.value)} />
            </label>
            <label className="npmodal-field">
              <span>Stock mín.</span>
              <input type="number" min={0} value={minStock} onChange={(ev) => setMinStock(ev.target.value)} />
            </label>
            <label className="npmodal-field">
              <span>Stock máx.</span>
              <input type="number" min={0} value={maxStock} onChange={(ev) => setMaxStock(ev.target.value)} />
            </label>
          </div>
          <label className="npmodal-field">
            <span>Costo unitario (CLP)</span>
            <input type="number" min={1} step={1} value={unitCost} onChange={(ev) => setUnitCost(ev.target.value)} required />
          </label>
          <label className="npmodal-field">
            <span>Proveedor</span>
            <input value={supplier} onChange={(ev) => setSupplier(ev.target.value)} required />
          </label>
          <div className="npmodal-actions">
            <button type="button" className="npmodal-btn npmodal-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="npmodal-btn npmodal-btn--primary" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NuevoProductoModal
