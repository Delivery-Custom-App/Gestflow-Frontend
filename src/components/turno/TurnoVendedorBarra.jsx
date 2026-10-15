import { useCallback, useEffect, useState } from 'react'
import { Clock3, CreditCard, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '../../context/AuthContext'
import { useTurnoVendedor } from '../../context/turnoVendedor'
import { getCaja, terminarTurno } from '../../lib/salesApi'
import { mensajeTerminarTurno, turnoTerminado } from '../../lib/turnos'
import { elegirMaquinaDelTurno, listarMaquinasDelLocal, maquinaDelTurno, webCobraCon } from '../../lib/maquinasCobro'
import { isAlPasoLocal } from '../../lib/salesModel'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import ElegirMaquina from './ElegirMaquina'

function horaDe(fecha) {
  const d = fecha ? new Date(fecha) : null
  if (!d || Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

/** Cada cuánto se vuelve a mirar el turno: el administrador puede liberarle la máquina. */
const REVISAR_MAQUINA_CADA_MS = 60_000

const CHIP_AVISO = 'inline-flex max-w-[16rem] items-center gap-1.5 truncate rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
const CHIP = 'inline-flex max-w-[16rem] items-center gap-1.5 truncate rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--foreground))]'
const BOTON = 'inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors'

/**
 * Con qué máquina cobra con tarjeta el turno (sección 5b):
 * - restaurante: la que eligió (`pos_machine_id`), mientras no se la suelten;
 * - al paso: la anclada a su caja física.
 * Se vuelve a revisar sola y al volver a la pestaña, porque el administrador
 * puede liberarle la máquina durante el turno. En restaurante, con la bandera
 * `eleccionMaquinaVendedor`, puede elegir o cambiar la máquina desde aquí.
 */
function MaquinaDelTurno({ turnoInicial, alPaso, onTerminado }) {
  const [turno, setTurno] = useState(turnoInicial)
  const [maquinas, setMaquinas] = useState(null) // null = sin dato (cargando o no se pudo consultar)
  const [eligiendo, setEligiendo] = useState(false)
  const puedeElegir = !alPaso && isV2FeatureEnabled('eleccionMaquinaVendedor')

  const revisar = useCallback(() => {
    Promise.all([
      getCaja(turnoInicial.id).catch(() => null),
      listarMaquinasDelLocal(turnoInicial.local_id),
    ])
      .then(([fresco, filas]) => {
        if (fresco) setTurno(fresco)
        setMaquinas(filas)
        // T-41: si el administrador le terminó el turno, se avisa con el motivo.
        if (fresco && turnoTerminado(fresco)) onTerminado?.(fresco)
      })
      // Si no se pueden consultar, no se afirma nada.
      .catch(() => setMaquinas(null))
  }, [turnoInicial.id, turnoInicial.local_id, onTerminado])

  useEffect(() => {
    revisar()
    const intervalo = setInterval(revisar, REVISAR_MAQUINA_CADA_MS)
    window.addEventListener('focus', revisar)
    return () => { clearInterval(intervalo); window.removeEventListener('focus', revisar) }
  }, [revisar])

  const cambiar = async (maquina, { compartir }) => {
    const actualizado = await elegirMaquinaDelTurno(turno.id, maquina.id, { compartir })
    setTurno((t) => ({ ...t, ...actualizado }))
    setEligiendo(false)
    toast.success(compartir ? `Compartes la máquina ${maquina.nombre}` : `Cobrarás con ${maquina.nombre}`)
    revisar()
  }

  if (!maquinas) return null
  const maquina = maquinaDelTurno(turno, maquinas, { alPaso })
  const liberada = !alPaso && Boolean(turno.pos_machine_released_at)

  let chip
  if (!maquina) {
    const texto = liberada ? 'Te liberaron la máquina' : alPaso ? 'Tu caja no tiene máquina' : 'Sin máquina de cobro'
    chip = (
      <span title={`${texto}: solo puedes cobrar sin tarjeta.${puedeElegir ? ' Elige una para cobrar con tarjeta.' : ''}`} className={CHIP_AVISO}>
        <CreditCard size={13} className="shrink-0" />
        <span className="sm:hidden">Sin máquina</span>
        <span className="hidden sm:inline">{texto}: solo cobros sin tarjeta</span>
      </span>
    )
  } else {
    const noCobraEnWeb = !webCobraCon(maquina.proveedor)
    chip = (
      <span className={noCobraEnWeb ? CHIP_AVISO : CHIP}
        title={noCobraEnWeb ? 'La web todavía no cobra con Haulmer.' : maquina.ocupacion >= 2 ? `Compartida: ${maquina.usuarios.join(' y ')}` : undefined}>
        <CreditCard size={13} className="shrink-0" />
        <span className="truncate">
          {maquina.nombre}
          {maquina.proveedorLabel ? ` · ${maquina.proveedorLabel}` : ''}
          {maquina.ocupacion >= 2 ? ' · compartida' : ''}
        </span>
      </span>
    )
  }

  return (
    <>
      {chip}
      {puedeElegir && (
        <button type="button" onClick={() => setEligiendo(true)} className={BOTON}>
          {maquina ? 'Cambiar máquina' : 'Elegir máquina'}
        </button>
      )}
      {eligiendo && (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) setEligiendo(false) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{maquina ? 'Cambiar de máquina' : 'Elegir máquina de cobro'}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <ElegirMaquina
                localId={turno.local_id}
                maquinaActualId={maquina?.id || null}
                onConfirmar={cambiar}
                onSinMaquina={() => setEligiendo(false)}
                textoSinMaquina="Cancelar"
              />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

/**
 * En la vista del vendedor: su turno abierto, la máquina con que cobra y
 * «Terminar mi turno» (T-41): suelta la máquina y deja la caja abierta para que
 * el administrador la cuente y la cierre (el vendedor no cierra la caja, A-03).
 * Como el servidor no sabe cuándo se va, se le recuerda terminar su turno.
 * Fuera de la vista del vendedor no hay turno en contexto y no se muestra nada.
 */
export default function TurnoVendedorBarra() {
  const contexto = useTurnoVendedor()
  const { user } = useAuth()
  const [confirmando, setConfirmando] = useState(false)
  const [terminando, setTerminando] = useState(false)
  const [error, setError] = useState('')
  const alTerminar = contexto?.alTerminar
  const avisarTerminado = useCallback((t) => { alTerminar?.(t) }, [alTerminar])
  if (!contexto?.turno) return null
  const { turno } = contexto
  const desde = horaDe(turno.opened_at)

  const terminar = async () => {
    setTerminando(true)
    setError('')
    try {
      const actualizado = await terminarTurno(turno.id)
      setConfirmando(false)
      toast.success('Terminaste tu turno')
      avisarTerminado(actualizado)
    } catch (err) {
      setError(mensajeTerminarTurno(err))
    } finally {
      setTerminando(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Clock3 size={13} /> Turno abierto{desde ? ` desde las ${desde}` : ''}
      </span>
      <span className="hidden lg:inline text-[11px] text-[hsl(var(--muted-foreground))]" data-testid="recordatorio-terminar">
        Al terminar tu jornada, termina tu turno
      </span>
      <MaquinaDelTurno key={turno.id} turnoInicial={turno} alPaso={isAlPasoLocal(user?.local_sales_model)} onTerminado={avisarTerminado} />
      <button type="button" onClick={() => { setConfirmando(true); setError('') }} className={BOTON}
        title="Al terminar tu jornada, termina tu turno">
        <LogOut size={13} /> Terminar mi turno
      </button>
      {confirmando && (
        <Dialog open onOpenChange={(abierto) => { if (!abierto && !terminando) setConfirmando(false) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>¿Terminar tu turno?</DialogTitle>
            </DialogHeader>
            <DialogBody>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Se suelta tu máquina de cobro y ya no podrás vender en este turno. La caja queda abierta: la cuenta y la cierra el administrador.
            </p>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </DialogBody>
            <DialogFooter>
              <button type="button" onClick={() => setConfirmando(false)} disabled={terminando} className={BOTON}>Cancelar</button>
              <button type="button" onClick={terminar} disabled={terminando}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {terminando ? 'Terminando…' : 'Terminar turno'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
