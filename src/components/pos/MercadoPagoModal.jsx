import { useState } from 'react'
import { apiRequest } from '../../lib/apiClient'

const METHODS = [
  { key: 'CASH',        label: 'Efectivo',   icon: '💵', desc: null },
  { key: 'CARD',        label: 'Tarjeta',    icon: '💳', desc: null },
  { key: 'MERCADOPAGO', label: 'MercadoPago', icon: '🔵', desc: 'QR · Link de pago · Cuotas' },
]

function fmt(n) {
  return `$${Number(n || 0).toLocaleString('es-CL')}`
}

export default function MercadoPagoModal({ open, orderId, total, onSuccess, onClose }) {
  const [step, setStep]             = useState('select')  // 'select' | 'mp_checkout' | 'mp_demo' | 'processing'
  const [checkoutUrl, setCheckoutUrl] = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  if (!open) return null

  const reset = () => {
    setStep('select')
    setCheckoutUrl(null)
    setLoading(false)
    setError(null)
  }

  const handleClose = () => { reset(); onClose() }

  const simulateAndComplete = async (method) => {
    setLoading(true)
    setError(null)
    try {
      await apiRequest('/orders/checkout/complete', {
        method: 'POST',
        body: { order_id: orderId, payment_method: method },
      })
      reset()
      onSuccess(method)
    } catch (err) {
      setError(err.message || 'Error al procesar el pago')
      setLoading(false)
    }
  }

  const handleSelectMethod = async (method) => {
    if (method !== 'MERCADOPAGO') {
      await simulateAndComplete(method)
      return
    }

    // Intenta crear preferencia real en MP
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest('/orders/checkout/init', {
        method: 'POST',
        body: { order_id: orderId },
      })
      setCheckoutUrl(data.sandbox_init_point)
      setStep('mp_checkout')
    } catch {
      // Sin credenciales MP → modo demo directo
      setStep('mp_demo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl w-full max-w-sm mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
          <div>
            <h2 className="font-semibold text-[hsl(var(--foreground))] text-sm">Método de Pago</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Total: <span className="font-bold text-[hsl(var(--foreground))]">{fmt(total)}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">

          {/* ── Selección de método ── */}
          {step === 'select' && (
            <>
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  disabled={loading}
                  onClick={() => handleSelectMethod(m.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] transition-colors text-left disabled:opacity-50"
                >
                  <span className="text-2xl">{m.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{m.label}</p>
                    {m.desc && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{m.desc}</p>
                    )}
                  </div>
                  {loading && m.key === 'MERCADOPAGO' && (
                    <div className="ml-auto w-4 h-4 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              ))}
              {error && (
                <p className="text-xs text-red-600 text-center pt-1">{error}</p>
              )}
            </>
          )}

          {/* ── MP con link de checkout real ── */}
          {step === 'mp_checkout' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-blue-900 mb-1">🔵 Checkout MercadoPago</p>
                <p className="text-xs text-blue-700 mb-3">
                  Abre el link en el dispositivo del cliente para que complete el pago.
                </p>
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Abrir Checkout →
                </a>
              </div>

              <div className="border-t border-[hsl(var(--border))] pt-3 text-center space-y-2">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Modo sandbox / demo — simula la aprobación:
                </p>
                <button
                  disabled={loading}
                  onClick={() => simulateAndComplete('MERCADOPAGO')}
                  className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Procesando...' : '✓ Simular Pago Aprobado'}
                </button>
              </div>
              {error && <p className="text-xs text-red-600 text-center">{error}</p>}
            </div>
          )}

          {/* ── MP sin credenciales: demo directo ── */}
          {step === 'mp_demo' && (
            <div className="space-y-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-yellow-800 mb-1">⚠ MercadoPago — Modo Demo</p>
                <p className="text-xs text-yellow-700">
                  No hay credenciales MP configuradas. Simula el cobro para demostrar el flujo completo.
                </p>
              </div>
              <button
                disabled={loading}
                onClick={() => simulateAndComplete('MERCADOPAGO')}
                className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {loading ? 'Procesando...' : '✓ Simular Pago Aprobado'}
              </button>
              {error && <p className="text-xs text-red-600 text-center">{error}</p>}
            </div>
          )}
        </div>

        {step !== 'select' && (
          <div className="px-6 pb-4">
            <button
              onClick={() => { setStep('select'); setError(null) }}
              disabled={loading}
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline"
            >
              ← Volver a métodos
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
