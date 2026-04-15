import { useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import InventoryShell from './InventoryShell'
import '../../styles/inventory/InventoryModuleHub.css'

/** Hub Módulo de Inventario: KPIs resumen + tarjetas Recetas / Stock / Proveedores */
function InventoryModuleHub({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const { localId } = useParams()
  const location = useLocation()

  const selectedLocal = useMemo(() => {
    if (location.state?.local) return location.state.local
    return { id: localId, name: `Local ${localId}` }
  }, [location.state, localId])

  const goStock = () => {
    navigate(`/local/${localId}/inventario/stock`, { state: { local: selectedLocal } })
  }

  const goRecipes = () => {
    navigate(`/local/${localId}/inventario/recipes`, { state: { local: selectedLocal } })
  }

  return (
    <InventoryShell user={user} userRole={userRole} onLogout={onLogout} active="hub">
      <button
        type="button"
        className="inv-hub__back"
        onClick={() => navigate(`/local/${localId}`, { state: { local: selectedLocal } })}
      >
        ← Volver a Módulos
      </button>

      <header className="inv-hub__header">
        <span className="inv-hub__header-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <div>
          <h1 className="inv-hub__title">Módulo de Inventario</h1>
          <p className="inv-hub__subtitle">Control de recetas, stock y proveedores</p>
        </div>
      </header>

      <section className="inv-hub__kpis" aria-label="Indicadores del módulo">
        <article className="inv-hub__kpi-card">
          <span className="inv-hub__kpi-icon">🍳</span>
          <span className="inv-hub__kpi-value">—</span>
          <span className="inv-hub__kpi-label">Recetas activas</span>
        </article>
        <article className="inv-hub__kpi-card">
          <span className="inv-hub__kpi-icon">📦</span>
          <span className="inv-hub__kpi-value">—</span>
          <span className="inv-hub__kpi-label">Productos en stock</span>
        </article>
        <article className="inv-hub__kpi-card">
          <span className="inv-hub__kpi-icon">🏪</span>
          <span className="inv-hub__kpi-value">—</span>
          <span className="inv-hub__kpi-label">Proveedores activos</span>
        </article>
        <article className="inv-hub__kpi-card">
          <span className="inv-hub__kpi-icon">⚠️</span>
          <span className="inv-hub__kpi-value">—</span>
          <span className="inv-hub__kpi-label">Alertas pendientes</span>
        </article>
      </section>

      <section className="inv-hub__cards" aria-label="Accesos inventario">
        <article className="inv-hub__feature inv-hub__feature--recipes">
          <h2>Recetas</h2>
          <p className="inv-hub__feature-sub">Gestión de recetas del menú</p>
          <ul className="inv-hub__feature-list">
            <li>CRUD de recetas</li>
            <li>Ingredientes</li>
            <li>Costos</li>
          </ul>
          <button type="button" className="inv-hub__feature-btn inv-hub__feature-btn--primary" onClick={goRecipes}>
            Gestionar recetas →
          </button>
        </article>

        <article className="inv-hub__feature inv-hub__feature--stock">
          <div className="inv-hub__feature-stock-head">
            <span className="inv-hub__feature-stock-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <h2>Stock</h2>
          </div>
          <p className="inv-hub__feature-sub">Control de inventario</p>
          <ul className="inv-hub__feature-list">
            <li>Control de productos</li>
            <li>Entradas y salidas</li>
            <li>Alertas de stock mínimo</li>
            <li>Valorización de inventario (HU-49)</li>
          </ul>
          <button type="button" className="inv-hub__feature-btn inv-hub__feature-btn--primary" onClick={goStock}>
            Gestionar stock →
          </button>
        </article>

        <article className="inv-hub__feature">
          <h2>Proveedores</h2>
          <p className="inv-hub__feature-sub">Gestión de proveedores</p>
          <ul className="inv-hub__feature-list">
            <li>Base de datos</li>
            <li>Contacto</li>
            <li>Historial de compras</li>
          </ul>
          <button type="button" className="inv-hub__feature-btn" disabled>
            Gestionar proveedores →
          </button>
        </article>
      </section>
    </InventoryShell>
  )
}

export default InventoryModuleHub
