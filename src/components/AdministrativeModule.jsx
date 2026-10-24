import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { parseApiDate } from '../utils/chileDateTime'
import LoadingSpinner from './LoadingSpinner'
import IncomeChart from './charts/IncomeChart'
import CajaMpPairingModal from './pos/CajaMpPairingModal'
import CajaFisicaModal from './pos/CajaFisicaModal'
import CajaFisicaEstadoDialog from './pos/CajaFisicaEstadoDialog'
import TicketModal from './pos/TicketModal'
import { isV2FeatureEnabled } from '../lib/v2Features'
import {
  getCajasByLocal,
  getCajasFisicasByLocal,
  listarCajasFisicas,
  getVentasIndicadores,
  getLocalDashboard,
  getOrdersByLocal,
  createCaja,
  getResumenDiario,
} from '../lib/administrativeApi'
import { getAuthContext, apiRequest, listUsers } from '../lib/apiClient'
import { textosNoCobradas } from '../lib/noCobradas'
import { isAlPasoLocal } from '../lib/salesModel'
import { useSelectedLocal } from '../hooks/useSelectedLocal'
import { nombreDeVendedor, opcionesDeVendedor, useTurnosFiltrados } from '../lib/registroTurnos'
import { diferenciaDe, monto, textoDiferencia } from '../lib/arqueo'
import { ultimoCierreDeCaja } from '../lib/cierreCaja'
import { nombreVisible } from '../lib/altaUsuario'
import { puedeVender } from '../lib/rolesCaja'
import DetalleTurno from './turno/DetalleTurno'
import RegistrarMovimientoCaja from './turno/RegistrarMovimientoCaja'
import CerrarTurno from './turno/CerrarTurno'
import AperturaCierreCajas from './caja/AperturaCierreCajas'
import MaquinasDeLasCajas from './caja/MaquinasDeLasCajas'
import RegistroAperturas from './caja/RegistroAperturas'
import ResumenDelDiaCajas from './caja/ResumenDelDiaCajas'
import { crearNombreDe } from '../lib/cajaFisica'
import SupervisionTurno from './turno/SupervisionTurno'
import HistorialTurno from './turno/HistorialTurno'
import { montoDesdeTexto } from '../lib/fondoEmergencia'
import TablaTurnos from './turno/TablaTurnos'
import FondoEmergencia from './FondoEmergencia'
import NoCobradas from './NoCobradas'
import FiltrosTurnos from './turno/FiltrosTurnos'
import { useAuth } from '../context/AuthContext'
import { normalizeRoleKey } from '../auth/roleLabel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCLPCurrency as formatMoney } from '../lib/formatCLP'
import { m, AnimatePresence } from 'framer-motion'
import { MapPin, X, ShoppingCart, HelpCircle, CreditCard, ArrowLeftRight, Lock, LifeBuoy } from 'lucide-react'

/**
 * Las cajas físicas son supervisorias: el backend restringe su estado de
 * MercadoPago a ADMIN y superiores (`_ADMIN_ROLES` en mp_provisioning), y
 * vincular una terminal o renombrar el mueble no es tarea de quien atiende.
 * Un EMPLEADO veía el panel igual, con el estado en "no disponible" y botones
 * que solo podían terminar en 403.
 */
const ROLES_CAJAS_FISICAS = new Set(['ADMIN', 'ADMINNEGOCIO', 'SUPERADMIN'])

/** Secciones visibles: se calculan al renderizar porque dependen de las banderas. */
const getSections = (alPaso = false) => [
  { id: 'ventas',        label: 'Ventas',        subtitle: 'Totales de hoy, tendencia, productos más vendidos e histórico' },
  { id: 'flujo-caja',    label: 'Caja y turnos', subtitle: 'Turnos de caja, movimientos y arqueo del día' },
  // T-46: lo que quedó sin cobrar al cerrar la caja y los pedidos vencidos.
  { id: 'no-cobradas',   label: textosNoCobradas(alPaso).titulo, subtitle: textosNoCobradas(alPaso).subtitulo },
  // T-26: fondo de emergencia (backend B-09). Con la bandera apagada la sección no existe y su dirección lleva a Ventas.
  ...(isV2FeatureEnabled('fondoEmergencia')
    ? [{ id: 'fondo-emergencia', label: 'Fondo de emergencia', subtitle: 'Plata apartada para imprevistos: monto fijo, saldo, gastos y reposiciones' }]
    : []),
  { id: 'configuracion', label: 'Configuración', subtitle: 'Dispositivos POS y ajustes del local' },
]

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizePaymentMethod(method) {
  const value = String(method || '').toLowerCase()
  if (value === 'mercadopago_point' || value.includes('mercadopago')) return 'MercadoPago'
  if (value.includes('cash') || value.includes('efectivo')) return 'Efectivo'
  if (value.includes('debit') || value.includes('debito')) return 'Debito'
  if (value.includes('credit') || value.includes('credito')) return 'Credito'
  if (value.includes('transfer')) return 'Transferencia'
  return 'Otro'
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  const date = parseApiDate(value)
  if (!date) return 'Sin fecha'
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago',
    hour12: true,
  })
}

/** Formatea un business_date ("YYYY-MM-DD") sin pasar por Date/timezone —
 * es un día calendario plano, no un instante; convertirlo con Date podría
 * correrlo un día según la zona horaria del navegador. */
