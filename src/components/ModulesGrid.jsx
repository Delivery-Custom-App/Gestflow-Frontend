import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/ModulesGrid.css'

function ModulesGrid({ localId, localName, userRole }) {
  const navigate = useNavigate()
  const [hoveredModule, setHoveredModule] = useState(null)

  const modules = [
    {
      id: 'administrativo',
      title: 'Administrativo',
      subtitle: 'Gestión financiera y operativa del negocio',
      icon: 'grid',
      features: [
        'Dashboard',
        'Flujo de Caja',
        'Ventas',
        'Alertas',
        'Rendiciones',
        'Bonos',
        'Reportes',
      ],
      color: '#059669',
    },
    {
      id: 'pos',
      title: 'POS Restaurante',
      subtitle: 'Sistema punto de venta para restaurante y bar',
      icon: 'bar',
      features: [
        'Gestión de Mesas',
        'Menú',
        'Pantalla Bar',
        'Pantalla Cocina',
        'Toma de Pedidos',
      ],
      color: '#047857',
    },
    {
      id: 'inventario',
      title: 'Inventario',
      subtitle: 'Control de stock, recetas y proveedores',
      icon: 'package',
      features: [
        'Recetas',
        'Control de Stock',
        'Proveedores',
        'Órdenes de Compra',
      ],
      color: '#059669',
    },
    {
      id: 'configuracion',
      title: 'Configuración',
      subtitle: 'Administración del sistema y usuarios',
      icon: 'settings',
      features: [
        'Gestión de Usuarios',
        'Configuration General',
        'Parámetros del Sistema',
        'Auditoría',
      ],
      color: '#047857',
    },
  ]

  const handleModuleClick = (moduleId) => {
    navigate(`/local/${localId}/administrativo/${moduleId}`)
  }

  return (
    <div className="modules-grid-container">
      <div className="modules-header">
        <div className="modules-header-content">
          <h2>Módulos Disponibles</h2>
          <p className="modules-subtitle">Selecciona un módulo para continuar</p>
        </div>
      </div>

      <div className="modules-wrapper">
        <div className="modules-grid">
          {modules.map((module) => (
            <div
              key={module.id}
              className="module-card"
              onMouseEnter={() => setHoveredModule(module.id)}
              onMouseLeave={() => setHoveredModule(null)}
            >
              <div className="module-header" style={{ backgroundColor: module.color }}>
                <div className="module-icon" aria-hidden="true">
                  {module.icon === 'grid' && (
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  )}
                  {module.icon === 'bar' && (
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M3 5H21M5 5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8 8V16M11 8V16M14 8V16M17 8V16" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  )}
                  {module.icon === 'package' && (
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L3 7V12C3 17.55 8.16 22.74 12 23.96C15.84 22.74 21 17.55 21 12V7L12 2Z" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 10.5L7.5 7.5M12 10.5L16.5 7.5M12 10.5V18" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  )}
                  {module.icon === 'settings' && (
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 2V5M12 19V22M5.64 5.64L7.76 7.76M16.24 16.24L18.36 18.36M2 12H5M19 12H22M5.64 18.36L7.76 16.24M16.24 7.76L18.36 5.64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <div className="module-title-section">
                  <h3>{module.title}</h3>
                  <p className="module-subtitle-text">{module.subtitle}</p>
                </div>
                <div className="module-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 12H19M12 5L19 12L12 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div className="module-content">
                <div className="module-features">
                  <p className="features-label">Funcionalidades:</p>
                  <ul className="features-list">
                    {module.features.map((feature, idx) => (
                      <li key={idx}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <button
                  className={`module-button ${hoveredModule === module.id ? 'hovered' : ''}`}
                  onClick={() => handleModuleClick(module.id)}
                  style={{ backgroundColor: module.color }}
                >
                  Acceder al Módulo
                  <span className="button-arrow">→</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="modules-stats">
          <div className="stat-card">
            <div className="stat-number">4</div>
            <div className="stat-label">Módulos Disponibles</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{userRole}</div>
            <div className="stat-label">Tu Rol</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">95%</div>
            <div className="stat-label">Sistema Funcional</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">v1</div>
            <div className="stat-label">Versión Modular</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModulesGrid
