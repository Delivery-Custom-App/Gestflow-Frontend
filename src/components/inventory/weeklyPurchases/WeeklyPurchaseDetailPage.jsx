import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../../hooks/useSelectedLocal'
import { useLocalBusinessId } from '../../../hooks/useLocalBusinessId'
import {
  getSupplierDetailForBusiness,
  deleteWeeklyPurchaseOrder,
  getWeeklyPurchaseOrder,
  patchWeeklyPurchaseLineReception,
  patchWeeklyPurchaseOrder,
} from '../../../lib/providersApi'
import { getInventoryStockList, patchInventoryStock } from '../../../lib/inventoryApi'
import { useAuth } from '../../../context/AuthContext'
import { formatCLPDisplay as formatMoneyClp } from '../../../lib/formatCLP'
import InventoryShell from '../InventoryShell'
import LoadingSpinner from '../../LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_LABELS = {
  draft: 'Borrador',
  sent: 'Enviada',
  in_transit: 'En tránsito',
  partially_received: 'Recepción parcial',
  received: 'Recibida',
  cancelled: 'Anulada',
}

const STATUS_VARIANT = {
  draft: 'secondary',
  sent: 'info',
  in_transit: 'warning',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'destructive',
}

function WeeklyPurchaseDetailPage() {
  const { isInventoryAdmin: canAccess } = useAuth()
  const navigate = useNavigate()
  const { localId, orderId } = useParams()
  const selectedLocal = useSelectedLocal(localId)

  const [businessId, setBusinessId] = useState(null)
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [supplierName, setSupplierName] = useState('')

  const [statusEdit, setStatusEdit] = useState('draft')
  const [savingStatus, setSavingStatus] = useState(false)

  const [recvInputs, setRecvInputs] = useState({})
  const [markingDelivered, setMarkingDelivered] = useState(false)

  const resolveBusiness = useLocalBusinessId(localId)

  const load = useCallback(async () => {
    if (!orderId || !businessId) {
      setOrder(null)
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await getWeeklyPurchaseOrder(orderId, businessId)
      setOrder(data && typeof data === 'object' ? data : null)
      if (data?.status) setStatusEdit(data.status)
      const items = Array.isArray(data?.items) ? data.items : []
      const recv = {}
      for (const it of items) {
        recv[String(it.id)] = String(it.quantity_received ?? '')
      }
      setRecvInputs(recv)
    } catch (e) {
      setOrder(null)
      setError(e?.message || 'No se pudo cargar la orden.')
    } finally {
      setLoading(false)
    }
  }, [orderId, businessId])

  useEffect(() => {
    if (!canAccess || !localId) {
      setBusinessId(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const bid = await resolveBusiness()
        if (!cancelled) setBusinessId(bid)
      } catch {
        if (!cancelled) setBusinessId(null)
      }
    })()
    return () => { cancelled = true }
  }, [localId, canAccess, resolveBusiness])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!order?.supplier_id || !businessId) {
      setSupplierName('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const detail = await getSupplierDetailForBusiness(order.supplier_id, businessId)
        if (!cancelled) setSupplierName(detail?.name ? String(detail.name) : String(order.supplier_id))
      } catch {
        if (!cancelled) setSupplierName(String(order.supplier_id))
      }
    })()
    return () => { cancelled = true }
  }, [order?.supplier_id, businessId])

  const applyStatus = async () => {
    if (!businessId || !orderId) return
    setSavingStatus(true)
    setActionError('')
    try {
      const updated = await patchWeeklyPurchaseOrder(orderId, businessId, { status: statusEdit })
      setOrder(updated)
    } catch (e) {
      setActionError(e?.message || 'No se pudo actualizar el estado.')
    } finally {
      setSavingStatus(false)
    }
  }

  const removeDraft = async () => {
    if (!businessId || !orderId || order?.status !== 'draft') return
    if (!window.confirm('¿Eliminar esta orden en borrador?')) return
    setActionError('')
    try {
      await deleteWeeklyPurchaseOrder(orderId, businessId)
      navigate(`/local/${localId}/inventario/compras-semanales`, { state: { local: selectedLocal } })
    } catch (e) {
      setActionError(e?.message || 'No se pudo eliminar.')
    }
  }

  const markAsDelivered = async () => {
    if (!businessId || !orderId || !localId || !order) return
    if (!window.confirm('¿Marcar como entregada? El stock de cada producto se sumará con la cantidad pedida.')) return
    setMarkingDelivered(true)
    setActionError('')
    try {
      // Obtener inventario actual del local para mapear product_id → inventory_id + stock_current
      const invList = await getInventoryStockList(localId, {})
      const invByProduct = {}
      for (const row of (Array.isArray(invList) ? invList : [])) {
        if (row.product_id) invByProduct[String(row.product_id)] = row
      }

      const items = Array.isArray(order.items) ? order.items : []
      const warnings = []

      for (const item of items) {
        const inv = invByProduct[String(item.product_id)]
        if (!inv?.inventory_id) {
          warnings.push(`"${item.product_name_snapshot || item.product_id}" no encontrado en inventario — omitido`)
          continue
        }
        const newStock = (Number(inv.stock_current) || 0) + (Number(item.quantity_ordered) || 0)
        await patchInventoryStock(localId, inv.inventory_id, { stock: newStock })
      }

      const updated = await patchWeeklyPurchaseOrder(orderId, businessId, { status: 'received' })
      setOrder(updated)

      if (warnings.length > 0) {
        setActionError(`Entregado con advertencias: ${warnings.join(' • ')}`)
      }
    } catch (e) {
      setActionError(e?.message || 'No se pudo marcar como entregado.')
    } finally {
      setMarkingDelivered(false)
    }
  }

  const registerReception = async (itemId) => {
    if (!businessId || !orderId || !itemId) return
    const raw = recvInputs[String(itemId)]
    const qty = raw === '' || raw == null ? 0 : Number(raw)
    if (Number.isNaN(qty) || qty < 0) {
      setActionError('Cantidad recibida inválida.')
      return
    }
    setActionError('')
    try {
      const updated = await patchWeeklyPurchaseLineReception(orderId, itemId, businessId, qty)
      setOrder(updated)
      const items = Array.isArray(updated?.items) ? updated.items : []
      const recv = {}
      for (const it of items) {
        recv[String(it.id)] = String(it.quantity_received ?? '')
      }
      setRecvInputs(recv)
    } catch (e) {
      setActionError(e?.message || 'No se pudo registrar la recepción.')
    }
  }

  const selectClass = 'h-9 rounded-md border border-[hsl(var(--border))] bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'

  return (
    <InventoryShell>
      <div className="flex flex-col gap-6 px-6 py-6 pb-10">
        <button
          type="button"
          onClick={() => navigate(`/local/${localId}/inventario/compras-semanales`, { state: { local: selectedLocal } })}
          className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors self-start"
        >
          <ChevronLeft size={16} />
          Volver a compras semanales
        </button>

        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Orden de compra semanal</h1>
            {order ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] text-sm font-bold tracking-wide">
                  {supplierName || order.supplier_id}
                </span>
              </div>
            ) : (
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Cargando…</span>
            )}
          </div>
          {order && (
            <div className="flex items-center gap-2.5 shrink-0 mt-1">
              <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'}>
                {STATUS_LABELS[order.status] || order.status}
              </Badge>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                Total estimado: <strong className="text-[hsl(var(--primary))]">{formatMoneyClp(order.total_estimated_clp)}</strong>
              </span>
            </div>
          )}
        </header>

        {!canAccess ? (
          <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">No tienes permisos.</p>
        ) : null}

        {actionError ? (
          <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
            {actionError}
          </p>
        ) : null}

        {loading ? <LoadingSpinner message="Cargando orden…" /> : null}

        {!loading && error ? (
          <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</p>
        ) : null}

        {!loading && order && !error ? (
          <>

            {/* Banner demo */}
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-800 text-sm">
              <span className="font-bold shrink-0">⚠ Demo</span>
              <span>Esta sección está en desarrollo. Las acciones a continuación son funcionales pero la interfaz es preliminar.</span>
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap gap-3 items-center">
              {order.status === 'draft' && (
                <Button type="button" variant="destructive" onClick={() => removeDraft()}>
                  Eliminar Borrador
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => window.print()} title="Demo — impresión no implementada">
                Imprimir Borrador
              </Button>
              {order.status !== 'received' && order.status !== 'cancelled' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={markAsDelivered}
                  disabled={markingDelivered}
                >
                  {markingDelivered ? 'Actualizando stock…' : 'Marcar como entregado'}
                </Button>
              )}
            </div>

            <div className="rounded-md border border-[hsl(var(--border))] overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Precio unit.</TableHead>
                    <TableHead>Subtotal</TableHead>
                    {order.status !== 'draft' ? <TableHead>Recibido</TableHead> : null}
                    {order.status !== 'draft' ? <TableHead>Acción</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(order.items || []).map((it) => (
                    <TableRow key={String(it.id)}>
                      <TableCell className="font-medium">{it.product_name_snapshot || it.product_id || '—'}</TableCell>
                      <TableCell>{it.quantity_ordered}</TableCell>
                      <TableCell>{formatMoneyClp(it.unit_price_clp)}</TableCell>
                      <TableCell>{formatMoneyClp(it.line_total_estimated_clp)}</TableCell>
                      {order.status !== 'draft' ? (
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={recvInputs[String(it.id)] ?? ''}
                            onChange={(ev) =>
                              setRecvInputs((prev) => ({ ...prev, [String(it.id)]: ev.target.value }))
                            }
                            onKeyDown={(ev) => ['e', 'E', '+', '-'].includes(ev.key) && ev.preventDefault()}
                            aria-label="Cantidad recibida"
                            className="w-24"
                          />
                        </TableCell>
                      ) : null}
                      {order.status !== 'draft' ? (
                        <TableCell>
                          <Button type="button" variant="outline" size="sm" onClick={() => registerReception(it.id)}>
                            Registrar
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}
      </div>
    </InventoryShell>
  )
}

export default WeeklyPurchaseDetailPage
