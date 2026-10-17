/**
 * Comprobante del cierre de un turno (T-55): caja, local, fecha y hora, quién
 * cerró, el resumen, lo contado (con el desglose si se contó por billetes), la
 * diferencia y la nota.
 *
 * Igual que la boleta y la comanda, el papel lo arma el navegador
 * (`imprimirEnNavegador`, de `ticketPrint`): el backend no guarda el comprobante
 * ni el desglose del conteo, así que solo se puede sacar al cerrar, con lo que
 * tiene la pantalla. «Descargar» baja el mismo documento como archivo, que
 * también se puede imprimir o guardar como PDF desde el navegador.
 */
import { CHILE_TZ, parseApiDate } from '../utils/chileDateTime'
import { documento, esc } from './ticketPrint'
import { formatCLP } from './formatCLP'
import { esCajaDigital } from './cierreCaja'
import { etiquetaDenominacion } from './efectivo'
import { textoDiferencia } from './arqueo'

const money = (valor) => (valor === null || valor === undefined ? '—' : `$${formatCLP(valor)}`)

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: CHILE_TZ,
})

/** «17/10/2026 18:30» en hora de Chile; vacío si no hay fecha. Se arma por partes: el separador de es-CL cambia entre navegadores. */
export function fechaHoraDelCierre(iso) {
  const d = parseApiDate(iso)
  if (!d) return ''
  const p = Object.fromEntries(FORMATO_FECHA_HORA.formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

/** Nombre del archivo que se descarga: «comprobante-cierre-caja-principal-2026-10-17.html». */
export function nombreDelComprobante({ caja, cerradoAt } = {}) {
  const d = parseApiDate(cerradoAt)
  const dia = d ? d.toLocaleDateString('en-CA', { timeZone: CHILE_TZ }) : ''
  const nombre = String(caja || 'caja')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return ['comprobante-cierre', nombre || 'caja', dia].filter(Boolean).join('-') + '.html'
}

const fila = (etiqueta, valor, clase = '') => `<tr><td>${esc(etiqueta)}</td><td class="der ${clase}">${esc(valor)}</td></tr>`

/**
 * El comprobante como documento listo para imprimir.
 * @param {object} datos
 * @param {string} datos.local nombre del local
 * @param {string} datos.caja nombre de la caja física
 * @param {string} [datos.tipo] 'fisica' | 'digital'
 * @param {string} [datos.turno] id del turno
 * @param {string} [datos.vendedor] de quién era el turno
 * @param {string} [datos.cerro] quién cerró
 * @param {string} datos.cerradoAt instante del cierre (ISO)
 * @param {object} datos.resumen lo de `armarResumenCierre`
 * @param {Array} [datos.desglose] filas del conteo ({ valor, cantidad, subtotal }), vacío si se escribió el total
 * @param {string} [datos.nota] nota del cierre
 */
export function comprobanteCierreHtml(datos) {
  const { resumen = {}, desglose = [], nota = '' } = datos || {}
  const ventas = resumen.ventas
  const digital = esCajaDigital({ tipo: datos?.tipo })
  const conteo = !digital && resumen.contado !== null && resumen.contado !== undefined

  const filasVentas = [
    fila('Ventas en efectivo', ventas ? money(ventas.efectivo) : '—'),
    fila('Ventas con tarjeta', ventas ? money(ventas.tarjeta) : '—'),
    fila('Ventas por transferencia', ventas ? money(ventas.transferencia) : '—'),
    ventas && ventas.otros > 0 ? fila('Ventas con otros medios', money(ventas.otros)) : '',
  ].join('')

  const filasDesglose = desglose.map((d) => `
    <tr class="chico"><td>${esc(d.cantidad)} × ${esc(etiquetaDenominacion(d.valor))}</td><td class="der">${esc(money(d.subtotal))}</td></tr>`).join('')

  const arqueo = conteo
    ? `
    <table><tbody>
      ${fila('Efectivo contado', money(resumen.contado), 'total')}
      ${filasDesglose}
      ${fila('Diferencia', textoDiferencia(resumen.diferencia) ?? '—', 'total')}
    </tbody></table>
    ${nota ? `<p class="chico">Nota: ${esc(nota)}</p>` : ''}
    <p class="chico">Lo contado queda en la caja para la apertura del día siguiente.</p>`
    : `
    <p class="chico">${digital ? 'Caja digital: se cerró sin contar efectivo.' : 'Se cerró sin contar el efectivo.'}</p>
    ${nota ? `<p class="chico">Nota: ${esc(nota)}</p>` : ''}`

  return documento(`Cierre de caja ${datos?.caja || ''}`.trim(), `
    <div class="centro">
      <h1>CIERRE DE CAJA</h1>
      <p class="chico">${esc(datos?.local || '')}</p>
      <p><strong>${esc(datos?.caja || '')}</strong></p>
      <p class="chico">${esc(fechaHoraDelCierre(datos?.cerradoAt))}</p>
    </div>
    <hr/>
    <table><tbody>
      ${datos?.turno ? fila('Turno', `#${String(datos.turno).slice(0, 8).toUpperCase()}`) : ''}
      ${datos?.vendedor ? fila('Turno de', datos.vendedor) : ''}
      ${datos?.cerro ? fila('Cerró', datos.cerro) : ''}
    </tbody></table>
    <hr/>
    <table><tbody>
      ${fila('Fondo inicial', money(resumen.fondo))}
      ${filasVentas}
      ${fila('Ingresos de caja', money(resumen.ingresosCaja))}
      ${fila('Retiros y gastos', money(resumen.retiros))}
      ${fila('Efectivo esperado', money(resumen.esperado), 'total')}
    </tbody></table>
    <hr/>
    ${arqueo}
    <hr/>
  `)
}

/** Baja el documento como archivo (no imprime). */
export function descargarComprobante(html, nombre, { document: doc = document } = {}) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const enlace = doc.createElement('a')
  enlace.href = url
  enlace.download = nombre
  doc.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  // Se libera después del clic: revocarla antes puede cancelar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
