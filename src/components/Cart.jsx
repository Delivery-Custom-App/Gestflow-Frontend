import { useState, useEffect } from 'react'
import { useCart } from '../hooks/useCart'
import { supabase } from '../lib/supabaseClient'
import '../styles/Cart.css'

/**
 * Componente de página del carrito de compras
 */
export default function Cart() {
  const { items, total, loading, error, removeItem, clearCart, addItem, isSynced } =
    useCart()
  const [userEmail, setUserEmail] = useState('')
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Obtener email del usuario
  useEffect(() => {
    const getUserEmail = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setUserEmail(data.session.user.email)
      }
    }
    getUserEmail()
  }, [])

  const handleRemoveItem = async (itemId) => {
    try {
      await removeItem(itemId)
      setSuccessMessage('Producto eliminado del carrito')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setCheckoutError('Error al eliminar producto: ' + err.message)
    }
  }

  const handleClearCart = async () => {
    if (window.confirm('¿Estás seguro de que deseas vaciar el carrito?')) {
      try {
        await clearCart()
        setSuccessMessage('Carrito vaciado')
        setTimeout(() => setSuccessMessage(''), 3000)
      } catch (err) {
        setCheckoutError('Error al vaciar carrito: ' + err.message)
      }
    }
  }

  const handleCheckout = async () => {
    if (items.length === 0) {
      setCheckoutError('El carrito está vacío')
      return
    }

    setProcessingCheckout(true)
    setCheckoutError('')

    try {
      // Validar stock antes de proceder
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const { data } = await supabase.auth.getSession()
      const token = data.session.access_token

      // TODO: Aquí iría la lógica de checkout
      // Por ahora solo se muestra el resumen
      setSuccessMessage(`Pedido procesado. Total: $${total.toLocaleString()}`)
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (err) {
      setCheckoutError('Error al procesar el pedido: ' + err.message)
    } finally {
      setProcessingCheckout(false)
    }
  }

  const handleQuantityChange = async (item, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveItem(item.id)
      return
    }

    try {
      // Eliminar item anterior
      await removeItem(item.id)

      // Agregar con nueva cantidad
      await addItem(
        item.product_id,
        item.local_id,
        newQuantity,
        item.notes,
      )
      setSuccessMessage('Cantidad actualizada')
      setTimeout(() => setSuccessMessage(''), 2000)
    } catch (err) {
      setCheckoutError('Error al actualizar cantidad: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="cart-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Cargando carrito...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-container">
      <div className="cart-header">
        <div className="header-top">
          <h1>🛒 Mi Carrito</h1>
          <div className="sync-status">
            {isSynced ? (
              <span className="synced">Sincronizado</span>
            ) : (
              <span className="not-synced">Modo offline</span>
            )}
          </div>
        </div>
        <p className="user-email">{userEmail}</p>
      </div>

      {/* Mensajes de error */}
      {error && <div className="error-message">{error}</div>}
      {checkoutError && <div className="error-message">{checkoutError}</div>}

      {/* Mensajes de éxito */}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* Carrito vacío */}
      {items.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-icon">🛍️</div>
          <h2>Tu carrito está vacío</h2>
          <p>Agrega productos desde el menú para comenzar tu pedido</p>
          <a href="/" className="btn-continue-shopping">
            Continuar comprando
          </a>
        </div>
      ) : (
        <>
          {/* Lista de items */}
          <div className="cart-items">
            <div className="cart-items-header">
              <span>Producto</span>
              <span>Precio</span>
              <span>Cantidad</span>
              <span>Subtotal</span>
              <span>Acciones</span>
            </div>

            {items.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="item-product">
                  <div className="product-info">
                    <p className="product-name">{item.product_name}</p>
                    {item.notes && (
                      <p className="product-notes">Notas: {item.notes}</p>
                    )}
                  </div>
                </div>

                <div className="item-price">
                  ${item.unit_price?.toLocaleString() || 0}
                </div>

                <div className="item-quantity">
                  <button
                    className="qty-btn"
                    onClick={() =>
                      handleQuantityChange(item, item.quantity - 1)
                    }
                    disabled={item.quantity <= 1}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      handleQuantityChange(
                        item,
                        Math.max(1, parseInt(e.target.value) || 1),
                      )
                    }
                    className="qty-input"
                    min="1"
                  />
                  <button
                    className="qty-btn"
                    onClick={() =>
                      handleQuantityChange(item, item.quantity + 1)
                    }
                  >
                    +
                  </button>
                </div>

                <div className="item-total">
                  ${item.total_price?.toLocaleString() || 0}
                </div>

                <button
                  className="btn-remove"
                  onClick={() => handleRemoveItem(item.id)}
                  title="Eliminar del carrito"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          {/* Resumen del carrito */}
          <div className="cart-summary">
            <div className="summary-details">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>${total?.toLocaleString() || 0}</span>
              </div>
              <div className="summary-row">
                <span>Impuestos:</span>
                <span>$0</span>
              </div>
              <div className="summary-row total-row">
                <span>Total:</span>
                <span>${total?.toLocaleString() || 0}</span>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="cart-actions">
              <button
                className="btn-checkout btn-primary"
                onClick={handleCheckout}
                disabled={processingCheckout || items.length === 0}
              >
                {processingCheckout ? 'Procesando...' : '✓ Finalizar Compra'}
              </button>

              <button
                className="btn-clear btn-secondary"
                onClick={handleClearCart}
              >
                Vaciar Carrito
              </button>

              <a href="/" className="btn-continue btn-secondary">
                ← Continuar Comprando
              </a>
            </div>
          </div>

          {/* Información de persistencia */}
          <div className="cart-info">
            <p>
              💾 Tu carrito se guarda automáticamente en tu dispositivo y se
              sincroniza con nuestros servidores
            </p>
          </div>
        </>
      )}
    </div>
  )
}
