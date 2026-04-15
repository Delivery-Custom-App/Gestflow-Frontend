import { useState } from 'react'
import { useOrderItems } from '../../hooks/useOrderItems'
import { formatCLP } from '../../lib/formatCLP'
import ProductDetailModal from './ProductDetailModal'
import '../../styles/ProductList.css'

/** Lista de productos de la orden con edición de cantidad/precio y detalle. */
export default function ProductList({ products = [], orderId = null, onProductsChanged = null, className = '' }) {
  const { updateItem, deleteItem, loading, error } = useOrderItems(orderId)
  const [editingId, setEditingId] = useState(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [localError, setLocalError] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)

  if (!products || products.length === 0) {
    return (
      <div className={`product-list product-list-empty ${className}`}>
        <p className="product-list-empty-message">No hay productos</p>
      </div>
    )
  }

  // Validar consistencia: cantidad y precio correctos
  const validateProduct = (product) => {
    const hasName = !!product.product_name
    const hasQuantity = product.quantity > 0
    const hasPrice = product.unit_price > 0 && product.total_price > 0
    const priceConsistent = Math.abs(product.quantity * product.unit_price - product.total_price) < 0.01

    return {
      isValid: hasName && hasQuantity && hasPrice && priceConsistent,
      hasName,
      hasQuantity,
      hasPrice,
      priceConsistent,
    }
  }

  const handleEditStart = (product) => {
    setEditingId(product.id)
    setEditQuantity(product.quantity.toString())
    setEditPrice(product.unit_price.toString())
    setLocalError(null)
  }

  const handleEditSave = async (product) => {
    setLocalError(null)

    if (!editQuantity || editQuantity <= 0) {
      setLocalError('Cantidad debe ser mayor a 0')
      return
    }

    if (!editPrice || editPrice <= 0) {
      setLocalError('Precio debe ser mayor a 0')
      return
    }

    const success = await updateItem(product.id, parseInt(editQuantity), parseFloat(editPrice))
    if (success) {
      setEditingId(null)
      if (onProductsChanged) onProductsChanged()
    }
  }

  const handleDelete = async (product) => {
    if (window.confirm(`¿Eliminar ${product.product_name}?`)) {
      const success = await deleteItem(product.id)
      if (success) {
        if (onProductsChanged) onProductsChanged()
      }
    }
  }

  return (
    <div className={`product-list ${className}`}>
      <div className="product-list-header">
        <div className="product-col-name">Producto</div>
        <div className="product-col-quantity">Cantidad</div>
        <div className="product-col-price">Precio</div>
        <div className="product-col-total">Total</div>
        <div className="product-col-actions">Acciones</div>
      </div>

      <ul className="product-list-items">
        {products.map((product, index) => {
          const validation = validateProduct(product)
          const isEditing = editingId === product.id

          return (
            <li
              key={product.id || index}
              className={`product-item ${!validation.isValid ? 'product-item-invalid' : ''} ${isEditing ? 'product-item-editing' : ''}`}
              data-product-id={product.id}
            >
              <div
                className="product-col-name product-col-name-clickable"
                onClick={() => !isEditing && setSelectedProduct(product)}
                title="Ver detalle del producto"
                role="button"
                tabIndex={isEditing ? -1 : 0}
                onKeyDown={(e) => { if (!isEditing && (e.key === 'Enter' || e.key === ' ')) setSelectedProduct(product) }}
              >
                <span className="product-name">{product.product_name || 'Producto sin nombre'}</span>
                {!validation.hasName && <span className="product-warning">⚠ Sin nombre</span>}
              </div>

              <div className="product-col-quantity">
                {isEditing ? (
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="edit-input"
                    disabled={loading}
                  />
                ) : (
                  <>
                    <span className="product-quantity">
                      {validation.hasQuantity ? `x${product.quantity}` : '—'}
                    </span>
                    {!validation.hasQuantity && <span className="product-warning">⚠ Cantidad</span>}
                  </>
                )}
              </div>

              <div className="product-col-price">
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="edit-input"
                    disabled={loading}
                  />
                ) : (
                  <>
                    <span className="product-price">${formatCLP(product.unit_price || 0)}</span>
                    {!validation.hasPrice && <span className="product-warning">⚠ Precio</span>}
                  </>
                )}
              </div>

              <div className="product-col-total">
                <span className="product-total">${formatCLP(product.total_price || 0)}</span>
                {!validation.priceConsistent && (
                  <span className="product-warning" title="El total no coincide con cantidad × precio unitario">
                    ⚠
                  </span>
                )}
              </div>

              <div className="product-col-actions">
                {isEditing ? (
                  <div className="action-buttons">
                    <button
                      onClick={() => handleEditSave(product)}
                      disabled={loading}
                      className="btn-save"
                      title="Guardar cambios"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={loading}
                      className="btn-cancel-edit"
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="action-buttons">
                    <button
                      onClick={() => handleEditStart(product)}
                      disabled={loading}
                      className="btn-edit"
                      title="Editar"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      disabled={loading}
                      className="btn-delete"
                      title="Eliminar"
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Error */}
      {(localError || error) && (
        <div className="product-list-error">
          <p>{localError || error}</p>
        </div>
      )}

      {/* Resumen de validación */}
      {products.some((p) => !validateProduct(p).isValid) && (
        <div className="product-list-warnings">
          <p>⚠ Algunos productos tienen datos inconsistentes</p>
        </div>
      )}

      {/* Detalle de producto */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  )
}
