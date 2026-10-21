/** Comprobante del cierre de un turno (T-55). */
import { describe, it, expect, vi } from 'vitest'
import { comprobanteCierreHtml, descargarComprobante, fechaHoraDelCierre, nombreDelComprobante } from './comprobanteCierre'
import { armarResumenCierre } from './cierreCaja'

const RESUMEN_BACKEND = {
  monto_apertura: '50000.00', ingresos_manuales: '0.00', total_egresos: '10000.00', efectivo_esperado: '48200.00',
}
const MOVIMIENTOS = [
  { tipo: 'ingreso', monto: '8200.00', payment_method: 'cash', order_id: 'o1' },
  { tipo: 'ingreso', monto: '5000.00', payment_method: 'debit', order_id: 'o2' },
  { tipo: 'ingreso', monto: '7000.00', payment_method: 'transfer', order_id: 'o3' },
]

const BASE = {
  local: 'Sucursal Centro',
  caja: 'Caja Principal',
  tipo: 'fisica',
  turno: 'abcdef12-3456-7890-abcd-ef1234567890',
  vendedor: 'Cajero',
  cerro: 'Centro Admin',
  cerradoAt: '2026-10-17T21:30:00Z',
  nota: '',
}

describe('comprobanteCierreHtml', () => {
  it('lleva caja, local, fecha y hora, quién cerró y el resumen completo', () => {
    const html = comprobanteCierreHtml({
      ...BASE,
      resumen: armarResumenCierre({ resumen: RESUMEN_BACKEND, movimientos: MOVIMIENTOS, contado: 48200 }),
    })
    for (const texto of ['CIERRE DE CAJA', 'Sucursal Centro', 'Caja Principal', '17/10/2026', 'Centro Admin', '#ABCDEF12', 'Cajero']) {
      expect(html).toContain(texto)
    }
    expect(html).toContain('Fondo inicial')
    expect(html).toContain('$50.000')
    expect(html).toMatch(/Ventas en efectivo<\/td><td class="der ">\$8\.200/)
    expect(html).toMatch(/Ventas con tarjeta<\/td><td class="der ">\$5\.000/)
    expect(html).toMatch(/Ventas por transferencia<\/td><td class="der ">\$7\.000/)
    expect(html).toContain('Ingresos de caja')
    expect(html).toMatch(/Retiros y gastos<\/td><td class="der ">\$10\.000/)
    expect(html).toMatch(/Efectivo esperado<\/td><td class="der total">\$48\.200/)
    expect(html).toMatch(/Efectivo contado<\/td><td class="der total">\$48\.200/)
    expect(html).toContain('Cuadra')
    expect(html).toContain('queda en la caja para la apertura del día siguiente')
  })

  it('con conteo por billetes incluye el desglose', () => {
    const html = comprobanteCierreHtml({
      ...BASE,
      resumen: armarResumenCierre({ resumen: RESUMEN_BACKEND, movimientos: MOVIMIENTOS, contado: 48000 }),
      desglose: [
        { valor: 20000, cantidad: 2, subtotal: 40000 },
        { valor: 5000, cantidad: 1, subtotal: 5000 },
        { valor: 1000, cantidad: 3, subtotal: 3000 },
      ],
      nota: 'Vuelto mal dado',
    })
    expect(html).toContain('2 × $20.000')
    expect(html).toContain('1 × $5.000')
    expect(html).toContain('3 × $1.000')
    expect(html).toContain('Faltan $200')
    expect(html).toContain('Nota: Vuelto mal dado')
  })

  it('la caja digital se cierra sin conteo: no hay contado ni diferencia', () => {
    const html = comprobanteCierreHtml({
      ...BASE,
      caja: 'Caja Digital',
      tipo: 'digital',
      resumen: armarResumenCierre({ resumen: RESUMEN_BACKEND, movimientos: MOVIMIENTOS }),
    })
    expect(html).toContain('Caja digital: se cerró sin contar efectivo.')
    expect(html).not.toContain('Efectivo contado')
    expect(html).not.toContain('Diferencia')
  })

  it('sin las ventas por medio las muestra como «—» y un nombre con < no rompe el papel', () => {
    const html = comprobanteCierreHtml({
      ...BASE,
      caja: 'Caja <b>1</b>',
      resumen: armarResumenCierre({ resumen: RESUMEN_BACKEND, contado: 48200 }),
    })
    expect(html).toMatch(/Ventas en efectivo<\/td><td class="der ">—/)
    expect(html).not.toContain('<b>1</b>')
    expect(html).toContain('Caja &lt;b&gt;1&lt;/b&gt;')
  })

  it('las ventas con otros medios solo aparecen si las hubo', () => {
    const con = comprobanteCierreHtml({
      ...BASE,
      resumen: armarResumenCierre({
        resumen: RESUMEN_BACKEND,
        movimientos: [...MOVIMIENTOS, { tipo: 'ingreso', monto: '900.00', payment_method: 'mercadopago', order_id: 'o9' }],
        contado: 48200,
      }),
    })
    expect(con).toContain('Ventas con otros medios')
    const sin = comprobanteCierreHtml({ ...BASE, resumen: armarResumenCierre({ resumen: RESUMEN_BACKEND, movimientos: MOVIMIENTOS, contado: 48200 }) })
    expect(sin).not.toContain('Ventas con otros medios')
  })
})

