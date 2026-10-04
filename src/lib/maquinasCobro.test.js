import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  estadoDeMaquina, listarMaquinasDelVendedor, maquinasParaElegir, resumenDeMaquinas, tomarMaquina, webCobraCon,
} from './maquinasCobro'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const MAQUINAS = [
  { id: 'm-2', display_name: 'Point Barra', connection_id: 'c-mp', assigned_user_id: 'otro', is_active: true },
  { id: 'm-1', display_name: 'Haulmer Caja', connection_id: 'c-hm', assigned_user_id: null, is_active: true },
  { id: 'm-3', display_name: 'Point Viejo', connection_id: 'c-mp', assigned_user_id: 'yo', is_active: false },
]
const CONEXIONES = [{ id: 'c-mp', provider: 'mercadopago' }, { id: 'c-hm', provider: 'haulmer' }]

function responder({ maquinas = MAQUINAS, conexiones = CONEXIONES } = {}) {
  apiRequest.mockImplementation((ruta) => {
    if (ruta.startsWith('/pos-machines')) return Promise.resolve(maquinas)
    if (ruta === '/payment-connections') return conexiones instanceof Error ? Promise.reject(conexiones) : Promise.resolve(conexiones)
    return Promise.reject(new Error(`ruta inesperada ${ruta}`))
  })
}

const m = (estado, extra = {}) => ({ id: `${estado}-${Math.round(Math.random() * 1e6)}`, estado, activa: true, ...extra })

beforeEach(() => vi.clearAllMocks())

describe('estadoDeMaquina', () => {
  it('distingue la suya, la de otra persona y la libre', () => {
    expect(estadoDeMaquina({ assigned_user_id: 'yo' }, 'yo')).toBe('mia')
    expect(estadoDeMaquina({ assigned_user_id: 'otro' }, 'yo')).toBe('en_uso')
    expect(estadoDeMaquina({ assigned_user_id: null }, 'yo')).toBe('libre')
  })
})

describe('listarMaquinasDelVendedor', () => {
  it('lista las del local por nombre, con proveedor, si están activas y su estado', async () => {
    responder()
    const lista = await listarMaquinasDelVendedor('loc-1', 'yo')

    expect(apiRequest).toHaveBeenCalledWith('/pos-machines?local_id=loc-1')
    expect(lista.map((x) => [x.nombre, x.proveedorLabel, x.activa, x.estado])).toEqual([
      ['Haulmer Caja', 'Haulmer', true, 'libre'],
      ['Point Barra', 'Mercado Pago', true, 'en_uso'],
      // Inactiva pero a su nombre: el backend cobra igual con ella, así que no se esconde.
      ['Point Viejo', 'Mercado Pago', false, 'mia'],
    ])
  })

  it('al vendedor el backend le niega las conexiones (403): lista igual, sin inventar el proveedor', async () => {
    responder({ conexiones: new Error('403: No autorizado') })
    const lista = await listarMaquinasDelVendedor('loc-1', 'yo')
    expect(lista.every((x) => x.proveedorLabel === null && x.proveedor === null)).toBe(true)
  })

  it('sin local no consulta nada', async () => {
    expect(await listarMaquinasDelVendedor(null, 'yo')).toEqual([])
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

describe('resumenDeMaquinas', () => {
  it('ninguna, una o varias a su nombre', () => {
    expect(resumenDeMaquinas([m('libre'), m('en_uso')]).tipo).toBe('ninguna')
    const una = resumenDeMaquinas([m('libre'), m('mia', { id: 'x' })])
    expect([una.tipo, una.maquina.id]).toEqual(['una', 'x'])
    // Dos a su nombre: el cobro con tarjeta necesita una sola.
    const varias = resumenDeMaquinas([m('mia'), m('mia')])
    expect([varias.tipo, varias.maquina, varias.mias.length]).toEqual(['varias', null, 2])
  })

  it('una inactiva a su nombre cuenta: es con la que el backend le cobra', () => {
    expect(resumenDeMaquinas([m('mia', { activa: false })]).tipo).toBe('una')
    expect(resumenDeMaquinas([m('mia', { activa: false }), m('mia')]).tipo).toBe('varias')
  })

  it('sin datos no hay máquina', () => {
    expect(resumenDeMaquinas(null).tipo).toBe('ninguna')
  })
})

describe('maquinasParaElegir', () => {
  it('las activas, más las suyas aunque estén desactivadas', () => {
    const inactivaAjena = m('en_uso', { activa: false })
    const inactivaMia = m('mia', { activa: false })
    const libre = m('libre')
    expect(maquinasParaElegir([inactivaAjena, inactivaMia, libre])).toEqual([inactivaMia, libre])
  })
})

describe('webCobraCon', () => {
  it('la web cobra con tarjeta solo por MercadoPago Point', () => {
    expect(webCobraCon('mercadopago')).toBe(true)
    expect(webCobraCon('haulmer')).toBe(false)
    // Sin proveedor conocido no se afirma que no pueda.
    expect(webCobraCon(null)).toBe(true)
  })
})

describe('tomarMaquina', () => {
  it('se la asigna a quien la toma', async () => {
    apiRequest.mockResolvedValue({ id: 'm-1', assigned_user_id: 'yo' })
    await tomarMaquina('m-1', 'yo')
    expect(apiRequest).toHaveBeenCalledWith('/pos-machines/m-1', { method: 'PATCH', body: { assigned_user_id: 'yo' } })
  })

  it('sin saber quién la toma no manda nada (un PATCH vacío no cambiaría nada)', async () => {
    await expect(tomarMaquina('m-1', undefined)).rejects.toThrow('No se pudo identificar')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('mientras el backend no se lo permita (403), lo dice en palabras del vendedor', async () => {
    apiRequest.mockRejectedValue(new Error('No autorizado'))
    await expect(tomarMaquina('m-1', 'yo')).rejects.toThrow('Pídele al encargado que te la asigne')
  })

  it('si otra persona la tomó recién (409), lo dice y lo marca como conflicto', async () => {
    apiRequest.mockRejectedValue(new Error('409: ya asignada'))
    const error = await tomarMaquina('m-1', 'yo').catch((e) => e)
    expect(error.message).toMatch('Otra persona acaba de tomar esa máquina')
    expect(error.conflicto).toBe(true)
  })
})
