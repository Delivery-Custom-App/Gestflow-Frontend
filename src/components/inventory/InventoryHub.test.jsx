/** Inventario en una sola sección (#174): Resumen · Productos · Platos preparados. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import InventoryHub from './InventoryHub'

vi.mock('../../hooks/useSelectedLocal', () => ({ useSelectedLocal: () => ({ name: 'Sucursal Centro' }) }))
vi.mock('../../hooks/useInventarioDelLocal', () => ({
  useInventarioDelLocal: () => ({ filas: [{ product_id: 'p1' }, { product_id: 'p2' }], categorias: [], loading: false, error: '', recargar: vi.fn(), setFilas: vi.fn() }),
}))
vi.mock('./unificado/ResumenInventario', () => ({ default: () => <p>parte-resumen</p> }))
vi.mock('./unificado/ProductosInventario', () => ({ default: () => <p>parte-productos</p> }))
vi.mock('./unificado/PlatosPreparados', () => ({ default: () => <p>parte-platos</p> }))

function Direccion() {
  return <p data-testid="direccion">{useLocation().pathname}</p>
}

function montar(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/local/:localId/inventario" element={<InventoryHub />} />
        <Route path="/local/:localId/inventario/productos" element={<InventoryHub />} />
        <Route path="/local/:localId/inventario/platos" element={<InventoryHub />} />
        <Route path="/local/:localId/inventario/stock" element={<Navigate to="/local/l1/inventario/productos" replace />} />
      </Routes>
      <Direccion />
    </MemoryRouter>,
  )
}

describe('InventoryHub', () => {
  it('abre en Resumen, con el encabezado y la guía', async () => {
    const user = userEvent.setup()
    montar('/local/l1/inventario')
    expect(screen.getByRole('tab', { name: /Resumen/, selected: true })).toBeInTheDocument()
    expect(screen.getByText('parte-resumen')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Resumen' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '¿Cómo funciona esta pantalla?' }))
    expect(screen.getByRole('dialog', { name: /Guía — Inventario/ })).toHaveTextContent('Vale solo para este local')
  })

  it('los botones cambian de parte y de dirección', async () => {
    const user = userEvent.setup()
    montar('/local/l1/inventario')
    await user.click(screen.getByRole('tab', { name: /Productos/ }))
    expect(screen.getByText('parte-productos')).toBeInTheDocument()
    expect(screen.getByTestId('direccion')).toHaveTextContent('/local/l1/inventario/productos')
    expect(screen.getByRole('tab', { name: /Productos/ })).toHaveTextContent('2')
    await user.click(screen.getByRole('tab', { name: /Platos preparados/ }))
    expect(screen.getByText('parte-platos')).toBeInTheDocument()
    expect(screen.getByTestId('direccion')).toHaveTextContent('/local/l1/inventario/platos')
  })

  it('la dirección vieja de Menú lleva a Productos', () => {
    montar('/local/l1/inventario/stock')
    expect(screen.getByText('parte-productos')).toBeInTheDocument()
  })
})
