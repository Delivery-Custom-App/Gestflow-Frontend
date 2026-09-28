/**
 * La comanda y la boleta existen en el backend; lo que no existe es el
 * servicio de impresión. El papel lo arma el navegador a partir de esos datos.
 */
import { describe, it, expect, vi } from 'vitest'
import { boletaHtml, comandaHtml, formatCantidad, imprimirEnNavegador, ordenCorta } from './ticketPrint'

const COMANDA = {
  order_id: 'abcdef12-3456-7890-abcd-ef1234567890',
  local_name: 'Sucursal Centro',
  local_address: '5 Norte 147',
  mesa_nombre: 'Mesa 4',
  created_at: '2026-09-28T14:30:00Z',
  items: [
    { product_name: 'Churrasco italiano', quantity: 2 },
    { product_name: 'Papas fritas', quantity: 1 },
  ],
}

const BOLETA = {
  order_id: 'abcdef12-3456-7890-abcd-ef1234567890',
  business_name: 'Sabores del Valle',
  business_rut: '77.123.456-7',
  local_name: 'Sucursal Centro',
  local_address: '5 Norte 147',
  mesa_nombre: 'Mesa 4',
  created_at: '2026-09-28T14:30:00Z',
  items: [{ product_name: 'Churrasco italiano', quantity: 2, unit_price: 6000, subtotal: 12000 }],
  total: 12000,
  net_amount: 10084,
  iva_amount: 1916,
  payment_method: 'efectivo',
}

describe('comandaHtml', () => {
  it('lleva lo que hay que preparar', () => {
    const html = comandaHtml(COMANDA)

    expect(html).toContain('COMANDA')
    expect(html).toContain('Churrasco italiano')
    expect(html).toContain('Papas fritas')
    expect(html).toContain('Mesa 4')
    expect(html).toContain('Sucursal Centro')
  })

  it('no lleva precios: la comanda es para la cocina', () => {
    const html = comandaHtml({ ...COMANDA, items: [{ product_name: 'Churrasco', quantity: 1 }] })
    const papel = html.split('</style>')[1]   // sin los estilos, solo lo que se lee

    expect(papel).not.toContain('$')
    expect(papel).not.toMatch(/total|iva/i)
  })

  it('una orden sin ítems para preparar lo dice, no queda en blanco', () => {
    expect(comandaHtml({ ...COMANDA, items: [] })).toContain('Sin ítems para preparar')
  })

  it('un nombre con caracteres de HTML no rompe el papel', () => {
    const html = comandaHtml({ ...COMANDA, items: [{ product_name: 'Pan <con> "queso" & jamón', quantity: 1 }] })

    expect(html).toContain('Pan &lt;con&gt; &quot;queso&quot; &amp; jamón')
    expect(html).not.toContain('<con>')
  })
})

describe('boletaHtml', () => {
  it('lleva los datos del negocio, los precios y el IVA incluido', () => {
    const html = boletaHtml(BOLETA)

    expect(html).toContain('Sabores del Valle')
    expect(html).toContain('77.123.456-7')
    expect(html).toContain('$12.000')
    expect(html).toContain('IVA incluido (19%)')
    expect(html).toContain('$1.916')
    expect(html).toContain('Pagado con efectivo')
  })

  it('el método de pago se lee en castellano, no como lo guarda el backend', () => {
    expect(boletaHtml({ ...BOLETA, payment_method: 'cash' })).toContain('Pagado con efectivo')
    expect(boletaHtml({ ...BOLETA, payment_method: 'mercadopago_point' })).toContain('Pagado con MercadoPago')
  })

  it('sin método de pago registrado no inventa uno', () => {
    expect(boletaHtml({ ...BOLETA, payment_method: null })).toContain('Sin método de pago registrado')
  })
})

describe('utilidades del ticket', () => {
  it('la cantidad decimal se lee como cantidad, no como número raro', () => {
    expect(formatCantidad(2)).toBe('2')
    expect(formatCantidad(0.5)).toBe('0,5')
  })

  it('la orden se identifica con sus primeros ocho caracteres', () => {
    expect(ordenCorta('abcdef12-3456')).toBe('#ABCDEF12')
  })
})

describe('imprimirEnNavegador', () => {
  it('imprime desde un iframe oculto, sin depender de ningún servicio', () => {
    const print = vi.fn()
    const escribir = { open: vi.fn(), write: vi.fn(), close: vi.fn(), readyState: 'complete' }
    const iframe = {
      setAttribute: vi.fn(), style: {}, remove: vi.fn(), addEventListener: vi.fn(),
      contentDocument: escribir,
      contentWindow: { print, focus: vi.fn() },
    }
    const doc = { createElement: vi.fn(() => iframe), body: { appendChild: vi.fn() } }

    const ok = imprimirEnNavegador('<html></html>', { document: doc })

    expect(ok).toBe(true)
    expect(escribir.write).toHaveBeenCalledWith('<html></html>')
    expect(print).toHaveBeenCalled()
  })
})
