/**
 * Máquinas POS del turno con el contrato de la sección 5b (T-71): ocupación de
 * hasta 2 personas, compartir, proveedor en cada máquina y la máquina del
 * turno elegida con PUT /cajas/{id}/maquina.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  elegirMaquinaDelTurno, errorAlTomarMaquina, estadoDeMaquina, listarMaquinasDelLocal, mapMaquina,
  maquinaDelTurno, maquinasElegibles, requiereCompartir, textoDeOcupacion, turnoTieneMaquina, webCobraCon,
} from './maquinasCobro'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const fila = (extra = {}) => ({
  id: 'm-1', display_name: 'Point barra', provider: 'mercadopago', is_active: true,
  ocupacion: 0, usuarios: [], disponible: true, caja_fisica_id: null, ...extra,
})

beforeEach(() => { vi.clearAllMocks() })

describe('mapMaquina y estado', () => {
  it('lee ocupación, usuarios y proveedor de la máquina', () => {
    const m = mapMaquina(fila({ ocupacion: 1, usuarios: ['Ana'] }))
    expect(m).toMatchObject({
      id: 'm-1', nombre: 'Point barra', proveedor: 'mercadopago', proveedorLabel: 'Mercado Pago',
      activa: true, ocupacion: 1, usuarios: ['Ana'], estado: 'compartible',
    })
  })

  it('libre, compartible, llena y desactivada', () => {
    expect(mapMaquina(fila()).estado).toBe('libre')
    expect(mapMaquina(fila({ ocupacion: 1 })).estado).toBe('compartible')
    expect(mapMaquina(fila({ ocupacion: 2 })).estado).toBe('llena')
    expect(mapMaquina(fila({ is_active: false })).estado).toBe('desactivada')
    expect(estadoDeMaquina({ activa: true, ocupacion: 3 })).toBe('llena')
  })

  it('sin proveedor no inventa una etiqueta', () => {
    expect(mapMaquina(fila({ provider: null })).proveedorLabel).toBeNull()
  })

  it('con un backend sin ocupación, la estima con la asignación fija', () => {
    expect(mapMaquina(fila({ ocupacion: undefined, assigned_user_id: 'u-1' })).ocupacion).toBe(1)
    expect(mapMaquina(fila({ ocupacion: undefined })).ocupacion).toBe(0)
  })

  it('texto de la ocupación con quién la usa', () => {
    expect(textoDeOcupacion(mapMaquina(fila()))).toBe('Libre')
    expect(textoDeOcupacion(mapMaquina(fila({ ocupacion: 1, usuarios: ['Ana'] })))).toBe('Compartida con Ana')
    expect(textoDeOcupacion(mapMaquina(fila({ ocupacion: 2, usuarios: ['Ana', 'Luis'] })))).toBe('Llena (Ana y Luis)')
    expect(textoDeOcupacion(mapMaquina(fila({ is_active: false })))).toBe('Desactivada')
  })

  it('solo se eligen las libres y las compartibles; compartir se pide en las compartibles', () => {
    const lista = [fila(), fila({ id: 'm-2', ocupacion: 1 }), fila({ id: 'm-3', ocupacion: 2 }), fila({ id: 'm-4', is_active: false })].map(mapMaquina)
    expect(maquinasElegibles(lista).map((m) => m.id)).toEqual(['m-1', 'm-2'])
    expect(requiereCompartir(lista[0])).toBe(false)
    expect(requiereCompartir(lista[1])).toBe(true)
  })

  it('la web cobra solo con Mercado Pago', () => {
    expect(webCobraCon('mercadopago')).toBe(true)
    expect(webCobraCon('haulmer')).toBe(false)
  })
})

describe('listarMaquinasDelLocal', () => {
  it('pide las disponibles y las no disponibles (el backend solo trae la ocupación con ese filtro) y las une', async () => {
    apiRequest.mockImplementation((ruta) => Promise.resolve(ruta.endsWith('disponible=true')
      ? [fila({ id: 'b', display_name: 'Zeta' }), fila({ id: 'a', display_name: 'Alfa', ocupacion: 1 })]
      : [fila({ id: 'c', display_name: 'Media', ocupacion: 2, disponible: false })]))
    const lista = await listarMaquinasDelLocal('loc 1')
    expect(apiRequest).toHaveBeenCalledTimes(2)
    expect(apiRequest).toHaveBeenCalledWith('/pos-machines?local_id=loc%201&disponible=true')
    expect(apiRequest).toHaveBeenCalledWith('/pos-machines?local_id=loc%201&disponible=false')
    expect(lista.map((m) => `${m.nombre}:${m.estado}`)).toEqual(['Alfa:compartible', 'Media:llena', 'Zeta:libre'])
  })

  it('no pide /payment-connections: el proveedor viene en cada máquina', async () => {
    apiRequest.mockResolvedValue([])
    await listarMaquinasDelLocal('loc-1')
    expect(apiRequest.mock.calls.some(([r]) => String(r).includes('payment-connections'))).toBe(false)
  })

  it('sin local no llama a la API', async () => {
    expect(await listarMaquinasDelLocal(null)).toEqual([])
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

describe('máquina del turno', () => {
  const lista = [fila(), fila({ id: 'm-2', display_name: 'Point caja', caja_fisica_id: 'cf-1' })].map(mapMaquina)

  it('restaurante: la que eligió, mientras no se la suelten', () => {
    expect(turnoTieneMaquina({ pos_machine_id: 'm-1' })).toBe(true)
    expect(maquinaDelTurno({ pos_machine_id: 'm-1' }, lista).id).toBe('m-1')
    expect(turnoTieneMaquina({ pos_machine_id: 'm-1', pos_machine_released_at: '2026-10-14T13:00:00Z' })).toBe(false)
    expect(maquinaDelTurno({ pos_machine_id: 'm-1', pos_machine_released_at: '2026-10-14T13:00:00Z' }, lista)).toBeNull()
    expect(maquinaDelTurno({ pos_machine_id: null }, lista)).toBeNull()
  })

  it('al paso: la anclada a su caja física', () => {
    expect(maquinaDelTurno({ caja_fisica_id: 'cf-1' }, lista, { alPaso: true }).id).toBe('m-2')
    expect(maquinaDelTurno({ caja_fisica_id: 'cf-9' }, lista, { alPaso: true })).toBeNull()
  })
})

describe('elegirMaquinaDelTurno', () => {
  it('usa PUT /cajas/{id}/maquina con la máquina y si comparte (no PATCH /pos-machines)', async () => {
    apiRequest.mockResolvedValue({ id: 'turno-1', pos_machine_id: 'm-1' })
    await elegirMaquinaDelTurno('turno-1', 'm-1', { compartir: true })
    expect(apiRequest).toHaveBeenCalledWith('/cajas/turno-1/maquina', {
      method: 'PUT', body: { pos_machine_id: 'm-1', compartir: true },
    })
    expect(apiRequest.mock.calls.some(([ruta]) => String(ruta).startsWith('/pos-machines/'))).toBe(false)
  })

  it('un 409 trae el texto del backend y marca que hay que recargar la lista', async () => {
    apiRequest.mockRejectedValue(Object.assign(
      new Error('409: La máquina «Point barra» la está usando Ana. Si quieres usarla junto a esa persona, elige «compartir máquina»'),
      { status: 409 },
    ))
    const error = await elegirMaquinaDelTurno('turno-1', 'm-1').catch((e) => e)
    expect(error.message).toBe('La máquina «Point barra» la está usando Ana. Si quieres usarla junto a esa persona, elige «compartir máquina»')
    expect(error.conflicto).toBe(true)
  })

  it('otro error no pide recargar', () => {
    const error = errorAlTomarMaquina(Object.assign(new Error('400: Esta máquina no tiene lector configurado'), { status: 400 }))
    expect(error.message).toBe('Esta máquina no tiene lector configurado')
    expect(error.conflicto).toBeUndefined()
  })

  it('sin turno o sin máquina no llama a la API', async () => {
    await expect(elegirMaquinaDelTurno(null, 'm-1')).rejects.toThrow('No se pudo identificar tu turno')
    await expect(elegirMaquinaDelTurno('turno-1', null)).rejects.toThrow('Elige una máquina')
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
