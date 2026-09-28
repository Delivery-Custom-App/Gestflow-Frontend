/**
 * Comanda y boleta impresas desde el navegador.
 *
 * Backend V2 entrega los dos documentos como datos (`GET /orders/{id}/comanda`
 * y `/orders/{id}/boleta`), pero no tiene servicio de impresión ni registro de
 * impresoras: `/comandas/{id}/print` y `/printers` no existen. Así que el papel
 * lo arma el navegador — el usuario elige su impresora en el diálogo del
 * sistema, que es el que ya sabe hablar con ella.
 *
 * El ancho de 72 mm es el del rollo térmico habitual en punto de venta.
 */

const ANCHO_TICKET_MM = 72

const money = (valor) => `$${Number(valor || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`

/** Las cantidades vienen como decimal: 2 se ve "2" y 0.5 se ve "0,5". */
export function formatCantidad(cantidad) {
  const n = Number(cantidad || 0)
  return Number.isInteger(n) ? String(n) : n.toLocaleString('es-CL')
}

export function formatFechaTicket(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** El backend guarda el método en inglés; en el papel del cliente va en castellano. */
const METODOS = {
  cash: 'efectivo', card: 'tarjeta', debit: 'débito', credit: 'crédito',
  transfer: 'transferencia', mercadopago: 'MercadoPago', mercadopago_point: 'MercadoPago',
}

export function metodoPagoLegible(metodo) {
  if (!metodo) return null
  return METODOS[String(metodo).toLowerCase()] || String(metodo)
}

export function ordenCorta(orderId) {
  return `#${String(orderId || '').slice(0, 8).toUpperCase()}`
}

/** Evita que un nombre con < o & rompa el papel. */
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

const ESTILOS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: ${ANCHO_TICKET_MM - 8}mm; padding: 4mm; color: #000; }
  h1 { font-size: 16px; text-align: center; letter-spacing: 2px; }
  .centro { text-align: center; }
  .chico { font-size: 11px; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  td.cant { width: 32px; font-weight: bold; }
  td.der { text-align: right; white-space: nowrap; }
  .total { font-size: 14px; font-weight: bold; }
  @media print { @page { margin: 0; size: ${ANCHO_TICKET_MM}mm auto; } }
`

function documento(titulo, cuerpo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>${esc(titulo)}</title><style>${ESTILOS}</style></head><body>${cuerpo}</body></html>`
}

/** Comanda de cocina: qué preparar. Sin precios, por definición del backend. */
export function comandaHtml(comanda) {
  const items = Array.isArray(comanda?.items) ? comanda.items : []
  const filas = items.length
    ? items.map((i) => `<tr><td class="cant">${esc(formatCantidad(i.quantity))}x</td><td>${esc(i.product_name)}</td></tr>`).join('')
    : '<tr><td colspan="2">Sin ítems para preparar</td></tr>'

  return documento(`Comanda ${ordenCorta(comanda?.order_id)}`, `
    <div class="centro">
      <h1>COMANDA</h1>
      <p class="chico">${esc(comanda?.local_name || '')}</p>
      ${comanda?.mesa_nombre ? `<p><strong>${esc(comanda.mesa_nombre)}</strong></p>` : ''}
      <p class="chico">${esc(formatFechaTicket(comanda?.created_at))}</p>
      <p class="chico">Orden ${esc(ordenCorta(comanda?.order_id))}</p>
    </div>
    <hr/>
    <table><tbody>${filas}</tbody></table>
    <hr/>
  `)
}

/** Boleta: lo que se le entrega al cliente, con precios e IVA incluido. */
export function boletaHtml(boleta) {
  const items = Array.isArray(boleta?.items) ? boleta.items : []
  const filas = items.map((i) => `
    <tr>
      <td class="cant">${esc(formatCantidad(i.quantity))}x</td>
      <td>${esc(i.product_name)}</td>
      <td class="der">${esc(money(i.subtotal))}</td>
    </tr>`).join('') || '<tr><td colspan="3">Sin ítems</td></tr>'

  return documento(`Boleta ${ordenCorta(boleta?.order_id)}`, `
    <div class="centro">
      <h1>${esc(boleta?.business_name || 'BOLETA')}</h1>
      ${boleta?.business_rut ? `<p class="chico">RUT ${esc(boleta.business_rut)}</p>` : ''}
      <p class="chico">${esc(boleta?.local_name || '')}</p>
      ${boleta?.local_address ? `<p class="chico">${esc(boleta.local_address)}</p>` : ''}
      ${boleta?.mesa_nombre ? `<p class="chico">${esc(boleta.mesa_nombre)}</p>` : ''}
      <p class="chico">${esc(formatFechaTicket(boleta?.created_at))}</p>
      <p class="chico">Orden ${esc(ordenCorta(boleta?.order_id))}</p>
    </div>
    <hr/>
    <table><tbody>${filas}</tbody></table>
    <hr/>
    <table><tbody>
      <tr><td class="total">TOTAL</td><td class="der total">${esc(money(boleta?.total))}</td></tr>
      <tr><td class="chico">Neto</td><td class="der chico">${esc(money(boleta?.net_amount))}</td></tr>
      <tr><td class="chico">IVA incluido (19%)</td><td class="der chico">${esc(money(boleta?.iva_amount))}</td></tr>
    </tbody></table>
    <hr/>
    <p class="centro chico">${boleta?.payment_method ? `Pagado con ${esc(metodoPagoLegible(boleta.payment_method))}` : 'Sin método de pago registrado'}</p>
    <p class="centro chico">¡Gracias por su compra!</p>
  `)
}

/**
 * Manda el papel al diálogo de impresión del navegador. Se usa un iframe
 * oculto en vez de una ventana nueva porque los bloqueadores de popups la
 * cierran, y porque así la página del POS no pierde el foco ni su estado.
 */
export function imprimirEnNavegador(html, { document: doc = document } = {}) {
  const iframe = doc.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:none;opacity:0'
  doc.body.appendChild(iframe)

  const interno = iframe.contentDocument || iframe.contentWindow?.document
  if (!interno) { iframe.remove(); return false }
  interno.open()
  interno.write(html)
  interno.close()

  const ventana = iframe.contentWindow
  const lanzar = () => {
    try {
      ventana.focus()
      ventana.print()
    } finally {
      // Se retira después del diálogo: quitarlo antes cancela la impresión.
      setTimeout(() => iframe.remove(), 1000)
    }
  }
  if (interno.readyState === 'complete') lanzar()
  else iframe.addEventListener('load', lanzar, { once: true })
  return true
}
