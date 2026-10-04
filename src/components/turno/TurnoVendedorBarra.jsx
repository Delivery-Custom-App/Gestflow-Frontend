import { useState } from 'react'
import { Clock3, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useTurnoVendedor } from '../../context/turnoVendedor'
import { closeCaja } from '../../lib/salesApi'
import { mensajeCierreTurno } from '../../lib/turnos'
import { isV2FeatureEnabled } from '../../lib/v2Features'

function horaDe(fecha) {
  const d = fecha ? new Date(fecha) : null
  if (!d || Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

/**
 * En la vista del vendedor: su turno abierto y, cuando el backend defina la
 * opción, el botón para cerrarlo (bandera `cierreTurnoVendedor`). Fuera de la
 * vista del vendedor no hay turno en contexto y no se muestra nada.
 */
export default function TurnoVendedorBarra() {
  const contexto = useTurnoVendedor()
  const [cerrando, setCerrando] = useState(false)
  if (!contexto?.turno) return null
  const { turno, alCerrar } = contexto
  const desde = horaDe(turno.opened_at)

  const cerrarTurno = async () => {
    if (!window.confirm('¿Cerrar tu turno? Es el cierre del arqueo del día: no se puede reabrir.')) return
    setCerrando(true)
    try {
      await closeCaja(turno.id)
      toast.success('Turno cerrado')
      alCerrar()
    } catch (err) {
      toast.error(mensajeCierreTurno(err))
      setCerrando(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Clock3 size={13} /> Turno abierto{desde ? ` desde las ${desde}` : ''}
      </span>
      {isV2FeatureEnabled('cierreTurnoVendedor') && (
        <button
          type="button"
          onClick={cerrarTurno}
          disabled={cerrando}
          className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-50"
        >
          <LogOut size={13} /> {cerrando ? 'Cerrando…' : 'Cerrar turno'}
        </button>
      )}
    </div>
  )
}
