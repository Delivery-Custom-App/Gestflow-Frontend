/**
 * Vinculación de MercadoPago: el terminal cuelga de la CAJA FÍSICA, no del turno.
 *
 * Backend V2 expone estas acciones bajo `/cajas-fisicas/{id}/mp/...`. El front
 * las pedía bajo `/cajas/{id}/mp/...` y recibía 404 en las tres. Estas pruebas
 * fijan las rutas correctas para que la regresión no vuelva en silencio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  assignExistingMpPos,
  getCajasByLocal,
  getCajasFisicasByLocal,
  provisionCajaFisicaMp,
  verifyCajaFisicaMpPairing,
} from './administrativeApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const LOCAL = 'loc-1'
const CAJA_FISICA = 'cf-1'

const rutasPedidas = () => apiRequest.mock.calls.map(([path]) => String(path))

describe('Vinculación MercadoPago por caja física', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequest.mockResolvedValue([])
  })

  it('provisionar apunta a /cajas-fisicas/{id}/mp/provision', async () => {
    await provisionCajaFisicaMp(CAJA_FISICA)

    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas/cf-1/mp/provision', { method: 'POST' })
    expect(rutasPedidas().some((p) => p.startsWith('/cajas/'))).toBe(false)
  })

  it('verificar el emparejamiento apunta a /cajas-fisicas/{id}/mp/verify-pairing', async () => {
    await verifyCajaFisicaMpPairing(CAJA_FISICA)

    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas/cf-1/mp/verify-pairing', { method: 'POST' })
    expect(rutasPedidas().some((p) => p.startsWith('/cajas/'))).toBe(false)
  })

  it('asignar un POS existente apunta a /cajas-fisicas/{id}/mp/assign-existing', async () => {
    await assignExistingMpPos(CAJA_FISICA, 'pos-9')

    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas/cf-1/mp/assign-existing', {
      method: 'POST',
      body: { mercadopago_pos_id: 'pos-9' },
    })
  })

  it('lista las cajas físicas con su estado MP y normaliza nombre a name', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/cajas-fisicas')) {
        return Promise.resolve([
          { id: 'cf-1', nombre: 'Caja principal', is_active: true },
          { id: 'cf-2', nombre: 'Caja terraza', is_active: true },
        ])
      }
      if (path.includes('/mp/cajas-fisicas-status')) {
        return Promise.resolve([
          { caja_fisica_id: 'cf-2', pairing_status: 'paired', terminal_id: 'PAX-123' },
        ])
      }
      return Promise.resolve([])
    })

    const filas = await getCajasFisicasByLocal(LOCAL)

    expect(rutasPedidas()).toContain('/cajas-fisicas?local_id=loc-1')
    expect(rutasPedidas()).toContain('/locals/loc-1/mp/cajas-fisicas-status')
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ id: 'cf-1', name: 'Caja principal', mp: null })
    expect(filas[1]).toMatchObject({ id: 'cf-2', name: 'Caja terraza' })
    expect(filas[1].mp).toMatchObject({ pairing_status: 'paired', terminal_id: 'PAX-123' })
  })

  it('si el estado MP falla, las cajas físicas se listan igual sin vinculación', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/cajas-fisicas')) return Promise.resolve([{ id: 'cf-1', nombre: 'Caja 1' }])
      return Promise.reject(new Error('403'))
    })

    const filas = await getCajasFisicasByLocal(LOCAL)

    expect(filas).toHaveLength(1)
    expect(filas[0].mp).toBeNull()
  })

  it('las cajas (turnos) ya no consultan el estado MP, que era por turno y no existe', async () => {
    apiRequest.mockResolvedValue([])

    await getCajasByLocal(LOCAL, 'token')

    expect(rutasPedidas().some((p) => p.includes('/mp/cajas-status'))).toBe(false)
    expect(rutasPedidas()).toContain('/cajas?local_id=loc-1')
  })
})
