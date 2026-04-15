import { useState } from 'react'
import '../styles/LocalsGrid.css'

function LocalsGrid({ locales, onLocalSelect, onCreateLocal }) {
  const [hoveredLocal, setHoveredLocal] = useState(null)

  const modulesList = [
    'Administrativo',
    'POS Restaurante',
    'Inventario',
    'Configuración',
  ]

  return (
    <div className="locales-grid-container">
      <div className="locales-wrapper">
        <div className="locales-page-title">
          <div>
            <h2>Tus Locales</h2>
            <p className="locales-subtitle">Selecciona un local para gestionar sus módulos</p>
          </div>
          <button className="btn-create-local-header" onClick={onCreateLocal} aria-label="Crear nuevo local">
            <span aria-hidden="true">+</span> Crear Local
          </button>
        </div>

        {locales.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="5" y="3" width="10" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                <rect x="9" y="7" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
            <h3>No hay locales disponibles</h3>
            <p>Crea tu primer local para comenzar a gestionar</p>
            <button className="btn-create-local-empty" onClick={onCreateLocal}>
              Crear Local
            </button>
          </div>
        ) : (
          <>
            <div className="locales-grid">
              {locales.map((local, index) => (
                <div
                  key={local.id}
                  className="local-card"
                  onMouseEnter={() => setHoveredLocal(local.id)}
                  onMouseLeave={() => setHoveredLocal(null)}
                >
                  <div className="local-header" style={{ backgroundColor: '#059669' }}>
                    <div className="local-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <rect x="5" y="3" width="10" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                        <rect x="9" y="7" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </div>
                    <div className="local-title-section">
                      <h3>{local.name}</h3>
                      <p className="local-location">{local.address}</p>
                    </div>
                    <div className="local-arrow" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M5 12H19M12 5L19 12L12 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>

                  <div className="local-content">
                    <div className="local-modules">
                      <p className="modules-label">Módulos Disponibles:</p>
                      <ul className="modules-list">
                        {modulesList.map((module, idx) => (
                          <li key={idx}>{module}</li>
                        ))}
                      </ul>
                    </div>

                    <button
                      className={`local-button ${hoveredLocal === local.id ? 'hovered' : ''}`}
                      onClick={() => onLocalSelect(local, index)}
                      style={{ backgroundColor: '#059669' }}
                    >
                      Ver Detalles
                      <span className="button-arrow">→</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="locales-stats">
              <div className="stat-card">
                <div className="stat-number">{locales.length}</div>
                <div className="stat-label">Locales Disponibles</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">4</div>
                <div className="stat-label">Módulos por Local</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">100%</div>
                <div className="stat-label">Funcionalidad</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">v1</div>
                <div className="stat-label">Versión Sistema</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default LocalsGrid
