import { useEffect } from 'react'
import { useReportesPOS } from '../../hooks/useReportesPOS'
import { formatCLP } from '../../lib/formatCLP'
import '../../styles/ReportesModal.css'

/** Modal de reportes POS: top producto, bebida y top 5 (datos del backend). */
export default function ReportesModal({ localId, onClose }) {
  const { data, loading, error, fetch } = useReportesPOS(localId)

  useEffect(() => {
    fetch()
  }, [fetch])

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="reportes-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Reportes POS">
      <div className="reportes-modal">

        <header className="reportes-header">
          <div className="reportes-header-title">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 16l4-5 4 3 4-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>Reportes Básicos</h2>
          </div>
          <button className="reportes-close" onClick={onClose} aria-label="Cerrar reportes">✕</button>
        </header>

        <div className="reportes-body">
          {loading && (
            <div className="reportes-loading">
              <div className="reportes-spinner" aria-label="Cargando..." />
              <p>Cargando datos...</p>
            </div>
          )}

          {error && (
            <div className="reportes-error">
              <p>Error al cargar reportes: {error}</p>
              <button onClick={fetch} className="btn-retry">Reintentar</button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Destacados: producto + bebida más vendidos */}
              <section className="reportes-destacados">
                <DestacadoCard
                  titulo="Producto más vendido"
                  icono="🍽️"
                  metric={data.top_producto}
                  colorClass="destacado-producto"
                  emptyMsg="Sin ventas registradas"
                />
                <DestacadoCard
                  titulo="Bebida más vendida"
                  icono="🥤"
                  metric={data.top_bebida}
                  colorClass="destacado-bebida"
                  emptyMsg="Sin bebidas vendidas"
                />
              </section>

              {/* Top 5 general */}
              <section className="reportes-top5">
                <h3 className="reportes-section-title">Top 5 Productos</h3>
                {data.top_5.length === 0 ? (
                  <p className="reportes-empty">No hay datos de ventas disponibles.</p>
                ) : (
                  <ol className="top5-list">
                    {data.top_5.map((item, index) => (
                      <Top5Item key={String(item.product_id)} item={item} rank={index + 1} />
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}

          {!loading && !error && !data && (
            <p className="reportes-empty">No hay datos disponibles.</p>
          )}
        </div>

        <footer className="reportes-footer">
          <button className="reportes-btn-actualizar" onClick={fetch} disabled={loading}>
            {loading ? 'Actualizando...' : '↻ Actualizar'}
          </button>
          <button className="reportes-btn-cerrar" onClick={onClose}>Cerrar</button>
        </footer>

      </div>
    </div>
  )
}

function DestacadoCard({ titulo, icono, metric, colorClass, emptyMsg }) {
  return (
    <div className={`destacado-card ${colorClass}`}>
      <div className="destacado-icon">{icono}</div>
      <div className="destacado-content">
        <p className="destacado-titulo">{titulo}</p>
        {metric ? (
          <>
            <p className="destacado-nombre">{metric.product_name}</p>
            <p className="destacado-stats">
              <span>{metric.units_sold} unidades</span>
              <span className="destacado-sep">·</span>
              <span>${formatCLP(metric.revenue)}</span>
            </p>
          </>
        ) : (
          <p className="destacado-empty">{emptyMsg}</p>
        )}
      </div>
    </div>
  )
}

function Top5Item({ item, rank }) {
  const maxUnits = 999
  const barWidth = Math.min((item.units_sold / maxUnits) * 100, 100)

  return (
    <li className="top5-item">
      <span className={`top5-rank rank-${rank <= 3 ? rank : 'rest'}`}>{rank}</span>
      <div className="top5-info">
        <div className="top5-name-row">
          <span className="top5-name">{item.product_name}</span>
          <span className="top5-units">{item.units_sold} uds.</span>
        </div>
        <div className="top5-bar-container">
          <div className="top5-bar" style={{ width: `${barWidth}%` }} />
        </div>
        <span className="top5-revenue">${formatCLP(item.revenue)}</span>
      </div>
    </li>
  )
}
