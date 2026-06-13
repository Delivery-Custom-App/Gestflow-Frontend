import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/apiClient'

function printComandaMP({ orderId, items, total }) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('es-CL')
  const orderLabel = `#${orderId.slice(0, 8).toUpperCase()}`

  const itemsHTML = (items || []).map(item => `
    <tr>
      <td class="qty">${item.quantity}x</td>
      <td>${item.item_name || item.product_name || '—'}</td>
      <td class="right">$${(item.total_price || 0).toLocaleString('es-CL')}</td>
    </tr>
  `).join('') || `<tr><td colspan="3">Pedido ${orderLabel}</td></tr>`

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Comanda ${orderLabel}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Courier New',monospace; font-size:13px; width:280px; padding:10px; }
    h2 { font-size:18px; text-align:center; letter-spacing:2px; }
    .center { text-align:center; margin-bottom:4px; }
    hr { border:none; border-top:1px solid #222; margin:8px 0; }
    table { width:100%; border-collapse:collapse; }
    td { padding:3px 0; vertical-align:top; }
    td.qty { width:28px; font-weight:bold; }
    td.right { text-align:right; }
    .badge { display:inline-block; border:2px solid #000; padding:3px 12px; font-weight:bold; font-size:15px; margin-top:8px; }
    .mp { color:#009EE3; font-weight:bold; }
    @media print { @page { margin:4mm; size:72mm auto; } }
  </style>
</head>
<body>
  <div class="center">
    <h2>COMANDA</h2>
    <p>${dateStr} ${timeStr}</p>
    <p>Orden: ${orderLabel}</p>
  </div>
  <hr/>
  <p class="mp center">🔵 Pagado con MercadoPago</p>
  <hr/>
  <table><tbody>${itemsHTML}</tbody></table>
  <hr/>
  <div class="center">
    <p>Total: <strong>$${Number(total || 0).toLocaleString('es-CL')}</strong></p>
    <span class="badge">✓ APROBADO</span>
  </div>
  <script>window.onload=function(){ window.print(); }</script>
</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:none;opacity:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument || iframe.contentWindow.document
  doc.open()
  doc.write(html)
  doc.close()
  iframe.onload = () => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe)
    }, 3000)
  }
}

export default function MercadoPagoReturn() {
  const [state, setState] = useState(null) // null | 'processing' | 'success' | 'failure' | 'pending'
  const [orderId, setOrderId] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mpStatus  = params.get('mp_status')
    const mpOrderId = params.get('mp_order_id')
    if (!mpStatus || !mpOrderId) return

    // Limpiar URL sin recargar
    const clean = window.location.pathname
    window.history.replaceState({}, '', clean)

    setOrderId(mpOrderId)

    if (mpStatus === 'approved') {
      setState('processing')
      // Cerrar la orden y obtener detalle para la comanda
      Promise.all([
        apiRequest('/orders/checkout/complete', {
          method: 'POST',
          body: { order_id: mpOrderId, payment_method: 'MERCADOPAGO' },
        }),
        apiRequest(`/orders/${mpOrderId}/summary`).catch(() => null),
      ])
        .then(([, summary]) => {
          setState('success')
          const items  = summary?.items  || []
          const total  = summary?.total  || 0
          printComandaMP({ orderId: mpOrderId, items, total })
        })
        .catch(() => setState('success')) // igual mostramos éxito aunque el print falle
    } else if (mpStatus === 'failure') {
      setState('failure')
    } else {
      setState('pending')
    }
  }, [])

  if (!state) return null

  const close = () => setState(null)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center space-y-4">
        {state === 'processing' && (
          <>
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-gray-700">Registrando pago MercadoPago...</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="text-6xl">✅</div>
            <h2 className="text-lg font-bold text-green-700">¡Pago aprobado!</h2>
            <p className="text-sm text-gray-500">
              La orden quedó cerrada y la comanda se está imprimiendo.
            </p>
            <p className="text-xs text-gray-400 font-mono">#{orderId?.slice(0, 8).toUpperCase()}</p>
            <button
              onClick={close}
              className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors"
            >
              Volver al POS
            </button>
          </>
        )}

        {state === 'failure' && (
          <>
            <div className="text-6xl">❌</div>
            <h2 className="text-lg font-bold text-red-600">Pago rechazado</h2>
            <p className="text-sm text-gray-500">El pago no fue aprobado por MercadoPago. Intenta con otro método.</p>
            <button onClick={close} className="w-full py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm">
              Volver al POS
            </button>
          </>
        )}

        {state === 'pending' && (
          <>
            <div className="text-6xl">⏳</div>
            <h2 className="text-lg font-bold text-yellow-600">Pago pendiente</h2>
            <p className="text-sm text-gray-500">MercadoPago está procesando el pago. Te notificaremos cuando se confirme.</p>
            <button onClick={close} className="w-full py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm">
              Entendido
            </button>
          </>
        )}
      </div>
    </div>
  )
}
