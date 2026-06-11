import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  createSplitPayment,
  deleteSplitPayment,
  getSplitPaymentSummary,
  updateSplitPayment,
} from '../../lib/apiClient'

const PAYMENT_METHODS = [
  { value: 'CASH',     label: 'Efectivo' },
  { value: 'CARD',     label: 'Tarjeta' },
  { value: 'DEBIT',    label: 'Débito' },
  { value: 'CREDIT',   label: 'Crédito' },
  { value: 'TRANSFER', label: 'Transferencia' },
]

const STATUS_BADGE = {
  PENDING:    'bg-gray-100 text-gray-600',
  APPROVED:   'bg-green-100 text-green-700',
  REJECTED:   'bg-red-100 text-red-700',
  IN_PROCESS: 'bg-yellow-100 text-yellow-700',
  CANCELLED:  'bg-red-50 text-red-500',
}

const STATUS_LABEL = {
  PENDING:    'Pendiente',
  APPROVED:   'Aprobado',
  REJECTED:   'Rechazado',
  IN_PROCESS: 'En Proceso',
  CANCELLED:  'Cancelado',
}

function fmt(n) {
  return Number(n || 0).toLocaleString('es-CL')
}

export default function MultiPaymentModal({ order, orderTotal, onClose, onFullyPaid }) {
  const [summary, setSummary]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [newAmount, setNewAmount]   = useState('')
  const [newMethod, setNewMethod]   = useState('CASH')
  const [newLabel, setNewLabel]     = useState('')

  const loadSummary = useCallback(async () => {
    try {
      const data = await getSplitPaymentSummary(order.id)
      setSummary(data)
      setError('')
    } catch (err) {
      setError(err.message || 'Error cargando pagos')
    } finally {
      setLoading(false)
    }
  }, [order.id])

  useEffect(() => { loadSummary() }, [loadSummary])

  // Auto-notify parent when fully paid
  useEffect(() => {
    if (summary?.is_fully_paid) onFullyPaid?.()
  }, [summary?.is_fully_paid, onFullyPaid])

  const handleAdd = async () => {
    const amt = parseFloat(newAmount)
    if (!amt || amt <= 0) { setError('Ingresa un monto válido'); return }
    setSaving(true)
    setError('')
    try {
      const label = newLabel.trim() || `Comensal ${(summary?.splits?.length || 0) + 1}`
      await createSplitPayment(order.id, {
        comensal_label: label,
        amount: amt,
        payment_method: newMethod,
      })
      setNewAmount('')
      setNewLabel('')
      setNewMethod('CASH')
      await loadSummary()
    } catch (err) {
      setError(err.message || 'Error al agregar')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (splitId) => {
    setSaving(true)
    setError('')
    try {
      await updateSplitPayment(splitId, { payment_status: 'APPROVED' })
      await loadSummary()
    } catch (err) {
      setError(err.message || 'Error al aprobar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (splitId) => {
    setSaving(true)
    setError('')
    try {
      await deleteSplitPayment(splitId)
      await loadSummary()
    } catch (err) {
      setError(err.message || 'Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  const splits    = summary?.splits || []
  const remaining = summary?.remaining ?? orderTotal
  const approved  = summary?.total_approved ?? 0
  const assigned  = summary?.total_assigned ?? 0
  const isFull    = summary?.is_fully_paid ?? false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
          <div>
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Dividir Pago</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Total de la orden: <span className="font-bold">${fmt(orderTotal)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))] mb-1">
            <span>Aprobado: ${fmt(approved)}</span>
            <span>Pendiente: ${fmt(remaining)}</span>
          </div>
          <div className="w-full h-2 bg-[hsl(var(--accent))] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${Math.min(100, orderTotal > 0 ? (approved / orderTotal) * 100 : 0)}%` }}
            />
          </div>
          {isFull && (
            <p className="mt-2 text-center text-sm font-medium text-green-600">
              ✓ Pago completo — mesa lista para cerrar
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Splits list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : splits.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
              No hay pagos registrados. Agrega comensales abajo.
            </p>
          ) : (
            splits.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between bg-[hsl(var(--accent))] rounded-xl px-4 py-3 gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{s.comensal_label}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {PAYMENT_METHODS.find(m => m.value === s.payment_method)?.label || s.payment_method}
                    {s.external_transaction_id && (
                      <span className="ml-1 font-mono">· MP {s.external_transaction_id.slice(0, 8)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-[hsl(var(--foreground))]">${fmt(s.amount)}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[s.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[s.payment_status] || s.payment_status}
                  </span>
                  {s.payment_status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleApprove(s.id)}
                        disabled={saving}
                        className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                        title="Marcar como pagado"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={saving}
                        className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg disabled:opacity-50"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add new split */}
        {!isFull && (
          <div className="px-6 py-4 border-t border-[hsl(var(--border))] space-y-3">
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Agregar comensal</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre (opcional)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder={`Monto (max $${fmt(remaining)})`}
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                min={1}
                max={remaining}
                className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
              <select
                value={newMethod}
                onChange={e => setNewMethod(e.target.value)}
                className="text-sm px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <Button
                onClick={handleAdd}
                disabled={saving || !newAmount}
                className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90"
                size="sm"
              >
                + Agregar
              </Button>
            </div>
            {/* Quick-fill remaining */}
            {remaining > 0 && assigned < orderTotal && (
              <button
                onClick={() => setNewAmount(String(remaining))}
                className="text-xs text-[hsl(var(--primary))] hover:underline"
              >
                Autocompletar con ${fmt(remaining)} restante
              </button>
            )}
          </div>
        )}

        {/* Summary footer */}
        <div className="px-6 pb-4 flex justify-between items-center text-sm border-t border-[hsl(var(--border))] pt-3">
          <div className="text-[hsl(var(--muted-foreground))] space-y-0.5">
            <p>Asignado: <span className="font-medium text-[hsl(var(--foreground))]">${fmt(assigned)}</span></p>
            <p>Aprobado: <span className="font-medium text-green-600">${fmt(approved)}</span></p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

      </div>
    </div>
  )
}
