import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ProductsTable from './ProductsTable'

describe('ProductsTable', () => {
  it('muestra estado de carga de datos', () => {
    const { container } = render(
      <ProductsTable items={[]} loading error="" currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
    )

    // 5 filas de 10 columnas (con Crítico, sin Proveedor).
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(50)
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
    expect(celdas.slice(2, 5)).toEqual(['3', '10', '4'])
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
