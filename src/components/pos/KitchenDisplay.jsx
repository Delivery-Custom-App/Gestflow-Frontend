import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, UtensilsCrossed, Clock } from 'lucide-react'
import { useKitchenOrders } from '../../hooks/useKitchenOrders'
import { useTheme } from '../../context/ThemeContext'
import {
  URGENCY_STOPS_MIN,
  DELAY_THRESHOLD_MIN,
  READY_DISMISS_SECS,
  elapsedMinutesSinceCreated,
  elapsedSecondsSinceCreated,
  getUrgencyColor,
  getUrgencyLevel,
  getReadableTextClass,
} from '../../lib/orderUrgency'

// ── Constants ─────────────────────────────────────────────────────
// Efecto visual de pila: la comanda más antigua queda más desplazada/opaca "al fondo".
const STACK_OFFSET_Y = 14
const STACK_OFFSET_X = 6
const STACK_SCALE_STEP = 0.02
const STACK_MAX_VISIBLE_DEPTH = 6

function stackTransform(indexFromTop) {
  const depth = Math.min(indexFromTop, STACK_MAX_VISIBLE_DEPTH)
  return {
    y: depth * STACK_OFFSET_Y,
    x: depth * STACK_OFFSET_X,
    scale: 1 - depth * STACK_SCALE_STEP,
    opacity: Math.max(0.55, 1 - depth * 0.06),
    zIndex: 1000 - indexFromTop,
  }
}

const STATUS_CFG = {
  PENDING:   { label: 'Nueva Orden', bg: 'bg-[#0D0D1F]', fg: 'text-white' },
  PREPARING: { label: 'En Cocina',   bg: 'bg-[hsl(var(--warning))]',         fg: 'text-[hsl(var(--warning-foreground))]' },
  DELAYED:   { label: 'Demorada',    bg: 'bg-[hsl(var(--destructive))]',     fg: 'text-white' },
  READY:     { label: 'Lista',       bg: 'bg-[hsl(var(--success))]',         fg: 'text-[hsl(var(--success-foreground))]' },
}

const SOURCE_LABEL = { 'dine-in': 'Dine In', takeout: 'Take Away', delivery: 'Delivery' }

// ── Helpers ───────────────────────────────────────────────────────
// La urgencia corre desde created_at para PENDING y PREPARING por igual: una comanda
// que nunca se inicia también debe ir quedando "al fondo" de la pila y poniéndose roja.
function resolveDisplayStatus(order, now) {
  if (order.status === 'PENDING' || order.status === 'PREPARING') {
    const elapsedMin = elapsedMinutesSinceCreated(order, now)
    if (elapsedMin > DELAY_THRESHOLD_MIN) return 'DELAYED'
  }
  return order.status
}

