import { formatCLP } from '../../lib/formatCLP'
import '../../styles/ProductDetailModal.css'

/** Modal de detalle: descripción, añadidos parseados desde el texto y precios. */
export default function ProductDetailModal({ product, onClose }) {
  if (!product) return null

  // Añadidos extraídos de la descripción: "Texto base. Añadidos: Item1, Item2."
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

          {/* Descripción */}
          <section className="product-detail-section">
            <h3 className="product-detail-section-title">Descripción</h3>
            <p className="product-detail-description">
              {baseDescription || 'Sin descripción'}
            </p>
          </section>

          {/* Añadidos */}
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

          {/* Precios */}
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
 * Separa descripción base y lista de añadidos tras "Añadidos:".
 * Ej.: "Hamburguesa doble. Añadidos: Tocino, Extra Queso."
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
