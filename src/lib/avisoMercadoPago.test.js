/** #171: el aviso de la ventana de Mercado Pago solo se acepta de esa ventana y de un origen conocido. */
import { describe, it, expect } from 'vitest'
import { avisoDeMercadoPago, origenesConfiables } from './avisoMercadoPago'

const ventana = {}
const ORIGENES = origenesConfiables('https://api.gestflow.cl', 'https://app.gestflow.cl')
const evento = (extra) => ({ source: ventana, origin: 'https://api.gestflow.cl', data: { type: 'mp_oauth_success' }, ...extra })

describe('avisoDeMercadoPago', () => {
  it('acepta el aviso de la ventana abierta y del origen de la API o del front', () => {
    expect(avisoDeMercadoPago(evento(), ventana, ORIGENES)).toBe('mp_oauth_success')
    expect(avisoDeMercadoPago(evento({ origin: 'https://app.gestflow.cl', data: { type: 'mp_oauth_error' } }), ventana, ORIGENES)).toBe('mp_oauth_error')
  })

  it('rechaza el de otra página, aunque traiga el mismo tipo', () => {
    expect(avisoDeMercadoPago(evento({ origin: 'https://malicioso.example' }), ventana, ORIGENES)).toBeNull()
  })

  it('rechaza el que no viene de la ventana de Mercado Pago', () => {
    expect(avisoDeMercadoPago(evento({ source: {} }), ventana, ORIGENES)).toBeNull()
  })

  it('ignora otros mensajes', () => {
    expect(avisoDeMercadoPago(evento({ data: 'hola' }), ventana, ORIGENES)).toBeNull()
    expect(avisoDeMercadoPago(evento({ data: { type: 'otro' } }), ventana, ORIGENES)).toBeNull()
  })

  it('sin URL de API (mismo origen) confía solo en el front', () => {
    expect([...origenesConfiables('', 'http://localhost:5173')]).toEqual(['http://localhost:5173'])
  })
})
