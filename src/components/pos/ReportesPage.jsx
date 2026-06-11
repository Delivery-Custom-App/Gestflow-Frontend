import { useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useReportesPOS } from '../../hooks/useReportesPOS'
import { formatCLP } from '../../lib/formatCLP'
import { Button } from '@/components/ui/button'

export default function ReportesPage() {
  const { localId } = useParams()
  const navigate = useNavigate()
  const { state: locState } = useLocation()
  const { data, loading, error, fetch } = useReportesPOS(localId)

  useEffect(() => {
    fetch()
  }, [fetch])

  return (
    <>
      <header className="flex items-center justify-between px-6 h-14 shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/local/${localId}/pos`, { state: locState })}
          >
            ← Volver
          </Button>
          <div>
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] leading-none">
              Reportes POS
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Estadísticas de ventas</p>
          </div>
        </div>
        </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-4 lg:p-6">
        {loading && (
          <div className="flex flex-col items-center gap-2 py-16 text-[hsl(var(--muted-foreground))]">
            <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" aria-label="Cargando..." />
            <p className="text-sm">Cargando datos...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-[hsl(var(--destructive))] space-y-2">
            <p>Error al cargar reportes: {error}</p>
            <Button size="sm" variant="destructive" onClick={fetch}>Reintentar</Button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6 max-w-2xl">
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DestacadoCard
                titulo="Receta más vendida"
                icono="🍽️"
                metric={data.top_producto}
                colorClass="border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5"
                emptyMsg="Sin recetas vendidas"
              />
              <DestacadoCard
                titulo="Bebestible más vendido"
                icono="🥤"
                metric={data.top_bebida}
                colorClass="border-blue-200 bg-blue-50"
                emptyMsg="Sin bebestibles vendidos"
              />
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Top 5 Productos más vendidos</h3>
              {data.top_5.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay datos de ventas disponibles.</p>
              ) : (
                <ol className="space-y-2">
                  {data.top_5.map((item, index) => (
                    <Top5Item
                      key={String(item.product_id)}
                      item={item}
                      rank={index + 1}
                      maxUnits={data.top_5[0].units_sold || 1}
                    />
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}

        {!loading && !error && !data && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay datos disponibles.</p>
        )}
      </main>
    </>
  )
}

function DestacadoCard({ titulo, icono, metric, colorClass, emptyMsg }) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${colorClass}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">{icono}</span>
        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{titulo}</p>
      </div>
      {metric ? (
        <div>
          <p className="text-sm font-bold text-[hsl(var(--foreground))]">{metric.product_name}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {metric.units_sold} unidades
            <span className="mx-1">·</span>
            ${formatCLP(metric.revenue)}
          </p>
        </div>
      ) : (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{emptyMsg}</p>
      )}
    </div>
  )
}

function Top5Item({ item, rank, maxUnits = 1 }) {
  const barWidth = Math.min((item.units_sold / maxUnits) * 100, 100)

  const rankColors = {
    1: 'bg-yellow-400 text-yellow-900',
    2: 'bg-slate-300 text-slate-700',
    3: 'bg-orange-300 text-orange-800',
  }
  const rankClass = rankColors[rank] || 'bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]'

  return (
    <li className="flex items-start gap-3 p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0 mt-0.5 ${rankClass}`}>
        {rank}
      </span>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{item.product_name}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{item.units_sold} uds.</span>
        </div>
        <div className="h-1.5 bg-[hsl(var(--accent))] rounded-full overflow-hidden">
          <div
            className="h-full bg-[hsl(var(--primary))] rounded-full transition-all"
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">${formatCLP(item.revenue)}</span>
      </div>
    </li>
  )
}
