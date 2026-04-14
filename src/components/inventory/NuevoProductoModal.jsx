import { useMemo, useState } from 'react'
import '../../styles/inventory/NuevoProductoModal.css'

const UNIT_OPTIONS = ['kg', 'g', 'L', 'ml']
const SUPPLIER_OPTIONS = ['PF Alimentos', 'Frigorífico del Sur', 'Distribuidora Central', 'Proveedor Local']
const CATEGORY_STORAGE_KEY = 'inventory-category-options'

function validateForm(values) {
  const errors = {}
  const stockActual = Number(values.currentStock)
  const stockMaximo = Number(values.maxStock)
  const costoUnitario = Number(values.unitCost)

  if (!values.productName.trim()) errors.productName = 'Ingresa el nombre del producto.'
  if (!values.category) errors.category = 'Selecciona una categoría.'
  if (!values.unit) errors.unit = 'Selecciona una unidad.'
  if (!values.supplier) errors.supplier = 'Selecciona un proveedor.'

  if (values.currentStock === '') {
    errors.currentStock = 'Ingresa el stock actual.'
  } else if (!Number.isFinite(stockActual) || stockActual < 0) {
    errors.currentStock = 'El stock actual debe ser un número mayor o igual a 0.'
  }

  if (values.maxStock === '') {
    errors.maxStock = 'Ingresa el stock máximo.'
  } else if (!Number.isFinite(stockMaximo) || stockMaximo < 0) {
    errors.maxStock = 'El stock máximo debe ser un número mayor o igual a 0.'
  }

  if (values.unitCost === '') {
    errors.unitCost = 'Ingresa el costo unitario.'
  } else if (!Number.isInteger(costoUnitario) || costoUnitario <= 0) {
    errors.unitCost = 'El costo unitario (CLP) debe ser un entero mayor a 0.'
  }

  if (
    Number.isFinite(stockActual) &&
    Number.isFinite(stockMaximo) &&
    stockActual > stockMaximo
  ) {
    errors.currentStock = 'El stock actual no puede ser mayor al stock máximo.'
  }

  return errors
}

