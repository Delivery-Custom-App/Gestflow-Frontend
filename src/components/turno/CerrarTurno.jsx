import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Download, Lock, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { closeCaja, getCajaResumen, listCajas, listMesas, listOrdenesDelTurno } from '../../lib/salesApi'
import { movimientosDelTurno } from '../../lib/registroTurnos'
import { mensajeCierreTurno, pendientesAlCerrar } from '../../lib/turnos'
import { diferenciaDe, monto, textoDiferencia } from '../../lib/arqueo'
import { armarResumenCierre, esCajaDigital } from '../../lib/cierreCaja'
import { totalesDelConteo } from '../../lib/efectivo'
import { comprobanteCierreHtml, descargarComprobante, nombreDelComprobante } from '../../lib/comprobanteCierre'
import { imprimirEnNavegador } from '../../lib/ticketPrint'
import ConteoEfectivo from './ConteoEfectivo'
import ResumenCierre from './ResumenCierre'
import TrabajadoresSinTerminar from './TrabajadoresSinTerminar'

export const NOTA_CIERRE_MAX = 300

/**
 * Cierre de un turno con arqueo (T-55, B-18): el administrador cuenta el
 * efectivo del cajón y lo manda con el cierre (`monto_cierre_declarado`). Se
 * compara con el efectivo esperado; si no coincide (falta o sobra) la nota es
 * obligatoria. Si el backend responde 400 «Explícala en nota_cierre», no se
 * pierde lo escrito y se enfoca la nota. Un cierre exacto no pide nota.
 *
 * - Caja física: siempre se cuenta por billetes y monedas, y el total es lo
 *   contado. Lo contado es lo que queda en la caja para la apertura de mañana:
 *   si se retira plata antes, hay que registrarla como retiro.
 * - Caja digital: no hay efectivo que contar, se cierra sin arqueo.
 * - Antes de confirmar se ve, en una sola pantalla, el resumen del cierre; qué
 *   trabajadores siguen con el turno sin terminar (cada uno con «Forzar
 *   término», T-42) y qué mesas quedarán «no cobradas» (T-45).
 * - Al cerrar se ofrece el comprobante, para imprimir o descargar.
 *
 * `cajaFisica` ({ id, nombre, tipo }) dice si se cuenta y de dónde es el turno;
 * `localNombre`, `vendedor` y `cierra` son para el comprobante. `onCierreRegistrado`
 * avisa apenas el turno queda cerrado (para recargar la lista) y `onCerrado`,
 * que se terminó con la pantalla; `onRegistrarRetiro` lleva a registrar un retiro.
 */
