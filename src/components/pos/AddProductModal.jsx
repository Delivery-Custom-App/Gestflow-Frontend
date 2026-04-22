import { useState, useEffect } from 'react'
import { useOrderItems } from '../../hooks/useOrderItems'
import { getAuthContext } from '../../lib/apiClient'
import '../../styles/AddProductModal.css'

/**
 * Modal para agregar productos extras a una orden
 * (pan, aceite, sal, etc. que se solicitan durante la espera)
 * Si no existe orden, la crea automáticamente
 */
export default function AddProductModal({ orderId, mesaId, localId, onClose, onProductAdded, products = [] }) {
  const [actualOrderId, setActualOrderId] = useState(orderId)
  const { createItem, loading: loadingItem, error: errorItem } = useOrderItems(actualOrderId)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [localError, setLocalError] = useState(null)
  const [creatingOrder, setCreatingOrder] = useState(false)

  useEffect(() => {
    if (errorItem) setLocalError(errorItem)
  }, [errorItem])

  const createOrderIfNeeded = async () => {
    if (actualOrderId) return true // Ya existe orden

    if (!mesaId || !localId) {
      setLocalError('Datos de mesa/local faltantes')
      return false
    }

    setCreatingOrder(true)
    setLocalError(null)

    try {
      const { token } = await getAuthContext()
      const response = await fetch(`http://localhost:8000/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          local_id: localId,
          mesa_id: mesaId,
          source: 'dine-in',
          payment_method: 'cash',
          items: [],
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Error al crear orden')
      }

      const newOrder = await response.json()
      setActualOrderId(newOrder.id)
      return true
    } catch (err) {
      setLocalError(err.message || 'Error al crear orden')
      console.error('Error creating order:', err)
      return false
    } finally {
      setCreatingOrder(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)

    if (!selectedProduct) {
      setLocalError('Selecciona un producto')
      return
    }

    if (!quantity || quantity <= 0) {
      setLocalError('Cantidad debe ser mayor a 0')
      return
    }

    // Crear orden si es necesaria
    const hasOrder = await createOrderIfNeeded()
    if (!hasOrder || !actualOrderId) {
      return
    }

    const newItem = await createItem(selectedProduct.id, quantity, 0)

    if (newItem) {
      if (onProductAdded) onProductAdded(newItem)
      setSelectedProduct(null)
      setQuantity(1)
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Agregar Producto</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-product-form">
          {/* Seleccionar Producto */}
          <div className="form-group">
            <label htmlFor="product-select">Producto</label>
            <select
              id="product-select"
              value={selectedProduct ? selectedProduct.id : ''}
              onChange={(e) => {
                const product = products.find((p) => String(p.id) === e.target.value)
                setSelectedProduct(product)
              }}
              disabled={loadingItem || creatingOrder}
              required
            >
              <option value="">-- Seleccionar --</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad */}
          <div className="form-group">
            <label htmlFor="quantity">Cantidad</label>
            <input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={loadingItem || creatingOrder}
              required
            />
          </div>

          {/* Error */}
          {localError && <div className="form-error">{localError}</div>}

          {/* Status */}
          {creatingOrder && <div className="form-info">Creando orden...</div>}

          {/* Botones */}
          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={loadingItem || creatingOrder} className="btn-cancel">
              Cancelar
            </button>
            <button type="submit" disabled={loadingItem || creatingOrder} className="btn-submit">
              {creatingOrder ? 'Creando orden...' : loadingItem ? 'Agregando...' : 'Agregar Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
