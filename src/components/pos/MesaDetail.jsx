import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { formatCLP } from '../../lib/formatCLP'
import { apiRequest } from '../../lib/apiClient'
import ProductList from './ProductList'
import '../../styles/MesaDetail.css'

const EXTRAS_DISPONIBLES = [
  'Pan', 'Ketchup', 'Mostaza', 'Mayonesa',
  'Aceite', 'Sal', 'Pimienta', 'Mantequilla',
  'Servilletas', 'Cubiertos',
]

export default function MesaDetail({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const { mesaId, localId } = useParams()
  const { detail, loading, error, refresh } = useMesaDetail(mesaId)
  const { data: menuData, fetch: fetchMenu } = useMenuPOS(localId)

  const [agregados, setAgregados] = useState({})
  const [showPicker, setShowPicker] = useState(false)
  const [pickerOrderId, setPickerOrderId] = useState(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    fetchMenu()
  }, [fetchMenu])

  // Búsqueda en picker con el mismo endpoint que el menú (`?search=`) y debounce
  useEffect(() => {
    if (!showPicker) return
    const id = setTimeout(() => {
      fetchMenu({ search: pickerSearch.trim() || undefined })
    }, 300)
    return () => clearTimeout(id)
  }, [pickerSearch, showPicker, fetchMenu])

  // ── Agregados helpers ──────────────────────────────────────
  const agregarExtra = (nombre) =>
    setAgregados((prev) => ({ ...prev, [nombre]: (prev[nombre] || 0) + 1 }))
  const quitarExtra = (nombre) =>
    setAgregados((prev) => {
      const n = { ...prev }
      if (n[nombre] <= 1) delete n[nombre]
      else n[nombre] -= 1
      return n
    })
  const limpiarExtras = () => setAgregados({})

  // ── Abrir selector de productos ────────────────────────────
  const handleOpenPicker = (orderId = null) => {
    setPickerOrderId(orderId)
    setAddError(null)
    setPickerSearch('')
    fetchMenu()
    setShowPicker(true)
  }

  // ── Agregar producto (crea orden si no existe) ─────────────
  const handleAddProduct = useCallback(async (product) => {
    setAddingProduct(true)
    setAddError(null)
    try {
      let orderId = pickerOrderId

      // Si no hay orden, crear una primero
      if (!orderId) {
        const newOrder = await apiRequest('/orders', {
          method: 'POST',
          body: {
            local_id: localId,
            mesa_id: mesaId,
            source: 'dine-in',
            payment_method: 'CASH',
            items: [],
          },
        })
        orderId = newOrder.id
      }

      // Agregar producto a la orden
      await apiRequest(`/orders/${orderId}/items`, {
        method: 'POST',
        body: {
          product_id: product.id,
          quantity: 1,
          unit_price: product.price,
        },
      })

      setShowPicker(false)
      setPickerSearch('')
      fetchMenu()
      await refresh()
    } catch (err) {
      setAddError(err.message || 'Error al agregar producto')
    } finally {
      setAddingProduct(false)
    }
  }, [pickerOrderId, localId, mesaId, refresh, fetchMenu])

  // El backend filtra por `search`
  const pickerMenu = (menuData?.categories || []).filter((cat) => (cat.products?.length || 0) > 0)

  const handleGoBack = () => navigate(`/local/${localId}/pos`)

  // ── Loading / Error states ────────────────────────────────
  if (loading) return (
    <div className="mesa-detail-container">
      <div className="mesa-detail-loading"><p>Cargando detalle de mesa...</p></div>
    </div>
  )
  if (error) return (
    <div className="mesa-detail-container">
      <div className="mesa-detail-error">
        <p>Error: {error}</p>
        <button onClick={() => navigate(`/local/${localId}/pos`)}>Volver</button>
      </div>
    </div>
  )
  if (!detail) return (
    <div className="mesa-detail-container">
      <div className="mesa-vacia">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c.866-1.5 2.926-5.231 9.303-6.622m0 0a27.047 27.047 0 015.897 6.622M12 12.75c2.613 0 4.859-1.354 5.573-3.423" />
        </svg>
        <div className="mesa-vacia-text">Esta mesa está vacía</div>
        <div className="mesa-vacia-subtitle">Sin órdenes activas</div>
        <button onClick={() => navigate(`/local/${localId}/pos`)}>Volver</button>
      </div>
    </div>
  )

  const { mesa, active_orders, total_products, total_value } = detail
  const hasOrders = active_orders && active_orders.length > 0
  const agregadosActivos = Object.entries(agregados)

  return (
    <main className="mesa-detail-container">
      <header className="mesa-detail-header">
        <button className="mesa-detail-back-btn" onClick={handleGoBack}>← Volver</button>
        <div className="mesa-detail-title">
          <h1>{mesa.name || `Mesa ${mesa.numero}`}</h1>
          <p className="mesa-detail-zone">{mesa.zona || 'General'}</p>
        </div>
      </header>

      <div className="mesa-detail-body">
        {/* Info básica */}
        <section className="mesa-detail-info">
          <div className="info-card">
            <span className="info-label">Capacidad</span>
            <span className="info-value">{mesa.capacidad || 4} personas</span>
          </div>
          <div className="info-card">
            <span className="info-label">Estado</span>
            <span className={`info-value state-${mesa.state || 'libre'}`}>{getStateName(mesa.state)}</span>
          </div>
          <div className="info-card">
            <span className="info-label">Tipo</span>
            <span className="info-value">{mesa.is_delivery ? 'Delivery' : 'Dine-In'}</span>
          </div>
        </section>

        {/* KPIs */}
        <section className="mesa-detail-kpis">
          <article className="kpi-card kpi-productos">
            <div className="kpi-icon">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="kpi-content">
              <p className="kpi-label">Productos</p>
              <p className="kpi-value">{total_products}</p>
            </div>
          </article>
          <article className="kpi-card kpi-valor">
            <div className="kpi-icon">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 7v5M9.5 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="kpi-content">
              <p className="kpi-label">Valor Total</p>
              <p className="kpi-value">${formatCLP(total_value)}</p>
            </div>
          </article>
        </section>

        {/* Órdenes + Agregados (todo junto) */}
        <section className="mesa-detail-orders">
          <div className="orders-section-header">
            <h2>Órdenes Activas</h2>
            <button className="btn-add-product" onClick={() => handleOpenPicker(hasOrders ? active_orders[0]?.id : null)}>
              + Agregar Producto
            </button>
          </div>

          {hasOrders ? (
            <div className="orders-list">
              {active_orders.map((order) => (
                <article key={order.id} className={`order-card order-status-${order.status}`}>
                  <div className="order-header">
                    <div className="order-meta">
                      <span className="order-status-badge">{getOrderStatusLabel(order.status)}</span>
                      <span className="order-payment">{getPaymentLabel(order.payment_method)}</span>
                    </div>
                    <span className="order-total">${formatCLP(order.total)}</span>
                  </div>
                  <div className="order-items">
                    <div className="order-items-header">
                      <h3>Productos</h3>
                    </div>
                    <ProductList products={order.items || []} orderId={order.id} onProductsChanged={refresh} />
                  </div>
                  <div className="order-footer">
                    <span className="order-subtotal">Subtotal: ${formatCLP(order.subtotal)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mesa-sin-ordenes">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c.866-1.5 2.926-5.231 9.303-6.622m0 0a27.047 27.047 0 015.897 6.622M12 12.75c2.613 0 4.859-1.354 5.573-3.423" />
              </svg>
              <p className="mesa-sin-ordenes-text">Mesa libre</p>
              <p className="mesa-sin-ordenes-subtitle">Agrega un producto para iniciar la atención</p>
            </div>
          )}

          {/* ── Agregados — dentro de la sección de órdenes ── */}
          <div className="mesa-agregados">
            <div className="agregados-header">
              <h3>Agregados de la Mesa</h3>
              <p className="agregados-subtitle">Extras sin costo entregados en la mesa</p>
            </div>
            <div className="extras-chips">
              {EXTRAS_DISPONIBLES.map((nombre) => (
                <button key={nombre} className="extra-chip" onClick={() => agregarExtra(nombre)}>
                  + {nombre}
                </button>
              ))}
            </div>
            {agregadosActivos.length > 0 ? (
              <div className="agregados-activos">
                {agregadosActivos.map(([nombre, cantidad]) => (
                  <div key={nombre} className="agregado-row">
                    <span className="agregado-nombre">{nombre}</span>
                    <div className="agregado-controls">
                      <button className="agregado-btn-minus" onClick={() => quitarExtra(nombre)}>−</button>
                      <span className="agregado-cantidad">x{cantidad}</span>
                      <button className="agregado-btn-plus" onClick={() => agregarExtra(nombre)}>+</button>
                    </div>
                  </div>
                ))}
                <button className="btn-limpiar-extras" onClick={limpiarExtras}>Limpiar todo</button>
              </div>
            ) : (
              <p className="agregados-empty">Ningún agregado registrado aún.</p>
            )}
          </div>
        </section>
      </div>

      <footer className="mesa-detail-footer">
        <button className="btn-volver" onClick={handleGoBack}>← Volver a Visualización</button>
      </footer>

      {/* ── Product Picker Modal ── */}
      {showPicker && (
        <div
          className="picker-backdrop"
          onClick={() => {
            setShowPicker(false)
            setPickerSearch('')
            fetchMenu()
          }}
        >
          <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="picker-header">
              <h3>Seleccionar Producto</h3>
              <button
                type="button"
                className="picker-close"
                onClick={() => {
                  setShowPicker(false)
                  setPickerSearch('')
                  fetchMenu()
                }}
              >
                ✕
              </button>
            </div>

            <input
              className="picker-search"
              type="text"
              placeholder="Buscar producto..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoFocus
            />

            {addError && <p className="picker-error">{addError}</p>}

            <div className="picker-list">
              {pickerMenu.length === 0 && (
                <p className="picker-empty">Sin resultados</p>
              )}
              {pickerMenu.map((cat) => (
                <div key={cat.id}>
                  <p className="picker-cat-label">{cat.name}</p>
                  {cat.products.map((product) => (
                    <button
                      key={product.id}
                      className="picker-product-row"
                      onClick={() => handleAddProduct(product)}
                      disabled={addingProduct}
                    >
                      <span className="picker-product-name">{product.name}</span>
                      <span className="picker-product-price">${formatCLP(product.price)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {addingProduct && <p className="picker-adding">Agregando...</p>}
          </div>
        </div>
      )}
    </main>
  )
}

function getStateName(state) {
  return { libre: 'Libre', ocupada: 'Ocupada', en_cobro: 'En Cobro', inactiva: 'Inactiva' }[state] || 'Desconocido'
}
function getOrderStatusLabel(status) {
  return { pending: 'Pendiente', PENDING: 'Pendiente', in_progress: 'En Progreso', PREPARING: 'Preparando', ready: 'Listo', READY: 'Listo', delivered: 'Entregado', COMPLETED: 'Completado', cancelled: 'Cancelado' }[status] || status
}
function getPaymentLabel(method) {
  return { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', CASH: 'Efectivo', DEBIT: 'Débito', CREDIT: 'Crédito' }[method] || method
}