export default function CerrarTurno({
  cajaId, localId = null, cajaFisica = null, localNombre = '', vendedor = '', cierra = '',
  usuarios = [], nombreDeUsuario = null,
  onRegistrarRetiro, onCierreRegistrado, onCerrado, onCancelar,
}) {
  const [resumen, setResumen] = useState(undefined) // undefined = cargando, null = sin dato
  const [movimientos, setMovimientos] = useState(undefined)
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [cantidades, setCantidades] = useState({})
  const notaRef = useRef(null)
  // Enfocar la nota después de que el formulario vuelve a estar habilitado.
  const [enfocarNota, setEnfocarNota] = useState(0)
  useEffect(() => { if (enfocarNota) notaRef.current?.focus() }, [enfocarNota])
  // T-45: lo que sigue abierto al cerrar (las mesas quedan «no cobradas»).
  const [pendientes, setPendientes] = useState(null)
  // Los turnos abiertos del local: quién sigue trabajando (T-42).
  const [abiertas, setAbiertas] = useState(null)
  // Se sube al forzar el término de un turno: se recarga lo que depende de él.
  const [version, setVersion] = useState(0)
  // Lo que se muestra cuando el turno ya quedó cerrado.
  const [cierre, setCierre] = useState(null)
  const digital = esCajaDigital(cajaFisica)

  useEffect(() => {
    let ignore = false
    Promise.all([listOrdenesDelTurno(cajaId), localId ? listMesas(localId).catch(() => []) : []])
      .then(([ordenes, mesas]) => {
        if (ignore) return
        const nombres = new Map((mesas || []).map((m) => [String(m.id), m.name || m.nombre]))
        setPendientes(pendientesAlCerrar(ordenes, (id) => nombres.get(String(id))))
      })
      .catch(() => { if (!ignore) setPendientes(null) })
    return () => { ignore = true }
  }, [cajaId, localId, version])

  useEffect(() => {
    if (!localId) return undefined
    let ignore = false
    listCajas(localId, { status: 'open' })
      .then((filas) => { if (!ignore) setAbiertas(filas) })
      .catch(() => { if (!ignore) setAbiertas(null) })
    return () => { ignore = true }
  }, [localId, version])

  useEffect(() => {
    let ignore = false
    getCajaResumen(cajaId)
      .then((r) => { if (!ignore) setResumen(r ?? null) })
      .catch(() => { if (!ignore) setResumen(null) })
    // Las ventas por medio de pago salen de los movimientos; si no llegan, quedan en «—».
    movimientosDelTurno(cajaId)
      .then((m) => { if (!ignore) setMovimientos(m) })
      .catch(() => { if (!ignore) setMovimientos(null) })
    return () => { ignore = true }
  }, [cajaId, version])

  const esperado = resumen === undefined ? undefined : monto(resumen?.efectivo_esperado)
  const conteo = totalesDelConteo(cantidades)
  const contado = digital ? null : conteo.total
  const diferencia = contado === null ? null : diferenciaDe(contado, esperado)
  const pideNota = diferencia !== null && diferencia !== 0
  const resumenCierre = resumen === undefined || movimientos === undefined
    ? null
    : armarResumenCierre({ resumen, movimientos, contado })

  const cerrar = async (e) => {
    e.preventDefault()
    if (pideNota && !nota.trim()) {
      setError('Lo contado no coincide con lo esperado: explica la diferencia en la nota.')
      notaRef.current?.focus()
      return
    }
    setCerrando(true)
    setError('')
    try {
      const cerrada = await closeCaja(cajaId, digital ? { notaCierre: nota } : { montoCierreDeclarado: contado, notaCierre: nota })
      onCierreRegistrado?.()
      // Lo que quedó guardado manda sobre lo que se calculó en pantalla.
      const base = resumenCierre ?? armarResumenCierre({ resumen: null, movimientos: null, contado })
      setCierre({
        cerradoAt: cerrada?.closed_at || new Date().toISOString(),
        resumen: {
          ...base,
          esperado: monto(cerrada?.efectivo_esperado_cierre) ?? base.esperado,
          diferencia: monto(cerrada?.diferencia) ?? base.diferencia,
        },
        desglose: digital ? [] : conteo.filas.filter((f) => f.cantidad > 0),
        nota: nota.trim(),
        mesas: pendientes?.mesas ?? [],
        totalMesas: pendientes?.totalMesas ?? 0,
      })
    } catch (err) {
      const texto = String(err?.detail || err?.message || '')
      if (/nota_cierre/i.test(texto)) {
        setError(texto.replace(/^\d{3}:\s*/, '').replace(/\.? Explícala en nota_cierre\.?$/, ': explícala en la nota.'))
        setEnfocarNota((n) => n + 1)
      } else {
        setError(mensajeCierreTurno(err))
      }
    } finally {
      setCerrando(false)
    }
  }

  if (cierre) {
    const datos = {
      local: localNombre, caja: cajaFisica?.name || cajaFisica?.nombre || 'Caja', tipo: cajaFisica?.tipo, turno: cajaId, vendedor, cerro: cierra,
      cerradoAt: cierre.cerradoAt, resumen: cierre.resumen, desglose: cierre.desglose, nota: cierre.nota,
    }
    const hayMesas = cierre.mesas.length > 0
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="text-sm text-[hsl(var(--foreground))]">
          Turno cerrado.
          {!digital && cierre.resumen.contado !== null && ` Contado ${formatMoney(cierre.resumen.contado)}: ${textoDiferencia(cierre.resumen.diferencia) ?? 'sin diferencia calculada'}.`}
          {digital && ' Se cerró sin contar efectivo.'}
          {hayMesas && ` ${cierre.mesas.length === 1 ? 'Una mesa quedó' : `${cierre.mesas.length} mesas quedaron`} como «no cobrada» por ${formatMoney(cierre.totalMesas)}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => imprimirEnNavegador(comprobanteCierreHtml(datos))}>
            <Printer size={14} /> Imprimir comprobante
          </Button>
          <Button type="button" size="sm" variant="outline"
            onClick={() => descargarComprobante(comprobanteCierreHtml(datos), nombreDelComprobante(datos))}>
            <Download size={14} /> Descargar comprobante
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          {hayMesas && localId && (
            <Link to={`/local/${localId}/administrativo/no-cobradas`} onClick={() => onCerrado?.()}
              className="inline-flex items-center rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]">
              Ver mesas no cobradas
            </Link>
          )}
          <Button type="button" size="sm" onClick={() => onCerrado?.()}>Listo</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        {digital
          ? 'Esta caja es digital: no hay efectivo que contar. Revisa el resumen y cierra el turno; el turno no se puede reabrir.'
          : 'Cuenta los billetes y monedas del cajón. Es el cierre del arqueo del día: el turno no se puede reabrir.'}
      </p>
      {/* Fuera del formulario de cierre: «Forzar término» tiene el suyo y un formulario no va dentro de otro
          (el envío subiría al cierre y cerraría el turno). */}
      {cajaFisica?.id && (
        <TrabajadoresSinTerminar
          abiertas={abiertas ?? []}
          cajaFisicaId={cajaFisica.id}
          localId={localId}
          turnoId={cajaId}
          usuarios={usuarios}
          nombreDeUsuario={nombreDeUsuario}
          onTerminado={() => setVersion((v) => v + 1)}
        />
      )}
      <form onSubmit={cerrar} aria-label="Cerrar turno" className="flex flex-col gap-3">
        {pendientes?.mesas.length > 0 && (
          <div role="note" aria-label="Mesas que quedarán no cobradas" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-semibold">Al cerrar, estas mesas abiertas quedarán como «no cobradas» (sin ingreso):</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {pendientes.mesas.map((m) => (
                <li key={m.id} className="flex justify-between gap-3"><span>{m.mesa}</span><span>{formatMoney(m.total)}</span></li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Total sin cobrar: {formatMoney(pendientes.totalMesas)}</p>
          </div>
        )}
        {pendientes?.mostrador.length > 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Hay {pendientes.mostrador.length === 1 ? 'un pedido' : `${pendientes.mostrador.length} pedidos`} de mostrador sin cobrar: si llevan más de 15 minutos sin cambios vencen al cerrar; si son recientes, hay que cobrarlos o esperar.
          </p>
        )}

        {!digital && (
          <>
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-sm">
              Efectivo esperado: <strong data-testid="efectivo-esperado-cierre">{esperado === undefined ? '…' : esperado === null ? '—' : formatMoney(esperado)}</strong>
            </div>
            <ConteoEfectivo cantidades={cantidades} onChange={setCantidades} disabled={cerrando} />
            <div role="note" aria-label="Lo contado queda en la caja" className="rounded-lg border border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))]">
              <p>
                <strong className="text-[hsl(var(--foreground))]">Lo que cuentas es lo que queda en la caja para mañana:</strong>{' '}
                con ese monto se compara la apertura del día siguiente.
              </p>
              <p className="mt-1">
                Si vas a retirar plata (por ejemplo, un depósito), regístrala antes como retiro; si no, aparecerá como una diferencia.
              </p>
              {onRegistrarRetiro && (
                <button type="button" onClick={onRegistrarRetiro} disabled={cerrando}
                  className="mt-2 text-xs font-semibold text-[hsl(var(--primary))] hover:underline disabled:opacity-50">
                  Registrar un retiro
                </button>
              )}
            </div>
          </>
        )}

        <ResumenCierre resumen={resumenCierre} digital={digital} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nota-cierre">{pideNota ? 'Nota (obligatoria: explica la diferencia)' : 'Nota (opcional)'}</Label>
          <textarea id="nota-cierre" ref={notaRef} rows={2} maxLength={NOTA_CIERRE_MAX} value={nota}
            onChange={(e) => setNota(e.target.value)} disabled={cerrando}
            placeholder={pideNota ? 'Ej: Faltan $300: vuelto mal dado en la mañana' : ''}
            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm" />
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancelar} disabled={cerrando}>Cancelar</Button>
          <Button type="submit" variant="danger" size="sm" disabled={cerrando}>
            <Lock size={14} /> {cerrando ? 'Cerrando…' : 'Cerrar turno'}
          </Button>
        </div>
      </form>
    </div>
  )
}
