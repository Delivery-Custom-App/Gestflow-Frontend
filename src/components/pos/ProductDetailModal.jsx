import { formatCLP } from '../../lib/formatCLP'
import '../../styles/ProductDetailModal.css'

/**
 * HU-62: Visualización de detalle de producto
 * SCRUM-493: Modal/vista de detalle
 * SCRUM-494: Lógica de añadidos
 * SCRUM-495: Cálculo de precio total
 * SCRUM-496: Estado vacío de añadidos
 *
 * Muestra al hacer click en un producto:
 * - Descripción base
 * - Añadidos (o "Sin añadidos")
 * - Precio base (unit_price)
 * - Precio total (total_price = cantidad × precio base)
 */
export default function ProductDetailModal({ product, onClose }) {
  if (!product) return null

  // SCRUM-494: Lógica de añadidos — se extraen de la descripción
  // Formato esperado en description: "Texto base. Añadidos: Item1, Item2."
  const { baseDescription, anyadidos } = parseDescription(product.product_description || '')

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="product-detail-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label={`Detalle de ${product.product_name}`}>
      <div className="product-detail-modal">

        <header className="product-detail-header">
          <h2 className="product-detail-name">{product.product_name || 'Producto'}</h2>
          <button className="product-detail-close" onClick={onClose} aria-label="Cerrar detalle">✕</button>
        </header>

        <div className="product-detail-body">

          {/* Descripción — SCRUM-493 */}
          <section className="product-detail-section">
            <h3 className="product-detail-section-title">Descripción</h3>
            <p className="product-detail-description">
              {baseDescription || 'Sin descripción'}
            </p>
          </section>

          {/* Añadidos — SCRUM-494 + SCRUM-496 */}
          <section className="product-detail-section">
            <h3 className="product-detail-section-title">Añadidos</h3>
            {anyadidos.length > 0 ? (
              <ul className="product-detail-anyadidos">
                {anyadidos.map((item, i) => (
                  <li key={i} className="product-detail-anyadido-item">
                    <span className="anyadido-bullet">+</span>
                    {item.trim()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="product-detail-sin-anyadidos">Sin añadidos</p>
            )}
          </section>

          {/* Precios — SCRUM-495 */}
          <section className="product-detail-section product-detail-prices">
            <div className="price-row">
              <span className="price-label">Precio unitario</span>
              <span className="price-value">${formatCLP(product.unit_price)}</span>
            </div>
            {product.quantity > 1 && (
              <div className="price-row">
                <span className="price-label">Cantidad</span>
                <span className="price-value">×{product.quantity}</span>
              </div>
            )}
            <div className="price-row price-row-total">
              <span className="price-label">Precio total</span>
              <span className="price-value price-total">${formatCLP(product.total_price)}</span>
            </div>
          </section>

        </div>

        <footer className="product-detail-footer">
          <button className="product-detail-btn-close" onClick={onClose}>Cerrar</button>
        </footer>

      </div>
    </div>
  )
}

/**
 * SCRUM-494: Parsea la descripción del producto para separar
 * la descripción base de los añadidos.
 *
 * Ejemplo: "Hamburguesa doble. Añadidos: Tocino, Extra Queso."
 *   → baseDescription: "Hamburguesa doble."
 *   → anyadidos: ["Tocino", "Extra Queso"]
 */
function parseDescription(description) {
  if (!description) return { baseDescription: '', anyadidos: [] }

  const marker = /añadidos?:/i
  const match = description.match(marker)

  if (!match) {
    return { baseDescription: description.trim(), anyadidos: [] }
  }

  const splitIndex = description.search(marker)
  const baseDescription = description.slice(0, splitIndex).trim().replace(/\.$/, '')
  const anyadidosRaw = description.slice(splitIndex + match[0].length).trim().replace(/\.$/, '')
  const anyadidos = anyadidosRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return { baseDescription, anyadidos }
}
