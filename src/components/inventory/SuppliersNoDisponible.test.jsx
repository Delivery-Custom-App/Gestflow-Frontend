/**
 * Proveedores: el módulo no existe en Backend V2 y las funciones del front son
 * sustitutos que devuelven listas vacías. La pantalla cargaba sin errores y con
 * todos los indicadores en cero, que se lee como un dato real: cero proveedores
 * y cero compras. Ahora lo dice explícitamente.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import SuppliersKpisDashboard from './SuppliersKpisDashboard'
import { V2_FEATURES } from '../../lib/v2Features'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isInventoryAdmin: true, userRole: 'ADMIN_NEGOCIO' }),
}))
vi.mock('../../hooks/useSelectedLocal', () => ({ useSelectedLocal: () => null }))
vi.mock('../../hooks/useLocalBusinessId', () => ({ useLocalBusinessId: () => ({ businessId: 'biz-1', loading: false }) }))
vi.mock('./RegisterSupplierModal', () => ({ default: () => null }))
vi.mock('./SupplierDetailModal', () => ({ default: () => null }))
vi.mock('./InventoryShell', () => ({ default: ({ children }) => <div>{children}</div> }))

function montar() {
  return render(
    <MemoryRouter initialEntries={['/local/loc-1/inventario/proveedores']}>
      <Routes>
        <Route path="/local/:localId/inventario/proveedores" element={<SuppliersKpisDashboard />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Proveedores sin backend en V2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('la bandera suppliers está apagada porque V2 no tiene el módulo', () => {
    expect(V2_FEATURES.suppliers).toBe(false)
  })

  it('avisa explícitamente que el módulo todavía no está disponible', async () => {
    montar()

    expect(await screen.findByText(/todavía no está disponible/i)).toBeInTheDocument()
    expect(screen.getByText(/no eran un dato real/i)).toBeInTheDocument()
  })

  it('no muestra indicadores en cero, que se leen como datos reales', async () => {
    montar()

    await screen.findByText(/todavía no está disponible/i)
    expect(screen.queryByText('Listado de proveedores')).not.toBeInTheDocument()
    expect(screen.queryByText(/proveedores registrados/i)).not.toBeInTheDocument()
    // Ningún KPI numérico a la vista.
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('no ofrece registrar un proveedor que no se puede guardar', async () => {
    montar()

    await screen.findByText(/todavía no está disponible/i)
    expect(screen.queryByRole('button', { name: /registrar proveedor/i })).not.toBeInTheDocument()
  })
})
