import { formatChileTime } from '../../../utils/chileDateTime'

export const STATUS_BADGE = {
  pending:   'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready:     'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
}

export const PAYMENT_STATUS_BADGE = {
  APPROVED:   'bg-green-100 text-green-700',
  REJECTED:   'bg-red-100 text-red-700',
  IN_PROCESS: 'bg-yellow-100 text-yellow-700',
  PENDING:    'bg-gray-100 text-gray-600',
  CANCELLED:  'bg-red-50 text-red-500',
}

export const PAYMENT_STATUS_LABEL = {
  APPROVED:   'Aprobado',
  REJECTED:   'Rechazado',
  IN_PROCESS: 'En Proceso',
  PENDING:    'Pendiente',
  CANCELLED:  'Cancelado',
}

export const STATUS_LABEL = {
  pending:   'Pendiente',
  preparing: 'Preparando',
  ready:     'En Cobro',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

export function fmt(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtTime(dateStr) {
  if (!dateStr) return '—'
  return formatChileTime(dateStr)
}

let _printInProgress = false

export function openPrintWindow({ mesa, firstOrder, allItems, subtotal, iva, total, label = 'BOLETA' }) {
  if (_printInProgress) return
  _printInProgress = true

  const now = new Date()
  const dateStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santiago' })
  const timeStr = formatChileTime(now.toISOString())
  const orderId = firstOrder?.id ? `#${String(firstOrder.id).slice(0, 8).toUpperCase()}` : '—'

  const itemsHTML = allItems.map(item => `
    <tr>
      <td>${item.quantity}</td>
      <td>${item.item_name || item.product_name || '—'}</td>
      <td class="right">$${(item.unit_price || 0).toLocaleString('es-CL')}</td>
      <td class="right">$${(item.total_price || 0).toLocaleString('es-CL')}</td>
    </tr>
  `).join('')

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${label} ${orderId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #111; width: 280px; padding: 8px; }
    h2 { font-size: 18px; text-align: center; }
    .center { text-align: center; margin-bottom: 4px; }
    hr { border: none; border-top: 1px solid #222; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding-bottom: 6px; font-size: 11px; }
    td { padding: 2px 0; vertical-align: top; }
    .right { text-align: right; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; }
    .total { font-weight: 700; font-size: 14px; }
    .small { font-size: 11px; margin-top: 6px; }
    @media print { @page { margin: 4mm; size: 72mm auto; } }
  </style>
</head>
<body>
  <div class="center">
    <h2>RESTAURANTE</h2>
    <p style="font-weight:700">${label}</p>
    <p style="font-family:monospace">${orderId}</p>
  </div>
  <hr/>
  <div class="row"><span>ATENCION:</span><span>${mesa.name || '—'}</span></div>
  <hr/>
  <table>
    <thead>
      <tr>
        <th>CANT</th>
        <th>DETALLE</th>
        <th class="right">P.UNIT</th>
        <th class="right">TOTAL</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <hr/>
  <div class="row"><span>Subtotal:</span><span>$ ${subtotal.toLocaleString('es-CL')}</span></div>
  <div class="row"><span>IVA 19%:</span><span>$ ${iva.toLocaleString('es-CL')}</span></div>
  <div class="row total"><span>TOTAL:</span><span>$ ${total.toLocaleString('es-CL')}</span></div>
  <p class="small">Fecha: ${dateStr} ${timeStr}</p>
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
      _printInProgress = false
      if (document.body.contains(iframe)) document.body.removeChild(iframe)
    }, 3000)
  }
}
