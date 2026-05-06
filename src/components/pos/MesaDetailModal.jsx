import { useState, useEffect } from 'react'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import '../../styles/MesaDetailModal.css'

const LoadingSpinner = () => (
  <div className="mesa-detail__loading">
    <div className="spinner" />
    <p>Cargando...</p>
  </div>
)

export default function MesaDetailModal({ mesa, localId, onClose, onTableUpdated }) {
  const { detail, loading: detailLoading, error: detailError, refresh } = useMesaDetail(mesa.id)
  const { data: menuData, loading: menuLoading, fetch: fetchMenu } = useMenuPOS(localId)
  const { createOrder, updateOrderStatus, loading: orderLoading, error: orderError } = useOrderManagement()

  const [selectedProducts, setSelectedProducts] = useState({})
  const [showAddProductForm, setShowAddProductForm] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Cargar menú al abrir modal
  useEffect(() => {
    if (showAddProductForm && !menuData) {
      fetchMenu({})
    }
  }, [showAddProductForm, menuData, fetchMenu])

  // Calcular total de la orden actual
  const calculateTotal = () => {
    if (!detail?.active_orders || detail.active_orders.length === 0) return 0
    return detail.active_orders.reduce((sum, order) => {
      const orderTotal = (order.items || []).reduce((orderSum, item) => orderSum + item.total_price, 0)
      return sum + orderTotal
    }, 0)
  }

  const handleProductQtyChange = (productId, quantity) => {
    if (quantity <= 0) {
      const newSelected = { ...selectedProducts }
      delete newSelected[productId]
      setSelectedProducts(newSelected)
    } else {
      setSelectedProducts(prev => ({
        ...prev,
        [productId]: quantity,
      }))
    }
  }

  const handleAddProducts = async () => {
    if (Object.keys(selectedProducts).length === 0) {
      alert('Selecciona al menos un producto')
      return
    }

    try {
      setIsProcessingPayment(true)

      // Preparar items de la orden
      const items = Object.entries(selectedProducts).map(([productId, quantity]) => {
        const product = (menuData?.products || []).find(p => String(p.id) === String(productId))
        return {
          product_id: productId,
          quantity,
          unit_price: product?.price || 0,
        }
      })

      // Crear nueva orden
      const orderData = {
        local_id: localId,
        mesa_id: mesa.id,
        source: 'dine-in',
        payment_method: 'CASH',
        items,
      }

      const newOrder = await createOrder(orderData)
      setSuccessMessage('✓ Productos agregados a la orden')
      setSelectedProducts({})
      setShowAddProductForm(false)

      // Refrescar detalles de la mesa
      refresh()

      setTimeout(() => setSuccessMessage(''), 2000)
    } catch (err) {
      console.error('Error adding products:', err)
      alert(`Error: ${err.message || 'No se pudieron agregar los productos'}`)
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const handleProceedToPayment = async () => {
    if (!detail?.active_orders || detail.active_orders.length === 0) {
      alert('No hay órdenes para procesar')
      return
    }

    if (!window.confirm('¿Confirmar pago y cerrar la mesa?')) return

    try {
      setIsProcessingPayment(true)

      // Marcar todas las órdenes activas como completadas
      for (const order of detail.active_orders) {
        await updateOrderStatus(order.id, 'completed')
      }

      setSuccessMessage('✓ Mesa cerrada - Pago procesado')
      setTimeout(() => {
        onTableUpdated?.()
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Error processing payment:', err)
      alert(`Error: ${err.message || 'Error procesando pago'}`)
    } finally {
      setIsProcessingPayment(false)
    }
  }

  if (detailLoading) return <div className="mesa-detail-modal"><LoadingSpinner /></div>

  return (
    <div className="mesa-detail-modal-overlay" onClick={onClose}>
      <div className="mesa-detail-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="mesa-detail-modal__header">
          <div>
            <h2 className="mesa-detail-modal__title">{mesa.name}</h2>
            <p className="mesa-detail-modal__subtitle">{mesa.zona || 'General'} • {mesa.capacidad} personas</p>
          </div>
          <button className="mesa-detail-modal__close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Success/Error Messages */}
        {successMessage && <div className="mesa-detail-modal__success">{successMessage}</div>}
        {detailError && <div className="mesa-detail-modal__error">Error: {detailError}</div>}
        {orderError && <div className="mesa-detail-modal__error">Error: {orderError}</div>}

        {/* Main Content */}
        <div className="mesa-detail-modal__content">
          {/* Órdenes actuales */}
          <section className="mesa-detail-modal__section">
            <h3>Órdenes Actuales</h3>
            {!detail?.active_orders || detail.active_orders.length === 0 ? (
              <p className="mesa-detail-modal__empty">No hay órdenes en esta mesa</p>
            ) : (
              <div className="mesa-detail__orders">
                {detail.active_orders.map((order, idx) => (
                  <div key={order.id} className="mesa-detail__order-card">
                    <div className="mesa-detail__order-header">
                      <span className="mesa-detail__order-badge">{idx + 1}</span>
                      <span className="mesa-detail__order-status">{order.status}</span>
                    </div>
                    <div className="mesa-detail__order-items">
                      {(order.items || []).map(item => (
                        <div key={item.id} className="mesa-detail__item">
                          <span className="mesa-detail__item-name">{item.product_name}</span>
                          <div className="mesa-detail__item-details">
                            <span>{item.quantity}x</span>
                            <span className="mesa-detail__item-price">${item.total_price}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Formulario agregar productos */}
          {showAddProductForm && (
            <section className="mesa-detail-modal__section">
              <h3>Agregar Productos</h3>
              {menuLoading ? (
                <LoadingSpinner />
              ) : !menuData?.products || menuData.products.length === 0 ? (
                <p className="mesa-detail-modal__empty">No hay productos disponibles</p>
              ) : (
                <div className="mesa-detail__products">
                  {menuData.products.map(product => (
                    <div key={product.id} className="mesa-detail__product-card">
                      <div className="mesa-detail__product-info">
                        <span className="mesa-detail__product-name">{product.name}</span>
                        <span className="mesa-detail__product-price">${product.price}</span>
                      </div>
                      <div className="mesa-detail__product-controls">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={selectedProducts[product.id] || 0}
                          onChange={e => handleProductQtyChange(product.id, parseInt(e.target.value) || 0)}
                          className="mesa-detail__qty-input"
                          placeholder="Qty"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Total */}
        <div className="mesa-detail-modal__total">
          <div className="mesa-detail__total-row">
            <span>Total:</span>
            <span className="mesa-detail__total-amount">${calculateTotal()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mesa-detail-modal__actions">
          <button
            className="btn-secondary"
            onClick={() => setShowAddProductForm(!showAddProductForm)}
            disabled={isProcessingPayment}
          >
            {showAddProductForm ? 'Cancelar' : '+ Agregar Productos'}
          </button>

          {showAddProductForm && (
            <button
              className="btn-primary"
              onClick={handleAddProducts}
              disabled={isProcessingPayment || Object.keys(selectedProducts).length === 0}
            >
              {isProcessingPayment ? 'Procesando...' : 'Confirmar Productos'}
            </button>
          )}

          {!showAddProductForm && (detail?.active_orders?.length > 0) && (
            <button
              className="btn-success"
              onClick={handleProceedToPayment}
              disabled={isProcessingPayment}
            >
              {isProcessingPayment ? 'Procesando...' : '💳 Proceder a Pago'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
