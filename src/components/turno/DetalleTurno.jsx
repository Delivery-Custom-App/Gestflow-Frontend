import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import LoadingSpinner from '../LoadingSpinner'
import { parseApiDate } from '../../utils/chileDateTime'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { getCajaResumen, listOrdenesDelTurno } from '../../lib/salesApi'
import { movimientosDelTurno, totalesDelTurno } from '../../lib/registroTurnos'
import { etiquetaDenominacion, filasDelDesglose } from '../../lib/efectivo'
import { monto, textoDiferencia } from '../../lib/arqueo'

// Canal del pedido (mesa, mostrador, delivery…), no cómo pagó el cliente.
const MOVIMIENTO_SOURCE_LABEL = {
  dine_in: 'Mesa',
  takeout: 'Para llevar',
  mostrador: 'Mostrador',
  delivery: 'Delivery',
  haulmer_pos: 'Haulmer POS',
  mercadopago_pos: 'Mercado Pago',
}

// Cómo pagó el cliente (CajaResumenPorMetodo.payment_method).
const PAYMENT_METHOD_LABEL = {
  cash: 'Efectivo',
  MERCADOPAGO_POINT: 'Mercado Pago',
  MERCADOPAGO_POINT_DEBIT: 'Mercado Pago (débito)',
  MERCADOPAGO_POINT_CREDIT: 'Mercado Pago (crédito)',
}

function fechaHora(value) {
  const date = value ? parseApiDate(value) : null
  if (!date) return 'Sin fecha'
  return date.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago', hour12: true,
  })
}

function Cifra({ label, valor, destacada = false }) {
  return (
    <div className={destacada
      ? 'rounded-lg border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] p-3'
      : 'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3'}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]">{valor}</p>
    </div>
  )
}

const ESTADO_ORDEN = { PENDING: 'Abierta', PREPARING: 'En preparación', READY: 'Lista', COMPLETED: 'Cobrada', CANCELLED: 'Cancelada' }

/**
 * Órdenes del turno (`GET /orders?caja_id=`, T-48): se piden solo al abrir la
 * lista, para no cargar el resumen.
 */
