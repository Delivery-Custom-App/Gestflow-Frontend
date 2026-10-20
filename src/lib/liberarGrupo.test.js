/** Mesas juntadas: liberar el grupo completo (#221). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { liberarMesa, listMesasConTotales, setMesaLibre } from './salesApi'
import { deshacerGrupoDeMesas, obtenerGrupoDeMesas } from './mesaGroupsApi'
import { errorDeMotivo, estadoDelGrupo, liberarGrupo, liberarGrupoAlCobrar, nombresEnLista } from './liberarGrupo'

vi.mock('./salesApi', () => ({ liberarMesa: vi.fn(), listMesasConTotales: vi.fn(), setMesaLibre: vi.fn() }))
vi.mock('./mesaGroupsApi', () => ({ deshacerGrupoDeMesas: vi.fn(), obtenerGrupoDeMesas: vi.fn() }))

// Un grupo de 3: la del medio (Mesa 2) tiene el pedido; las otras dos quedaron ocupadas sin pedido.
const mesa = (id, nombre, extra = {}) => ({ id, name: nombre, nombre, state: 'ocupada', mesa_group_id: 'g1', ordenes_en_curso: [], total: null, ...extra })
const MESAS = [
  mesa('m1', 'Mesa 1'),
  mesa('m2', 'Mesa 2', { ordenes_en_curso: [{ id: 'o1', total: '8200.00' }], total: 8200 }),
  mesa('m3', 'Mesa 3'),
]
const IDS = ['m1', 'm2', 'm3']

beforeEach(() => {
  vi.clearAllMocks()
  liberarMesa.mockResolvedValue({ total_sin_cobrar: '0.00' })
  setMesaLibre.mockResolvedValue({})
  deshacerGrupoDeMesas.mockResolvedValue(undefined)
  obtenerGrupoDeMesas.mockResolvedValue({ id: 'g1', mesa_ids: IDS })
  listMesasConTotales.mockResolvedValue(MESAS)
})

describe('estadoDelGrupo', () => {
  it('dice qué mesas siguen ocupadas, cuáles tienen un pedido abierto y de cuánto', () => {
    expect(estadoDelGrupo(IDS, MESAS)).toEqual([
      { id: 'm1', nombre: 'Mesa 1', ocupada: true, conPedido: false, total: 0 },
      { id: 'm2', nombre: 'Mesa 2', ocupada: true, conPedido: true, total: 8200 },
      { id: 'm3', nombre: 'Mesa 3', ocupada: true, conPedido: false, total: 0 },
    ])
  })

  it('una mesa libre no cuenta como ocupada y suma los pedidos de una mesa con dos', () => {
    const mesas = [
      mesa('m1', 'Mesa 1', { state: 'libre' }),
      mesa('m2', 'Mesa 2', { ordenes_en_curso: [{ total: 1000 }, { total: '2500.00' }] }),
    ]
    const [libre, dosPedidos] = estadoDelGrupo(['m1', 'm2'], mesas)
    expect(libre.ocupada).toBe(false)
    expect(dosPedidos).toMatchObject({ ocupada: true, conPedido: true, total: 3500 })
  })

  it('una mesa que ya no está en la lista no se cuenta como ocupada', () => {
    expect(estadoDelGrupo(['zzz'], MESAS)).toEqual([{ id: 'zzz', nombre: 'Mesa', ocupada: false, conPedido: false, total: 0 }])
    expect(estadoDelGrupo(undefined, undefined)).toEqual([])
  })
})

describe('errorDeMotivo', () => {
  it('el motivo va de 3 a 300 caracteres, sin contar los espacios de los bordes', () => {
    expect(errorDeMotivo('')).toMatch(/entre 3 y 300/)
    expect(errorDeMotivo('  ab  ')).toMatch(/entre 3 y 300/)
    expect(errorDeMotivo('abc')).toBeNull()
    expect(errorDeMotivo('a'.repeat(300))).toBeNull()
    expect(errorDeMotivo('a'.repeat(301))).toMatch(/entre 3 y 300/)
  })
})

describe('nombresEnLista', () => {
  it('las junta como se dicen', () => {
    expect(nombresEnLista([{ nombre: 'Mesa 2' }])).toBe('Mesa 2')
    expect(nombresEnLista([{ nombre: 'Mesa 2' }, { nombre: 'Mesa 4' }])).toBe('Mesa 2 y Mesa 4')
    expect(nombresEnLista([{ nombre: 'Mesa 2' }, { nombre: 'Mesa 3' }, { nombre: 'Mesa 4' }])).toBe('Mesa 2, Mesa 3 y Mesa 4')
    expect(nombresEnLista([])).toBe('')
  })
})

describe('liberarGrupo («Liberar grupo»)', () => {
  const estado = () => estadoDelGrupo(IDS, MESAS)

  it('un grupo de 3, con una mesa con pedido y dos sin pedido: libera las tres con el motivo y después separa el grupo', async () => {
    const llamadas = []
    liberarMesa.mockImplementation(async (id) => { llamadas.push(`liberar ${id}`); return { total_sin_cobrar: id === 'm2' ? '8200.00' : '0.00' } })
    deshacerGrupoDeMesas.mockImplementation(async () => { llamadas.push('separar') })

    const r = await liberarGrupo({ grupoId: 'g1', mesas: estado(), motivo: '  Se fueron los clientes  ' })

    expect(liberarMesa).toHaveBeenCalledTimes(3)
    for (const id of IDS) expect(liberarMesa).toHaveBeenCalledWith(id, 'Se fueron los clientes')
    expect(deshacerGrupoDeMesas).toHaveBeenCalledWith('g1')
    // Primero se sueltan las mesas y recién después se separa el grupo.
    expect(llamadas).toEqual(['liberar m1', 'liberar m2', 'liberar m3', 'separar'])
    expect(r).toMatchObject({ separado: true, errorAlSeparar: null, sinCobrar: 8200, fallidas: [] })
    expect(r.liberadas.map((m) => m.id)).toEqual(IDS)
  })

  it('no toca las mesas que ya estaban libres', async () => {
    const mesas = estadoDelGrupo(IDS, [mesa('m1', 'Mesa 1', { state: 'libre' }), MESAS[1], mesa('m3', 'Mesa 3', { state: 'libre' })])
    const r = await liberarGrupo({ grupoId: 'g1', mesas, motivo: 'Cierre' })
    expect(liberarMesa).toHaveBeenCalledTimes(1)
    expect(liberarMesa).toHaveBeenCalledWith('m2', 'Cierre')
    expect(r.separado).toBe(true)
  })

  it('falla parcial: sigue con las demás, no separa el grupo y dice cuáles no se pudieron liberar', async () => {
    liberarMesa.mockImplementation(async (id) => {
      if (id === 'm2') throw Object.assign(new Error('500: boom'), { status: 500, detail: 'Hay un cobro con tarjeta en curso' })
      return { total_sin_cobrar: '0.00' }
    })

    const r = await liberarGrupo({ grupoId: 'g1', mesas: estado(), motivo: 'Cierre' })

    expect(liberarMesa).toHaveBeenCalledTimes(3) // la falla de la del medio no frena a la tercera
    expect(deshacerGrupoDeMesas).not.toHaveBeenCalled()
    expect(r.separado).toBe(false)
    expect(r.liberadas.map((m) => m.id)).toEqual(['m1', 'm3'])
    expect(r.fallidas).toEqual([expect.objectContaining({ id: 'm2', nombre: 'Mesa 2', mensaje: 'Hay un cobro con tarjeta en curso' })])
  })

  it('una mesa que ya estaba libre (409) es lo que se quería: no cuenta como falla', async () => {
    liberarMesa.mockRejectedValueOnce(Object.assign(new Error('409: La mesa Mesa 1 ya está libre'), { status: 409 }))
    const r = await liberarGrupo({ grupoId: 'g1', mesas: estado(), motivo: 'Cierre' })
    expect(r.fallidas).toEqual([])
    expect(r.liberadas).toHaveLength(3)
    expect(r.separado).toBe(true)
  })

  it('con todas las mesas libres solo separa el grupo', async () => {
    const mesas = estadoDelGrupo(IDS, MESAS.map((m) => ({ ...m, state: 'libre', ordenes_en_curso: [] })))
    const r = await liberarGrupo({ grupoId: 'g1', mesas, motivo: '' })
    expect(liberarMesa).not.toHaveBeenCalled()
    expect(deshacerGrupoDeMesas).toHaveBeenCalledWith('g1')
    expect(r.separado).toBe(true)
  })

  it('si liberó todo pero no pudo separar, lo dice', async () => {
    deshacerGrupoDeMesas.mockRejectedValue(new Error('No se pudo separar el grupo'))
    const r = await liberarGrupo({ grupoId: 'g1', mesas: estado(), motivo: 'Cierre' })
    expect(r).toMatchObject({ separado: false, errorAlSeparar: 'No se pudo separar el grupo', fallidas: [] })
  })
})

describe('liberarGrupoAlCobrar (al cobrar una mesa del grupo)', () => {
  // Se cobró la del medio (Mesa 2): su pedido ya no está y la mesa ya quedó libre; las otras dos siguen ocupadas sin pedido.
  const cobrada = { id: 'm2', name: 'Mesa 2', mesa_group_id: 'g1' }
  const TRAS_COBRAR = [mesa('m1', 'Mesa 1'), mesa('m2', 'Mesa 2', { state: 'libre' }), mesa('m3', 'Mesa 3')]

  beforeEach(() => { listMesasConTotales.mockResolvedValue(TRAS_COBRAR) })

  it('cobrar en la del medio deja libres las otras dos y separa el grupo', async () => {
    const r = await liberarGrupoAlCobrar({ localId: 'loc-1', mesaCobrada: cobrada })

    expect(obtenerGrupoDeMesas).toHaveBeenCalledWith('g1')
    expect(listMesasConTotales).toHaveBeenCalledWith('loc-1')
    expect(setMesaLibre).toHaveBeenCalledTimes(2)
    expect(setMesaLibre).toHaveBeenCalledWith('m1')
    expect(setMesaLibre).toHaveBeenCalledWith('m3')
    expect(deshacerGrupoDeMesas).toHaveBeenCalledWith('g1')
    expect(r).toMatchObject({ separado: true, conPedido: [], fallidas: [], error: null })
    expect(r.liberadas.map((m) => m.nombre)).toEqual(['Mesa 1', 'Mesa 3'])
  })

  it('suelta con PATCH (que puede el mesero), no con «liberar» (que solo puede el encargado)', async () => {
    await liberarGrupoAlCobrar({ localId: 'loc-1', mesaCobrada: cobrada })
    expect(liberarMesa).not.toHaveBeenCalled()
  })

  it('una mesa del grupo con un pedido abierto no se libera sola: avisa cuál es y no separa el grupo', async () => {
    listMesasConTotales.mockResolvedValue([
      mesa('m1', 'Mesa 1'),
      mesa('m2', 'Mesa 2', { state: 'libre' }),
      mesa('m3', 'Mesa 3', { ordenes_en_curso: [{ id: 'o9', total: '5400.00' }], total: 5400 }),
    ])

    const r = await liberarGrupoAlCobrar({ localId: 'loc-1', mesaCobrada: cobrada })

    expect(setMesaLibre).toHaveBeenCalledTimes(1) // la que no tiene pedido sí se suelta
    expect(setMesaLibre).toHaveBeenCalledWith('m1')
    expect(deshacerGrupoDeMesas).not.toHaveBeenCalled()
    expect(r.separado).toBe(false)
    expect(r.liberadas.map((m) => m.id)).toEqual(['m1'])
    expect(r.conPedido).toEqual([expect.objectContaining({ id: 'm3', nombre: 'Mesa 3', total: 5400 })])
  })

  it('falla parcial: sigue con las demás, no separa y dice cuáles no se pudieron soltar', async () => {
    setMesaLibre.mockImplementation(async (id) => {
      if (id === 'm1') throw Object.assign(new Error('409: x'), { status: 409, detail: 'La mesa Mesa 1 tiene un pedido en curso' })
      return {}
    })

    const r = await liberarGrupoAlCobrar({ localId: 'loc-1', mesaCobrada: cobrada })

    expect(setMesaLibre).toHaveBeenCalledTimes(2)
    expect(deshacerGrupoDeMesas).not.toHaveBeenCalled()
    expect(r.separado).toBe(false)
    expect(r.liberadas.map((m) => m.id)).toEqual(['m3'])
    expect(r.fallidas).toEqual([expect.objectContaining({ id: 'm1', mensaje: 'La mesa Mesa 1 tiene un pedido en curso' })])
  })

  it('una mesa que no está en un grupo no hace nada', async () => {
    expect(await liberarGrupoAlCobrar({ localId: 'loc-1', mesaCobrada: { id: 'm9', name: 'Mesa 9' } })).toBeNull()
    expect(obtenerGrupoDeMesas).not.toHaveBeenCalled()
    expect(setMesaLibre).not.toHaveBeenCalled()
  })

  it('si el grupo ya se había separado (404) no es un problema', async () => {
    obtenerGrupoDeMesas.mockRejectedValue(Object.assign(new Error('404: Grupo de mesas no encontrado'), { status: 404 }))
    expect(await liberarGrupoAlCobrar({ localId: 'loc-1', mesaCobrada: cobrada })).toBeNull()
  })

  it('nunca lanza: un problema al revisar el grupo se informa, porque el cobro ya está hecho', async () => {
    listMesasConTotales.mockRejectedValue(new Error('Sin conexión'))
    const r = await liberarGrupoAlCobrar({ localId: 'loc-1', mesaCobrada: cobrada })
    expect(r).toMatchObject({ error: 'Sin conexión', separado: false })
    expect(setMesaLibre).not.toHaveBeenCalled()
  })

  it('si soltó todas pero no pudo separar, lo dice', async () => {
    deshacerGrupoDeMesas.mockRejectedValue(new Error('No se pudo separar el grupo'))
    const r = await liberarGrupoAlCobrar({ localId: 'loc-1', mesaCobrada: cobrada })
    expect(r).toMatchObject({ separado: false, errorAlSeparar: 'No se pudo separar el grupo', fallidas: [], conPedido: [] })
    expect(r.liberadas).toHaveLength(2)
  })
})