function NuevoProductoModal({ open, onClose }) {
  const [categoryDraft, setCategoryDraft] = useState('')
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
    } catch {
      return []
    }
  })
  const [values, setValues] = useState({
    productName: '',
    category: '',
    unit: '',
    currentStock: '',
    maxStock: '',
    unitCost: '',
    supplier: '',
  })
  const [touched, setTouched] = useState({})

  const errors = useMemo(() => validateForm(values), [values])
  const isFormValid = Object.keys(errors).length === 0

  const setField = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  const setFieldTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const persistCategories = (nextOptions) => {
    setCategoryOptions(nextOptions)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(nextOptions))
    }
  }

  const addCategory = () => {
    const trimmed = categoryDraft.trim()
    if (!trimmed) return

    const exists = categoryOptions.some((option) => option.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      const existing = categoryOptions.find((option) => option.toLowerCase() === trimmed.toLowerCase()) || trimmed
      setField('category', existing)
      setFieldTouched('category')
      setCategoryDraft('')
      return
    }

    const nextOptions = [trimmed, ...categoryOptions]
    persistCategories(nextOptions)
    setField('category', trimmed)
    setFieldTouched('category')
    setCategoryDraft('')
  }

  const handleClose = () => {
    setTouched({})
    setCategoryDraft('')
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    const allTouched = Object.keys(values).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    setTouched(allTouched)

    if (!isFormValid) return

    // En la siguiente historia se reemplaza por POST al backend.
    handleClose()
  }

  if (!open) return null

  return (
    <div className="npm-overlay" role="presentation" onClick={handleClose}>
      <div
        className="npm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="npm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="npm-header">
          <h2 id="npm-title">Nuevo producto</h2>
          <button type="button" className="npm-close" onClick={handleClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <form className="npm-form" onSubmit={handleSubmit} noValidate>
          <div className="npm-body">
            <div className="npm-grid">
              <label className="npm-field npm-field--full">
                <span>Nombre producto</span>
                <input
                  type="text"
                  value={values.productName}
                  onChange={(e) => setField('productName', e.target.value)}
                  onBlur={() => setFieldTouched('productName')}
                  placeholder="Ingresar producto"
                />
                {touched.productName && errors.productName ? <small>{errors.productName}</small> : null}
              </label>

              <label className="npm-field">
                <span>Categoría</span>
                <div
                  className="npm-category-composer"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setIsCategoryOpen(false)
                    }
                  }}
                >
                  <input
                    type="text"
                    value={categoryDraft}
                    onChange={(e) => setCategoryDraft(e.target.value)}
                    onFocus={() => setIsCategoryOpen(true)}
                    onClick={() => setIsCategoryOpen(true)}
                    onBlur={() => setFieldTouched('category')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCategory()
                        setIsCategoryOpen(true)
                      }
                      if (e.key === 'Escape') {
                        setIsCategoryOpen(false)
                      }
                    }}
                    placeholder="Escribe una categoría"
                  />
                  {isCategoryOpen ? (
                    <div className="npm-category-list" role="listbox" aria-label="Categorías disponibles">
                      {categoryOptions.length === 0 ? (
                        <p className="npm-category-empty">Aún no hay categorías. Agrega la primera.</p>
                      ) : (
                        categoryOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`npm-category-chip ${values.category === option ? 'is-active' : ''}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setField('category', option)
                              setFieldTouched('category')
                              setCategoryDraft(option)
                              setIsCategoryOpen(true)
                            }}
                          >
                            {option}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                {touched.category && errors.category ? <small>{errors.category}</small> : null}
              </label>

              <label className="npm-field">
                <span>Unidad</span>
                <select
                  value={values.unit}
                  onChange={(e) => setField('unit', e.target.value)}
                  onBlur={() => setFieldTouched('unit')}
                >
                  <option value="">Selecciona una unidad</option>
                  {UNIT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {touched.unit && errors.unit ? <small>{errors.unit}</small> : null}
              </label>

              <label className="npm-field">
                <span>Stock máximo</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={values.maxStock}
                  onChange={(e) => setField('maxStock', e.target.value)}
                  onBlur={() => setFieldTouched('maxStock')}
                  placeholder="0"
                />
                {touched.maxStock && errors.maxStock ? <small>{errors.maxStock}</small> : null}
              </label>

              <label className="npm-field">
                <span>Stock actual</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={values.currentStock}
                  onChange={(e) => setField('currentStock', e.target.value)}
                  onBlur={() => setFieldTouched('currentStock')}
                  placeholder="0"
                />
                {touched.currentStock && errors.currentStock ? <small>{errors.currentStock}</small> : null}
              </label>

              <label className="npm-field">
                <span>Costo unitario (CLP)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={values.unitCost}
                  onChange={(e) => setField('unitCost', e.target.value)}
                  onBlur={() => setFieldTouched('unitCost')}
                  placeholder="0"
                />
                {touched.unitCost && errors.unitCost ? <small>{errors.unitCost}</small> : null}
              </label>

              <label className="npm-field">
                <span>Proveedor</span>
                <select
                  value={values.supplier}
                  onChange={(e) => setField('supplier', e.target.value)}
                  onBlur={() => setFieldTouched('supplier')}
                >
                  <option value="">Selecciona un proveedor</option>
                  {SUPPLIER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {touched.supplier && errors.supplier ? <small>{errors.supplier}</small> : null}
              </label>
            </div>
          </div>
          <footer className="npm-footer">
            <button type="button" className="npm-btn npm-btn--ghost" onClick={handleClose}>
              Cancelar
            </button>
            <button type="submit" className="npm-btn npm-btn--primary" disabled={!isFormValid}>
              Guardar
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

export default NuevoProductoModal
