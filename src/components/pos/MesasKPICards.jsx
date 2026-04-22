import { useMesasKPIs } from '../../hooks/useMesasKPIs'

const KPI_CONFIG = [
  {
    key: 'total',
    label: 'Total Mesas',
    color: 'kpi-total',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="8" width="18" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 11V18M19 11V18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M3 18H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'libres',
    label: 'Mesas Libres',
    color: 'kpi-libre',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'ocupadas',
    label: 'Mesas Ocupadas',
    color: 'kpi-ocupada',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 19C5 15.686 8.134 13 12 13C15.866 13 19 15.686 19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'en_cobro',
    label: 'Mesas en Cobro',
    color: 'kpi-cobro',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 10H21" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 15H10M14 15H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
]

function KPICard({ config, value, loading }) {
  return (
    <article className={`mesas-kpi-card ${config.color}`}>
      <div className="mesas-kpi-icon">{config.icon}</div>
      <div className="mesas-kpi-body">
        <span className="mesas-kpi-value">
          {loading ? '—' : value ?? 0}
        </span>
        <span className="mesas-kpi-label">{config.label}</span>
      </div>
    </article>
  )
}

export default function MesasKPICards({ localId, onRefreshReady }) {
  const { kpis, loading, error, refresh } = useMesasKPIs(localId)

  // Expose refresh fn to parent (POSModule) so it can trigger after mesa creation
  if (onRefreshReady) onRefreshReady(refresh)

  return (
    <section className="mesas-kpis-section">
      <div className="mesas-kpis-header">
        <h3>Estado de Mesas</h3>
        <button
          className="mesas-kpi-refresh"
          type="button"
          onClick={refresh}
          aria-label="Actualizar KPIs"
          disabled={loading}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12C4 7.582 7.582 4 12 4C14.8 4 17.3 5.4 18.8 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M20 12C20 16.418 16.418 20 12 20C9.2 20 6.7 18.6 5.2 16.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M19 4L19 8L15 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 20L5 16L9 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Actualizar
        </button>
      </div>

      {error && (
        <p className="mesas-kpi-error">{error}</p>
      )}

      <div className="mesas-kpis-grid">
        {KPI_CONFIG.map((config) => (
          <KPICard
            key={config.key}
            config={config}
            value={kpis?.[config.key]}
            loading={loading}
          />
        ))}
      </div>

      {kpis?.generated_at && (
        <p className="mesas-kpi-timestamp">
          Actualizado: {new Date(kpis.generated_at).toLocaleTimeString('es-AR')}
        </p>
      )}
    </section>
  )
}
