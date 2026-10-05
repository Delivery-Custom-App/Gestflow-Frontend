import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ProductsTable from './ProductsTable'

describe('ProductsTable', () => {
  it('muestra estado de carga de datos', () => {
    const { container } = render(
      <ProductsTable items={[]} loading error="" currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
    )

    // 5 filas de 9 columnas (sin Proveedor).
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(45)
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
