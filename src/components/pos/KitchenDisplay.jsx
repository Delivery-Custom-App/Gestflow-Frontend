import { useState, useEffect, useMemo, useCallback } from 'react'
import { RefreshCw, Search, UtensilsCrossed, Clock } from 'lucide-react'
import { useKitchenOrders } from '../../hooks/useKitchenOrders'

// ── Constants ─────────────────────────────────────────────────────
const DELAY_THRESHOLD_MIN = 20

const STATUS_CFG = {
  PENDING:   { label: 'Nueva Orden', headerBg: 'bg-[#3d4a5c]',   pillBg: 'bg-[#3d4a5c]'   },
  PREPARING: { label: 'En Cocina',   headerBg: 'bg-orange-500',   pillBg: 'bg-orange-500'   },
  DELAYED:   { label: 'Demorada',    headerBg: 'bg-red-500',      pillBg: 'bg-red-500'      },
  READY:     { label: 'Lista',       headerBg: 'bg-green-600',    pillBg: 'bg-green-600'    },
}

const SOURCE_LABEL = { 'dine-in': 'Dine In', takeout: 'Take Away', delivery: 'Delivery' }

// ── Helpers ───────────────────────────────────────────────────────
function resolveDisplayStatus(order) {
  if (order.status === 'PREPARING') {
    const elapsed = (Date.now() - new Date(order.created_at)) / 60000
    if (elapsed > DELAY_THRESHOLD_MIN) return 'DELAYED'
  }
  return order.status
}

function elapsedSeconds(createdAt) {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt)) / 1000))
}

function formatTimer(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function shortOrderId(id) {
  return '#' + String(id).replace(/-/g, '').slice(-5).toUpperCase()
}

// ── Tick hook — forces re-render every second for live timers ─────
function useSecondTick() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
}

