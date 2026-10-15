import { useState, useRef } from 'react'
import { addOrderItem, createOrder } from '../../lib/salesApi'
import { nuevaClaveIdempotencia } from '../../lib/idempotency'
import { useCajaActiva } from '../../hooks/useCajaActiva'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Modal para agregar productos extras a una orden.
 * Si no existe orden, la crea automáticamente.
 */
export default function AddProductModal({ orderId, mesaId, localId, onClose, onProductAdded, products = [] }) {
  const [actualOrderId, setActualOrderId] = useState(orderId)
  const { cajaId } = useCajaActiva(localId)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [localError, setLocalError] = useState(null)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const idempotencyActionRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)

    if (!selectedProduct) {
      setLocalError('Selecciona un producto')
      return
    }

    if (!quantity || quantity <= 0) {
      setLocalError('Cantidad debe ser mayor a 0')
      return
    }

    if (!actualOrderId && (!mesaId || !localId)) {
      setLocalError('Datos de mesa/local faltantes')
      return
    }

    const action = idempotencyActionRef.current || {
      key: nuevaClaveIdempotencia(),
      createsOrder: !actualOrderId,
    }
    idempotencyActionRef.current = action
    setLocalError(null)
    setSubmitting(true)

    try {
      let targetOrderId = actualOrderId
      let itemKey = action.key

      if (action.createsOrder) {
        itemKey = `${action.key}:item:0`
        if (!targetOrderId) {
          setCreatingOrder(true)
          const newOrder = await createOrder({
            local_id: localId,
            mesa_id: mesaId,
            caja_id: cajaId || null,
            source: 'dine_in',
            items: [],
            idempotency_key: action.key,
          })
          targetOrderId = newOrder.id
          setActualOrderId(targetOrderId)
        }
      }

      const newItem = await addOrderItem(targetOrderId, {
        product_id: selectedProduct.id,
        quantity,
      }, undefined, itemKey)
      if (onProductAdded) onProductAdded(newItem)
      setSelectedProduct(null)
      setQuantity(1)
      idempotencyActionRef.current = null
      onClose()
    } catch (err) {
      setLocalError(err.message || 'Error al agregar producto')
    } finally {
      setCreatingOrder(false)
      setSubmitting(false)
    }
  }

  const isLoading = submitting

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar Producto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Producto */}
          <div className="space-y-1.5">
            <Label htmlFor="product-select">Producto</Label>
            <select
              id="product-select"
              value={selectedProduct ? selectedProduct.id : ''}
              onChange={(e) => {
                const product = products.find((p) => String(p.id) === e.target.value)
                setSelectedProduct(product)
              }}
              disabled={isLoading}
              required
              className="w-full h-9 text-sm rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 disabled:opacity-50"
            >
              <option value="">-- Seleccionar --</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad */}
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isLoading}
              required
              className="h-9"
            />
          </div>

          {/* Error */}
          {localError && (
            <p className="text-xs text-[hsl(var(--destructive))] bg-red-50 border border-red-200 rounded px-3 py-2">
              {localError}
            </p>
          )}

          {/* Status */}
          {creatingOrder && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Creando orden...</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
            >
              {creatingOrder ? 'Creando orden...' : submitting ? 'Agregando...' : 'Agregar Producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
