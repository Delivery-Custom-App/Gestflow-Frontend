import { useEffect, useRef, useState } from 'react'
import { createPointCharge, getPointOrderStatus, cancelPointCharge } from '../../lib/apiClient'
import { completeOrderCash } from '../../lib/salesApi'
import { isV2FeatureEnabled } from '../../lib/v2Features'

const ALL_METHODS = [
  { key: 'CASH',               label: 'Efectivo',          icon: '💵', desc: null },
  { key: 'MERCADOPAGO_POINT',  label: 'MercadoPago Point', icon: '🖥️', desc: 'Lector físico · Débito · Crédito' },
]

const METHODS = ALL_METHODS.filter(
  (m) => m.key !== 'MERCADOPAGO_POINT' || isV2FeatureEnabled('mercadopagoPoint'),
)

function fmt(n) {
  return `$${Number(n || 0).toLocaleString('es-CL')}`
}

export default function MercadoPagoModal({ open, orderId, total, description, onSuccess, onClose }) {
  const [step, setStep]               = useState('select')
  // steps: 'select' | 'cash_amount' | 'point_waiting' | 'point_success'
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [terminalMsg, setTerminalMsg] = useState('Conectando con la terminal...')
  const [paymentDetail, setPaymentDetail] = useState(null)
  const [chargeInfo, setChargeInfo] = useState(null)
  const [cashAmount, setCashAmount] = useState('')
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
    setLoading(false)
    setError(null)
    setTerminalMsg('Conectando con la terminal...')
    setPaymentDetail(null)
    setChargeInfo(null)
    setCashAmount('')
  }

  const handleClose = () => { reset(); onClose() }

  // ── Efectivo: registra monto recibido y calcula el vuelto ────────────────
  const cashReceivedNumber = Number(cashAmount) || 0
  const cashChange = cashReceivedNumber >= total ? cashReceivedNumber - total : 0

  const handleConfirmCash = async () => {
    if (!cashReceivedNumber || cashReceivedNumber < total) {
      setError(`El monto recibido debe ser al menos ${fmt(total)}`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await completeOrderCash(orderId, cashReceivedNumber)
      reset()
      onSuccess('CASH')
    } catch (err) {
      setError(err.message || 'Error al registrar el pago en efectivo')
      setLoading(false)
    }
  }

  // ── Point Smart 2 ─────────────────────────────────────────────────────────
  // Envía el cobro a la terminal apenas se elige el método — sin pantalla
  // intermedia de instrucciones manuales.
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

  const handleSelectMethod = async (method) => {
    if (method === 'MERCADOPAGO_POINT') {
      if (!isV2FeatureEnabled('mercadopagoPoint')) {
        setError('MercadoPago Point aún no está disponible en Backend V2')
        return
      }
      await handleSendToTerminal()
      return
    }
    if (method === 'CASH') {
      setStep('cash_amount')
      setError(null)
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
          setStep('select')
          return
        }

        if (s.payment_status === 'REJECTED') {
          stopPolling()
          setError('Pago rechazado por la terminal. Podés intentar de nuevo.')
          setStep('select')
          return
        }

        if (s.order_status === 'CANCELLED') {
          stopPolling()
          setError('La orden fue cancelada durante el cobro.')
          setStep('select')
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
      setStep('select')
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

          {/* ── Efectivo: monto recibido y vuelto ───────────────────────────── */}
          {step === 'cash_amount' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[hsl(var(--muted-foreground))]">Monto recibido</label>
                <input
                  type="number"
                  min={total}
                  autoFocus
                  value={cashAmount}
                  onChange={(e) => { setCashAmount(e.target.value); setError(null) }}
                  placeholder={fmt(total)}
                  className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-lg font-bold text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))]"
                />
              </div>

              <div className="flex gap-2">
                {[total, total + 1000, total + 2000, total + 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => { setCashAmount(String(Math.round(amt))); setError(null) }}
                    className="flex-1 py-1.5 rounded-lg border border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] transition-colors"
                  >
                    {fmt(amt)}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--accent))] px-4 py-3">
                <span className="text-sm text-[hsl(var(--muted-foreground))]">Vuelto</span>
                <span className="text-lg font-bold text-[hsl(var(--primary))]">{fmt(cashChange)}</span>
              </div>

              {error && <p className="text-xs text-red-600 text-center">{error}</p>}

              <button
                disabled={loading || !cashReceivedNumber}
                onClick={handleConfirmCash}
                className="w-full py-2.5 rounded-xl bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {loading ? 'Registrando...' : 'Confirmar pago en efectivo'}
              </button>
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
