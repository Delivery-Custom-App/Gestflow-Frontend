import { fechaHora } from '../../lib/sesiones'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'

/**
 * Los turnos que se trabajaron en una apertura de la caja física (#133): quién,
 * cuándo empezó y terminó, cuánto vendió y si sigue abierto. Vienen en
 * `turnos` del resumen de la apertura (`GET /cajas-fisicas/aperturas/{id}/resumen`).
 * `nombreDe(userId)` da el nombre de quien trabajó; si no, se muestra un id corto.
 */
export default function TurnosDeLaApertura({ turnos, nombreDe = null }) {
  const lista = Array.isArray(turnos) ? turnos : []
  const nombre = (id) => (nombreDe ? nombreDe(id) : `Usuario ${String(id || '').slice(0, 8)}`)
  if (lista.length === 0) {
    return <p className="text-xs text-[hsl(var(--muted-foreground))]">No se trabajaron turnos en esta apertura.</p>
  }
  return (
    <ul aria-label="Turnos trabajados" className="flex flex-col gap-1.5">
      {lista.map((t) => {
        const abierto = String(t.status) === 'open' && !t.turno_terminado_at
        return (
          <li key={t.caja_id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs">
            <span className="font-semibold text-[hsl(var(--foreground))]">{nombre(t.cashier_user_id)}</span>
            <span className="text-[hsl(var(--muted-foreground))]">
              {fechaHora(t.opened_at)} → {abierto ? 'en turno' : t.turno_terminado_at ? `terminó ${fechaHora(t.turno_terminado_at)}` : 'cerrado con la caja'}
            </span>
            <span className="tabular-nums">Vendió {formatMoney(Number(t.total_vendido) || 0)}</span>
          </li>
        )
      })}
    </ul>
  )
}
