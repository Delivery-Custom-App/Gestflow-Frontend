import { useNavigate, useParams } from 'react-router-dom'
import './BackToInventoryHubButton.css'

/**
 * Vuelta al hub de inventario con el mismo estilo en Recetas, Stock, Proveedores y Compras semanales.
 * @param {{ local?: unknown } | null | undefined} [navState] — p. ej. `{ local: selectedLocal }` para conservar contexto del local.
 */
function BackToInventoryHubButton({ navState } = {}) {
  const navigate = useNavigate()
  const { localId } = useParams()

  const handleClick = () => {
    const opts =
      navState != null && typeof navState === 'object' && Object.keys(navState).length > 0
        ? { state: navState }
        : undefined
    navigate(`/local/${localId}/inventario`, opts)
  }

  return (
    <div className="inv-back-hub-wrap">
      <button type="button" className="inv-back-hub" onClick={handleClick}>
        <span className="inv-back-hub__chev" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="inv-back-hub__text">Centro de inventario</span>
      </button>
    </div>
  )
}

export default BackToInventoryHubButton