describe('nombre del archivo y fecha', () => {
  it('el nombre lleva la caja y el día en Chile, sin tildes ni símbolos', () => {
    expect(nombreDelComprobante({ caja: 'Caja Principal', cerradoAt: '2026-10-17T21:30:00Z' }))
      .toBe('comprobante-cierre-caja-principal-2026-10-17.html')
    expect(nombreDelComprobante({ caja: 'Cajón Nº 2 / Terraza', cerradoAt: '2026-10-18T02:30:00Z' }))
      .toBe('comprobante-cierre-cajon-n-2-terraza-2026-10-17.html')
  })

  it('sin datos igual da un nombre válido', () => {
    expect(nombreDelComprobante()).toBe('comprobante-cierre-caja.html')
  })

  it('la fecha y hora salen en hora de Chile', () => {
    // 21:30 UTC es 18:30 en Chile (UTC-3 en octubre).
    expect(fechaHoraDelCierre('2026-10-17T21:30:00Z')).toBe('17/10/2026 18:30')
    expect(fechaHoraDelCierre(null)).toBe('')
  })
})

describe('descargarComprobante', () => {
  it('baja el documento como archivo con el nombre pedido', async () => {
    const crear = vi.fn(() => 'blob:comprobante')
    const revocar = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: crear, revokeObjectURL: revocar })
    vi.useFakeTimers()
    try {
      const clic = vi.fn()
      const enlace = { click: clic, remove: vi.fn(), href: '', download: '' }
      const doc = { createElement: vi.fn(() => enlace), body: { appendChild: vi.fn() } }
      descargarComprobante('<html></html>', 'comprobante.html', { document: doc })
      expect(crear).toHaveBeenCalledTimes(1)
      const blob = crear.mock.calls[0][0]
      expect(blob.type).toBe('text/html;charset=utf-8')
      expect(await blob.text()).toBe('<html></html>')
      expect(enlace.href).toBe('blob:comprobante')
      expect(enlace.download).toBe('comprobante.html')
      expect(clic).toHaveBeenCalled()
      expect(revocar).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1000)
      expect(revocar).toHaveBeenCalledWith('blob:comprobante')
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
})

describe('comprobante de la caja física (#133)', () => {
  it('trae los turnos trabajados y dice «Retiros»', () => {
    const html = comprobanteCierreHtml({
      local: 'Sucursal Centro', caja: 'Caja principal', cerradoAt: '2026-10-21T15:00:00Z', etiquetaRetiros: 'Retiros',
      resumen: { fondo: 60000, ventas: { efectivo: 2500, tarjeta: 0, transferencia: 0, otros: 0 }, ingresosCaja: 1000, retiros: 5000, esperado: 58500, contado: 20000, diferencia: -38500 },
      turnos: [{ nombre: 'Ana', desde: '21/10/2026 12:04', hasta: '21/10/2026 12:08', vendido: 2500 }],
    })
    expect(html).toContain('Turnos trabajados')
    expect(html).toContain('Ana')
    expect(html).toContain('21/10/2026 12:04 → 21/10/2026 12:08')
    expect(html).toContain('$2.500')
    expect(html).toContain('>Retiros<')
  })

  it('sin turnos no agrega la sección', () => {
    const html = comprobanteCierreHtml({ caja: 'Caja', resumen: {}, turnos: [] })
    expect(html).not.toContain('Turnos trabajados')
  })
})
