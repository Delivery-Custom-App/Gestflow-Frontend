import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { parseApiDate } from '../utils/chileDateTime'
import LoadingSpinner from './LoadingSpinner'
import IncomeChart from './charts/IncomeChart'
import CajaMpPairingModal from './pos/CajaMpPairingModal'
import CajaFisicaModal from './pos/CajaFisicaModal'
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
  closeCaja,
  getResumenDiario,
} from '../lib/administrativeApi'
import { getAuthContext, apiRequest, listUsers } from '../lib/apiClient'
import { mensajeCierreTurno } from '../lib/turnos'
import { filtrarTurnos, nombreDeVendedor, opcionesDeVendedor } from '../lib/registroTurnos'
import DetalleTurno from './turno/DetalleTurno'
import TablaTurnos from './turno/TablaTurnos'
import FiltrosTurnos from './turno/FiltrosTurnos'
import { useAuth } from '../context/AuthContext'
import { normalizeRoleKey } from '../auth/roleLabel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCLPCurrency as formatMoney } from '../lib/formatCLP'
import { m, AnimatePresence } from 'framer-motion'
import { MapPin, X, ChevronUp, ChevronRight, ShoppingCart, HelpCircle, CreditCard, ArrowLeftRight, Lock } from 'lucide-react'

/**
 * Las cajas físicas son supervisorias: el backend restringe su estado de
 * MercadoPago a ADMIN y superiores (`_ADMIN_ROLES` en mp_provisioning), y
 * vincular una terminal o renombrar el mueble no es tarea de quien atiende.
 * Un EMPLEADO veía el panel igual, con el estado en "no disponible" y botones
 * que solo podían terminar en 403.
 */
const ROLES_CAJAS_FISICAS = new Set(['ADMIN', 'ADMINNEGOCIO', 'SUPERADMIN'])

