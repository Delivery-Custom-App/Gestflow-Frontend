/**
 * Grupos de mesas: el backend (/mesa-groups) lo tenía completo y la app móvil
 * lo usaba; la web no lo ofrecía.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { crearGrupoDeMesas, deshacerGrupoDeMesas, indexarGruposPorMesa, listarGruposDeMesas } from './mesaGroupsApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const GRUPO = {
  id: 'g-1',
  local_id: 'loc-1',
  mesa_ids: ['m-1', 'm-2'],
  combined_capacity: 8,
  created_at: '2026-09-28T10:00:00Z',
}

describe('listarGruposDeMesas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pide los grupos del local', async () => {
    apiRequest.mockResolvedValue([GRUPO])

    expect(await listarGruposDeMesas('loc-1')).toEqual([GRUPO])
    expect(apiRequest).toHaveBeenCalledWith('/mesa-groups?local_id=loc-1')
  })

  it('sin local no pide nada', async () => {
    expect(await listarGruposDeMesas(null)).toEqual([])
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

describe('crearGrupoDeMesas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('junta las mesas elegidas', async () => {
    apiRequest.mockResolvedValue(GRUPO)

    await crearGrupoDeMesas('loc-1', ['m-1', 'm-2'])

    expect(apiRequest).toHaveBeenCalledWith('/mesa-groups', {
      method: 'POST',
      body: { local_id: 'loc-1', mesa_ids: ['m-1', 'm-2'] },
    })
  })

  it('con una sola mesa no molesta al servidor', async () => {
    await expect(crearGrupoDeMesas('loc-1', ['m-1'])).rejects.toThrow(/al menos dos mesas/i)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('la misma mesa repetida no cuenta dos veces', async () => {
    await expect(crearGrupoDeMesas('loc-1', ['m-1', 'm-1'])).rejects.toThrow(/al menos dos mesas/i)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('una mesa ocupada se explica sin el código del error', async () => {
    apiRequest.mockRejectedValue(new Error('409: La mesa Mesa 3 no está disponible'))

    await expect(crearGrupoDeMesas('loc-1', ['m-1', 'm-3'])).rejects.toThrow(
      'La mesa Mesa 3 no está disponible. Solo se pueden juntar mesas libres.',
    )
  })

  it('una mesa que ya está en otro grupo también', async () => {
    apiRequest.mockRejectedValue(new Error('409: La mesa Mesa 2 ya está en otro grupo'))

    await expect(crearGrupoDeMesas('loc-1', ['m-1', 'm-2'])).rejects.toThrow('La mesa Mesa 2 ya está en otro grupo')
  })

  it('en un local al paso lo dice en una frase', async () => {
    apiRequest.mockRejectedValue(new Error('400: Mesas solo aplican a locales RESTAURANT'))

    await expect(crearGrupoDeMesas('loc-1', ['m-1', 'm-2'])).rejects.toThrow('Este local no trabaja con mesas.')
  })
})

describe('deshacerGrupoDeMesas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('separa el grupo', async () => {
    apiRequest.mockResolvedValue(null)

    await deshacerGrupoDeMesas('g-1')

    expect(apiRequest).toHaveBeenCalledWith('/mesa-groups/g-1', { method: 'DELETE' })
  })

  it('si alguna mesa sigue ocupada, explica qué hacer', async () => {
    apiRequest.mockRejectedValue(new Error('409: No se puede separar: Mesa 1 todavía no está disponible'))

    await expect(deshacerGrupoDeMesas('g-1')).rejects.toThrow(/libéralas antes de separarlas/i)
  })
})

describe('indexarGruposPorMesa', () => {
  it('cada mesa sabe en qué grupo está, con una etiqueta para mostrar', () => {
    const porMesa = indexarGruposPorMesa([GRUPO])

    expect(porMesa.get('m-1').etiqueta).toBe('Grupo 1')
    expect(porMesa.get('m-2').id).toBe('g-1')
    expect(porMesa.get('m-2').capacidad).toBe(8)
  })

  it('las etiquetas siguen el orden de creación, no el del listado', () => {
    const viejo = { ...GRUPO, id: 'g-0', mesa_ids: ['m-9'], created_at: '2026-09-27T10:00:00Z' }
    const porMesa = indexarGruposPorMesa([GRUPO, viejo])

    expect(porMesa.get('m-9').etiqueta).toBe('Grupo 1')
    expect(porMesa.get('m-1').etiqueta).toBe('Grupo 2')
  })

  it('sin grupos, ninguna mesa tiene grupo', () => {
    expect(indexarGruposPorMesa([]).size).toBe(0)
  })
})
