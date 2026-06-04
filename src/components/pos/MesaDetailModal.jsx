import { useState, useEffect, useCallback } from 'react'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import { apiRequest } from '../../lib/apiClient'
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

const statusLabel = { pending: 'Pendiente', preparing: 'Preparando', ready: 'En Cobro' }
const statusColor = {
  pending:   'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready:     'bg-green-100 text-green-700',
}

export default function MesaDetailModal({ mesa, localId, onClose, onTableUpdated }) {
  const { detail, loading: detailLoading, refresh } = useMesaDetail(mesa.id)
  const { createOrder } = useOrderManagement()

  const [recipes, setRecipes]         = useState([])
  const [recipesByCategory, setRecipesByCategory] = useState([])
  const [recipesLoading, setRecipesLoading] = useState(false)
  const [selectedQtys, setSelectedQtys] = useState({})
  const [showMenu, setShowMenu]       = useState(false)
  const [processing, setProcessing]   = useState(false)
  const [success, setSuccess]         = useState('')
  const [error, setError]             = useState('')

  const fetchRecipes = useCallback(async () => {
    if (!localId) return
    setRecipesLoading(true)
    try {
      const data = await apiRequest(`/recipes?local_id=${localId}&is_active=true`)
      const list = Array.isArray(data) ? data : []
      setRecipes(list)
      // Group by category name
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

  const totalItems = Object.values(selectedQtys).reduce((s, q) => s + q, 0)

  const subtotal = Object.entries(selectedQtys).reduce((s, [id, qty]) => {
    const r = recipes.find(r => String(r.id) === id)
    return s + (r?.price_sale || 0) * qty
  }, 0)

  const orderTotal = (detail?.active_orders || []).reduce((sum, order) =>
    sum + (order.items || []).reduce((s, i) => s + i.total_price, 0), 0)

  const handleQty = (id, qty) => {
    setSelectedQtys(prev => {
      const next = { ...prev }
      if (qty <= 0) delete next[id]
      else next[id] = qty
      return next
    })
  }

  const handleConfirm = async () => {
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
      await createOrder({ local_id: localId, mesa_id: mesa.id, source: 'dine-in', payment_method: 'CASH', items })
      setSuccess('✓ Orden creada correctamente')
      setSelectedQtys({})
      setShowMenu(false)
      refresh()
      onTableUpdated?.()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err?.message || 'Error al crear la orden')
    } finally {
      setProcessing(false)
    }
  }

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
                Total: ${orderTotal.toLocaleString('es-CL')}
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
                    <div className="flex items-center justify-between px-4 py-2 bg-[hsl(var(--accent))]">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                        Orden {idx + 1}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[order.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel[order.status] || order.status}
                      </span>
                    </div>
                    <div className="divide-y divide-[hsl(var(--border))]">
                      {(order.items || []).map(item => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-5 h-5 flex items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-bold">
                              {item.quantity}
                            </span>
                            <span className="text-sm text-[hsl(var(--foreground))]">{item.product_name}</span>
                          </div>
                          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                            ${item.total_price?.toLocaleString('es-CL')}
                          </span>
                        </div>
                      ))}
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
                    {totalItems} plato{totalItems !== 1 ? 's' : ''} · ${subtotal.toLocaleString('es-CL')}
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
                                <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                                  {recipe.name}
                                </p>
                                {recipe.description && (
                                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{recipe.description}</p>
                                )}
                                <p className="text-xs font-semibold text-[hsl(var(--primary))] mt-0.5">
                                  ${(recipe.price_sale || 0).toLocaleString('es-CL')}
                                </p>
                              </div>
                              {/* Qty control */}
                              <div className="flex items-center gap-2 shrink-0">
                                {qty > 0 && (
                                  <button
                                    onClick={() => handleQty(recipe.id, qty - 1)}
                                    className="w-7 h-7 rounded-full border border-[hsl(var(--border))] flex items-center justify-center text-sm font-bold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
                                  >
                                    −
                                  </button>
                                )}
                                {qty > 0 && (
                                  <span className="w-5 text-center text-sm font-bold text-[hsl(var(--primary))]">{qty}</span>
                                )}
                                <button
                                  onClick={() => handleQty(recipe.id, qty + 1)}
                                  className="w-7 h-7 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-sm font-bold hover:bg-[hsl(var(--primary))]/90 transition-colors"
                                >
                                  +
                                </button>
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
              <span className="font-bold text-[hsl(var(--primary))]">${subtotal.toLocaleString('es-CL')}</span>
            </div>
          )}
          <div className="flex gap-2 w-full justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowMenu(!showMenu); setError('') }} disabled={processing}>
              {showMenu ? '✕ Cerrar Menú' : '＋ Agregar del Menú'}
            </Button>
            {showMenu && totalItems > 0 && (
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={processing}
                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
              >
                {processing ? 'Confirmando...' : `Confirmar Orden · $${subtotal.toLocaleString('es-CL')}`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
