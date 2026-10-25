import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MesaWorkspace from './MesaWorkspace'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import { createOrder, addOrderItem, updateOrderItem, removeOrderItem, liberarMesa, listMesasConTotales, setMesaLibre } from '../../lib/salesApi'
import { deshacerGrupoDeMesas, obtenerGrupoDeMesas } from '../../lib/mesaGroupsApi'

vi.mock('../../hooks/useMesaDetail', () => ({ useMesaDetail: vi.fn() }))
vi.mock('../../hooks/useMenuPOS', () => ({ useMenuPOS: vi.fn() }))
vi.mock('../../hooks/useOrderManagement', () => ({ useOrderManagement: vi.fn() }))
vi.mock('../../lib/salesApi', () => ({
  createOrder: vi.fn(),
  addOrderItem: vi.fn(),
  setMesaLibre: vi.fn(),
  liberarMesa: vi.fn(),
  listMesasConTotales: vi.fn(),
  updateOrderItem: vi.fn(),
  removeOrderItem: vi.fn(),
}))
vi.mock('../../lib/mesaGroupsApi', () => ({ obtenerGrupoDeMesas: vi.fn(), deshacerGrupoDeMesas: vi.fn() }))
// El cobro manda la boleta a imprimir: acá no hay impresora.
vi.mock('./order-panel/orderPrint', async (importOriginal) => ({ ...(await importOriginal()), openPrintWindow: vi.fn() }))
vi.mock('../../lib/apiClient', () => ({
  getSplitPaymentSummary: vi.fn().mockResolvedValue({ splits: [], is_fully_paid: false }),
}))
// Como en la app: la comanda encendida, el pago dividido apagado.
vi.mock('../../lib/v2Features', () => ({ isV2FeatureEnabled: (k) => k === 'comandas' }))
vi.mock('./MercadoPagoModal', () => ({
  default: ({ open, onSuccess, total, description }) => open ? (
    <div><p>{`Cobro de ${description}: ${total}`}</p><button type="button" onClick={onSuccess}>Simular pago aprobado</button></div>
  ) : null,
}))
vi.mock('./MultiPaymentModal', () => ({ default: () => null }))
vi.mock('./TicketModal', () => ({
  default: ({ tipo, orderId, createdAt }) => <p>{`${tipo} de ${orderId} (${createdAt})`}</p>,
}))

const mesa = { id: 'mesa-1', name: 'Mesa 1', zona: 'Salón' }

const menuData = {
  categories: [
    { id: 'cat1', name: 'Bebidas', products: [{ id: 'prod1', name: 'Agua', price: 1000 }] },
  ],
}