// ── StatusPill ────────────────────────────────────────────────────
function StatusPill({ label, count, pillBg }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold ${pillBg}`}>
      <span>{label}</span>
      <span className="bg-white/25 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold leading-none">
        {String(count).padStart(2, '0')}
      </span>
    </div>
  )
}

// ── OrderCard ─────────────────────────────────────────────────────
function OrderCard({ order, mesaMap, onUpdateStatus, tokenIndex }) {
  const [updating, setUpdating] = useState(false)

  useSecondTick()

  const displayStatus = resolveDisplayStatus(order)
  const cfg = STATUS_CFG[displayStatus] || STATUS_CFG.PENDING
  const secs = elapsedSeconds(order.created_at)
  const timer = formatTimer(secs)
  const progress = Math.min(secs / (DELAY_THRESHOLD_MIN * 60), 1)
  const isDelayed = displayStatus === 'DELAYED'
  const isReady = displayStatus === 'READY'

  const mesa = mesaMap[order.mesa_id]
  const mesaName = mesa?.name || (order.mesa_id ? `Mesa ${String(order.mesa_id).slice(0, 4)}` : 'Sin Mesa')
  const sourceLabel = SOURCE_LABEL[order.source] || 'Dine In'
  const tokenLabel = String(tokenIndex + 1).padStart(2, '0')

  const advance = useCallback(async () => {
    if (updating) return
    const next = order.status === 'PENDING' ? 'PREPARING' : 'READY'
    try {
      setUpdating(true)
      await onUpdateStatus(order.id, next)
    } finally {
      setUpdating(false)
    }
  }, [order.id, order.status, onUpdateStatus, updating])

  const markReady = useCallback(async () => {
    if (updating) return
    try {
      setUpdating(true)
      await onUpdateStatus(order.id, 'READY')
    } finally {
      setUpdating(false)
    }
  }, [order.id, onUpdateStatus, updating])

  const overMin = Math.max(0, Math.floor(secs / 60 - DELAY_THRESHOLD_MIN))

  return (
    <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm overflow-hidden flex flex-col">

      {/* Colored header */}
      <div className={`${cfg.headerBg} px-4 py-3 flex items-center gap-3`}>
        <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
          <UtensilsCrossed className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight">{mesaName}</p>
          <span className="inline-block mt-0.5 text-[10px] font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">
            {sourceLabel}
          </span>
        </div>
        <span className="text-sm font-extrabold text-white/90 tracking-wide shrink-0">
          {shortOrderId(order.id)}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-[hsl(var(--border))]">
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
          <p className="text-xs text-[hsl(var(--muted-foreground))] italic">Sin productos cargados</p>
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
                  <span className="text-xs font-medium text-[hsl(var(--foreground))] leading-snug truncate">
                    {item.product_name}
                  </span>
                </div>
                <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 font-medium">
                  ×{item.quantity}
                </span>
              </div>
              {item.notes && (
                <p className="ml-6 text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  Notes: {item.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Progress bar + timer */}
      <div className="px-4 pt-1 pb-2 space-y-1.5">
        {isDelayed && (
          <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0" />
            Demorada {overMin} Min
          </p>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isDelayed ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
            <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{timer}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 flex gap-2">
        {isReady ? (
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-gray-50 transition-colors"
          >
            🖨 Imprimir Orden
          </button>
        ) : (
          <>
            <button
              onClick={advance}
              disabled={updating}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 ${
                order.status === 'PENDING'
                  ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  : 'border-orange-300 text-orange-600 hover:bg-orange-50'
              }`}
            >
              {order.status === 'PENDING' ? (
                <><span className="text-sm">▷</span> Iniciar {timer}</>
              ) : (
                <><span className="text-sm">⏸</span> {timer}</>
              )}
            </button>
            <button
              onClick={markReady}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              ✓ Listo
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── KitchenDisplay ────────────────────────────────────────────────
export default function KitchenDisplay({ localId, mesas = [] }) {
  const { orders, loading, error, refresh, updateOrderStatus } = useKitchenOrders(localId)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Build mesa lookup map
  const mesaMap = useMemo(() => {
    const m = {}
    mesas.forEach(mesa => { m[mesa.id] = mesa })
    return m
  }, [mesas])

  // Enrich orders with display status
  const enrichedOrders = useMemo(() =>
    orders.map(o => ({ ...o, displayStatus: resolveDisplayStatus(o) })),
    [orders]
  )

  // Filter by search
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

  // Status counts
  const counts = useMemo(() => ({
    pending:   enrichedOrders.filter(o => o.displayStatus === 'PENDING').length,
    preparing: enrichedOrders.filter(o => o.displayStatus === 'PREPARING').length,
    delayed:   enrichedOrders.filter(o => o.displayStatus === 'DELAYED').length,
    ready:     enrichedOrders.filter(o => o.displayStatus === 'READY').length,
  }), [enrichedOrders])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 pb-4">
        {/* Title */}
        <div className="flex items-center gap-2 mr-2">
          <UtensilsCrossed className="w-5 h-5 text-[hsl(var(--foreground))]" />
          <h2 className="text-lg font-extrabold text-[hsl(var(--foreground))] tracking-tight">Cocina</h2>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Status pills */}
        <StatusPill label="Nueva Orden"  count={counts.pending}   pillBg={STATUS_CFG.PENDING.pillBg}   />
        <StatusPill label="En Cocina"    count={counts.preparing} pillBg={STATUS_CFG.PREPARING.pillBg} />
        <StatusPill label="Demorada"     count={counts.delayed}   pillBg={STATUS_CFG.DELAYED.pillBg}   />
        <StatusPill label="Lista"        count={counts.ready}     pillBg={STATUS_CFG.READY.pillBg}     />

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Buscar mesa u orden..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 pr-3 text-xs rounded-lg border border-[hsl(var(--border))] bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] w-44"
          />
        </div>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pb-2">
          {filteredOrders.map((order, i) => (
            <OrderCard
              key={order.id}
              order={order}
              mesaMap={mesaMap}
              onUpdateStatus={updateOrderStatus}
              tokenIndex={i}
            />
          ))}
        </div>
      )}
    </div>
  )
}
