import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCLP } from '../../lib/formatCLP'
import { formatChileTime } from '../../utils/chileDateTime'

/**
 * #159: los pedidos de venta directa del turno que quedaron sin cobrar (por
 * ejemplo, si se cerró el cobro o se cortó la conexión). Mientras haya alguno
 * el turno no se puede terminar: se cobran o se cancelan desde acá.
 */
export default function PedidosSinCobrar({ pedidos = [], onCobrar, onCancelar }) {
  const [cancelando, setCancelando] = useState(null)
  const [error, setError] = useState('')
  if (!pedidos.length) return null

  const cancelar = async (pedido) => {
    if (!window.confirm('¿Cancelar este pedido sin cobrarlo?')) return
    setCancelando(pedido.id)
    setError('')
    try {
      await onCancelar(pedido)
    } catch (err) {
      setError(err?.message || 'No se pudo cancelar el pedido')
    } finally {
      setCancelando(null)
    }
  }

  return (
    <section aria-labelledby="pedidos-sin-cobrar" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3">
      <div>
        <h3 id="pedidos-sin-cobrar" className="text-sm font-bold text-amber-900">
          {pedidos.length === 1 ? 'Tienes 1 pedido sin cobrar' : `Tienes ${pedidos.length} pedidos sin cobrar`}
        </h3>
        <p className="text-xs text-amber-800">Cóbralo o cancélalo: mientras siga abierto no puedes terminar tu turno.</p>
      </div>
      <ul className="space-y-2">
        {pedidos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[hsl(var(--card))] px-3 py-2">
            <span className="text-sm text-[hsl(var(--foreground))]">
              Pedido #{String(p.id).slice(0, 8)}
              {p.created_at && <span className="text-[hsl(var(--muted-foreground))]"> · {formatChileTime(p.created_at)}</span>}
              {' · '}<strong>${formatCLP(p.total ?? 0)}</strong>
            </span>
            <span className="flex gap-2">
              <Button type="button" size="sm" onClick={() => onCobrar(p)} aria-label={`Cobrar el pedido #${String(p.id).slice(0, 8)}`}>Cobrar</Button>
              <Button type="button" size="sm" variant="outline" disabled={cancelando === p.id} onClick={() => cancelar(p)}
                aria-label={`Cancelar el pedido #${String(p.id).slice(0, 8)}`}>
                {cancelando === p.id ? 'Cancelando…' : 'Cancelar'}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </section>
  )
}