function formatTimer(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatDateTime(iso) {
  const d = new Date(iso)
  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh   = String(d.getHours()).padStart(2, '0')
  const min  = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}

function shortOrderId(id) {
  return '#' + String(id).replace(/-/g, '').slice(-5).toUpperCase()
}

// ── Tick hook — forces re-render every second, returns current ms ─
function useSecondTick() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ── StatusPill ────────────────────────────────────────────────────
function StatusPill({ label, count, bg, fg }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${bg} ${fg}`}>
      <span>{label}</span>
      <span className="bg-[hsl(var(--card))]/25 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold leading-none">
        {String(count).padStart(2, '0')}
      </span>
    </div>
  )
}

// ── UrgencyLegend — documenta visualmente el gradiente de color por tiempo ──
const LEGEND_STEPS = [
  { label: `< ${URGENCY_STOPS_MIN.WARN}m`, minutes: URGENCY_STOPS_MIN.WARN / 2 },
  { label: `${URGENCY_STOPS_MIN.WARN}-${URGENCY_STOPS_MIN.HIGH}m`, minutes: (URGENCY_STOPS_MIN.WARN + URGENCY_STOPS_MIN.HIGH) / 2 },
  { label: `${URGENCY_STOPS_MIN.HIGH}-${URGENCY_STOPS_MIN.CRITICAL}m`, minutes: (URGENCY_STOPS_MIN.HIGH + URGENCY_STOPS_MIN.CRITICAL) / 2 },
  { label: `${URGENCY_STOPS_MIN.CRITICAL}m+`, minutes: URGENCY_STOPS_MIN.CRITICAL + 5 },
]

function UrgencyLegend({ darkMode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pb-3 text-[11px] text-[hsl(var(--muted-foreground))]">
      {LEGEND_STEPS.map(step => {
        const color = getUrgencyColor(step.minutes, darkMode ? 'dark' : 'light')
        return (
          <span key={step.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color.css }} />
            {step.label}
          </span>
        )
      })}
    </div>
  )
}

// ── ActiveMesasBar — resumen fijo de todas las mesas/comandas activas ──────
function ActiveMesasBar({ orders, mesaMap, darkMode, now }) {
  const sorted = useMemo(
    () => [...orders].sort((a, b) => elapsedMinutesSinceCreated(b, now) - elapsedMinutesSinceCreated(a, now)),
    [orders, now],
  )

  if (sorted.length === 0) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 mt-2 border-t border-[hsl(var(--border))] shrink-0">
      <span className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] shrink-0">
        ACTIVAS
      </span>
      {sorted.map(order => {
        const elapsedMin = elapsedMinutesSinceCreated(order, now)
        const color = getUrgencyColor(elapsedMin, darkMode ? 'dark' : 'light')
        const mesa = mesaMap[order.mesa_id]
        const mesaName = mesa?.name || (order.mesa_id ? `Mesa ${String(order.mesa_id).slice(0, 4)}` : 'Sin Mesa')
        return (
          <span
            key={order.id}
            className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-[hsl(var(--foreground))] bg-[hsl(var(--accent))] px-2.5 py-1 rounded-full"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color.css }} />
            {shortOrderId(order.id)} {mesaName} {Math.floor(elapsedMin)}m
          </span>
        )
      })}
    </div>
  )
}

// ── OrderCard ─────────────────────────────────────────────────────
function OrderCard({ order, mesaMap, onUpdateStatus, tokenIndex }) {
  const [updating, setUpdating] = useState(false)
  const [now, setNow] = useState(Date.now)
  const { darkMode } = useTheme()

  const isPending = order.status === 'PENDING'

  // El reloj de urgencia corre desde created_at para toda comanda activa, así que el
  // tick corre siempre (antes solo corría a partir de PREPARING).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const displayStatus = resolveDisplayStatus(order, now)
  const isDelayed = displayStatus === 'DELAYED'
  const isReady = displayStatus === 'READY'

  const elapsedMin = elapsedMinutesSinceCreated(order, now)
  const secs = elapsedSecondsSinceCreated(order, now)
  const urgencyLevel = getUrgencyLevel(elapsedMin)
  // Lista: se mantiene el color fijo de éxito (ya no hay más urgencia que comunicar).
  const urgencyColor = isReady ? null : getUrgencyColor(elapsedMin, darkMode ? 'dark' : 'light')
  const cfg = STATUS_CFG[displayStatus] || STATUS_CFG.PENDING
  const headerBg = isReady ? cfg.bg : ''
  const headerStyle = isReady ? undefined : { backgroundColor: urgencyColor.css }
  const headerFg = isReady ? cfg.fg : getReadableTextClass(urgencyColor.hsl)

  const timer = formatTimer(secs)
  const progress = Math.min(secs / (DELAY_THRESHOLD_MIN * 60), 1)

  const mesa = mesaMap[order.mesa_id]
  const mesaName = mesa?.name || (order.mesa_id ? `Mesa ${String(order.mesa_id).slice(0, 4)}` : 'Sin Mesa')
  const sourceLabel = SOURCE_LABEL[order.source] || 'Dine In'
  const tokenLabel = String(tokenIndex + 1).padStart(2, '0')

  // PENDING → PREPARING (inicia el timer); PREPARING/DELAYED → READY
  const handleAction = useCallback(async () => {
    if (updating) return
    const next = isPending ? 'PREPARING' : 'READY'
    try {
      setUpdating(true)
      await onUpdateStatus(order.id, next)
    } finally {
      setUpdating(false)
    }
  }, [order.id, isPending, onUpdateStatus, updating])

  const overMin = Math.max(0, Math.floor(secs / 60 - DELAY_THRESHOLD_MIN))

  return (
    <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] shadow-sm overflow-hidden flex flex-col">

      {/* Colored header — fondo continuo según urgencia (salvo Lista, color fijo) */}
      <div className={`${headerBg} ${headerFg} px-4 py-3 flex items-center gap-3`} style={headerStyle}>
        <div className="w-9 h-9 rounded-full bg-[hsl(var(--card))]/20 border border-current/30 flex items-center justify-center shrink-0">
          <UtensilsCrossed className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate leading-tight">{mesaName}</p>
          <span className="inline-flex items-center gap-1 mt-0.5">
            <span className="text-[10px] font-semibold bg-[hsl(var(--card))]/20 px-2 py-0.5 rounded-full">
              {sourceLabel}
            </span>
            <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
              {cfg.label}
            </span>
          </span>
        </div>
        <span className="text-sm font-extrabold opacity-90 tracking-wide shrink-0">
          {shortOrderId(order.id)}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between px-4 py-2 bg-[hsl(var(--accent))] border-b border-[hsl(var(--border))]">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          Token No: <span className="font-semibold text-[hsl(var(--foreground))]">{tokenLabel}</span>
        </span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {formatDateTime(order.created_at)}
        </span>
      </div>

      {/* Items list */}
      <div className="px-4 py-3 flex-1 min-h-[80px] space-y-2">
        {!order.items || order.items.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] italic text-center py-2">Sin productos cargados</p>
        ) : (
          order.items.map((item, i) => (
            <div key={item.id || i}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-4 h-4 rounded bg-green-500 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-[hsl(var(--foreground))] leading-snug">
                    {item.item_name || item.product_name || '—'}
                  </span>
                </div>
                <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 font-medium">
                  ×{item.quantity}
                </span>
              </div>
              {item.notes && (
                <p className="ml-6 text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  {item.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Progress bar + timer — corre desde created_at para toda comanda activa */}
      {!isReady && (() => {
        const barColor = urgencyLevel === 'critical'
          ? 'bg-red-500'
          : urgencyLevel === 'high' || urgencyLevel === 'warning'
            ? 'bg-amber-400'
            : 'bg-green-500'
        const timerColor = urgencyLevel === 'critical'
          ? 'text-red-500 font-bold'
          : urgencyLevel === 'high' || urgencyLevel === 'warning'
            ? 'text-amber-500 font-bold'
            : 'text-[hsl(var(--muted-foreground))]'
        return (
          <div className="px-4 pt-1 pb-3 space-y-2">
            {isDelayed && (
              <p className="text-xs text-red-500 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                ¡Demorada {overMin} min!
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Clock className={`w-3.5 h-3.5 shrink-0 ${timerColor}`} />
                <span className={`text-sm font-mono ${timerColor}`}>{timer}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Action button */}
      <div className="px-4 pb-4">
        {isReady ? (
          <button className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] transition-colors">
            🖨 Imprimir Orden
          </button>
        ) : isPending ? (
          <button
            onClick={handleAction}
            disabled={updating}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors disabled:opacity-50"
          >
            ▷ Iniciar
          </button>
        ) : (
          <button
            onClick={handleAction}
            disabled={updating}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-green-400 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors disabled:opacity-50"
          >
            ✓ Listo
          </button>
        )}
      </div>
    </div>
  )
}

// ── KitchenDisplay ────────────────────────────────────────────────
export default function KitchenDisplay({ localId, mesas = [] }) {
  const { orders, loading, error, updateOrderStatus } = useKitchenOrders(localId)
  const [search, setSearch] = useState('')
  const now = useSecondTick()
  const reduceMotion = useReducedMotion()
  const { darkMode } = useTheme()

  const mesaMap = useMemo(() => {
    const m = {}
    mesas.forEach(mesa => { m[mesa.id] = mesa })
    return m
  }, [mesas])

  // Auto-dismiss READY orders 30 s after updated_at (set by the server when marked ready)
  const enrichedOrders = useMemo(() => {
    return orders
      .map(o => ({ ...o, displayStatus: resolveDisplayStatus(o, now) }))
      .filter(o => {
        if (o.status !== 'READY') return true
        const readyAt = new Date(o.updated_at || o.created_at).getTime()
        return (now - readyAt) / 1000 < READY_DISMISS_SECS
      })
  }, [orders, now])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return enrichedOrders
    return enrichedOrders.filter(o => {
      const mesa = mesaMap[o.mesa_id]
      return (
        (mesa?.name || '').toLowerCase().includes(q) ||
        shortOrderId(o.id).toLowerCase().includes(q)
      )
    })
  }, [enrichedOrders, search, mesaMap])

  const counts = useMemo(() => ({
    pending:   enrichedOrders.filter(o => o.displayStatus === 'PENDING').length,
    preparing: enrichedOrders.filter(o => o.displayStatus === 'PREPARING').length,
    delayed:   enrichedOrders.filter(o => o.displayStatus === 'DELAYED').length,
    ready:     enrichedOrders.filter(o => o.displayStatus === 'READY').length,
  }), [enrichedOrders])

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 pb-4 pr-24">
        <div className="flex items-center gap-2 mr-2">
          <UtensilsCrossed className="w-5 h-5 text-[hsl(var(--foreground))]" />
          <h2 className="text-lg font-extrabold text-[hsl(var(--foreground))] tracking-tight">Cocina</h2>
        </div>

        <StatusPill label="Nueva Orden"  count={counts.pending}   bg={STATUS_CFG.PENDING.bg}   fg={STATUS_CFG.PENDING.fg}   />
        <StatusPill label="En Cocina"    count={counts.preparing} bg={STATUS_CFG.PREPARING.bg} fg={STATUS_CFG.PREPARING.fg} />
        <StatusPill label="Demorada"     count={counts.delayed}   bg={STATUS_CFG.DELAYED.bg}   fg={STATUS_CFG.DELAYED.fg}   />
        <StatusPill label="Lista"        count={counts.ready}     bg={STATUS_CFG.READY.bg}     fg={STATUS_CFG.READY.fg}     />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Buscar mesa u orden..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 pr-3 text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] w-40"
          />
        </div>
      </div>

      <UrgencyLegend darkMode={darkMode} />

      {/* ── Content ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando órdenes...</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[hsl(var(--destructive))]">Error: {error}</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[hsl(var(--muted-foreground))]">
          <UtensilsCrossed className="w-12 h-12 opacity-20" />
          <p className="text-sm font-medium">
            {search ? 'Sin resultados para la búsqueda' : 'No hay órdenes activas'}
          </p>
          {!search && (
            <p className="text-xs opacity-60">Las órdenes aparecerán aquí cuando se creen desde las mesas</p>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-2 pt-1">
          <div className="flex flex-col max-w-xl mx-auto">
            <AnimatePresence initial={false}>
              {filteredOrders.map((order, i) => {
                const indexFromTop = filteredOrders.length - 1 - i
                const transform = stackTransform(indexFromTop)
                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: transform.y - 24, scale: transform.scale }}
                    animate={{ x: transform.x, y: transform.y, scale: transform.scale, opacity: transform.opacity }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: transform.y + 20 }}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
                    style={{ zIndex: transform.zIndex, position: 'relative' }}
                    className={i > 0 ? '-mt-3' : ''}
                  >
                    <OrderCard
                      order={order}
                      mesaMap={mesaMap}
                      onUpdateStatus={updateOrderStatus}
                      tokenIndex={i}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      <ActiveMesasBar orders={enrichedOrders} mesaMap={mesaMap} darkMode={darkMode} now={now} />
    </div>
  )
}