function OrdenesDelTurno({ cajaId }) {
  const [ordenes, setOrdenes] = useState(null) // null = sin pedir
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const ver = () => {
    setCargando(true)
    setError('')
    listOrdenesDelTurno(cajaId)
      .then(setOrdenes)
      .catch((e) => setError(e?.message || 'No se pudieron cargar las órdenes del turno'))
      .finally(() => setCargando(false))
  }

  if (ordenes === null) {
    return (
      <div>
        <button type="button" onClick={ver} disabled={cargando}
          className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline disabled:opacity-50">
          {cargando ? 'Cargando órdenes…' : 'Ver órdenes del turno'}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    )
  }
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Órdenes del turno ({ordenes.length})</h3>
      {ordenes.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Este turno no tiene órdenes.</p>
      ) : (
        <ul aria-label="Órdenes del turno" className="flex flex-col gap-1">
          {ordenes.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs">
              <span className="font-mono">#{String(o.id).slice(0, 8).toUpperCase()}</span>
              <span className="text-[hsl(var(--muted-foreground))]">{fechaHora(o.created_at)}</span>
              <span>{ESTADO_ORDEN[o.status] || o.status}</span>
              <span className="font-semibold">{formatMoney(Number(o.total))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Resumen de un turno: cuántas ventas hubo, ingresos y egresos, el desglose
 * por método de pago y sus movimientos. `conArqueo` (vista del encargado y
 * del dueño) agrega el monto de apertura, el efectivo que debería haber en el
 * cajón (`efectivo_esperado`: para cuadrar se usa este, no `total_esperado`),
 * lo cobrado con tarjeta por cada máquina y las órdenes del turno (T-48).
 */
export default function DetalleTurno({ caja, conArqueo = false, cerradoPor = null, nombreDeUsuario = null }) {
  // De qué turno es lo cargado: si no es el que se muestra, está cargando.
  const [cargado, setCargado] = useState(null)

  useEffect(() => {
    let ignore = false
    Promise.all([getCajaResumen(caja.id), movimientosDelTurno(caja.id)])
      .then(([resumen, movimientos]) => { if (!ignore) setCargado({ id: caja.id, resumen, movimientos, err: '' }) })
      .catch((e) => {
        if (!ignore) setCargado({ id: caja.id, resumen: null, movimientos: [], err: e?.message || 'No se pudo cargar el resumen del turno' })
      })
    return () => { ignore = true }
  }, [caja.id])

  if (cargado?.id !== caja.id) return <LoadingSpinner message="Cargando el resumen del turno..." />
  const { resumen, movimientos, err } = cargado
  if (err) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
        <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
      </div>
    )
  }

  const { ventas, egresos: egresosCalculados } = totalesDelTurno(movimientos)
  // T-57: el backend separa lo vendido de lo que entró a mano y suma lo que salió.
  const vendido = monto(resumen?.total_vendido) ?? monto(resumen?.total_ingresos) ?? 0
  const ingresosManuales = monto(resumen?.ingresos_manuales) ?? 0
  const egresos = monto(resumen?.total_egresos) ?? egresosCalculados
  const cerrado = String(caja?.status || resumen?.status || '') === 'closed' || caja?.is_active === false
  const contado = monto(resumen?.monto_cierre_declarado ?? caja?.monto_cierre_declarado)
  const diferencia = monto(resumen?.diferencia ?? caja?.diferencia)
  const nota = resumen?.nota_cierre ?? caja?.nota_cierre ?? null
  const porMetodo = Array.isArray(resumen?.por_metodo) ? resumen.por_metodo : []
  const porMaquina = Array.isArray(resumen?.por_maquina) ? resumen.por_maquina : []
  const efectivoEsperado = resumen?.efectivo_esperado != null ? formatMoney(Number(resumen.efectivo_esperado)) : '—'
  // Billetes y monedas de la apertura (T-40): llegan cuando el backend los guarde (B-28).
  const desglose = filasDelDesglose(resumen?.apertura_desglose ?? caja?.apertura_desglose)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3">
        <Cifra label="Ventas" valor={String(ventas)} />
        <Cifra label="Vendido" valor={formatMoney(vendido)} />
        <Cifra label="Ingresos" valor={formatMoney(Number(resumen?.total_ingresos))} />
        <Cifra label="Ingresos manuales" valor={formatMoney(ingresosManuales)} />
        <Cifra label="Egresos" valor={formatMoney(egresos)} />
        {conArqueo && (
          <>
            <Cifra label="Apertura" valor={formatMoney(Number(resumen?.monto_apertura))} />
            <div className="col-span-2">
              <Cifra label="Total esperado" valor={formatMoney(Number(resumen?.total_esperado))} />
            </div>
            <div className="col-span-3">
              <Cifra label="Efectivo esperado en el cajón" valor={efectivoEsperado} destacada />
              <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                Apertura + lo cobrado en efectivo − lo que salió. Es lo que debería haber al contar el cajón; lo cobrado con tarjeta no está ahí.
              </p>
            </div>
          </>
        )}
      </div>

      {conArqueo && cerrado && (
        <div aria-label="Arqueo del cierre" role="group">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Arqueo del cierre</h3>
          {contado === null ? (
            <p className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
              Sin arqueo: este turno se cerró sin contar el efectivo.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Cifra label="Contado" valor={formatMoney(contado)} />
              <div className={diferencia !== null && diferencia < 0
                ? 'rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800/50 dark:bg-red-950/30'
                : 'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3'}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Diferencia</p>
                <p data-testid="diferencia-cierre" className={`mt-1 text-sm font-bold ${diferencia !== null && diferencia < 0 ? 'text-red-600 dark:text-red-400' : 'text-[hsl(var(--foreground))]'}`}>
                  {textoDiferencia(diferencia) ?? '—'}
                </p>
              </div>
              {nota && (
                <p className="col-span-2 text-sm text-[hsl(var(--foreground))]"><span className="font-semibold">Nota:</span> {nota}</p>
              )}
            </div>
          )}
          {cerradoPor && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Cerró: {cerradoPor}</p>}
        </div>
      )}

      {conArqueo && porMaquina.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Por máquina</h3>
          <table className="w-full text-sm" aria-label="Por máquina">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <th className="py-1 font-semibold">Máquina</th>
                <th className="py-1 text-right font-semibold">Cobros</th>
                <th className="py-1 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {porMaquina.map((m) => (
                <tr key={m.pos_machine_id || m.display_name} className="border-t border-[hsl(var(--border))]">
                  <td className="py-1.5">{m.display_name || 'Máquina sin nombre'}</td>
                  <td className="py-1.5 text-right">{m.cobros}</td>
                  <td className="py-1.5 text-right font-semibold">{formatMoney(Number(m.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {conArqueo && desglose.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Efectivo de apertura</h3>
          <ul className="flex flex-col gap-1" aria-label="Efectivo de apertura">
            {desglose.map((d) => (
              <li key={d.valor} className="flex justify-between text-sm text-[hsl(var(--foreground))]">
                <span>{d.cantidad} × {etiquetaDenominacion(d.valor)} <span className="text-xs text-[hsl(var(--muted-foreground))]">({d.tipo})</span></span>
                <span className="font-semibold">{formatMoney(d.subtotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {porMetodo.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Desglose por método de pago</h3>
          {conArqueo && (
            <p className="mb-2 text-[11px] text-[hsl(var(--muted-foreground))]">Para arquear, compara el monto de Mercado Pago aquí contra el reporte de la app/sitio de Mercado Pago.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {porMetodo.map((row) => (
              <div key={row.payment_method} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                <span className="text-[hsl(var(--foreground))]">{PAYMENT_METHOD_LABEL[row.payment_method] || row.payment_method}</span>
                <span className="font-semibold text-[hsl(var(--foreground))]">{formatMoney(Number(row.total))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {conArqueo && <OrdenesDelTurno cajaId={caja.id} />}

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Movimientos</h3>
        {movimientos.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Todavía no hay movimientos registrados en este turno.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {movimientos.map((mov) => {
              const esEgreso = mov.tipo === 'egreso'
              return (
                <li key={mov.id} className="flex items-start justify-between gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                  <div className="min-w-0 flex-1">
                    <strong className={`block text-sm font-bold ${esEgreso ? 'text-red-600 dark:text-red-400' : 'text-[hsl(var(--foreground))]'}`}>
                      {esEgreso ? `− ${formatMoney(Number(mov.monto))}` : formatMoney(Number(mov.monto))}
                    </strong>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{fechaHora(mov.created_at)}</p>
                    {mov.order_id && (
                      <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">Orden {String(mov.order_id).slice(0, 8)}</span>
                    )}
                    {mov.note && <span className="mt-0.5 block text-xs text-[hsl(var(--foreground))]">{mov.note}</span>}
                    {!mov.order_id && mov.actor_user_id && nombreDeUsuario && (
                      <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">Registró: {nombreDeUsuario(mov.actor_user_id)}</span>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {esEgreso ? 'Retiro o gasto'
                      : !mov.order_id ? 'Ingreso manual'
                        : (MOVIMIENTO_SOURCE_LABEL[mov.payment_source] || mov.payment_source || 'Ingreso')}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