const sections = [
  { id: 'ventas',        label: 'Ventas',        subtitle: 'Ventas del día, tendencia, productos más vendidos e histórico' },
  { id: 'flujo-caja',    label: 'Caja y turnos', subtitle: 'Turnos de caja, movimientos y arqueo del día' },
  { id: 'configuracion', label: 'Configuración', subtitle: 'Dispositivos POS y ajustes del local' },
]

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function _normalizeOrderStatus(status) {
  return String(status || '').trim().toLowerCase()
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
  // Sin color de marca propio — tratado como neutro/informativo, no como alerta ni dato positivo.
  blue: {
    bar:   'border-l-[hsl(var(--info-foreground))]',
    bg:    'bg-[hsl(var(--info))]',
    ring:  'ring-1 ring-[hsl(var(--info-foreground)/0.2)]',
    value: 'text-[hsl(var(--info-foreground))]',
    dot:   'bg-[hsl(var(--info-foreground))]',
  },
  purple: {
    bar:   'border-l-[hsl(var(--success))]',
    bg:    'bg-[hsl(var(--success)/0.1)] dark:bg-[hsl(var(--success)/0.15)]',
    ring:  'ring-1 ring-[hsl(var(--success)/0.3)]',
    value: 'text-[hsl(149,60%,28%)] dark:text-[hsl(149,50%,68%)]',
    dot:   'bg-[hsl(var(--success))]',
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
    <article className={cn('rounded-xl border-l-[5px] p-4 shadow-md', a.bar, a.bg, a.ring)}>
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

function SectionActions({ activeSection, onNuevaCaja }) {
  if (activeSection === 'ventas') {
    return null
  }
  if (activeSection === 'flujo-caja') {
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

const PERIOD_OPTIONS = [
  { id: 'week',  label: 'Semanal' },
  { id: 'month', label: 'Mensual' },
  { id: 'year',  label: 'Anual' },
]

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function santiagoYmd(iso) {
  const d = parseApiDate(iso)
  if (!d) return null
  const ymd = d.toLocaleString('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' })
  return ymd.length === 10 ? ymd : null
}

function periodMeta(ymd, granularity) {
  const [y, m, d] = ymd.split('-').map(Number)
  if (granularity === 'year') {
    return { key: String(y), label: `Año ${y}`, sortKey: y, range: String(y) }
  }
  if (granularity === 'month') {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const label = `${MONTH_NAMES[m - 1]} ${y}`
    return { key, label, sortKey: y * 12 + (m - 1), range: label }
  }
  const base = new Date(Date.UTC(y, m - 1, d))
  const diffToMon = (base.getUTCDay() + 6) % 7
  const mon = new Date(base.getTime() - diffToMon * 86400000)
  const sun = new Date(mon.getTime() + 6 * 86400000)
  const fmt = (dt) => `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
  return {
    key: mon.toISOString().slice(0, 10),
    label: `Semana del ${fmt(mon)} al ${fmt(sun)}`,
    sortKey: mon.getTime(),
    range: `Semana ${fmt(mon)} — ${fmt(sun)}`,
  }
}

function VentasContent({ indicadores, orders, loading, error, onCargarDetalle, detalleLoading, onVerBoleta }) {
  const all = useMemo(() => safeArray(orders), [orders])
  const detalleCargado = Array.isArray(orders)
  const [granularity, setGranularity] = useState('month')
  const [expandedKey, setExpandedKey] = useState(null)

  // Últimas 24 horas (ventana rodante)
  const [cutoff24h] = useState(() => new Date(Date.now() - 24 * 60 * 60 * 1000))
  const last24h = all.filter((o) => {
    if (!o.created_at) return false
    if (_normalizeOrderStatus(o.status) === 'cancelled') return false
    return new Date(o.created_at) >= cutoff24h
  })

  // ── Histórico consolidado por período ──
  const buckets = useMemo(() => {
    const map = new Map()
    for (const o of all) {
      if (_normalizeOrderStatus(o.status) === 'cancelled') continue
      const ymd = santiagoYmd(o.created_at)
      if (!ymd) continue
      const meta = periodMeta(ymd, granularity)
      if (!map.has(meta.key)) {
        map.set(meta.key, { ...meta, total: 0, count: 0, orders: [] })
      }
      const bucket = map.get(meta.key)
      bucket.total += getOrderAmount(o)
      bucket.count += 1
      bucket.orders.push(o)
    }
    return [...map.values()].sort((a, b) => (a.sortKey > b.sortKey ? -1 : a.sortKey < b.sortKey ? 1 : 0))
  }, [all, granularity])

  const histTotal = buckets.reduce((s, b) => s + b.total, 0)
  const histCount = buckets.reduce((s, b) => s + b.count, 0)
  const histAvg = histCount ? histTotal / histCount : 0

  const methodBreakdown = useMemo(() => {
    const acc = {}
    for (const o of all) {
      if (_normalizeOrderStatus(o.status) === 'cancelled') continue
      const method = normalizePaymentMethod(o?.payment_method)
      acc[method] = (acc[method] || 0) + getOrderAmount(o)
    }
    return Object.entries(acc)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
  }, [all])

  const methodTotal = methodBreakdown.reduce((s, m) => s + m.total, 0)
  const periodNoun = granularity === 'week' ? 'semanas' : granularity === 'month' ? 'meses' : 'años'

  // Tendencia de 7 días y top productos (antes en Reportes), calculados con las mismas órdenes.
  // Indicadores: los calcula el backend. El detalle por orden, si se pidió,
  // alimenta los paneles de abajo.
  const incomeTrend = safeArray(indicadores?.tendencia)
  const topProducts = safeArray(indicadores?.topProductos)
  const hoy = indicadores?.hoy || { total: 0, ordenes: 0 }
  const porMetodo = indicadores?.porMetodo || { efectivo: 0, tarjetas: 0, otros: 0 }

  const stateNode = <SectionState loading={loading} error={error} isEmpty={false} emptyMessage="" />
  if (loading || error) return stateNode

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Hoy"  value={formatMoney(hoy.total)}  sub={`${hoy.ordenes} venta${hoy.ordenes !== 1 ? 's' : ''}`} />
        <KpiCard label="Efectivo"   value={formatMoney(porMetodo.efectivo)} />
        <KpiCard label="Tarjetas"   value={formatMoney(porMetodo.tarjetas)} accent="blue" />
        <KpiCard label="Otros"      value={formatMoney(porMetodo.otros)}    accent="purple" />
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
        <Panel title="Detalle de órdenes" sub="Se carga aparte porque trae el histórico completo del local">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Los indicadores de arriba los calcula el servidor. El detalle orden por orden y los
            consolidados por período se descargan solo si los necesitas.
          </p>
          <Button className="mt-3" size="sm" onClick={onCargarDetalle} disabled={detalleLoading}>
            {detalleLoading ? 'Cargando detalle…' : 'Cargar detalle de órdenes'}
          </Button>
        </Panel>
      )}

      {detalleCargado && (
      <>
      <Panel title="Ventas del Día" sub="Órdenes no canceladas de las últimas 24 h">
        {last24h.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No hay ventas en las últimas 24 horas.
          </p>
        ) : (
          <div className="space-y-2">
            {last24h.slice(0, 20).map((order) => (
              <RowCard
                key={order.id}
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
      </Panel>

      <Panel title="Histórico y Consolidados" sub="Registros consolidados por período. Excluye órdenes canceladas.">
        <div className="mb-5 inline-flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setGranularity(opt.id); setExpandedKey(null) }}
              className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                granularity === opt.id
                  ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total Consolidado" value={formatMoney(histTotal)} sub={`${histCount} ventas`} />
          <KpiCard label="Ticket Promedio"   value={formatMoney(histAvg)}   sub="Por venta" accent="blue" />
          <KpiCard label="Períodos"          value={String(buckets.length)} sub={periodNoun} accent="purple" />
          <KpiCard label="Mayor Período"     value={formatMoney(buckets[0]?.total || 0)} sub={buckets[0]?.label || 'Sin ventas'} accent="warning" />
        </div>

        {buckets.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay ventas históricas registradas.</p>
        ) : (
          <div className="space-y-2">
            {buckets.map((bucket) => {
              const isOpen = expandedKey === bucket.key
              const pct = histTotal ? (bucket.total / histTotal) * 100 : 0
              const bucketAvg = bucket.count ? bucket.total / bucket.count : 0
              return (
                <div key={bucket.key} className="rounded-lg border border-[hsl(var(--border))]">
                  <button
                    type="button"
                    onClick={() => setExpandedKey(isOpen ? null : bucket.key)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left transition-colors hover:bg-[hsl(var(--muted)/40)]">
                    <div className="flex min-w-0 items-center gap-2">
                      {isOpen
                        ? <ChevronUp size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                        : <ChevronRight size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" />}
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-bold text-[hsl(var(--foreground))]">{bucket.label}</strong>
                        <span className="block text-xs text-[hsl(var(--muted-foreground))]">{bucket.count} venta{bucket.count !== 1 ? 's' : ''} · {formatMoney(bucketAvg)} promedio</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <strong className="block text-sm font-bold text-[hsl(var(--foreground))]">{formatMoney(bucket.total)}</strong>
                      <span className="block text-xs text-[hsl(var(--muted-foreground))]">{pct.toFixed(0)}% del total</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t border-[hsl(var(--border))] p-3">
                      {bucket.orders.map((order) => (
                        <RowCard
                          key={order.id}
                          title={formatMoney(getOrderAmount(order))}
                          sub={`#${String(order.id || '').slice(0, 8)} — ${normalizePaymentMethod(order.payment_method)} — ${formatDateTime(order.created_at)}`}
                          meta={`Estado: ${order.status || '—'} · Fuente: ${order.source || '—'}`}
                          pill={normalizePaymentMethod(order.payment_method)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title="Distribución por Método de Pago" sub={`Histórico consolidado ${granularity === 'week' ? 'semanal' : granularity === 'month' ? 'mensual' : 'anual'}`}>
        {methodBreakdown.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay datos de métodos de pago.</p>
        ) : (
          <div className="space-y-3">
            {methodBreakdown.map((m) => {
              const pct = methodTotal ? (m.total / methodTotal) * 100 : 0
              return (
                <div key={m.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[hsl(var(--muted-foreground))]">{m.label}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{formatMoney(m.total)} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--border))]">
                    <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
      </>
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

function FlujoCajaContent({ dashboard, cajas, cajasFisicas, usuarios, resumenDiario, loading, error, onManagePairing, onViewMovimientos, onGestionarCajaFisica }) {
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
  const stateNode = <SectionState loading={loading} error={error} isEmpty={!dashboard && !loading && !error} emptyMessage="Sin datos de flujo. Completa órdenes desde el POS y registra gastos para ver gráficos." />
  if (loading || error || (!dashboard && !loading && !error)) return stateNode

  const turnosFiltrados = filtrarTurnos(cajasList, { vendedorId: filtroVendedor, fecha: filtroFecha })
  const openCajasCount = cajasList.filter((c) => c.is_active).length

  return (
    <div className="space-y-5">
      {/* «Caja» significaba dos cosas en esta pantalla: se aclara en una línea. */}
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        <span className="font-semibold text-[hsl(var(--foreground))]">Turno de caja:</span> se abre y se cierra cada día, con su arqueo.{' '}
        <span className="font-semibold text-[hsl(var(--foreground))]">Caja física:</span> el puesto donde está la terminal; es permanente.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Ingresos del Mes" value={formatMoney(dashboard?.monthly_sales)} sub="Mes actual" />
        <KpiCard label="Turnos Abiertos"  value={String(openCajasCount)} sub={`De ${cajasList.length} registrado${cajasList.length !== 1 ? 's' : ''}`} accent="blue" />
      </div>
      {resumenDiario && (
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
            <div className="rounded-lg border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total esperado hoy</p>
              <p className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]">{formatMoney(Number(resumenDiario.total_esperado))}</p>
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
                headers={['Caja física', 'Turnos', 'Apertura', 'Ingresos', 'Esperado']}
                rowKeys={porCajaFisica.map((cf) => cf.caja_fisica_id)}
                rows={porCajaFisica.map((cf) => {
                  const turnos = safeArray(cf.cajas)
                  const abiertos = turnos.filter((t) => t.status === 'open').length
                  return [
                    cf.nombre || 'Caja física sin nombre',
                    `${turnos.length}${abiertos ? ` · ${abiertos} abierto${abiertos !== 1 ? 's' : ''}` : ''}`,
                    formatMoney(Number(cf.monto_apertura_total)),
                    formatMoney(Number(cf.total_ingresos)),
                    formatMoney(Number(cf.total_esperado)),
                  ]
                })}
                emptyMessage="Sin cajas físicas con movimiento hoy."
              />
            </div>
          )}
        </Panel>
      )}
      <Panel title="Turnos de caja" sub="Los turnos de cada vendedor: cuándo abrieron y cerraron y cuánto vendieron">
        <div className="flex flex-col gap-4">
          <FiltrosTurnos
            vendedores={opcionesDeVendedor(cajasList, usuariosPorId)}
            vendedorId={filtroVendedor}
            onVendedor={setFiltroVendedor}
            fecha={filtroFecha}
            onFecha={setFiltroFecha}
          />
          <TablaTurnos
            key={`${filtroVendedor}|${filtroFecha}`}
            turnos={turnosFiltrados}
            cajaFisicaDe={(c) => nombrePorCajaFisica.get(String(c.caja_fisica_id))}
            vendedorDe={(c) => nombreDeVendedor(usuariosPorId, c.cashier_user_id)}
            onVer={showMovimientos ? (c) => onViewMovimientos({ ...c, vendedor: nombreDeVendedor(usuariosPorId, c.cashier_user_id) }) : undefined}
            vacio={filtroVendedor || filtroFecha ? 'No hay turnos con esos filtros.' : 'Este local todavía no tiene turnos de caja.'}
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
              return [
                cf.name || 'Caja física sin nombre',
                <div className="flex items-center gap-2" key={`mp-${cf.id}`}>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {status === 'paired' && cf.mp?.terminal_id && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{cf.mp.terminal_id}</span>
                  )}
                </div>,
                <div className="flex items-center gap-2" key={`acc-${cf.id}`}>
                  {onGestionarCajaFisica && (
                    <Button size="sm" variant="outline" onClick={() => onGestionarCajaFisica({ cajaFisica: cf })}>
                      Renombrar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onManagePairing(cf)}>
                    {MP_PAIRING_ACTION[status] || MP_PAIRING_ACTION.unprovisioned}
                  </Button>
                </div>,
              ]
            })}
            emptyMessage="No hay cajas físicas registradas para este local."
          />
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

/** Acepta "50.000" o "50000"; lo que no sea dígito se descarta. */
function montoDesdeTexto(texto) {
  return Number(String(texto ?? '').replace(/[^\d]/g, '')) || 0
}

function AbrirTurnoModal({ localId, onClose, onSaved, onCrearCajaFisica }) {
  // null mientras se cargan: distingue "todavía no sé" de "no hay ninguna".
  const [cajasFisicas, setCajasFisicas] = useState(null)
  const [cajaFisicaId, setCajaFisicaId] = useState('')
  const [monto,   setMonto]   = useState('')
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!cajaFisicaId) { setErr('Elige la caja física donde se abre el turno'); return }
    setSaving(true); setErr('')
    try {
      await createCaja({ caja_fisica_id: cajaFisicaId, monto_apertura: montoDesdeTexto(monto) })
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
                <input id="turno-monto" type="text" inputMode="numeric" value={monto}
                  onChange={e => setMonto(e.target.value)} placeholder="Ej: 50000" className={inputCls} />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  El efectivo con el que parte la caja. Se compara con él en el arqueo del cierre.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={handleClose} disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[hsl(var(--primary))] hover:opacity-90 shadow-sm transition-colors disabled:opacity-50">
                  {saving ? 'Abriendo…' : 'Abrir turno'}
                </button>
              </div>
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
function CajaMovimientosModal({ caja, onClose, onClosed }) {
  const [err, setErr] = useState('')
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const isOpen = caja.status === 'open' || caja.is_active

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const handleCloseCaja = async () => {
    if (!window.confirm('¿Cerrar este turno? Es el cierre del arqueo del día — no se puede reabrir después.')) return
    setClosing(true); setErr('')
    try {
      await closeCaja(caja.id)
      onClosed?.()
      handleClose()
    } catch (e) {
      // Con órdenes en curso el backend responde 409: se explica qué hacer.
      setErr(mensajeCierreTurno(e))
      setClosing(false)
    }
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
          {err && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}
          <DetalleTurno caja={caja} conArqueo />
        </div>

        {/* Footer */}
        {isOpen && (
          <div className="px-6 py-4 border-t border-[hsl(var(--border))] shrink-0">
            <button
              type="button"
              onClick={handleCloseCaja}
              disabled={closing}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-800/50 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
            >
              <Lock size={14} />
              {closing ? 'Cerrando…' : 'Cerrar turno (arqueo del día)'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function renderSectionContent(activeSection, payload) {
  switch (activeSection) {
    case 'flujo-caja':
      return <FlujoCajaContent dashboard={payload.dashboard} cajas={payload.cajas} cajasFisicas={payload.cajasFisicas} usuarios={payload.usuarios} resumenDiario={payload.resumenDiario} loading={payload.loading} error={payload.error} onManagePairing={payload.onManagePairing} onViewMovimientos={payload.onViewMovimientos} onGestionarCajaFisica={payload.onGestionarCajaFisica} />
    case 'configuracion':
      return <ConfiguracionContent localId={payload.localId} />
    case 'ventas':
    default:
      return <VentasContent indicadores={payload.indicadores} orders={payload.orders} loading={payload.loading} error={payload.error} onCargarDetalle={payload.onCargarDetalle} detalleLoading={payload.detalleLoading} onVerBoleta={payload.onVerBoleta} />
  }
}

// ── Main component ─────────────────────────────────────────────

function AdministrativeModule() {
  const location = useLocation()
  const { localId, sectionId } = useParams()
  const { userRole } = useAuth()
  const puedeGestionarCajasFisicas = ROLES_CAJAS_FISICAS.has(normalizeRoleKey(userRole))
  const [sectionData, setSectionData] = useState({ dashboard: null, orders: null, cajas: [], indicadores: null })
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [cajaFisicaModal, setCajaFisicaModal] = useState(null)
  const [boletaOrden, setBoletaOrden] = useState(null)

  /**
   * Descarga el detalle orden por orden. Solo bajo pedido: `/orders` no admite
   * filtro de fecha ni paginación, así que trae el histórico completo del local
   * y no debe pagarse al entrar a la pantalla.
   */
  const cargarDetalleOrdenes = async () => {
    setDetalleLoading(true)
    try {
      const { token } = await getAuthContext()
      const rows = await getOrdersByLocal(localId, token)
      setSectionData((prev) => ({ ...prev, orders: rows }))
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
      {puedeGestionarCajasFisicas && cajaFisicaModal && (
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
          onViewMovimientos: isV2FeatureEnabled('movimientosCaja') ? setMovimientosCaja : undefined,
        })}
      </main>
    </>
  )
}

export default AdministrativeModule
