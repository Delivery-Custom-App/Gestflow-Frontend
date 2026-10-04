import { useEffect, useState } from 'react'
import { Clock3, CreditCard, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { useTurnoVendedor } from '../../context/turnoVendedor'
import { closeCaja } from '../../lib/salesApi'
import { mensajeCierreTurno } from '../../lib/turnos'
import { listarMaquinasDelVendedor, resumenDeMaquinas, webCobraCon } from '../../lib/maquinasCobro'
import { isV2FeatureEnabled } from '../../lib/v2Features'

function horaDe(fecha) {
  const d = fecha ? new Date(fecha) : null
  if (!d || Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

/** Cada cuánto se vuelve a mirar la máquina: el encargado puede asignarla o cambiarla durante el turno. */
const REVISAR_MAQUINA_CADA_MS = 60_000

const CHIP_AVISO = 'inline-flex max-w-[16rem] items-center gap-1.5 truncate rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
const CHIP = 'inline-flex max-w-[16rem] items-center gap-1.5 truncate rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--foreground))]'

/**
 * Con qué máquina cobra con tarjeta (la asignada a él, aunque esté
 * desactivada: el backend cobra igual con ella). Sin una, avisa que solo
 * puede cobrar sin tarjeta; con dos, que el cobro con tarjeta necesita una.
 * Se vuelve a revisar sola, y al volver a la pestaña.
 */
function MaquinaDelTurno({ localId, userId, turnoId }) {
  const [resumen, setResumen] = useState(null) // null = sin dato (cargando o no se pudo consultar)

  useEffect(() => {
    let ignore = false
    const revisar = () => {
      listarMaquinasDelVendedor(localId, userId)
        .then((filas) => { if (!ignore) setResumen(resumenDeMaquinas(filas)) })
        // Si no se pueden consultar, no se afirma nada.
        .catch(() => { if (!ignore) setResumen(null) })
    }
    revisar()
    const intervalo = setInterval(revisar, REVISAR_MAQUINA_CADA_MS)
    window.addEventListener('focus', revisar)
    return () => { ignore = true; clearInterval(intervalo); window.removeEventListener('focus', revisar) }
  }, [localId, userId, turnoId])

  if (!resumen) return null
  if (resumen.tipo === 'ninguna') {
    return (
      <span title="Solo puedes cobrar sin tarjeta. Pídele al encargado que te asigne una máquina de cobro." className={CHIP_AVISO}>
        <CreditCard size={13} className="shrink-0" />
        <span className="sm:hidden">Sin máquina</span>
        <span className="hidden sm:inline">Sin máquina de cobro: solo cobros sin tarjeta</span>
      </span>
    )
  }
  if (resumen.tipo === 'varias') {
    return (
      <span title="El cobro con tarjeta necesita una sola máquina a tu nombre. Pídele al encargado que deje solo una." className={CHIP_AVISO}>
        <CreditCard size={13} className="shrink-0" /> {resumen.mias.length} máquinas a tu nombre
      </span>
    )
  }
  const { maquina } = resumen
  const noCobraEnWeb = !webCobraCon(maquina.proveedor)
  return (
    <span className={noCobraEnWeb ? CHIP_AVISO : CHIP}
      title={noCobraEnWeb ? 'La web todavía no cobra con Haulmer.' : !maquina.activa ? 'Está desactivada, pero sigue a tu nombre: el cobro con tarjeta usa esta máquina.' : undefined}>
      <CreditCard size={13} className="shrink-0" />
      <span className="truncate">
        {maquina.nombre}
        {maquina.proveedorLabel ? ` · ${maquina.proveedorLabel}` : ''}
        {!maquina.activa ? ' (desactivada)' : ''}
      </span>
    </span>
  )
}

/**
 * En la vista del vendedor: su turno abierto y, cuando el backend defina la
 * opción, el botón para cerrarlo (bandera `cierreTurnoVendedor`). Fuera de la
 * vista del vendedor no hay turno en contexto y no se muestra nada.
 */
export default function TurnoVendedorBarra() {
  const contexto = useTurnoVendedor()
  const { user } = useAuth()
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
      <MaquinaDelTurno localId={turno.local_id} userId={user?.id} turnoId={turno.id} />
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
