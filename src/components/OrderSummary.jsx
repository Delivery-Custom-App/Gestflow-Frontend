import { useParams, useNavigate } from 'react-router-dom'
import { useOrderSummary } from '../hooks/useOrderSummary'
import '../styles/OrderSummary.css'

export default function OrderSummary() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { summary, loading, error } = useOrderSummary(orderId)

  if (loading) {
    return <div className="order-summary-loading">Cargando resumen del pedido...</div>
  }

  if (error) {
    return <div className="order-summary-error">Error: {error}</div>
  }

  if (!summary) {
    return <div className="order-summary-error">No se encontró el pedido</div>
  }

  const {
    id: orderIdFromSummary,
    items = [],
    client_name,
    client_email,
    client_phone,
    local_info,
    pricing_breakdown = {},
  } = summary

  const {
    subtotal = 0,
    tax_amount = 0,
    tax_percentage = 0,
    delivery_cost = 0,
    discount_amount = 0,
    total = 0,
  } = pricing_breakdown

  const handleChangeLocal = () => {
    navigate(`/order/${orderId}/change-local`)
  }

  const handleGoBack = () => {
    navigate('/cart')
  }

  const handleConfirm = () => {
    // TODO: Ir a pantalla de pago
    navigate(`/payment/${orderId}`)
  }

  return (
    <div className="order-summary-container">
      <header className="order-summary-header">
        <h1>Confirmar Pedido</h1>
        <p className="order-id">Pedido: {orderIdFromSummary}</p>
      </header>

      {/* SCRUM-136: Items Section */}
      <section className="order-summary-section items-section">
        <h2>📦 Productos</h2>
        <div className="items-list">
          {items && items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className="item-card">
                <div className="item-info">
                  <h3 className="item-name">{item.product_name}</h3>
                  {item.product_description && (
                    <p className="item-description">{item.product_description}</p>
                  )}
                  {item.category_name && (
                    <span className="item-category">{item.category_name}</span>
                  )}
                </div>
                <div className="item-pricing">
                  <span className="item-quantity">×{item.quantity}</span>
                  <span className="item-price">${item.total_price.toLocaleString('es-CL')}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="no-items">No hay items en este pedido</p>
          )}
        </div>
      </section>

      {/* SCRUM-137: Local Info Section */}
      <section className="order-summary-section local-section">
        <h2>📍 Punto de Retiro</h2>
        {local_info ? (
          <div className="local-info-card">
            <h3>{local_info.name}</h3>
            <p className="local-address">{local_info.address}</p>
            <p className="local-phone">{local_info.phone}</p>
            <button onClick={handleChangeLocal} className="btn-change-local">
              Cambiar Local
            </button>
          </div>
        ) : (
          <p>No hay información del local</p>
        )}
      </section>

      {/* Client Info Section */}
      {client_name && (
        <section className="order-summary-section client-section">
          <h2>👤 Información del Cliente</h2>
          <div className="client-info-card">
            <p className="client-name"><strong>{client_name}</strong></p>
            {client_email && <p className="client-email">{client_email}</p>}
            {client_phone && <p className="client-phone">{client_phone}</p>}
          </div>
        </section>
      )}

      {/* SCRUM-138: Pricing Section */}
      <section className="order-summary-section pricing-section">
        <h2>💰 Desglose de Costos</h2>
        <div className="pricing-breakdown">
          <div className="pricing-row">
            <span>Subtotal:</span>
            <span className="price">${subtotal.toLocaleString('es-CL')}</span>
          </div>

          {tax_percentage > 0 && (
            <div className="pricing-row tax-row">
              <span>IVA ({tax_percentage}%) - Chile:</span>
              <span className="price">${tax_amount.toLocaleString('es-CL')}</span>
            </div>
          )}

          {delivery_cost > 0 && (
            <div className="pricing-row">
              <span>Envío:</span>
              <span className="price">${delivery_cost.toLocaleString('es-CL')}</span>
            </div>
          )}

          {discount_amount > 0 && (
            <div className="pricing-row discount-row">
              <span>Descuento:</span>
              <span className="price">-${discount_amount.toLocaleString('es-CL')}</span>
            </div>
          )}

          <div className="pricing-row total-row">
            <span>TOTAL A PAGAR:</span>
            <span className="total-price">${total.toLocaleString('es-CL')}</span>
          </div>
        </div>
        <p className="currency-note">* Montos en Pesos Chilenos ($)</p>
      </section>

      {/* Action Buttons */}
      <section className="order-summary-actions">
        <button onClick={handleGoBack} className="btn btn-secondary">
          ← Volver al Carrito
        </button>
        <button onClick={handleConfirm} className="btn btn-primary">
          Confirmar y Ir a Pago ✓
        </button>
      </section>
    </div>
  )
}