function setup({ activeOrders = [] } = {}) {
  const refresh = vi.fn()
  const updateAfterItemRemoval = vi.fn()
  useMesaDetail.mockReturnValue({ detail: { active_orders: activeOrders }, loading: false, error: null, refresh, updateAfterItemRemoval })
  useMenuPOS.mockReturnValue({ data: menuData, loading: false, fetch: vi.fn() })
  useOrderManagement.mockReturnValue({ updateOrderStatus: vi.fn() })
  return { refresh, updateAfterItemRemoval }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MesaWorkspace', () => {
  it('solo el administrador o el dueño ve Liberar mesa', () => {
    setup({ activeOrders: [{ id: 'order-1', items: [] }] })
    const props = { mesa: { ...mesa, state: 'ocupada' }, localId: 'local1', cajaId: 'caja1', onBack: vi.fn(), onTableUpdated: vi.fn() }

    const { rerender } = render(<MesaWorkspace {...props} puedeLiberarMesa />)
    expect(screen.getByRole('button', { name: 'Liberar mesa' })).toBeInTheDocument()

    rerender(<MesaWorkspace {...props} puedeLiberarMesa={false} />)
    expect(screen.queryByRole('button', { name: 'Liberar mesa' })).not.toBeInTheDocument()
  })

  it('pide motivo, muestra el total y vuelve al plano con el total sin cobrar', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const onTableUpdated = vi.fn()
    setup({ activeOrders: [{ id: 'order-1', items: [{ id: 'i1', quantity: 1, total_price: 5000 }] }] })
    liberarMesa.mockResolvedValue({ status: 'available', total_sin_cobrar: '5000.00' })
    render(<MesaWorkspace mesa={{ ...mesa, state: 'ocupada' }} localId="local1" cajaId="caja1" puedeLiberarMesa onBack={onBack} onTableUpdated={onTableUpdated} />)

    await user.click(screen.getByRole('button', { name: 'Liberar mesa' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Total actual que quedar/)).toHaveTextContent('$5.000')
    await user.type(within(dialog).getByLabelText('Motivo'), 'Clientes se retiraron')
    await user.click(within(dialog).getByRole('button', { name: 'Liberar mesa' }))

    expect(liberarMesa).toHaveBeenCalledWith('mesa-1', 'Clientes se retiraron')
    expect(screen.getByRole('dialog')).toHaveTextContent(/Total sin cobrar\s*\$5\.000/)
    await user.click(screen.getByRole('button', { name: 'Volver a mesas' }))
    expect(onTableUpdated).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('un 409 al intentar dejar la mesa disponible ofrece Liberar mesa al administrador', async () => {
    const user = userEvent.setup()
    setup({ activeOrders: [{ id: 'order-1', items: [] }] })
    setMesaLibre.mockRejectedValue(Object.assign(new Error('409: Hay un cobro con tarjeta en curso'), { status: 409 }))
    render(<MesaWorkspace mesa={{ ...mesa, state: 'ocupada' }} localId="local1" cajaId="caja1" puedeLiberarMesa onBack={vi.fn()} onTableUpdated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(screen.getByRole('button', { name: 'Simular pago aprobado' }))

    expect(await screen.findByText('409: Hay un cobro con tarjeta en curso')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Liberar mesa' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Total actual que quedaría sin cobrar')
  })

  it('#156: junto a «Liberar mesa» se explica que cancela lo no cobrado, y la mesa se recarga', async () => {
    const user = userEvent.setup()
    const { refresh } = setup({ activeOrders: [{ id: 'order-1', items: [] }] })
    setMesaLibre.mockRejectedValue(Object.assign(new Error('409: La mesa Mesa 1 tiene un pedido en curso'), { status: 409 }))
    render(<MesaWorkspace mesa={{ ...mesa, state: 'ocupada' }} localId="local1" cajaId="caja1" puedeLiberarMesa onBack={vi.fn()} onTableUpdated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(screen.getByRole('button', { name: 'Simular pago aprobado' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ojo: liberar la mesa cancela sin cobrar lo que quede pendiente.')
    expect(refresh).toHaveBeenCalled()
  })

  it('Cobrar deshabilitado cuando la mesa no tiene orden activa', () => {
    setup({ activeOrders: [] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)
    expect(screen.getByRole('button', { name: /cobrar/i })).toBeDisabled()
  })

  it('Cobrar habilitado cuando ya hay una orden activa', () => {
    setup({ activeOrders: [{ id: 'order-1', created_at: '2024-01-01T00:00:00Z', items: [] }] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)
    expect(screen.getByRole('button', { name: /cobrar/i })).not.toBeDisabled()
  })

  it('la cantidad decimal del backend se muestra como cantidad ("1.000" -> 1)', () => {
    setup({ activeOrders: [{
      id: 'order-1',
      created_at: '2024-01-01T00:00:00Z',
      items: [
        { id: 'i1', item_name: 'Café Americano', quantity: '1.000', unit_price: 2500, total_price: 2500 },
        { id: 'i2', item_name: 'Queso', quantity: '0.500', unit_price: 1000, total_price: 500 },
      ],
    }] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)
    const fila = (nombre) => screen.getAllByText(nombre)[0].closest('tr')
    expect(within(fila('Café Americano')).getByText('1')).toBeInTheDocument()
    expect(within(fila('Queso')).getByText('0,5')).toBeInTheDocument()
    expect(screen.queryByText('1.000')).not.toBeInTheDocument()
  })

  it('agregar producto sin orden previa crea la orden (createOrder), no addOrderItem', async () => {
    const user = userEvent.setup()
    const { refresh } = setup({ activeOrders: [] })
    createOrder.mockResolvedValue({ id: 'order-nueva' })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.clear(screen.getByLabelText('Comensales'))
    await user.type(screen.getByLabelText('Comensales'), '4')
    await user.click(screen.getByText('+'))
    await user.click(screen.getByRole('button', { name: /agregar al pedido/i }))

    await waitFor(() => expect(createOrder).toHaveBeenCalledWith({
      local_id: 'local1',
      mesa_id: 'mesa-1',
      caja_id: 'caja1',
      source: 'dine_in',
      guests: 4,
      items: [{ product_id: 'prod1', quantity: 1, unit_price: 1000 }],
      idempotency_key: expect.any(String),
    }))
    expect(addOrderItem).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('reutiliza la clave si falla la creación y el usuario reintenta la misma acción', async () => {
    const user = userEvent.setup()
    setup({ activeOrders: [] })
    createOrder.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce({ id: 'order-nueva' })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getByText('+'))
    await user.click(screen.getByRole('button', { name: /agregar al pedido/i }))
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    const firstKey = createOrder.mock.calls[0][0].idempotency_key

    await user.click(screen.getByRole('button', { name: /agregar al pedido/i }))

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2))
    expect(createOrder.mock.calls[1][0].idempotency_key).toBe(firstKey)
  })

  it('agregar producto con orden ya activa llama addOrderItem, no createOrder', async () => {
    const user = userEvent.setup()
    const { refresh } = setup({ activeOrders: [{ id: 'order-existing', created_at: '2024-01-01T00:00:00Z', items: [] }] })
    addOrderItem.mockResolvedValue({})
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getByText('+'))
    await user.click(screen.getByRole('button', { name: /agregar al pedido/i }))

    await waitFor(() => expect(addOrderItem).toHaveBeenCalledWith(
      'order-existing',
      { product_id: 'prod1', quantity: 1, unit_price: 1000 },
      '2024-01-01T00:00:00Z',
      expect.stringMatching(/:item:0$/),
    ))
    expect(createOrder).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  // La pantalla de Cocina está apagada: la comanda se ve e imprime desde la mesa.
  it('con una orden activa abre la comanda de esa orden', async () => {
    const user = userEvent.setup()
    setup({ activeOrders: [{ id: 'order-1', created_at: '2024-01-01T00:00:00Z', items: [] }] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Comanda' }))

    expect(screen.getByText('comanda de order-1 (2024-01-01T00:00:00Z)')).toBeInTheDocument()
  })

  it('sin orden activa no hay comanda que abrir', () => {
    setup({ activeOrders: [] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    expect(screen.getByRole('button', { name: 'Comanda' })).toBeDisabled()
  })

  // T-42: Imprimir y Cancelar eran solo un ícono de 44 px.
  it('los botones de la mesa miden 48 px y Imprimir y Cancelar llevan texto', () => {
    setup({ activeOrders: [{ id: 'order-1', created_at: '2024-01-01T00:00:00Z', items: [] }] })
    render(<MesaWorkspace mesa={{ ...mesa, state: 'ocupada' }} localId="local1" cajaId="caja1" puedeLiberarMesa onBack={() => {}} onTableUpdated={() => {}} />)

    for (const nombre of ['Liberar mesa', 'Cobrar', 'Imprimir', 'Comanda', 'Cancelar orden']) {
      const boton = screen.getByRole('button', { name: nombre })
      expect(boton).toHaveTextContent(nombre)
      expect(boton).toHaveClass('h-12')
    }
  })
})

describe('MesaWorkspace · editar y quitar ítems (T-30)', () => {
  const orden = { id: 'order-1', created_at: '2026-10-14T12:00:00Z', items: [{ id: 'it-1', product_name: 'Agua', quantity: 2, total_price: 2000 }] }

  it('«+» manda PATCH solo con la cantidad nueva y recarga la mesa', async () => {
    const user = userEvent.setup()
    const { refresh } = setup({ activeOrders: [orden] })
    updateOrderItem.mockResolvedValue({})
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getAllByRole('button', { name: 'Sumar uno de Agua' })[0])
    expect(updateOrderItem).toHaveBeenCalledWith('order-1', 'it-1', { quantity: 3 }, '2026-10-14T12:00:00Z')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('«Quitar» confirma, usa DELETE y recarga', async () => {
    const user = userEvent.setup()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { refresh } = setup({ activeOrders: [orden] })
    removeOrderItem.mockResolvedValue(true)
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getAllByRole('button', { name: 'Quitar Agua del pedido' })[0])
    expect(removeOrderItem).toHaveBeenCalledWith('order-1', 'it-1', '2026-10-14T12:00:00Z')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    confirmar.mockRestore()
  })

  it('actualiza el total desde X-Order-Total sin recargar la mesa', async () => {
    const user = userEvent.setup()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { refresh, updateAfterItemRemoval } = setup({ activeOrders: [orden] })
    removeOrderItem.mockResolvedValue({ orderTotal: 1200 })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getAllByRole('button', { name: 'Quitar Agua del pedido' })[0])

    expect(updateAfterItemRemoval).toHaveBeenCalledWith('order-1', 'it-1', 1200)
    expect(refresh).not.toHaveBeenCalled()
    confirmar.mockRestore()
  })

  it('un pedido cerrado muestra «El pedido ya está cerrado»', async () => {
    const user = userEvent.setup()
    setup({ activeOrders: [orden] })
    updateOrderItem.mockRejectedValue(new Error('El pedido ya está cerrado'))
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getAllByRole('button', { name: 'Sumar uno de Agua' })[0])
    expect((await screen.findAllByText('El pedido ya está cerrado')).length).toBeGreaterThan(0)
  })
})

describe('MesaWorkspace · roles de caja (A-03)', () => {
  const orden = { id: 'order-1', created_at: '2026-10-14T12:00:00Z', items: [] }

  it('el administrador de restaurante no ve «Cobrar», pero sí cancelar', () => {
    setup({ activeOrders: [orden] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" puedeCobrar={false} onBack={() => {}} onTableUpdated={() => {}} />)
    expect(screen.queryByRole('button', { name: /^cobrar$/i })).not.toBeInTheDocument()
    expect(screen.getAllByTitle('Cancelar orden').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/el administrador no cobra/).length).toBeGreaterThan(0)
  })

  it('el dueño y el vendedor ven «Cobrar»', () => {
    setup({ activeOrders: [orden] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)
    expect(screen.getAllByRole('button', { name: /cobrar/i }).length).toBeGreaterThan(0)
  })
})

describe('MesaWorkspace · nota del ítem (A-06)', () => {
  it('agrega una nota a un ítem con PATCH notes y vaciarla la borra', async () => {
    const user = userEvent.setup()
    const orden = { id: 'order-1', created_at: '2026-10-14T12:00:00Z', items: [{ id: 'it-1', product_name: 'Agua', quantity: 1, total_price: 1000, notes: null }] }
    setup({ activeOrders: [orden] })
    updateOrderItem.mockResolvedValue({})
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)
    await user.click(screen.getAllByRole('button', { name: 'Agregar nota de Agua' })[0])
    await user.type(screen.getAllByLabelText('Nota de Agua')[0], 'sin gas')
    await user.click(screen.getAllByRole('button', { name: 'Guardar' })[0])
    expect(updateOrderItem).toHaveBeenCalledWith('order-1', 'it-1', { notes: 'sin gas' }, '2026-10-14T12:00:00Z')
  })
})

// Mesas juntadas (#221): al cobrar una mesa del grupo, las otras que quedaron ocupadas sin pedido se sueltan y el grupo se separa.
describe('MesaWorkspace · cobrar una mesa de un grupo', () => {
  const delMedio = { ...mesa, id: 'm2', name: 'Mesa 2', state: 'ocupada', mesa_group_id: 'g1' }
  const deGrupo = (id, nombre, extra = {}) => ({ id, name: nombre, nombre, state: 'ocupada', mesa_group_id: 'g1', ordenes_en_curso: [], ...extra })
  // Tras cobrar la del medio: ella ya está libre; las otras dos siguen ocupadas sin pedido.
  const TRAS_COBRAR = [deGrupo('m1', 'Mesa 1'), deGrupo('m2', 'Mesa 2', { state: 'libre' }), deGrupo('m3', 'Mesa 3')]

  beforeEach(() => {
    setMesaLibre.mockResolvedValue({})
    deshacerGrupoDeMesas.mockResolvedValue(undefined)
    obtenerGrupoDeMesas.mockResolvedValue({ id: 'g1', mesa_ids: ['m1', 'm2', 'm3'] })
    listMesasConTotales.mockResolvedValue(TRAS_COBRAR)
  })

  async function cobrar(props = {}) {
    const user = userEvent.setup()
    const callbacks = { onBack: vi.fn(), onTableUpdated: vi.fn(), onGrupoActualizado: vi.fn() }
    setup({ activeOrders: [{ id: 'order-1', created_at: '2024-01-01T00:00:00Z', items: [] }] })
    render(<MesaWorkspace mesa={delMedio} localId="local1" cajaId="caja1" {...callbacks} {...props} />)
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(screen.getByRole('button', { name: 'Simular pago aprobado' }))
    return callbacks
  }

  it('cobrar en la del medio deja libres las tres y separa el grupo, también si cobra un mesero', async () => {
    // Un mesero: `puedeLiberarMesa` apagado (no puede usar «Liberar mesa»), igual se sueltan las otras mesas.
    const { onBack, onGrupoActualizado } = await cobrar({ puedeLiberarMesa: false })

    await waitFor(() => expect(onBack).toHaveBeenCalledOnce())
    expect(setMesaLibre.mock.calls.map(([id]) => id)).toEqual(['m2', 'm1', 'm3']) // primero la cobrada, después las otras
    expect(deshacerGrupoDeMesas).toHaveBeenCalledWith('g1')
    expect(liberarMesa).not.toHaveBeenCalled() // «liberar» es solo del encargado: el mesero usa PATCH
    expect(listMesasConTotales).toHaveBeenCalledWith('local1')
    expect(onGrupoActualizado).toHaveBeenCalledWith(expect.objectContaining({
      separado: true, mesaCobrada: 'Mesa 2', conPedido: [], fallidas: [],
      liberadas: [expect.objectContaining({ nombre: 'Mesa 1' }), expect.objectContaining({ nombre: 'Mesa 3' })],
    }))
  })

  it('con el encargado pasa lo mismo', async () => {
    const { onBack } = await cobrar({ puedeLiberarMesa: true })

    await waitFor(() => expect(onBack).toHaveBeenCalledOnce())
    expect(deshacerGrupoDeMesas).toHaveBeenCalledWith('g1')
  })

  it('el grupo se suelta antes de volver a la vista de mesas, para que ya se vean todas libres', async () => {
    const orden = []
    setMesaLibre.mockImplementation(async (id) => { orden.push(`libre ${id}`) })
    deshacerGrupoDeMesas.mockImplementation(async () => { orden.push('separar') })
    await cobrar({ onBack: () => orden.push('volver'), onTableUpdated: () => orden.push('refrescar') })

    await waitFor(() => expect(orden).toContain('volver'))
    expect(orden).toEqual(['libre m2', 'libre m1', 'libre m3', 'separar', 'refrescar', 'volver'])
  })

  it('una mesa del grupo con un pedido abierto no se libera sola: se avisa cuál es y el cobro igual termina', async () => {
    listMesasConTotales.mockResolvedValue([
      deGrupo('m1', 'Mesa 1'),
      deGrupo('m2', 'Mesa 2', { state: 'libre' }),
      deGrupo('m3', 'Mesa 3', { ordenes_en_curso: [{ id: 'o3', total: '5400.00' }] }),
    ])
    const { onBack, onGrupoActualizado } = await cobrar()

    await waitFor(() => expect(onBack).toHaveBeenCalledOnce())
    expect(setMesaLibre.mock.calls.map(([id]) => id)).toEqual(['m2', 'm1']) // la Mesa 3, con pedido, no se toca
    expect(deshacerGrupoDeMesas).not.toHaveBeenCalled()
    expect(onGrupoActualizado).toHaveBeenCalledWith(expect.objectContaining({
      separado: false, conPedido: [expect.objectContaining({ id: 'm3', nombre: 'Mesa 3', total: 5400 })],
    }))
  })

  it('falla parcial: sigue con las demás y avisa cuáles no se pudieron liberar', async () => {
    setMesaLibre.mockImplementation(async (id) => {
      if (id === 'm1') throw Object.assign(new Error('409: x'), { status: 409, detail: 'La mesa Mesa 1 tiene un pedido en curso' })
      return {}
    })
    const { onBack, onGrupoActualizado } = await cobrar()

    await waitFor(() => expect(onBack).toHaveBeenCalledOnce())
    expect(setMesaLibre.mock.calls.map(([id]) => id)).toEqual(['m2', 'm1', 'm3'])
    expect(deshacerGrupoDeMesas).not.toHaveBeenCalled()
    expect(onGrupoActualizado).toHaveBeenCalledWith(expect.objectContaining({
      separado: false,
      liberadas: [expect.objectContaining({ id: 'm3' })],
      fallidas: [expect.objectContaining({ id: 'm1', mensaje: 'La mesa Mesa 1 tiene un pedido en curso' })],
    }))
  })

  it('si no se puede revisar el grupo, el cobro igual queda hecho y se informa', async () => {
    listMesasConTotales.mockRejectedValue(new Error('Sin conexión'))
    const { onBack, onGrupoActualizado } = await cobrar()

    await waitFor(() => expect(onBack).toHaveBeenCalledOnce())
    expect(onGrupoActualizado).toHaveBeenCalledWith(expect.objectContaining({ error: 'Sin conexión', separado: false }))
  })

  it('una mesa que no está en un grupo se cobra como siempre: no toca ningún grupo', async () => {
    const { onBack, onGrupoActualizado } = await cobrar({ mesa: { ...delMedio, mesa_group_id: null } })

    await waitFor(() => expect(onBack).toHaveBeenCalledOnce())
    expect(setMesaLibre).toHaveBeenCalledTimes(1)
    expect(obtenerGrupoDeMesas).not.toHaveBeenCalled()
    expect(listMesasConTotales).not.toHaveBeenCalled()
    expect(onGrupoActualizado).not.toHaveBeenCalled()
  })
})

describe('MesaWorkspace · una mesa con dos pedidos (#156)', () => {
  const pedidos = [
    { id: 'order-1', created_at: '2026-10-24T12:00:00Z', items: [{ id: 'i1', product_name: 'Agua', quantity: 1, unit_price: 2200, total_price: 2200 }] },
    { id: 'order-2', created_at: '2026-10-24T12:00:01Z', items: [{ id: 'i2', product_name: 'Jugo', quantity: 1, unit_price: 1800, total_price: 1800 }] },
  ]

  it('avisa que hay dos pedidos y cobra primero uno, por su monto', async () => {
    const user = userEvent.setup()
    setup({ activeOrders: pedidos })
    render(<MesaWorkspace mesa={{ ...mesa, state: 'ocupada' }} localId="local1" cajaId="caja1" onBack={vi.fn()} onTableUpdated={vi.fn()} />)

    expect(screen.getByRole('note')).toHaveTextContent('Esta mesa tiene 2 pedidos abiertos')
    expect(screen.getByRole('note')).toHaveTextContent('ahora el pedido 1 de 2, por $2.200')
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    expect(screen.getByText('Cobro de Mesa Mesa 1 · pedido 1 de 2: 2200')).toBeInTheDocument()
  })

  it('cobrado el primero, la mesa sigue ocupada y dice cuánto falta', async () => {
    const user = userEvent.setup()
    const { refresh } = setup({ activeOrders: pedidos })
    const onBack = vi.fn()
    render(<MesaWorkspace mesa={{ ...mesa, state: 'ocupada' }} localId="local1" cajaId="caja1" onBack={onBack} onTableUpdated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(screen.getByRole('button', { name: 'Simular pago aprobado' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Pedido cobrado. Falta 1 pedido de esta mesa por $1.800: pulsa «Cobrar» de nuevo.')
    expect(setMesaLibre).not.toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('con un solo pedido se cobra el total y no aparece el aviso', async () => {
    const user = userEvent.setup()
    setup({ activeOrders: [pedidos[0]] })
    render(<MesaWorkspace mesa={{ ...mesa, state: 'ocupada' }} localId="local1" cajaId="caja1" onBack={vi.fn()} onTableUpdated={vi.fn()} />)

    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    expect(screen.getByText('Cobro de Mesa Mesa 1: 2200')).toBeInTheDocument()
  })
})
