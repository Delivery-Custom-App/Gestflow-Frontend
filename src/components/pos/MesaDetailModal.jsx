import { useState, useEffect, useCallback, useRef } from 'react'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { apiRequest } from '../../lib/apiClient'
import { formatCLP } from '../../lib/formatCLP'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const Spinner = () => (
  <div className="flex flex-col items-center gap-2 py-10 text-[hsl(var(--muted-foreground))]">
    <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
    <p className="text-xs">Cargando...</p>
  </div>
)

const STATUS_LABEL = {
  PENDING: 'Pendiente', pending: 'Pendiente',
  PREPARING: 'Preparando', preparing: 'Preparando',
  READY: 'Lista', ready: 'Lista',
  COMPLETED: 'Completada', completed: 'Completada',
  CANCELLED: 'Cancelada', cancelled: 'Cancelada',
}
const STATUS_COLOR = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PREPARING: 'bg-blue-100 text-blue-700',
  READY: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
}

export default function MesaDetailModal({ mesa, localId, onClose, onTableUpdated }) {
  const { detail, loading: detailLoading, refresh } = useMesaDetail(mesa.id)

  // Menu
  const [recipes, setRecipes]               = useState([])
  const [recipesByCategory, setRecipesByCategory] = useState([])
  const [recipesLoading, setRecipesLoading] = useState(false)
  const [selectedQtys, setSelectedQtys]     = useState({})
  const [showMenu, setShowMenu]             = useState(false)
  const [processing, setProcessing]         = useState(false)
  const [success, setSuccess]               = useState('')
  const [error, setError]                   = useState('')

  // Cancel confirm
  const [cancelOrderId, setCancelOrderId]   = useState(null)
  const [cancelling, setCancelling]         = useState(false)

  // Print view
  const [printOrder, setPrintOrder]         = useState(null)
  const [completing, setCompleting]         = useState(false)

  // Track if we set mesa to en_cobro so we can handle unmount
  const setEnCobro = useRef(false)

  // Set mesa state to en_cobro when modal opens with active orders
  useEffect(() => {
    if (!detail?.active_orders?.length) return
    setEnCobro.current = true
    apiRequest(`/mesas/${mesa.id}/state`, { method: 'PATCH', body: { state: 'en_cobro' } }).catch(() => {})
  }, [detail?.active_orders?.length, mesa.id])

  // ── Recipes ──────────────────────────────────────────────────
  const fetchRecipes = useCallback(async () => {
    if (!localId) return
    setRecipesLoading(true)
    try {
      const data = await apiRequest(`/recipes?local_id=${localId}&is_active=true`)
      const list = Array.isArray(data) ? data : []
      setRecipes(list)
      const groups = {}
      list.forEach(r => {
        const cat = r.category_name || r.category_id || 'Sin categoría'
        if (!groups[cat]) groups[cat] = []
        groups[cat].push(r)
      })
      setRecipesByCategory(Object.entries(groups))
    } catch {
      setRecipes([])
      setRecipesByCategory([])
    } finally {
      setRecipesLoading(false)
    }
  }, [localId])

  useEffect(() => {
    if (showMenu && recipes.length === 0) fetchRecipes()
  }, [showMenu, recipes.length, fetchRecipes])

  // ── Confirm order ────────────────────────────────────────────
  const totalItems = Object.values(selectedQtys).reduce((s, q) => s + q, 0)
  const subtotal   = Object.entries(selectedQtys).reduce((s, [id, qty]) => {
    const r = recipes.find(r => String(r.id) === id)
    return s + (r?.price_sale || 0) * qty
  }, 0)

  const handleQty = (id, qty) => {
    setSelectedQtys(prev => {
      const next = { ...prev }
      if (qty <= 0) delete next[id]
      else next[id] = qty
      return next
    })
  }

  const handleConfirmOrder = async () => {
    if (!totalItems) { setError('Selecciona al menos un plato'); return }
    setProcessing(true)
    setError('')
    try {
      const items = Object.entries(selectedQtys).map(([recipeId, quantity]) => {
        const recipe = recipes.find(r => String(r.id) === recipeId)
        return {
          recipe_id: recipeId,
          item_name: recipe?.name || 'Plato',
          quantity,
          unit_price: Math.round(recipe?.price_sale || 0),
        }
      })
      await apiRequest('/orders', {
        method: 'POST',
        body: { local_id: localId, mesa_id: mesa.id, source: 'dine-in', payment_method: 'CASH', items },
      })
      setSuccess('✓ Orden creada correctamente')
      setSelectedQtys({})
      setShowMenu(false)
      await refresh()
      onTableUpdated?.()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err?.message || 'Error al crear la orden')
    } finally {
      setProcessing(false)
    }
  }

  // ── Cancel order ─────────────────────────────────────────────
  const handleCancelConfirm = async () => {
    if (!cancelOrderId) return
    setCancelling(true)
    try {
      await apiRequest(`/orders/${cancelOrderId}`, { method: 'PATCH', body: { status: 'CANCELLED' } })
      setCancelOrderId(null)
      await refresh()
      onTableUpdated?.()
    } catch (err) {
      setError(err?.message || 'Error al cancelar la orden')
    } finally {
      setCancelling(false)
    }
  }

  // ── Print & complete ─────────────────────────────────────────
  const handlePrintAndComplete = async () => {
    if (!printOrder) return
    setCompleting(true)
    try {
      window.print()
      await apiRequest(`/orders/${printOrder.id}`, { method: 'PATCH', body: { status: 'COMPLETED' } })
      setPrintOrder(null)
      await refresh()
      onTableUpdated?.()
    } catch (err) {
      setError(err?.message || 'Error al completar la orden')
    } finally {
      setCompleting(false)
    }
  }

  const orderTotal = (detail?.active_orders || []).reduce(
    (sum, o) => sum + (o.items || []).reduce((s, i) => s + (i.total_price || 0), 0), 0
  )

  // ── Print view ───────────────────────────────────────────────
  if (printOrder) {
    return (
      <Dialog open onOpenChange={() => setPrintOrder(null)}>
        <DialogContent className="max-w-sm flex flex-col">
          <DialogHeader>
            <DialogTitle>Imprimir Orden</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm print:block">
            <div className="text-center border-b pb-2">
              <p className="font-bold text-base">{mesa.name}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                ID: #{String(printOrder.id).replace(/-/g, '').slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="space-y-1">
              {(printOrder.items || []).map(item => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.quantity}× {item.product_name || item.item_name}</span>
                  <span className="font-medium">${formatCLP(item.total_price)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>Total</span>
              <span>${formatCLP(printOrder.items?.reduce((s, i) => s + (i.total_price || 0), 0))}</span>
            </div>
          </div>
          {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPrintOrder(null)}>Volver</Button>
            <Button
              size="sm"
              onClick={handlePrintAndComplete}
              disabled={completing}
              className="bg-[hsl(var(--primary))] text-white"
            >
              {completing ? 'Procesando...' : '🖨 Imprimir y Cerrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ── Cancel confirm dialog ────────────────────────────────────
  if (cancelOrderId) {
    return (
      <Dialog open onOpenChange={() => setCancelOrderId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar esta orden?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Esta acción no se puede deshacer. La orden será cancelada y la mesa quedará libre.
          </p>
          {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setCancelOrderId(null)}>
              No, conservar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelConfirm}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelando...' : 'Sí, cancelar orden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ── Main modal ───────────────────────────────────────────────
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[88vh] flex flex-col p-0 gap-0">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))]">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">{mesa.name}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))] font-normal">
                {mesa.zona || 'General'} · {mesa.capacidad} personas
              </span>
            </div>
            {!!orderTotal && (
              <span className="text-sm font-bold text-[hsl(var(--primary))]">
                Total: ${formatCLP(orderTotal)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Mensajes */}
        {success && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
            <button className="ml-2 underline text-xs" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Órdenes activas */}
          {detailLoading ? <Spinner /> : (
            <div className="px-5 pt-4 pb-2 space-y-3">
              {!detail?.active_orders?.length ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                  No hay órdenes en esta mesa aún
                </p>
              ) : (
                detail.active_orders.map((order, idx) => (
                  <div key={order.id} className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                    {/* Order header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-[hsl(var(--accent))]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                          Orden {idx + 1}
                        </span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          #{String(order.id).replace(/-/g, '').slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-[hsl(var(--border))]">
                      {(order.items || []).map(item => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-5 h-5 flex items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-bold">
                              {item.quantity}
                            </span>
                            <span className="text-sm text-[hsl(var(--foreground))]">
                              {item.product_name || item.item_name}
                            </span>
                          </div>
                          <span className="text-sm font-medium">${formatCLP(item.total_price)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Order total + actions */}
                    <div className="px-4 py-2 bg-gray-50 border-t border-[hsl(var(--border))] flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                        Subtotal: ${formatCLP(order.items?.reduce((s, i) => s + (i.total_price || 0), 0))}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => setCancelOrderId(order.id)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs h-7 bg-[hsl(var(--primary))] text-white"
                          onClick={() => setPrintOrder(order)}
                        >
                          🖨 Imprimir
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Menú de recetas */}
          {showMenu && (
            <div className="px-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Menú</h3>
                {totalItems > 0 && (
                  <span className="text-xs text-[hsl(var(--primary))] font-medium">
                    {totalItems} plato{totalItems !== 1 ? 's' : ''} · ${formatCLP(subtotal)}
                  </span>
                )}
              </div>

              {recipesLoading ? <Spinner /> : !recipes.length ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                  No hay recetas disponibles
                </p>
              ) : (
                <div className="space-y-4">
                  {recipesByCategory.map(([category, items]) => (
                    <div key={category}>
                      <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
                        {category}
                      </p>
                      <div className="rounded-xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] overflow-hidden">
                        {items.map(recipe => {
                          const qty = selectedQtys[recipe.id] || 0
                          return (
                            <div key={recipe.id} className="flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--accent))] transition-colors">
                              <div className="min-w-0 flex-1 mr-3">
                                <p className="text-sm font-medium truncate">{recipe.name}</p>
                                {recipe.description && (
                                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{recipe.description}</p>
                                )}
                                <p className="text-xs font-semibold text-[hsl(var(--primary))] mt-0.5">
                                  ${formatCLP(recipe.price_sale || 0)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {qty > 0 && (
                                  <button
                                    onClick={() => handleQty(recipe.id, qty - 1)}
                                    className="w-7 h-7 rounded-full border border-[hsl(var(--border))] flex items-center justify-center text-sm font-bold hover:bg-[hsl(var(--accent))] transition-colors"
                                  >−</button>
                                )}
                                {qty > 0 && (
                                  <span className="w-5 text-center text-sm font-bold text-[hsl(var(--primary))]">{qty}</span>
                                )}
                                <button
                                  onClick={() => handleQty(recipe.id, qty + 1)}
                                  className="w-7 h-7 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-sm font-bold hover:bg-[hsl(var(--primary))]/90 transition-colors"
                                >+</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-4 border-t border-[hsl(var(--border))] flex-col gap-2">
          {showMenu && totalItems > 0 && (
            <div className="flex items-center justify-between w-full text-sm mb-1">
              <span className="text-[hsl(var(--muted-foreground))]">
                {totalItems} plato{totalItems !== 1 ? 's' : ''} seleccionado{totalItems !== 1 ? 's' : ''}
              </span>
              <span className="font-bold text-[hsl(var(--primary))]">${formatCLP(subtotal)}</span>
            </div>
          )}
          <div className="flex gap-2 w-full justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowMenu(!showMenu); setError('') }} disabled={processing}>
              {showMenu ? '✕ Cerrar Menú' : '＋ Agregar del Menú'}
            </Button>
            {showMenu && totalItems > 0 && (
              <Button
                size="sm"
                onClick={handleConfirmOrder}
                disabled={processing}
                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
              >
                {processing ? 'Confirmando...' : `Confirmar · $${formatCLP(subtotal)}`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
