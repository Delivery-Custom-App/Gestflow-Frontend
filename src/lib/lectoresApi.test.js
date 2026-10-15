/**
 * La web pedía `GET /payments/point/devices`, que no existe: el inventario de
 * lectores está en `/pos-machines`, igual que en la app móvil. El cambio de
 * modo sí tiene ruta propia y se conserva.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { ayudaDelModo, cambiarModoLector, listarLectores, modoLegible } from './lectoresApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const MAQUINA = {
  id: 'pm-1',
  local_id: 'loc-1',
  display_name: 'Lector barra',
  operating_mode: 'remote_pdv',
  is_active: true,
}

describe('listarLectores', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pide el inventario real del local, no la ruta que no existe', async () => {
    apiRequest.mockResolvedValue([MAQUINA])

    await listarLectores('loc-1')

    expect(apiRequest).toHaveBeenCalledWith('/pos-machines?local_id=loc-1')
    expect(apiRequest).not.toHaveBeenCalledWith('/payments/point/devices')
  })

  it('presenta el nombre y el modo en castellano', async () => {
    apiRequest.mockResolvedValue([MAQUINA])

    const [lector] = await listarLectores('loc-1')

    expect(lector.name).toBe('Lector barra')
    expect(lector.modo).toBe('Cobro automático')
    expect(lector.activo).toBe(true)
  })

  it('un modo que no conocemos no se inventa', async () => {
    apiRequest.mockResolvedValue([{ ...MAQUINA, operating_mode: 'algo_nuevo' }])

    const [lector] = await listarLectores('loc-1')

    expect(lector.modo).toBe('Sin modo definido')
    expect(ayudaDelModo('algo_nuevo')).toBeNull()
  })

  it('sin local no pide nada', async () => {
    expect(await listarLectores(null)).toEqual([])
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('los tres modos del backend tienen su etiqueta', () => {
    expect(modoLegible('remote_pdv')).toBe('Cobro automático')
    expect(modoLegible('inter_app')).toBe('Cobro desde la app')
    expect(modoLegible('idle')).toBe('En espera')
  })
})

describe('cambiarModoLector', () => {
  beforeEach(() => vi.clearAllMocks())

  it('usa la ruta de compatibilidad, que sí existe', async () => {
    apiRequest.mockResolvedValue({ operating_mode: 'PDV' })

    await cambiarModoLector('TERMINAL-9', 'PDV')

    expect(apiRequest).toHaveBeenCalledWith('/payments/point/devices/TERMINAL-9/mode', {
      method: 'PATCH',
      body: { operating_mode: 'PDV' },
    })
  })

  it('una terminal no registrada se explica, no se muestra el detalle crudo', async () => {
    apiRequest.mockRejectedValue(new Error("404: Terminal 'X' no está registrada (usá /webhooks/mercadopago-pos primero)"))

    await expect(cambiarModoLector('X', 'PDV')).rejects.toThrow(/búscala de nuevo/i)
  })

  it('sin cuenta de MercadoPago conectada se dice en castellano', async () => {
    apiRequest.mockRejectedValue(new Error('400: No hay una cuenta MercadoPago conectada para este local'))

    await expect(cambiarModoLector('X', 'PDV')).rejects.toThrow(/no tiene una cuenta de MercadoPago conectada/i)
  })

  it('cualquier otro error se propaga tal cual', async () => {
    apiRequest.mockRejectedValue(new Error('500: se cayó todo'))

    await expect(cambiarModoLector('X', 'PDV')).rejects.toThrow(/se cayó todo/)
  })
})