function formatBusinessDate(value) {
  if (!value || typeof value !== 'string') return 'Sin fecha'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function getOrderAmount(order) {
  const directAmount =
    toNumber(order?.total_amount) ||
    toNumber(order?.amount) ||
    toNumber(order?.total) ||
    toNumber(order?.subtotal)
  if (directAmount > 0) return directAmount
  return safeArray(order?.items).reduce((sum, item) => sum + toNumber(item?.quantity, 1) * toNumber(item?.unit_price), 0)
}

// ── Shared UI atoms ────────────────────────────────────────────

const KPI_ACCENT = {
  warning: {
    bar:   'border-l-[hsl(var(--warning))]',
    bg:    'bg-[hsl(var(--warning)/0.1)] dark:bg-[hsl(var(--warning)/0.15)]',
    ring:  'ring-1 ring-[hsl(var(--warning)/0.3)]',
    value: 'text-[hsl(var(--warning-foreground))] dark:text-[hsl(38,90%,70%)]',
    dot:   'bg-[hsl(var(--warning))]',
  },
  red: {
    bar:   'border-l-[hsl(var(--destructive))]',
    bg:    'bg-[hsl(var(--destructive)/0.1)] dark:bg-[hsl(var(--destructive)/0.15)]',
    ring:  'ring-1 ring-[hsl(var(--destructive)/0.3)]',
    value: 'text-[hsl(354,70%,36%)] dark:text-[hsl(354,75%,72%)]',
    dot:   'bg-[hsl(var(--destructive))]',
  },
  // Un color por medio de pago (#ventas): el total va en el ámbar de la marca, el efectivo
  // en el esmeralda, las tarjetas en azul y los otros medios en violeta. Ninguno queda gris.
  amber: {
    bar:   'border-l-[hsl(var(--primary))]',
    bg:    'bg-[hsl(var(--primary)/0.12)] dark:bg-[hsl(var(--primary)/0.15)]',
    ring:  'ring-1 ring-[hsl(var(--primary)/0.3)]',
    value: 'text-[hsl(38,92%,25%)] dark:text-[hsl(38,90%,70%)]',
    dot:   'bg-[hsl(var(--primary))]',
  },
  green: {
    bar:   'border-l-[hsl(var(--success))]',
    bg:    'bg-[hsl(var(--success)/0.1)] dark:bg-[hsl(var(--success)/0.15)]',
    ring:  'ring-1 ring-[hsl(var(--success)/0.3)]',
    value: 'text-[hsl(149,60%,28%)] dark:text-[hsl(149,50%,68%)]',
    dot:   'bg-[hsl(var(--success))]',
  },
  blue: {
    bar:   'border-l-[hsl(211,70%,54%)]',
    bg:    'bg-[hsla(211,70%,54%,0.1)] dark:bg-[hsla(211,70%,54%,0.18)]',
    ring:  'ring-1 ring-[hsla(211,70%,54%,0.3)]',
    value: 'text-[hsl(211,82%,27%)] dark:text-[hsl(211,80%,75%)]',
    dot:   'bg-[hsl(211,70%,54%)]',
  },
  violet: {
    bar:   'border-l-[hsl(245,58%,67%)]',
    bg:    'bg-[hsla(245,58%,67%,0.12)] dark:bg-[hsla(245,58%,67%,0.2)]',
    ring:  'ring-1 ring-[hsla(245,58%,67%,0.3)]',
    value: 'text-[hsl(245,45%,37%)] dark:text-[hsl(245,70%,80%)]',
    dot:   'bg-[hsl(245,58%,67%)]',
  },
}

// Sin accent explícito = sin estado que resaltar → tratamiento neutro (no verde por defecto).
const KPI_DEFAULT = {
  bar:   'border-l-[hsl(var(--info-foreground))]',
  bg:    'bg-[hsl(var(--info))]',
  ring:  'ring-1 ring-[hsl(var(--info-foreground)/0.2)]',
  value: 'text-[hsl(var(--info-foreground))]',
  dot:   'bg-[hsl(var(--info-foreground))]',
}

function KpiCard({ label, value, sub, accent }) {
  const a = KPI_ACCENT[accent] || KPI_DEFAULT
  return (
    <article data-accent={KPI_ACCENT[accent] ? accent : 'neutro'} className={cn('rounded-xl border-l-[5px] p-4 shadow-md', a.bar, a.bg, a.ring)}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', a.dot)} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">{label}</p>
      </div>
      <strong className={cn('block text-2xl font-extrabold leading-tight', a.value)}>{value}</strong>
      {sub && <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">{sub}</span>}
    </article>
  )
}

const PANEL_ACCENT = {
  blue:    'border-[hsl(var(--info-foreground)/0.3)] bg-[hsl(var(--info)/0.4)]',
  red:     'border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.05)] dark:bg-[hsl(var(--destructive)/0.1)]',
  warning: 'border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.06)] dark:bg-[hsl(var(--warning)/0.12)]',
}

function Panel({ title, sub, accent, action, children }) {
  const accentCls = PANEL_ACCENT[accent] || 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
  return (
    <article className={cn('rounded-xl border p-5 shadow-sm', accentCls)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <h3 className="mb-0.5 text-sm font-bold text-[hsl(var(--foreground))]">{title}</h3>}
          {sub && <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </article>
  )
}

function RowCard({ title, sub, meta, pill, receiptUrl, action }) {
  return (
    <article className="flex items-start justify-between gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="flex-1 min-w-0">
        <strong className="block text-sm font-bold text-[hsl(var(--foreground))]">{title}</strong>
        {sub && <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
        {meta && <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">{meta}</span>}
        {receiptUrl && (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] underline underline-offset-2 hover:opacity-75">
            Ver comprobante
          </a>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {pill && <Badge variant="secondary" className="text-[10px]">{pill}</Badge>}
        {action}
      </div>
    </article>
  )
}

/** rowKeys: ids estables por fila (mismo orden que rows). */
function AmTable({ headers, rows, rowKeys, emptyMessage }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
      <table className="w-full text-sm">
        <thead className="bg-[hsl(var(--muted))]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKeys[i]} className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))/50]">
                {row.map((cell, j) => (
                  <td key={headers[j]} className="px-4 py-3 text-sm text-[hsl(var(--foreground))]">{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Section helpers ────────────────────────────────────────────

function SectionActions({ activeSection, onNuevaCaja, puedeAbrirTurno = true }) {
  if (activeSection === 'ventas') {
    return null
  }
  // A-03: en restaurante el administrador no tiene caja propia (no abre turno).
  // #133: con la caja física mandando, la caja se abre en «La caja del día» y el turno no lleva plata.
  if (activeSection === 'flujo-caja' && puedeAbrirTurno && !isV2FeatureEnabled('cajaFisicaManda')) {
    return (
      <div className="flex gap-2">
        <Button onClick={onNuevaCaja}>+ Abrir turno de caja</Button>
      </div>
    )
  }
  return null
}

function SectionState({ loading, error, isEmpty, emptyMessage }) {
  if (!loading && !error && !isEmpty) return null
  return (
    <div className={cn('rounded-xl border p-6', error ? 'border-red-200 bg-red-50 text-red-700' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]')}>
      {loading && <LoadingSpinner message="Cargando..." />}
      {!loading && error && <p className="text-sm">Error al cargar sección: {error}</p>}
      {!loading && !error && isEmpty && <p className="text-sm text-[hsl(var(--muted-foreground))]">{emptyMessage}</p>}
    </div>
  )
}

// ── Section content components ─────────────────────────────────

const DETALLE_ORDENES_POR_PAGINA = 50
function VentasContent({ indicadores, orders, ordersTotal, ordersOffset = 0, ordersLimit = 50, loading, error, onCargarDetalle, detalleLoading, onVerBoleta }) {
  const pageOrders = safeArray(orders)
  const detalleCargado = orders !== null && orders !== undefined
  const total = Number.isFinite(ordersTotal) ? ordersTotal : 0
  const incomeTrend = safeArray(indicadores?.tendencia)
  const topProducts = safeArray(indicadores?.topProductos)
  const hoy = indicadores?.hoy || { total: 0, ordenes: 0 }
  const porMetodo = indicadores?.porMetodo || { efectivo: 0, tarjetas: 0, otros: 0 }
  const firstOrder = total === 0 ? 0 : ordersOffset + 1
  const lastOrder = Math.min(ordersOffset + pageOrders.length, total)
  const stateNode = <SectionState loading={loading} error={error} isEmpty={false} emptyMessage="" />
  if (loading || error) return stateNode

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Hoy" value={formatMoney(hoy.total)} sub={`${hoy.ordenes} venta${hoy.ordenes !== 1 ? 's' : ''}`} accent="amber" />
        <KpiCard label="Efectivo" value={formatMoney(porMetodo.efectivo)} accent="green" />
        <KpiCard label="Tarjetas" value={formatMoney(porMetodo.tarjetas)} accent="blue" />
        <KpiCard label="Otros" value={formatMoney(porMetodo.otros)} accent="violet" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Tendencia de Ventas" sub="Ingresos diarios de los últimos 7 días">
          <IncomeChart data={incomeTrend} />
        </Panel>
        <Panel title="Top Productos" sub="Por ingresos, últimos 7 días">
          <AmTable
            headers={['Producto', 'Unidades', 'Ingresos']}
            rowKeys={topProducts.slice(0, 8).map((p) => p.product_id ?? p.product_name)}
            rows={topProducts.slice(0, 8).map((p) => [p.product_name || 'Producto sin nombre', toNumber(p.units_sold), formatMoney(p.revenue)])}
            emptyMessage="No hay productos para mostrar."
          />
        </Panel>
      </div>

      {!detalleCargado && (
        <Panel title="Detalle de órdenes" sub="Consulta paginada de órdenes del local">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            El detalle se carga por páginas y muestra el total informado por el servidor.
          </p>
          <Button className="mt-3" size="sm" onClick={() => onCargarDetalle(0)} disabled={detalleLoading}>
            {detalleLoading ? 'Cargando órdenes…' : 'Cargar detalle de órdenes'}
          </Button>
        </Panel>
      )}

      {detalleCargado && (
        <Panel title="Detalle de órdenes" sub="Órdenes filtradas y paginadas por el servidor">
          <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
            Mostrando {firstOrder}–{lastOrder} de {total} órdenes.
          </p>
          {pageOrders.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay órdenes para mostrar.</p>
          ) : (
            <div className="space-y-2">
              {pageOrders.map((order) => (
                <RowCard
                  key={`${order.id}-${order.created_at || ''}`}
                  title={formatMoney(getOrderAmount(order))}
                  sub={`#${String(order.id || '').slice(0, 8)} — ${normalizePaymentMethod(order.payment_method)} — ${formatDateTime(order.created_at)}`}
                  meta={`Estado: ${order.status || '—'} · Fuente: ${order.source || '—'}`}
                  pill={normalizePaymentMethod(order.payment_method)}
                  action={isV2FeatureEnabled('receiptPrint') && (
                    <Button size="sm" variant="outline" onClick={() => onVerBoleta(order)}>
                      Boleta
                    </Button>
                  )}
                />
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button size="sm" variant="outline" disabled={ordersOffset <= 0 || detalleLoading} onClick={() => onCargarDetalle(Math.max(0, ordersOffset - ordersLimit))}>
              Anterior
            </Button>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Página {Math.floor(ordersOffset / ordersLimit) + 1}</span>
            <Button size="sm" variant="outline" disabled={ordersOffset + pageOrders.length >= total || detalleLoading} onClick={() => onCargarDetalle(ordersOffset + ordersLimit)}>
              Siguiente
            </Button>
          </div>
        </Panel>
      )}
    </div>
  )
}
const MP_PAIRING_BADGE = {
  // Cuando el backend no responde el estado, no se afirma que no está vinculada:
  // no saberlo y no estarlo son cosas distintas.
  desconocido:      { label: 'Estado no disponible', variant: 'warning' },
  unprovisioned:    { label: 'Sin vincular',      variant: 'secondary' },
  awaiting_pairing: { label: 'Esperando terminal', variant: 'warning' },
  paired:           { label: 'Vinculada',          variant: 'success' },
}

const MP_PAIRING_ACTION = {
  desconocido:      'Revisar vinculación',
  unprovisioned:    'Vincular MP',
  awaiting_pairing: 'Verificar vinculación',
  paired:           'Ver vinculación',
}

function FlujoCajaContent({ localId, localNombre = '', cierra = '', usuarioActual = null, puedeGestionarCaja = false, onRefresh, version = 0, dashboard, cajas, cajasFisicas, usuarios, resumenDiario, loading, error, onManagePairing, onViewMovimientos, onGestionarCajaFisica }) {
  const cajaFisicaManda = isV2FeatureEnabled('cajaFisicaManda')
  // Quién abrió o cerró una caja: su nombre, no su correo.
  const nombreDe = useMemo(() => crearNombreDe(usuarios, usuarioActual), [usuarios, usuarioActual])
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')
  const cajasList = safeArray(cajas)
  const usuariosPorId = useMemo(() => new Map(safeArray(usuarios).map((u) => [String(u.id), u])), [usuarios])
  const cajasFisicasList = safeArray(cajasFisicas)
  // El backend entrega los turnos del día anidados dentro de cada caja física
  // (`por_caja_fisica[].cajas`), no en un arreglo de primer nivel.
  // Si la consulta del estado MP falló, las filas lo traen marcado.
  const estadoMpDisponible = cajasFisicasList.every((cf) => cf.mpDisponible !== false)
  const porCajaFisica = safeArray(resumenDiario?.por_caja_fisica)
  const turnosDelDia = porCajaFisica.reduce((n, cf) => n + safeArray(cf.cajas).length, 0)
  // Para decir en la tabla sobre qué caja física se abrió cada turno.
  const nombrePorCajaFisica = new Map(cajasFisicasList.map((cf) => [String(cf.id), cf.name]))
  const showMpPairing = typeof onManagePairing === 'function'
  const showMovimientos = typeof onViewMovimientos === 'function'
  // A-01: con filtros, la lista la trae el servidor (GET /cajas?business_date=&cashier_user_id=).
  const filtrados = useTurnosFiltrados(localId, cajasList, { vendedorId: filtroVendedor, fecha: filtroFecha })
  const stateNode = <SectionState loading={loading} error={error} isEmpty={!dashboard && !loading && !error} emptyMessage="Sin datos de flujo. Completa órdenes desde el POS y registra gastos para ver gráficos." />
  // Una recarga (al abrir o cerrar una caja) no desmonta los paneles: si no, se pierden sus mensajes.
  if (error || !dashboard) return stateNode

  const openCajasCount = cajasList.filter((c) => c.is_active).length

  return (
    <div className="space-y-5">
      {/* «Caja» significaba dos cosas en esta pantalla: se aclara en una línea. */}
      {cajaFisicaManda ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          <span className="font-semibold text-[hsl(var(--foreground))]">Caja física:</span> el encargado o el dueño la abre y la cierra, contando el efectivo.{' '}
          <span className="font-semibold text-[hsl(var(--foreground))]">Turno:</span> el de cada empleado sobre una caja abierta; no lleva plata y se cierra con la caja.
        </p>
      ) : (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          <span className="font-semibold text-[hsl(var(--foreground))]">Turno de caja:</span> se abre y se cierra cada día, con su arqueo.{' '}
          <span className="font-semibold text-[hsl(var(--foreground))]">Caja física:</span> el puesto donde está la terminal; es permanente.
        </p>
      )}
      {cajaFisicaManda && puedeGestionarCaja && (
        <Panel title="La caja del día" sub="Abrir y cerrar cada caja física, con su conteo; retiros e ingresos del cajón">
          <AperturaCierreCajas cajasFisicas={cajasFisicasList} localNombre={localNombre} cierra={cierra} puedeGestionar={puedeGestionarCaja} onCambio={onRefresh}
            nombreDe={nombreDe} />
        </Panel>
      )}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Ingresos del Mes" value={formatMoney(dashboard?.monthly_sales)} sub="Mes actual" accent="amber" />
        <KpiCard label="Turnos Abiertos"  value={String(openCajasCount)} sub={`De ${cajasList.length} registrado${cajasList.length !== 1 ? 's' : ''}`} accent="blue" />
      </div>
      {/* #133: con la caja física mandando, el día se arma con las aperturas de hoy (el resumen por turnos ya no aplica). */}
      {cajaFisicaManda && puedeGestionarCaja && (
        <Panel title="Resumen del día" sub="Todas las cajas que se abrieron hoy en este local: fondo, ventas, retiros, lo esperado y lo contado">
          <ResumenDelDiaCajas cajasFisicas={cajasFisicasList} version={version} />
        </Panel>
      )}
      {!cajaFisicaManda && resumenDiario && (
        <Panel title="Resumen del día" sub={`Consolidado de todos los turnos del local · ${formatBusinessDate(resumenDiario.business_date)}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Apertura total</p>
              <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]">{formatMoney(Number(resumenDiario.monto_apertura_total))}</p>
            </div>
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Ingresos de hoy</p>
              <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]">{formatMoney(Number(resumenDiario.total_ingresos))}</p>
            </div>
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total esperado hoy</p>
              <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]">{formatMoney(Number(resumenDiario.total_esperado))}</p>
            </div>
            {/* T-63: retiros, efectivo esperado y diferencias del día (B-18). */}
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Egresos de hoy</p>
              <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]" data-testid="egresos-dia">{formatMoney(monto(resumenDiario.total_egresos) ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Efectivo esperado</p>
              <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]" data-testid="efectivo-esperado-dia">{monto(resumenDiario.efectivo_esperado) === null ? '—' : formatMoney(monto(resumenDiario.efectivo_esperado))}</p>
            </div>
            <div className={cn('rounded-lg border p-3', (monto(resumenDiario.diferencia_total) ?? 0) < 0 ? 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]')}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Diferencia del día</p>
              <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]" data-testid="diferencia-dia">{textoDiferencia(resumenDiario.diferencia_total) ?? 'Sin arqueo'}</p>
            </div>
          </div>
          {turnosDelDia === 0 ? (
            <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Todavía no se abrió ningún turno de caja hoy en este local.</p>
          ) : (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Detalle por caja física
              </p>
              <AmTable
                headers={['Caja física', 'Turnos', 'Apertura', 'Ingresos', 'Egresos', 'Efectivo esperado', 'Diferencia']}
                rowKeys={porCajaFisica.map((cf) => cf.caja_fisica_id)}
                rows={porCajaFisica.map((cf) => {
                  const turnos = safeArray(cf.cajas)
                  const abiertos = turnos.filter((t) => t.status === 'open').length
                  return [
                    cf.nombre || 'Caja física sin nombre',
                    `${turnos.length}${abiertos ? ` · ${abiertos} abierto${abiertos !== 1 ? 's' : ''}` : ''}`,
                    formatMoney(Number(cf.monto_apertura_total)),
                    formatMoney(Number(cf.total_ingresos)),
                    formatMoney(monto(cf.total_egresos) ?? 0),
                    monto(cf.efectivo_esperado) === null ? '—' : formatMoney(monto(cf.efectivo_esperado)),
                    textoDiferencia(cf.diferencia_total) ?? 'Sin arqueo',
                  ]
                })}
                emptyMessage="Sin cajas físicas con movimiento hoy."
              />
              <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Detalle por turno
              </p>
              <ul aria-label="Turnos del día" className="flex flex-col gap-1.5">
                {porCajaFisica.flatMap((cf) => safeArray(cf.cajas).map((t) => {
                  const dif = monto(t.diferencia)
                  const conDiferencia = dif !== null && dif !== 0
                  return (
                    <li key={t.caja_id} data-diferencia={conDiferencia ? 'si' : 'no'}
                      className={cn('grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-lg border px-3 py-2 text-xs sm:grid-cols-6',
                        conDiferencia ? 'border-red-300 bg-red-50 dark:border-red-800/60 dark:bg-red-950/30' : 'border-[hsl(var(--border))]')}>
                      <span className="font-semibold text-[hsl(var(--foreground))] sm:col-span-2">
                        {cf.nombre || 'Caja física'} · {nombreDeVendedor(usuariosPorId, t.cashier_user_id)}
                      </span>
                      <span>{t.status === 'open' ? 'Abierto' : 'Cerrado'}</span>
                      <span>Egresos {formatMoney(monto(t.total_egresos) ?? 0)}</span>
                      <span>Esperado {monto(t.efectivo_esperado) === null ? '—' : formatMoney(monto(t.efectivo_esperado))}</span>
                      <span className={conDiferencia && dif < 0 ? 'font-semibold text-red-600' : ''}>
                        {t.status === 'open' ? 'Sin cerrar'
                          : monto(t.monto_cierre_declarado) === null ? 'Sin arqueo'
                            : `Contado ${formatMoney(monto(t.monto_cierre_declarado))} · ${textoDiferencia(t.diferencia)}`}
                      </span>
                    </li>
                  )
                }))}
              </ul>
            </div>
          )}
        </Panel>
      )}
      {cajaFisicaManda && puedeGestionarCaja && (
        <Panel title="Apertura de caja" sub="Cada vez que se abrió y se cerró una caja: el fondo, quién la abrió y la cerró, lo contado y los turnos que se trabajaron">
          <RegistroAperturas cajasFisicas={cajasFisicasList} version={version} nombreDe={nombreDe} />
        </Panel>
      )}
      <Panel title="Turnos de caja" sub={cajaFisicaManda
        ? 'Los turnos de cada empleado sobre una caja abierta: cuándo empezaron y terminaron y cuánto vendieron. Abrir una caja no crea un turno'
        : 'Los turnos de cada vendedor: cuándo abrieron y cerraron y cuánto vendieron'}>
        <div className="flex flex-col gap-4">
          <FiltrosTurnos
            vendedores={opcionesDeVendedor(cajasList, usuariosPorId)}
            vendedorId={filtroVendedor}
            onVendedor={setFiltroVendedor}
            fecha={filtroFecha}
            onFecha={setFiltroFecha}
          />
          {filtrados.error && <p role="alert" className="text-xs text-red-600">{filtrados.error}</p>}
          <TablaTurnos
            key={`${filtroVendedor}|${filtroFecha}`}
            turnos={filtrados.turnos}
            cajaFisicaDe={(c) => nombrePorCajaFisica.get(String(c.caja_fisica_id))}
            vendedorDe={(c) => nombreDeVendedor(usuariosPorId, c.cashier_user_id)}
            onVer={showMovimientos ? (c) => onViewMovimientos({
              ...c,
              vendedor: nombreDeVendedor(usuariosPorId, c.cashier_user_id),
              cerradoPor: c.closed_by_user_id ? nombreDeVendedor(usuariosPorId, c.closed_by_user_id) : null,
              nombreDeUsuario: (id) => nombreDeVendedor(usuariosPorId, id),
              usuarios: safeArray(usuarios),
              // Si el rol no lista las cajas físicas, igual viaja el id: el cierre sabe de cuál es el turno.
              cajaFisica: cajasFisicasList.find((cf) => String(cf.id) === String(c.caja_fisica_id)) ?? { id: c.caja_fisica_id },
            }) : undefined}
            vacio={filtrados.cargando ? 'Buscando turnos…' : filtroVendedor || filtroFecha ? 'No hay turnos con esos filtros.' : 'Este local todavía no tiene turnos de caja.'}
          />
        </div>
      </Panel>
      {showMpPairing && (
        <Panel
          title="Cajas físicas"
          action={onGestionarCajaFisica && (
            <Button size="sm" variant="outline" onClick={() => onGestionarCajaFisica({ nueva: true })}>
              + Nueva caja física
            </Button>
          )}
          sub={estadoMpDisponible
            ? 'La terminal MercadoPago se vincula a la caja física, no al turno'
            : 'No se pudo consultar el estado de MercadoPago: se listan las cajas físicas, pero su vinculación no se puede confirmar'}
          accent={estadoMpDisponible ? undefined : 'warning'}
        >
          <AmTable
            headers={['Caja física', 'MercadoPago', 'Acciones']}
            rowKeys={cajasFisicasList.map((cf) => cf.id)}
            rows={cajasFisicasList.map((cf) => {
              const status = cf.mpDisponible === false ? 'desconocido' : (cf.mp?.pairing_status || 'unprovisioned')
              const badge = MP_PAIRING_BADGE[status] || MP_PAIRING_BADGE.unprovisioned
              const activa = cf.is_active !== false
              return [
                <span className="inline-flex items-center gap-2" key={`nombre-${cf.id}`}>
                  {cf.name || 'Caja física sin nombre'}
                  {!cajaFisicaManda && <Badge variant="outline">{cf.tipo === 'digital' ? 'Digital' : 'Física'}</Badge>}
                  {!activa && <Badge variant="warning">Desactivada</Badge>}
                </span>,
                <div className="flex items-center gap-2" key={`mp-${cf.id}`}>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {status === 'paired' && cf.mp?.terminal_id && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{cf.mp.terminal_id}</span>
                  )}
                </div>,
                <div className="flex items-center gap-2" key={`acc-${cf.id}`}>
                  {onGestionarCajaFisica && (
                    <Button size="sm" variant="outline" onClick={() => onGestionarCajaFisica({ cajaFisica: cf })}>
                      Editar
                    </Button>
                  )}
                  {activa && (
                    <Button size="sm" variant="outline" onClick={() => onManagePairing(cf)}>
                      {MP_PAIRING_ACTION[status] || MP_PAIRING_ACTION.unprovisioned}
                    </Button>
                  )}
                  {/* T-75: primero se desactiva (archiva); una desactivada se reactiva o se elimina. */}
                  {onGestionarCajaFisica && activa && (
                    <Button size="sm" variant="outline" onClick={() => onGestionarCajaFisica({ cajaFisica: cf, accion: 'desactivar' })}>
                      Desactivar
                    </Button>
                  )}
                  {onGestionarCajaFisica && !activa && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => onGestionarCajaFisica({ cajaFisica: cf, accion: 'reactivar' })}>
                        Reactivar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => onGestionarCajaFisica({ cajaFisica: cf, accion: 'eliminar' })}>
                        Eliminar
                      </Button>
                    </>
                  )}
                </div>,
              ]
            })}
            emptyMessage="No hay cajas físicas registradas para este local."
          />
        </Panel>
      )}
      {cajaFisicaManda && puedeGestionarCaja && (
        <Panel title="Máquinas POS" sub="Toda máquina pertenece a una caja física: quien la usa queda en esa caja y ahí busca el vuelto">
          <MaquinasDeLasCajas localId={localId} cajasFisicas={cajasFisicasList} puedeGestionar={puedeGestionarCaja} />
        </Panel>
      )}
    </div>
  )
}

// ── Configuración ─────────────────────────────────────────

function ConfiguracionContent({ localId }) {
  const [posList, setPosList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ mp_pos_id: '', name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!localId) return
    setLoading(true)
    getAuthContext().then(({ token }) =>
      apiRequest(`/webhooks/mercadopago-pos?local_id=${localId}`, { token })
        .then((data) => setPosList(Array.isArray(data) ? data : []))
        .catch(() => setError('Error cargando dispositivos POS'))
        .finally(() => setLoading(false))
    )
  }, [localId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.mp_pos_id.trim()) return setError('El ID del POS es requerido')
    setSaving(true)
    setError('')
    try {
      const { token } = await getAuthContext()
      const newPos = await apiRequest('/webhooks/mercadopago-pos', {
        method: 'POST',
        token,
        body: { mp_pos_id: form.mp_pos_id.trim(), local_id: localId, name: form.name.trim() || null },
      })
      setPosList((prev) => [...prev, newPos])
      setForm({ mp_pos_id: '', name: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      const { token } = await getAuthContext()
      await apiRequest(`/webhooks/mercadopago-pos/${id}`, { method: 'DELETE', token })
      setPosList((prev) => prev.filter((p) => p.id !== id))
    } catch {
      setError('Error eliminando dispositivo')
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <section className="border border-[hsl(var(--border))] rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />
          Dispositivos POS MercadoPago
        </h3>

        {loading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
        ) : posList.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center border border-dashed rounded-md">
            No hay dispositivos POS registrados
          </p>
        ) : (
          <div className="border rounded-md overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">ID del POS</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nombre</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {posList.map((pos) => (
                  <tr key={pos.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{pos.mp_pos_id}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{pos.name || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(pos.id)}
                        className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]">
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={handleAdd} className="flex gap-2 flex-wrap items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-35">
            <label htmlFor="pos-mp-id" className="text-xs text-muted-foreground">ID del POS *</label>
            <input
              id="pos-mp-id"
              type="text"
              placeholder="ej: PAX_A920_001"
              value={form.mp_pos_id}
              onChange={(e) => setForm((p) => ({ ...p, mp_pos_id: e.target.value }))}
              className="h-9 rounded-md border border-[hsl(var(--border))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-35">
            <label htmlFor="pos-mp-nombre" className="text-xs text-muted-foreground">Nombre (opcional)</label>
            <input
              id="pos-mp-nombre"
              type="text"
              placeholder="ej: Caja 1"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 rounded-md border border-[hsl(var(--border))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Agregando...' : 'Agregar POS'}
          </Button>
        </form>

        {error && <p className="mt-2 text-xs text-[hsl(var(--destructive))]">{error}</p>}
      </section>
    </div>
  )
}

// ── Modal de apertura de turno ───────────────────────────────

function AbrirTurnoModal({ localId, cajas = [], onClose, onSaved, onCrearCajaFisica }) {
  // null mientras se cargan: distingue "todavía no sé" de "no hay ninguna".
  const [cajasFisicas, setCajasFisicas] = useState(null)
  const [cajaFisicaId, setCajaFisicaId] = useState('')
  // Total del efectivo con que parte la caja, escrito a mano ("50.000" o "50000").
  const [monto, setMonto] = useState('')
  // Abrir en $0 se confirma: así no se abre vacía por olvidar escribir el monto.
  const [confirmarSinEfectivo, setConfirmarSinEfectivo] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  useEffect(() => {
    let ignore = false
    listarCajasFisicas(localId)
      .then((filas) => {
        if (ignore) return
        setCajasFisicas(filas)
        // Con una sola caja física no tiene sentido hacer elegir.
        if (filas.length === 1) setCajaFisicaId(String(filas[0].id))
      })
      .catch(() => {
        if (ignore) return
        setCajasFisicas([])
        setErr('No se pudieron cargar las cajas físicas de este local')
      })
    return () => { ignore = true }
  }, [localId])

  const handleClose = () => {
    if (saving) return
    setVisible(false)
    setTimeout(onClose, 300)
  }

  // Vacío es $0: el aviso de abrir sin efectivo lo confirma antes de abrir.
  const total = montoDesdeTexto(monto) ?? 0
  // Lo que se contó al cerrar el último turno de esta caja es lo que quedó en ella: se compara con lo que se escribe.
  const cierreAnterior = cajaFisicaId ? ultimoCierreDeCaja(cajas, cajaFisicaId) : null
  const diferenciaConCierre = cierreAnterior && monto.trim() !== '' ? diferenciaDe(total, cierreAnterior.contado) : null

  const cambiarMonto = (e) => {
    setMonto(e.target.value)
    setConfirmarSinEfectivo(false)
  }

  const abrir = async () => {
    setSaving(true); setErr('')
    try {
      await createCaja({ caja_fisica_id: cajaFisicaId, monto_apertura: total })
      onSaved()
      handleClose()
    } catch (e) {
      const mensaje = String(e?.message || '')
      // El backend rechaza un segundo turno del mismo cajero en la misma caja
      // física el mismo día; se explica en vez de mostrar el 409.
      setErr(/409|ya existe una caja abierta/i.test(mensaje)
        ? 'Ya tienes un turno abierto hoy en esa caja física. Ciérralo antes de abrir otro.'
        : (mensaje || 'No se pudo abrir el turno'))
      setSaving(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!cajaFisicaId) { setErr('Elige la caja física donde se abre el turno'); return }
    if (total === 0 && !confirmarSinEfectivo) { setErr(''); setConfirmarSinEfectivo(true); return }
    abrir()
  }

  const inputCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.4)] transition-colors'
  const labelCls = 'text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider'

  return (
    <div className="fixed inset-0 z-50">
      <div className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')} role="presentation" onClick={handleClose} />
      <div className={cn('absolute inset-y-0 right-0 w-full max-w-md flex flex-col shadow-2xl overflow-y-auto no-scrollbar bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] transition-transform duration-300 ease-out', visible ? 'translate-x-0' : 'translate-x-full')}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <CreditCard size={18} className="text-[hsl(var(--primary))]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Abrir turno de caja</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">El turno se abre y se cierra cada día; la caja física es el puesto y no se toca aquí</p>
            </div>
          </div>
          <button type="button" aria-label="Cerrar" onClick={handleClose} disabled={saving}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors disabled:opacity-40">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 flex-1">
          {err && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          {cajasFisicas === null && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando las cajas físicas del local…</p>
          )}

          {cajasFisicas?.length === 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-4">
              <p className="text-sm text-[hsl(var(--foreground))]">
                Este local todavía no tiene ninguna caja física registrada, y un turno se abre siempre sobre una.
              </p>
              {onCrearCajaFisica ? (
                <button type="button" onClick={onCrearCajaFisica}
                  className="self-start px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[hsl(var(--primary))] hover:opacity-90 shadow-sm transition-colors">
                  Crear caja física
                </button>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Pídele a un administrador que registre la caja física de este local.
                </p>
              )}
            </div>
          )}

          {cajasFisicas?.length > 0 && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="turno-caja-fisica" className={labelCls}>Caja física</label>
                {/* Foco al abrir el drawer: patrón de diálogo accesible (WAI-ARIA APG). */}
                {/* oxlint-disable-next-line react-doctor/no-autofocus */}
                <select id="turno-caja-fisica" value={cajaFisicaId} onChange={e => setCajaFisicaId(e.target.value)} className={inputCls} required autoFocus>
                  <option value="">Elige una caja física</option>
                  {cajasFisicas.map((cf) => (
                    <option key={cf.id} value={cf.id}>{cf.name || 'Caja física sin nombre'}</option>
                  ))}
                </select>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">El puesto donde se atiende. El turno queda asociado a ella.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="turno-monto" className={labelCls}>Monto de apertura</label>
                <input id="turno-monto" type="text" inputMode="numeric" autoComplete="off" value={monto}
                  onChange={cambiarMonto} placeholder="Ej: 50000" disabled={saving} className={inputCls} />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  El total del efectivo con el que parte la caja, escrito a mano. Se compara con él en el arqueo del cierre.
                  Si no hay efectivo, déjalo vacío o en 0.
                </p>
                {cierreAnterior && (
                  <div role="note" aria-label="Lo que quedó en la caja al cerrar" className="flex flex-col gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2">
                    <p className="text-xs text-[hsl(var(--foreground))]">
                      Al cerrar el turno del {formatBusinessDate(cierreAnterior.businessDate)} quedaron{' '}
                      <strong data-testid="quedo-en-la-caja">{formatMoney(cierreAnterior.contado)}</strong> en esta caja.
                    </p>
                    {diferenciaConCierre !== null && (
                      <p data-testid="apertura-vs-cierre" className={cn('text-xs font-semibold',
                        diferenciaConCierre < 0 ? 'text-red-600' : diferenciaConCierre > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                        {diferenciaConCierre === 0 ? 'Cuadra con lo que quedó' : `${textoDiferencia(diferenciaConCierre)} respecto de lo que quedó`}
                      </p>
                    )}
                    {diferenciaConCierre !== 0 && (
                      <button type="button" onClick={() => cambiarMonto({ target: { value: String(cierreAnterior.contado) } })} disabled={saving}
                        className="self-start text-xs font-semibold text-[hsl(var(--primary))] hover:underline disabled:opacity-50">
                        Usar este monto
                      </button>
                    )}
                  </div>
                )}
              </div>

              {confirmarSinEfectivo ? (
                <div role="alertdialog" aria-labelledby="sin-efectivo-titulo"
                  className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-950/30">
                  <p id="sin-efectivo-titulo" className="text-sm font-semibold text-[hsl(var(--foreground))]">¿Abrir la caja sin efectivo?</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No escribiste un monto de apertura: el turno parte en $0.</p>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setConfirmarSinEfectivo(false)} disabled={saving}
                      className="h-11 px-4 rounded-xl text-sm font-medium border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40">
                      Volver al monto
                    </button>
                    <button type="submit" disabled={saving}
                      className="h-11 px-5 rounded-xl text-sm font-semibold text-white bg-[hsl(var(--primary))] hover:opacity-90 shadow-sm transition-colors disabled:opacity-50">
                      {saving ? 'Abriendo…' : 'Sí, abrir sin efectivo'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={handleClose} disabled={saving}
                    className="h-11 px-4 rounded-xl text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    className="h-11 px-5 rounded-xl text-sm font-semibold text-white bg-[hsl(var(--primary))] hover:opacity-90 shadow-sm transition-colors disabled:opacity-50">
                    {saving ? 'Abriendo…' : 'Abrir turno'}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Resumen de un turno para el encargado y el dueño: ventas, ingresos,
 * egresos, apertura y total esperado (DetalleTurno), y el cierre del arqueo.
 */
function CajaMovimientosModal({ caja, onClose, onClosed, puedeRegistrarMovimientos = false }) {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  // T-55: el cierre pide el efectivo contado (arqueo).
  const [cerrandoTurno, setCerrandoTurno] = useState(false)
  // T-56: retiros, gastos e ingresos de caja; al registrar se recarga el resumen.
  const [registrando, setRegistrando] = useState(false)
  const [version, setVersion] = useState(0)
  const [aviso, setAviso] = useState('')
  // T-43: historial del turno, bajo pedido.
  const [verHistorial, setVerHistorial] = useState(false)
  const isOpen = caja.status === 'open' || caja.is_active
  const formularioMovimiento = useRef(null)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  // Al venir del cierre a registrar un retiro, el formulario queda arriba: se lleva a la vista.
  useEffect(() => { if (registrando) formularioMovimiento.current?.scrollIntoView?.({ block: 'nearest' }) }, [registrando])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }


  return (
    <div className="fixed inset-0 z-50">
      <div className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')} role="presentation" onClick={handleClose} />
      <div className={cn('absolute inset-y-0 right-0 w-full max-w-md flex flex-col shadow-2xl overflow-y-auto no-scrollbar bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] transition-transform duration-300 ease-out', visible ? 'translate-x-0' : 'translate-x-full')}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <ArrowLeftRight size={18} className="text-[hsl(var(--primary))]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Resumen del turno</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {caja.vendedor ? `${caja.vendedor} · ` : ''}{formatBusinessDate(caja.business_date)}
                {isOpen ? ' · Abierto' : ' · Cerrado'}
              </p>
            </div>
          </div>
          <button type="button" aria-label="Cerrar" onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5 flex-1">
          {aviso && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{aviso}</p>}
          {isOpen && puedeRegistrarMovimientos && !isV2FeatureEnabled('cajaFisicaManda') && (
            registrando ? (
              <div ref={formularioMovimiento}>
                <RegistrarMovimientoCaja
                  cajaId={caja.id}
                  onCancelar={() => setRegistrando(false)}
                  onRegistrado={({ tipo, monto }) => {
                    setRegistrando(false)
                    setAviso(`${tipo === 'egreso' ? 'Retiro o gasto' : 'Ingreso'} de ${formatMoney(monto)} registrado.`)
                    setVersion((v) => v + 1)
                  }}
                />
              </div>
            ) : (
              <Button size="sm" variant="outline" className="self-start" onClick={() => { setRegistrando(true); setAviso('') }}>
                Registrar movimiento
              </Button>
            )
          )}
          {isOpen && puedeRegistrarMovimientos && (
            <SupervisionTurno turno={caja} usuarios={caja.usuarios} onHecho={() => { setVersion((v) => v + 1); onClosed?.() }} />
          )}
          <DetalleTurno key={version} caja={caja} conArqueo={!isV2FeatureEnabled('cajaFisicaManda')} cerradoPor={caja.cerradoPor} nombreDeUsuario={caja.nombreDeUsuario} />
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="outline" className="self-start" onClick={() => setVerHistorial((v) => !v)} aria-expanded={verHistorial}>
              {verHistorial ? 'Ocultar historial' : 'Historial'}
            </Button>
            {verHistorial && <HistorialTurno key={version} cajaId={caja.id} />}
          </div>
        </div>

        {/* Footer */}
        {isOpen && isV2FeatureEnabled('cajaFisicaManda') && (
          <p className="border-t border-[hsl(var(--border))] px-6 py-4 text-xs text-[hsl(var(--muted-foreground))]">
            El turno no se cuenta ni se cierra solo: se cierra con su caja física, en «La caja del día».
          </p>
        )}
        {isOpen && !isV2FeatureEnabled('cajaFisicaManda') && (
          <div className="px-6 py-4 border-t border-[hsl(var(--border))] shrink-0">
            {cerrandoTurno ? (
              <CerrarTurno
                cajaId={caja.id}
                localId={caja.local_id}
                cajaFisica={caja.cajaFisica}
                localNombre={caja.localNombre}
                vendedor={caja.vendedor}
                cierra={user ? nombreVisible(user) : ''}
                usuarios={caja.usuarios}
                nombreDeUsuario={caja.nombreDeUsuario}
                // Un retiro cambia el efectivo esperado: se registra antes de contar (el cierre vuelve a abrirse después).
                onRegistrarRetiro={puedeRegistrarMovimientos ? () => { setCerrandoTurno(false); setRegistrando(true); setAviso('') } : undefined}
                onCancelar={() => setCerrandoTurno(false)}
                onCierreRegistrado={() => onClosed?.()}
                onCerrado={handleClose}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCerrandoTurno(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-800/50 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
              >
                <Lock size={14} />
                Cerrar turno (arqueo del día)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function renderSectionContent(activeSection, payload) {
  switch (activeSection) {
    case 'flujo-caja':
      return <FlujoCajaContent localId={payload.localId} version={payload.version} usuarioActual={payload.usuarioActual} localNombre={payload.localNombre} cierra={payload.cierra} puedeGestionarCaja={payload.puedeGestionarCaja} onRefresh={payload.onRefresh} dashboard={payload.dashboard} cajas={payload.cajas} cajasFisicas={payload.cajasFisicas} usuarios={payload.usuarios} resumenDiario={payload.resumenDiario} loading={payload.loading} error={payload.error} onManagePairing={payload.onManagePairing} onViewMovimientos={payload.onViewMovimientos} onGestionarCajaFisica={payload.onGestionarCajaFisica} />
    case 'fondo-emergencia':
      return <FondoEmergencia localId={payload.localId} />
    case 'no-cobradas':
      return <NoCobradas localId={payload.localId} />
    case 'configuracion':
      return <ConfiguracionContent localId={payload.localId} />
    case 'ventas':
    default:
      return <VentasContent indicadores={payload.indicadores} orders={payload.orders} ordersTotal={payload.ordersTotal} ordersOffset={payload.ordersOffset} ordersLimit={payload.ordersLimit} loading={payload.loading} error={payload.error} onCargarDetalle={payload.onCargarDetalle} detalleLoading={payload.detalleLoading} onVerBoleta={payload.onVerBoleta} />
  }
}

// ── Main component ─────────────────────────────────────────────

function AdministrativeModule() {
  const location = useLocation()
  const { localId, sectionId } = useParams()
  const { userRole, user } = useAuth()
  const puedeAbrirTurno = puedeVender(userRole, user?.local_sales_model)
  const puedeGestionarCajasFisicas = ROLES_CAJAS_FISICAS.has(normalizeRoleKey(userRole))
  const [sectionData, setSectionData] = useState({ dashboard: null, orders: null, ordersTotal: null, ordersOffset: 0, ordersLimit: DETALLE_ORDENES_POR_PAGINA, cajas: [], indicadores: null })
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [cajaFisicaModal, setCajaFisicaModal] = useState(null)
  const [boletaOrden, setBoletaOrden] = useState(null)

  /** Carga una página del detalle y conserva el total que informa X-Total-Count. */
  const cargarDetalleOrdenes = async (offset = 0) => {
    setDetalleLoading(true)
    try {
      const { token } = await getAuthContext()
      const page = await getOrdersByLocal(localId, token, { limit: DETALLE_ORDENES_POR_PAGINA, offset })
      setSectionData((prev) => ({
        ...prev,
        orders: page.orders,
        ordersTotal: page.total,
        ordersOffset: page.offset,
        ordersLimit: page.limit,
      }))
    } catch (error) {
      setSectionError(error.message || 'No se pudo cargar el detalle de órdenes')
    } finally {
      setDetalleLoading(false)
    }
  }
  const [loading, setLoading] = useState(false)
  const [sectionError, setSectionError] = useState('')
  const [showNuevaCaja, setShowNuevaCaja]               = useState(false)
  const [pairingCaja, setPairingCaja]                   = useState(null)
  const [movimientosCaja, setMovimientosCaja]           = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [guideOpen,  setGuideOpen]  = useState(false)


  // Sin sección o con una que ya no existe (rendiciones, reportes, alertas, bonos, dashboard) → Ventas.
  const localActual = useSelectedLocal(localId, 'state-then-locales')
  const sections = getSections(isAlPasoLocal(localActual))
  const isKnownSection = sections.some((s) => s.id === sectionId)
  const activeSection = isKnownSection ? sectionId : 'ventas'
  const activeSectionMeta = sections.find((s) => s.id === activeSection) || sections[0]

  useEffect(() => {
    let ignore = false
    async function fetchSectionData() {
      if (!localId || !isKnownSection) return
      setLoading(true)
      setSectionError('')
      try {
        const { token } = await getAuthContext()
        const updates = {}
        if (activeSection === 'flujo-caja') {
          updates.dashboard = await getLocalDashboard(localId, token)
        }
        if (activeSection === 'ventas') {
          // Indicadores agregados por el backend. El detalle orden por orden se
          // pide aparte, solo si el usuario lo abre.
          updates.indicadores = await getVentasIndicadores(localId)
        }
        if (activeSection === 'flujo-caja') {
          const [cajasData, cajasFisicasData, resumenDiarioData, usuariosData] = await Promise.all([
            getCajasByLocal(localId, token),
            // Solo ADMIN y superiores gestionan cajas físicas: para el resto no
            // se pide nada, porque el panel no se muestra.
            puedeGestionarCajasFisicas ? getCajasFisicasByLocal(localId).catch(() => []) : [],
            // 403 para EMPLEADO (arqueo consolidado es supervisorio) -- no
            // debe tumbar el resto de la sección si ocurre.
            getResumenDiario(localId).catch(() => null),
            // Nombres para la columna y el filtro "Vendedor". Sin ellos, la
            // tabla igual distingue a cada uno por un id corto.
            listUsers().catch(() => []),
          ])
          updates.cajas = cajasData
          updates.cajasFisicas = cajasFisicasData
          updates.resumenDiario = resumenDiarioData
          updates.usuarios = usuariosData
        }
        if (!ignore) setSectionData((prev) => ({ ...prev, ...updates }))
      } catch (error) {
        if (!ignore) setSectionError(error.message || 'No se pudo cargar la información del módulo')
      } finally {
        // Sí se resetea en finally; la guarda evita que una respuesta obsoleta apague el loader de una carga más nueva.
        // oxlint-disable-next-line react-doctor/no-loading-flag-reset-outside-finally
        if (!ignore) setLoading(false)
      }
    }
    fetchSectionData()
    return () => { ignore = true }
  }, [localId, activeSection, isKnownSection, refreshKey, puedeGestionarCajasFisicas])

  if (!isKnownSection) {
    return <Navigate to={`/local/${localId}/administrativo/ventas`} replace state={location.state} />
  }

  return (
    <>
      {showNuevaCaja && (
        <AbrirTurnoModal
          localId={localId}
          cajas={sectionData.cajas}
          onClose={() => setShowNuevaCaja(false)}
          onSaved={() => setRefreshKey(k => k + 1)}
          onCrearCajaFisica={puedeGestionarCajasFisicas
            ? () => { setShowNuevaCaja(false); setCajaFisicaModal({ nueva: true }) }
            : undefined}
        />
      )}
      {boletaOrden && (
        <TicketModal
          tipo="boleta"
          orderId={boletaOrden.id}
          createdAt={boletaOrden.created_at}
          onClose={() => setBoletaOrden(null)}
        />
      )}
      {puedeGestionarCajasFisicas && cajaFisicaModal?.accion && (
        <CajaFisicaEstadoDialog
          cajaFisica={cajaFisicaModal.cajaFisica}
          accion={cajaFisicaModal.accion}
          onClose={() => setCajaFisicaModal(null)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
      {puedeGestionarCajasFisicas && cajaFisicaModal && !cajaFisicaModal.accion && (
        <CajaFisicaModal
          localId={localId}
          cajaFisica={cajaFisicaModal.cajaFisica}
          onClose={() => setCajaFisicaModal(null)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
      {puedeGestionarCajasFisicas && isV2FeatureEnabled('cajaMpPairing') && pairingCaja && (
        <CajaMpPairingModal
          caja={pairingCaja}
          localId={localId}
          onClose={() => setPairingCaja(null)}
          onUpdated={() => setRefreshKey(k => k + 1)}
        />
      )}
      {movimientosCaja && (
        <CajaMovimientosModal
          caja={movimientosCaja}
          onClose={() => setMovimientosCaja(null)}
          onClosed={() => setRefreshKey(k => k + 1)}
          puedeRegistrarMovimientos={puedeGestionarCajasFisicas}
        />
      )}
      <AnimatePresence>
        {guideOpen && (
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setGuideOpen(false)}>
            <m.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                <div className="flex items-center gap-2">
                  <HelpCircle size={16} className="text-[hsl(var(--primary))]" />
                  <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Guía — Módulo Administrativo</h3>
                </div>
                <button type="button" aria-label="Cerrar guía" onClick={() => setGuideOpen(false)}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { icon: ShoppingCart, color: 'text-emerald-600', title: 'Ventas', desc: 'Ventas de las últimas 24 horas por método de pago, tendencia de los últimos 7 días, productos más vendidos e histórico consolidado por semana, mes o año.' },
                  { icon: CreditCard, color: 'text-amber-600', title: 'Caja y turnos', desc: 'Turnos de caja: resumen del día, movimientos de cada turno y cierre del arqueo diario. Y las cajas físicas del local, el puesto permanente al que se vincula la terminal MercadoPago.' },
                  ...(isV2FeatureEnabled('fondoEmergencia') ? [{ icon: LifeBuoy, color: 'text-rose-600', title: 'Fondo de emergencia', desc: 'Plata apartada para imprevistos del local: un monto fijo, su saldo, cada gasto con su motivo y las reposiciones, semana a semana. Un gasto mal anotado se corrige, no se borra. No forma parte del arqueo de los turnos de caja.' }] : []),
                ].map(({ icon: Icon, color, title, desc, highlight }) => (
                  <div key={title} className={`flex gap-3 rounded-xl p-3 ${highlight ? 'bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)]' : 'bg-[hsl(var(--muted)/0.4)]'}`}>
                    <div className={`mt-0.5 shrink-0 ${color}`}><Icon size={15} /></div>
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-0.5">{title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
      <main className="flex-1 overflow-y-auto no-scrollbar px-5 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[hsl(var(--primary))] tracking-tight">
              {activeSectionMeta.label}
            </h2>
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{activeSectionMeta.subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <SectionActions
              activeSection={activeSection}
              onNuevaCaja={() => setShowNuevaCaja(true)}
              puedeAbrirTurno={puedeAbrirTurno}
            />
            <button
              onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              <HelpCircle size={13} />
              <span>¿Cómo funciona este módulo?</span>
            </button>
          </div>
        </div>

        {renderSectionContent(activeSection, {
          ...sectionData,
          loading,
          error:    sectionError,
          localId,
          onRefresh: () => setRefreshKey(k => k + 1),
          onCargarDetalle: cargarDetalleOrdenes,
          onVerBoleta: setBoletaOrden,
          onGestionarCajaFisica: puedeGestionarCajasFisicas && isV2FeatureEnabled('cajaMpPairing') ? setCajaFisicaModal : undefined,
          detalleLoading,
          onManagePairing: puedeGestionarCajasFisicas && isV2FeatureEnabled('cajaMpPairing') ? setPairingCaja : undefined,
          onViewMovimientos: isV2FeatureEnabled('movimientosCaja') ? (c) => setMovimientosCaja({ ...c, localNombre: localActual?.name || '' }) : undefined,
          localNombre: localActual?.name || '',
          cierra: user ? nombreVisible(user) : '',
          puedeGestionarCaja: puedeGestionarCajasFisicas,
          version: refreshKey,
          usuarioActual: user,
        })}
      </main>
    </>
  )
}

export default AdministrativeModule
