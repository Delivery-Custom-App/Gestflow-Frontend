import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ConteoEfectivo from '../turno/ConteoEfectivo'
import ResumenCierre from '../turno/ResumenCierre'
import { totalesDelConteo } from '../../lib/efectivo'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { forzarTermino } from '../../lib/supervision'
import { comprobanteCierreHtml, descargarComprobante, nombreDelComprobante } from '../../lib/comprobanteCierre'
import { imprimirEnNavegador } from '../../lib/ticketPrint'
import {
  cerrarCajaFisica, faltaNota, mensajeCajaFisica, resumenDeApertura, resumenParaPantalla, revisarCierreCajaFisica,
} from '../../lib/cajaFisica'

const NOTA_MAXIMA = 300
const AREA = 'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm'

/** Terminar el turno de un empleado para poder cerrar la caja: también cierra su sesión. */
function TerminarTurno({ turno, onHecho }) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const terminar = async (e) => {
    e.preventDefault()
    const limpio = motivo.trim()
    if (limpio.length < 3) { setError('Escribe el motivo (al menos 3 caracteres).'); return }
    setGuardando(true)
    setError('')
    try {
      await forzarTermino(turno.caja_id, { motivo: limpio, cerrarSesion: true, paraCerrarLaCaja: true })
      onHecho()
    } catch (err) {
      setError(mensajeCajaFisica(err, 'No se pudo terminar el turno'))
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setAbierto(true)} aria-label={`Terminar el turno de ${turno.email || 'este empleado'}`}>
        Terminar turno y cerrar sesión
      </Button>
    )
  }
  return (
    <form onSubmit={terminar} className="mt-2 flex w-full flex-col gap-2">
      <Label htmlFor={`motivo-${turno.caja_id}`}>Motivo</Label>
      <input id={`motivo-${turno.caja_id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} disabled={guardando}
        placeholder="Ej: Cierre de caja" className={AREA} />
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Termina su turno y cierra su sesión. Sus pedidos abiertos quedan «no cobrados» al cerrar la caja.</p>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={guardando}>{guardando ? 'Terminando…' : 'Terminar turno'}</Button>
      </div>
    </form>
  )
}

/**
 * Cerrar una caja física en dos pasos (#133 y #140).
 *
 * 1. **Revisar** (`GET …/cierre`, no cierra nada): en orden, los pedidos que
 *    quedarán «no cobrados» (no impiden contar), si hay un cobro con tarjeta en
 *    curso (hay que esperar) y los empleados en turno (se les termina el turno y
 *    se cierra su sesión, sin reasignar). Se cuenta recién con `puede_contar`.
 * 2. **Contar** a ciegas: billetes y monedas; el backend calcula lo esperado y
 *    la diferencia, y si no cuadra pide la nota (422).
 * 3. **Cerrada**: el resumen de la apertura y el comprobante.
 */
export default function CerrarCajaFisica({ caja, localNombre = '', cierra = '', onClose, onCerrada }) {
  const [paso, setPaso] = useState('revisar') // revisar | contar | cerrada
  const [revision, setRevision] = useState(null)
  const [errorRevision, setErrorRevision] = useState('')
  // Por qué se volvió a la revisión desde el conteo (un 409 al cerrar): se queda hasta volver a contar.
  const [avisoCierre, setAvisoCierre] = useState('')
  const [version, setVersion] = useState(0)
  const [cantidades, setCantidades] = useState({})
  const [nota, setNota] = useState('')
  const [pideNota, setPideNota] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cerrada, setCerrada] = useState(null)
  const [resumen, setResumen] = useState(null)

  useEffect(() => {
    if (paso !== 'revisar') return undefined
    let ignore = false
    revisarCierreCajaFisica(caja.id)
      .then((r) => { if (!ignore) { setRevision(r); setErrorRevision('') } })
      .catch((err) => { if (!ignore) { setRevision(null); setErrorRevision(mensajeCajaFisica(err, 'No se pudo revisar la caja')) } })
    return () => { ignore = true }
  }, [caja.id, paso, version])

  const revisarDeNuevo = useCallback(() => { setRevision(null); setVersion((v) => v + 1) }, [])

  const contar = async (e) => {
    e.preventDefault()
    if (pideNota && !nota.trim()) { setError('Lo contado no coincide con lo esperado: explica la diferencia en la nota.'); return }
    setGuardando(true)
    setError('')
    try {
      const apertura = await cerrarCajaFisica(caja.id, { cantidades, nota })
      setCerrada(apertura)
      setPaso('cerrada')
      onCerrada?.(apertura)
      resumenDeApertura(apertura.id).then(setResumen).catch(() => setResumen(null))
    } catch (err) {
      if (faltaNota(err)) {
        setPideNota(true)
        setError(mensajeCajaFisica(err))
        document.getElementById('cierre-nota')?.focus()
      } else if (Number(err?.status) === 409) {
        // Algo cambió desde la revisión (un cobro en curso o un empleado que volvió a entrar): se revisa de nuevo.
        setError('')
        setAvisoCierre(mensajeCajaFisica(err))
        setPaso('revisar')
        revisarDeNuevo()
      } else {
        setError(mensajeCajaFisica(err, 'No se pudo cerrar la caja'))
      }
      setGuardando(false)
    }
  }

  const { total, filas } = totalesDelConteo(cantidades)
  const nombreCaja = caja?.name || 'Caja física'
  const datosComprobante = cerrada && resumen ? {
    local: localNombre,
    caja: nombreCaja,
    cerro: cerrada.cerrada_por_email || cierra,
    cerradoAt: cerrada.cerrada_at,
    resumen: resumenParaPantalla(resumen),
    desglose: filas.filter((f) => f.cantidad > 0),
    nota: cerrada.nota_cierre || '',
    // La caja no tiene gastos (salen del fondo de emergencia): solo retiros.
    etiquetaRetiros: 'Retiros',
  } : null

  const pedidos = revision?.pedidos_abiertos || []
  const turnos = revision?.turnos_abiertos || []

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !guardando) onClose() }}>
      <DialogContent overlayClassName="bg-black/60 backdrop-blur-md" className="flex max-h-[90vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>{paso === 'cerrada' ? 'Caja cerrada' : 'Cerrar caja'}</DialogTitle>
          <DialogDescription>{[localNombre, nombreCaja].filter(Boolean).join(' · ')}</DialogDescription>
        </DialogHeader>

        {paso === 'revisar' && (
          <>
          <DialogBody className="min-h-0 flex-1 overflow-y-auto">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Antes de contar se revisa lo que está pendiente. Todavía no se cierra nada.</p>
            {avisoCierre && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">{avisoCierre}</p>}
            {errorRevision && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{errorRevision}</p>}
            {!revision && !errorRevision && <p className="text-sm text-[hsl(var(--muted-foreground))]">Revisando la caja…</p>}
            {revision && (
              <>
                <section aria-label="Pedidos que quedarán no cobrados" className="rounded-lg border border-[hsl(var(--border))] p-3 text-sm">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">1. Pedidos abiertos</h3>
                  {pedidos.length === 0 ? (
                    <p className="text-xs text-emerald-700">No hay pedidos abiertos.</p>
                  ) : (
                    <>
                      <p className="mb-1 text-xs text-amber-800">Al cerrar la caja, estos pedidos quedan «no cobrados» (sin ingreso ni stock):</p>
                      <ul className="flex flex-col gap-1 text-xs">
                        {pedidos.map((p) => (
                          <li key={p.order_id} className="flex justify-between gap-2">
                            <span>{[p.mesa || 'Sin mesa', p.email].filter(Boolean).join(' · ')}</span>
                            <span className="tabular-nums">{formatMoney(Number(p.total) || 0)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>

                <section aria-label="Cobro con tarjeta en curso" className="rounded-lg border border-[hsl(var(--border))] p-3 text-sm">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">2. Cobro con tarjeta</h3>
                  {revision.cobro_en_curso ? (
                    <p className="text-xs text-red-700">Hay un cobro con tarjeta en curso: el cliente puede estar pagando. Espera a que termine y vuelve a revisar.</p>
                  ) : (
                    <p className="text-xs text-emerald-700">No hay cobros en curso.</p>
                  )}
                </section>

                <section aria-label="Empleados en turno" className="rounded-lg border border-[hsl(var(--border))] p-3 text-sm">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">3. Empleados en turno</h3>
                  {turnos.length === 0 ? (
                    <p className="text-xs text-emerald-700">No hay empleados en turno.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {turnos.map((t) => (
                        <li key={t.caja_id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span>{t.email || 'Empleado'} sigue en turno.</span>
                          <TerminarTurno turno={t} onHecho={revisarDeNuevo} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="button" variant="outline" onClick={revisarDeNuevo}>Volver a revisar</Button>
            <Button type="button" disabled={!revision?.puede_contar} onClick={() => { setAvisoCierre(''); setPaso('contar') }}>
              Contar el efectivo
            </Button>
          </DialogFooter>
          </>
        )}

        {paso === 'contar' && (
          <form onSubmit={contar} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="min-h-0 flex-1 overflow-y-auto">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Cuenta los billetes y monedas que hay en la caja. Lo contado es lo que queda para la próxima apertura:
              si vas a retirar plata (por ejemplo, un depósito), regístrala antes como retiro.
            </p>
            <ConteoEfectivo cantidades={cantidades} onChange={setCantidades} disabled={guardando} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cierre-nota">{pideNota ? 'Nota (obligatoria: explica la diferencia)' : 'Nota (opcional)'}</Label>
              <textarea id="cierre-nota" rows={2} maxLength={NOTA_MAXIMA} value={nota} onChange={(e) => setNota(e.target.value)} disabled={guardando} className={AREA} />
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setPaso('revisar'); revisarDeNuevo() }} disabled={guardando}>Volver</Button>
              <Button type="submit" disabled={guardando}>{guardando ? 'Cerrando…' : `Cerrar caja con ${formatMoney(total)}`}</Button>
            </DialogFooter>
          </form>
        )}

        {paso === 'cerrada' && (
          <>
          <DialogBody className="min-h-0 flex-1 overflow-y-auto">
            <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Caja cerrada. Los turnos de esta apertura quedaron cerrados con ella.
            </p>
            <ResumenCierre resumen={resumen ? resumenParaPantalla(resumen) : null} etiquetaRetiros="Retiros" />
            {cerrada?.nota_cierre && <p className="text-xs">Nota: {cerrada.nota_cierre}</p>}
          </DialogBody>
          <DialogFooter className="flex-wrap">
              {datosComprobante && (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => imprimirEnNavegador(comprobanteCierreHtml(datosComprobante))}>Imprimir comprobante</Button>
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => descargarComprobante(comprobanteCierreHtml(datosComprobante), nombreDelComprobante(datosComprobante))}>
                    Descargar comprobante
                  </Button>
                </>
              )}
              <Button type="button" onClick={onClose}>Listo</Button>
          </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
