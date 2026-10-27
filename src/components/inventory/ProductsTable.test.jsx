import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ProductsTable from './ProductsTable'

describe('ProductsTable', () => {
  it('muestra estado de carga de datos', () => {
    const { container } = render(
      <ProductsTable items={[]} loading error="" currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
    )

    // 5 filas de 11 columnas (con Precio, Crítico y En venta; sin Proveedor).
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(55)
  })

  const base = { loading: false, error: '', currentPage: 1, totalPages: 1, onPageChange: vi.fn() }
  const REGISTRADO = {
    inventory_id: 'inv-1', product_id: 'p1', product_name: 'Bebida lata', stock_current: 3, stock_min: 10, stock_critical: 4,
    unit_cost_clp: 500, stock_status: 'CRITICO',
  }
  const SIN_REGISTRO = { id: 'sin-registro-p2', inventory_id: null, sin_registro: true, product_id: 'p2', product_name: 'Agua mineral', unit_cost_clp: 400 }

  it('muestra las unidades, el mínimo y el nivel crítico de cada producto', () => {
    render(<ProductsTable {...base} items={[REGISTRADO]} />)
    expect(screen.getByRole('columnheader', { name: 'Crítico' })).toBeInTheDocument()
    const fila = screen.getAllByRole('row')[1]
    const celdas = within(fila).getAllByRole('cell').map((c) => c.textContent)
    // Producto · Precio · Costo · Actual · Mín. · Máx. · Crítico
    expect(celdas.slice(3, 7)).toEqual(['3', '10', '—', '4'])
  })

  it('sumar y corregir piden registrar sobre ese producto', () => {
    const onRegistrar = vi.fn()
    render(<ProductsTable {...base} items={[REGISTRADO]} onRegistrar={onRegistrar} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sumar unidades a Bebida lata' }))
    expect(onRegistrar).toHaveBeenLastCalledWith(REGISTRADO, 'sumar')
    fireEvent.click(screen.getByRole('button', { name: 'Corregir conteo de Bebida lata' }))
    expect(onRegistrar).toHaveBeenLastCalledWith(REGISTRADO, 'corregir')
  })

  it('un producto sin stock registrado ofrece "Empezar a controlar stock" y nada más', () => {
    const onRegistrar = vi.fn()
    render(<ProductsTable {...base} items={[SIN_REGISTRO]} onRegistrar={onRegistrar} />)

    expect(screen.getByText('Sin stock registrado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sumar|Corregir|Editar/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Empezar a controlar stock/ }))
    expect(onRegistrar).toHaveBeenCalledWith(SIN_REGISTRO, 'empezar')
  })

  it('al editar, el nivel crítico no puede ser mayor que el mínimo', async () => {
    const onPatchStock = vi.fn()
    render(<ProductsTable {...base} items={[REGISTRADO]} onPatchStock={onPatchStock} />)

    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    fireEvent.change(screen.getByLabelText('Nivel crítico'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('El nivel crítico no puede ser mayor que el mínimo.')).toBeInTheDocument()
    expect(onPatchStock).not.toHaveBeenCalled()
  })

  it('al editar, guarda el nivel crítico', async () => {
    const onPatchStock = vi.fn(() => Promise.resolve())
    render(<ProductsTable {...base} items={[REGISTRADO]} onPatchStock={onPatchStock} />)

    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    fireEvent.change(screen.getByLabelText('Nivel crítico'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(onPatchStock).toHaveBeenCalledWith(REGISTRADO, { critical_stock: 2 }))
  })

  it('no tiene columna Proveedor ni agrupa por proveedor: cada producto es una fila', () => {
    const items = [
      { inventory_id: 'inv-1', product_name: 'Tomate', stock_current: 5, unit_cost_clp: 500, supplier_name: 'Proveedor A' },
      { inventory_id: 'inv-2', product_name: 'Tomate', stock_current: 3, unit_cost_clp: 450, supplier_name: 'Proveedor B' },
    ]
    render(<ProductsTable items={items} loading={false} error="" currentPage={1} totalPages={1} onPageChange={vi.fn()} />)

    expect(screen.queryByRole('columnheader', { name: 'Proveedor' })).not.toBeInTheDocument()
    expect(screen.queryByText(/proveedores/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Proveedor [AB]/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Tomate')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Editar/ })).toHaveLength(2)
  })

  it('muestra estado vacio y permite accion para crear primer producto', () => {
    const onEmptyAction = vi.fn()

    render(
      <ProductsTable
        items={[]}
        loading={false}
        error=""
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
        onEmptyAction={onEmptyAction}
      />
    )

    expect(screen.getByText('No hay productos registrados en este local.')).toBeInTheDocument()
    expect(screen.getByText('Crea el primer producto para comenzar a gestionar inventario.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Crear primer producto' }))
    expect(onEmptyAction).toHaveBeenCalledTimes(1)
  })

  it('renderiza datos cargados correctamente', () => {
    const items = [
      {
        inventory_id: 'inv-1',
        product_name: 'Tomate',
        category_name: 'Verduras',
        stock_current: 12,
        stock_min: 2,
        stock_max: 20,
        unit_cost_clp: 500,
      },
    ]

    render(
      <ProductsTable items={items} loading={false} error="" currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    )

    expect(screen.getByText('Tomate')).toBeInTheDocument()
    expect(screen.getByText('Verduras')).toBeInTheDocument()
  })
})

describe('ProductsTable · precio y «En venta» por local (#176)', () => {
  const base = { loading: false, error: '', currentPage: 1, totalPages: 1, onPageChange: vi.fn() }
  const FILA = {
    inventory_id: 'inv-1', product_id: 'p1', product_name: 'Bebida lata', category_name: 'Bebidas', stock_current: 20, stock_min: 5,
    unit_cost_clp: 800, price: 1500, local_product_id: 'lp-1', en_venta: true,
  }

  it('muestra el precio y la categoría bajo el nombre', () => {
    render(<ProductsTable {...base} items={[FILA]} />)
    expect(screen.getByRole('columnheader', { name: 'Precio' })).toBeInTheDocument()
    const celdas = within(screen.getAllByRole('row')[1]).getAllByRole('cell')
    expect(celdas[0]).toHaveTextContent('Bebida lataBebidas')
    expect(celdas[1]).toHaveTextContent('1.500')
  })

  it('el interruptor «En venta» dice su estado y pide cambiarlo', () => {
    const onToggleEnVenta = vi.fn()
    render(<ProductsTable {...base} items={[FILA, { ...FILA, inventory_id: 'inv-2', product_id: 'p2', product_name: 'Jugo', local_product_id: 'lp-2', en_venta: false }]} onToggleEnVenta={onToggleEnVenta} />)
    const sw = screen.getByRole('switch', { name: 'En venta Bebida lata' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(within(screen.getAllByRole('row')[1]).getByText('En venta')).toBeInTheDocument()
    expect(screen.getByText('Oculto')).toBeInTheDocument()
    fireEvent.click(sw)
    expect(onToggleEnVenta).toHaveBeenCalledWith(FILA)
  })

  it('al editar ofrece «Es un plato preparado», «Quitar del menú» y «Eliminar del stock del local»', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onQuitarDelMenu = vi.fn(() => Promise.resolve())
    const onPasarAPlato = vi.fn(() => Promise.resolve())
    render(<ProductsTable {...base} items={[FILA]} onQuitarDelMenu={onQuitarDelMenu} onPasarAPlato={onPasarAPlato} onPatchPrice={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    expect(screen.getByLabelText('Precio de venta (CLP)')).toHaveValue(1500)
    expect(screen.getByRole('button', { name: 'Eliminar del stock del local' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar del menú' }))
    await waitFor(() => expect(onQuitarDelMenu).toHaveBeenCalledWith(FILA))
  })

  it('al editar, cambia el precio de venta', async () => {
    const onPatchPrice = vi.fn(() => Promise.resolve())
    render(<ProductsTable {...base} items={[FILA]} onPatchPrice={onPatchPrice} />)
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    fireEvent.change(screen.getByLabelText('Precio de venta (CLP)'), { target: { value: '1800' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(onPatchPrice).toHaveBeenCalledWith(FILA, 1800))
  })
})
