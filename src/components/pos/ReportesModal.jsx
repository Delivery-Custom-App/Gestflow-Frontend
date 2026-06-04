import { useEffect, useState, useCallback } from 'react'
import { useReportesPOS } from '../../hooks/useReportesPOS'
import { formatCLP } from '../../lib/formatCLP'
import { apiRequest } from '../../lib/apiClient'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/** Modal de reportes POS: top producto, bebida, top 5 y stock bajo. */
export default function ReportesModal({ localId, onClose }) {
  const { data, loading, error, fetch } = useReportesPOS(localId)
  const [stockBajo, setStockBajo]     = useState([])
  const [stockLoading, setStockLoading] = useState(false)

  const fetchStockBajo = useCallback(async () => {
    if (!localId) return
    setStockLoading(true)
    try {
      const res = await apiRequest(
        `/inventory/locals/${localId}/products?status=CRITICO&status=BAJO&limit=20&offset=0`
      )
      setStockBajo(res?.items || res || [])
    } catch {
      setStockBajo([])
    } finally {
      setStockLoading(false)
    }
  }, [localId])

  useEffect(() => {
    fetch()
    fetchStockBajo()
  }, [fetch, fetchStockBajo])

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-5 h-5 text-[hsl(var(--primary))]">
              <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 16l4-5 4 3 4-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Reportes Básicos
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading && (
            <div className="flex flex-col items-center gap-2 py-8 text-[hsl(var(--muted-foreground))]">
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
            <>
              {/* Destacados */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DestacadoCard
                  titulo="Producto más vendido"
                  icono="🍽️"
                  metric={data.top_producto}
                  colorClass="border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5"
                  emptyMsg="Sin ventas registradas"
                />
                <DestacadoCard
                  titulo="Bebida más vendida"
                  icono="🥤"
                  metric={data.top_bebida}
                  colorClass="border-blue-200 bg-blue-50"
                  emptyMsg="Sin bebidas vendidas"
                />
              </section>

              {/* Top 5 */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Top 5 Productos</h3>
                {data.top_5.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay datos de ventas disponibles.</p>
                ) : (
                  <ol className="space-y-2">
                    {data.top_5.map((item, index) => (
                      <Top5Item key={String(item.product_id)} item={item} rank={index + 1} />
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}

          {!loading && !error && !data && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay datos disponibles.</p>
          )}

          {/* Stock bajo */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
              <span>⚠️</span> Productos con Stock Bajo
            </h3>
            {stockLoading ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Cargando...</p>
            ) : stockBajo.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Todo el inventario está en nivel óptimo.</p>
            ) : (
              <div className="rounded-lg border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
                {stockBajo.map(item => (
                  <StockBajoItem key={item.product_id || item.inventory_id} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={fetch}
            disabled={loading}
          >
            {loading ? 'Actualizando...' : '↻ Actualizar'}
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function StockBajoItem({ item }) {
  const isCritico = item.stock_status === 'CRITICO'
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isCritico ? 'bg-red-500' : 'bg-amber-400'}`} />
        <span className="text-sm truncate">{item.product_name}</span>
        <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">{item.category_name}</span>
      </div>
      <div className="text-right shrink-0 ml-2">
        <span className={`text-xs font-bold ${isCritico ? 'text-red-600' : 'text-amber-600'}`}>
          {item.stock_current} uds
        </span>
        <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-1">
          / mín {item.stock_min}
        </span>
      </div>
    </div>
  )
}

function Top5Item({ item, rank }) {
  const maxUnits = 999
  const barWidth = Math.min((item.units_sold / maxUnits) * 100, 100)

  const rankColors = {
    1: 'bg-yellow-400 text-yellow-900',
    2: 'bg-slate-300 text-slate-700',
    3: 'bg-orange-300 text-orange-800',
  }
  const rankClass = rankColors[rank] || 'bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]'

  return (
    <li className="flex items-start gap-3 p-3 rounded-lg border border-[hsl(var(--border))] bg-white">
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
