import { useEffect, useRef, useState } from 'react'
import { apiRequest, createPointCharge, getPointOrderStatus, cancelPointCharge } from '../../lib/apiClient'

const METHODS = [
  { key: 'CASH',               label: 'Efectivo',          icon: '💵', desc: null },
  { key: 'CARD',               label: 'Tarjeta',           icon: '💳', desc: null },
  { key: 'MERCADOPAGO',        label: 'MercadoPago Checkout', icon: '🔵', desc: 'QR · Link de pago · Cuotas' },
  { key: 'MERCADOPAGO_POINT',  label: 'MercadoPago Point', icon: '🖥️', desc: 'Lector físico · Débito · Crédito' },
]

function fmt(n) {
  return `$${Number(n || 0).toLocaleString('es-CL')}`
}

export default function MercadoPagoModal({ open, orderId, total, description, onSuccess, onClose }) {
  const [step, setStep]               = useState('select')
  // steps: 'select' | 'mp_checkout' | 'mp_demo' | 'point_ready' | 'point_waiting' | 'point_success'
  const [checkoutUrl, setCheckoutUrl] = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [terminalMsg, setTerminalMsg] = useState('Conectando con la terminal...')
  const [paymentDetail, setPaymentDetail] = useState(null)
  const [chargeInfo, setChargeInfo] = useState(null)
  const pollRef = useRef(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  // Limpia el polling al desmontar o cerrar
  useEffect(() => () => stopPolling(), [])

  if (!open) return null

  const reset = () => {
    stopPolling()
    setStep('select')
    setCheckoutUrl(null)
    setLoading(false)
    setError(null)
    setTerminalMsg('Conectando con la terminal...')
    setPaymentDetail(null)
    setChargeInfo(null)
  }

  const handleClose = () => { reset(); onClose() }

  // ── Efectivo / Tarjeta / MP QR ────────────────────────────────────────────
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
    if (method === 'MERCADOPAGO_POINT') {
      setStep('point_ready')
      setError(null)
      return
    }
    if (method !== 'MERCADOPAGO') {
      await simulateAndComplete(method)
      return
    }
    // Checkout Pro
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
      setStep('mp_demo')
    } finally {
      setLoading(false)
    }
  }

  // ── Point Smart 2 ─────────────────────────────────────────────────────────
  const handleSendToTerminal = async () => {
    setLoading(true)
    setError(null)
    try {
      const charge = await createPointCharge(orderId, { amount: Math.round(total), description })
      setChargeInfo(charge || null)
      setStep('point_waiting')
      setTerminalMsg(charge?.message || 'Esperando que el cliente pase la tarjeta...')
      startPolling()
    } catch (err) {
      setError(err.message || 'Error al conectar con la terminal')
    } finally {
      setLoading(false)
    }
  }

  const startPolling = () => {
    stopPolling()

    const pollOnce = async () => {
      try {
        const s = await getPointOrderStatus(orderId)

        if (s.order_status === 'COMPLETED') {
          stopPolling()
          setPaymentDetail(s.payment_detail || null)
          setStep('point_success')
          return
        }

        if (s.point_charge_expired) {
          stopPolling()
          setError(
            `No detectamos el pago en la terminal. Verificá que cobraste exactamente ${fmt(total)} y volvé a enviar el cobro.`
          )
          setStep('point_ready')
          return
        }

        if (s.payment_status === 'REJECTED') {
          stopPolling()
          setError('Pago rechazado por la terminal. Podés intentar de nuevo.')
          setStep('point_ready')
          return
        }

        if (s.order_status === 'CANCELLED') {
          stopPolling()
          setError('La orden fue cancelada durante el cobro.')
          setStep('point_ready')
          return
        }

        setTerminalMsg(prev =>
          prev.endsWith('...') ? prev.slice(0, -3) : prev + '.'
        )
      } catch {
        // ignorar errores de red durante polling
      }
    }

    pollOnce()
    pollRef.current = setInterval(pollOnce, 3000)
  }

  const handleCancelPoint = async () => {
    stopPolling()
    setLoading(true)
    try {
      await cancelPointCharge(orderId)
    } catch {
      // ignorar — la orden puede ya haber expirado (TTL)
    } finally {
      setLoading(false)
      setStep('point_ready')
      setError(null)
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
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-xl leading-none disabled:opacity-30"
            disabled={step === 'point_waiting' || step === 'point_success'}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">

          {/* ── Selección ───────────────────────────────────────────────────── */}
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
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{m.label}</p>
                    {m.desc && <p className="text-xs text-[hsl(var(--muted-foreground))]">{m.desc}</p>}
                  </div>
                  {loading && (
                    <div className="w-4 h-4 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              ))}
              {error && <p className="text-xs text-red-600 text-center pt-1">{error}</p>}
            </>
          )}

          {/* ── Point: confirmar envío ───────────────────────────────────────── */}
          {step === 'point_ready' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-3xl mb-1">🖥️</p>
                <p className="text-sm font-semibold text-blue-900">Terminal MP Point</p>
                <p className="text-xs text-blue-700 mt-2">
                  1. En el lector Point, inicia un cobro manual
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  2. Ingresa exactamente <span className="font-bold">{fmt(total)}</span>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  3. Pide al cliente que pase su tarjeta
                </p>
                <p className="text-xs text-blue-400 mt-2">
                  Gestflow detectará el pago aprobado automáticamente.
                </p>
              </div>
              <button
                disabled={loading}
                onClick={handleSendToTerminal}
                className="w-full py-2.5 rounded-xl bg-[#009ee3] hover:bg-[#0082c0] text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Conectando...</>
                  : '📲 Iniciar cobro en Point'
                }
              </button>
              {error && <p className="text-xs text-red-600 text-center">{error}</p>}
            </div>
          )}

          {/* ── Point: esperando pago ──────────────────────────────────────── */}
          {step === 'point_waiting' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="text-sm font-semibold text-blue-900">Terminal activa</p>
                </div>
                {chargeInfo?.terminal_id && (
                  <p className="text-[11px] text-blue-500 pl-8 mb-1 font-mono break-all">
                    Terminal: {chargeInfo.terminal_id}
                  </p>
                )}
                <p className="text-xs text-blue-700 pl-8">{terminalMsg}</p>
                <p className="text-xs text-blue-400 pl-8 mt-1">
                  El cliente puede pagar con débito o crédito.
                </p>
              </div>
              <button
                disabled={loading}
                onClick={handleCancelPoint}
                className="w-full py-2 rounded-xl border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-50"
              >
                {loading ? 'Cancelando...' : 'Cancelar pago en terminal'}
              </button>
            </div>
          )}

          {/* ── MP Checkout Pro ───────────────────────────────────────────── */}
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
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Sandbox — simula la aprobación:</p>
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

          {/* ── Point: pago detectado ─────────────────────────────────────── */}
          {step === 'point_success' && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-2xl mb-1">✅</p>
                <p className="text-sm font-semibold text-green-900">Pago detectado</p>
                {paymentDetail && (
                  <div className="mt-3 text-left space-y-1">
                    <p className="text-xs text-green-800 font-medium">Tipo: <span className="font-bold">{paymentDetail.payment_type_id}</span></p>
                    <p className="text-xs text-green-800">Marca: <span className="font-bold">{paymentDetail.payment_method_id}</span></p>
                    <p className="text-xs text-green-800">Últimos 4: <span className="font-bold">**** {paymentDetail.card_last_four}</span></p>
                    <p className="text-xs text-green-800">Cuotas: <span className="font-bold">{paymentDetail.installments}</span></p>
                    <p className="text-xs text-green-800">Autorización: <span className="font-bold">{paymentDetail.authorization_code}</span></p>
                    <details className="mt-2">
                      <summary className="text-xs text-green-600 cursor-pointer">Ver JSON completo</summary>
                      <pre className="text-xs text-green-700 mt-1 bg-green-100 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">{JSON.stringify(paymentDetail, null, 2)}</pre>
                    </details>
                  </div>
                )}
              </div>
              <button
                onClick={() => { reset(); onSuccess(paymentDetail?.payment_type_id?.includes('debit') ? 'mercadopago_point_debit' : paymentDetail?.payment_type_id?.includes('credit') ? 'mercadopago_point_credit' : 'MERCADOPAGO_POINT') }}
                className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
              >
                Confirmar y cerrar
              </button>
            </div>
          )}

          {/* ── MP demo (sin credenciales) ────────────────────────────────── */}
          {step === 'mp_demo' && (
            <div className="space-y-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-yellow-800 mb-1">⚠ MercadoPago — Modo Demo</p>
                <p className="text-xs text-yellow-700">
                  No hay credenciales MP configuradas. Simula el cobro para demostrar el flujo.
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

        {/* Volver — deshabilitado mientras la terminal está activa */}
        {step !== 'select' && (
          <div className="px-6 pb-4">
            <button
              onClick={() => { stopPolling(); setStep('select'); setError(null) }}
              disabled={step === 'point_waiting' || step === 'point_success'}
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline disabled:opacity-30 disabled:no-underline"
            >
              ← Volver a métodos
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
