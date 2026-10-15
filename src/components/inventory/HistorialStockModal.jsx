import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fechaHora } from '../../lib/sesiones'
import {
  ETIQUETA_MOVIMIENTO_STOCK, MOVIMIENTOS_STOCK_POR_PAGINA, listarMovimientosStock, textoDelta,
} from '../../lib/movimientosStock'

const formatoCantidad = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? String(Number(n.toFixed(3))) : '—'
}

/**
 * Historial del stock de un producto en el local (T-58): tipo, cantidad, el
 * cambio con signo, el stock antes y después, el motivo, quién y cuándo.
 * Paginado según `X-Total-Count`.
 */
export default function HistorialStockModal({ row, onClose }) {
  const [pagina, setPagina] = useState(0)
  const [estado, setEstado] = useState({ clave: '', movimientos: [], total: 0, error: '' })
  const clave = `${row.inventory_id}|${pagina}`

  useEffect(() => {
    let ignore = false
    listarMovimientosStock(row.inventory_id, { offset: pagina * MOVIMIENTOS_STOCK_POR_PAGINA })
      .then(({ movimientos, total }) => { if (!ignore) setEstado({ clave, movimientos, total, error: '' }) })
      .catch((e) => { if (!ignore) setEstado({ clave, movimientos: [], total: 0, error: String(e?.detail || e?.message || 'No se pudo cargar').replace(/^\d{3}:\s*/, '') }) })
    return () => { ignore = true }
  }, [row.inventory_id, pagina, clave])

  const cargando = estado.clave !== clave
  const totalPaginas = Math.max(1, Math.ceil(estado.total / MOVIMIENTOS_STOCK_POR_PAGINA))

  return (
    <div className="fixed inset-0" style={{ zIndex: 500 }}>
      <div role="presentation" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="historial-stock-titulo"
        className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
          <div className="min-w-0">
            <h2 id="historial-stock-titulo" className="text-base font-bold text-[hsl(var(--foreground))]">Historial del stock</h2>
            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{row.product_name || row.name}</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-lg p-1.5 hover:bg-[hsl(var(--muted))]"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {cargando ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando el historial…</p>
          ) : estado.error ? (
            <p role="alert" className="text-sm text-red-600">{estado.error}</p>
          ) : estado.movimientos.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Todavía no hay movimientos de este producto.</p>
          ) : (
            <ol aria-label="Movimientos de stock" className="flex flex-col gap-2">
              {estado.movimientos.map((m) => (
                <li key={m.id} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-[hsl(var(--foreground))]">{ETIQUETA_MOVIMIENTO_STOCK[m.tipo] || m.tipo}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{fechaHora(m.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-[hsl(var(--foreground))]">
                    <span className={Number(m.delta) < 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-700'}>{textoDelta(m.delta)}</span>
                    {' · '}de {formatoCantidad(m.stock_anterior)} a {formatoCantidad(m.stock_resultante)}
                    {m.tipo === 'ajuste' ? ` (contado: ${formatoCantidad(m.cantidad)})` : ''}
                  </p>
                  {m.motivo && <p className="mt-0.5">Motivo: {m.motivo}</p>}
                  {m.actor_email && <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{m.actor_email}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
        {estado.total > MOVIMIENTOS_STOCK_POR_PAGINA && (
          <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-5 py-3 text-xs text-[hsl(var(--muted-foreground))]">
            <span>Página {pagina + 1} de {totalPaginas}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
