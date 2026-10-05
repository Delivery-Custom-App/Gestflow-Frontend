/**
 * Importar del catálogo maestro desde la web: buscar, elegir, ver el avance y
 * que los productos queden en el menú del local.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportarCatalogoDrawer from './ImportarCatalogoDrawer'
import { importarItemAlLocal, listarCatalogoMaestro } from '../../lib/masterCatalogApi'
import { getAuthContext } from '../../lib/apiClient'

vi.mock('../../lib/masterCatalogApi', async (importOriginal) => ({
  ...(await importOriginal()),
  listarCatalogoMaestro: vi.fn(),
  importarItemAlLocal: vi.fn(),
}))

vi.mock('../../lib/apiClient', () => ({
  getAuthContext: vi.fn(() => Promise.resolve({ businessId: 'b-1' })),
  apiRequest: vi.fn(),
}))

const ITEMS = [
  { id: 'i-1', name: 'Coca-Cola 500ml', category_name: 'Bebidas', provider: 'Coca-Cola', is_active: true },
  { id: 'i-2', name: 'Agua mineral', category_name: 'Bebidas', provider: 'Vital', is_active: true },
]

describe('ImportarCatalogoDrawer', () => {
  let onImportado

  beforeEach(() => {
    vi.clearAllMocks()
    onImportado = vi.fn()
    listarCatalogoMaestro.mockResolvedValue(ITEMS)
    importarItemAlLocal.mockResolvedValue({ id: 'p-9', name: 'Coca-Cola 500ml' })
    getAuthContext.mockResolvedValue({ businessId: 'b-1' })
  })

  const montar = (props = {}) => render(
    <ImportarCatalogoDrawer localId="loc-1" onClose={() => {}} onImportado={onImportado} {...props} />,
  )

  it('lista el catálogo maestro del local', async () => {
    montar({ salesModel: 'RESTAURANT' })

    expect(await screen.findByText('Coca-Cola 500ml')).toBeInTheDocument()
    expect(screen.getByText('Agua mineral')).toBeInTheDocument()
    expect(listarCatalogoMaestro).toHaveBeenCalledWith({ salesModel: 'RESTAURANT' })
  })

  it('se puede buscar dentro del catálogo', async () => {
    const user = userEvent.setup()
    montar()

    await screen.findByText('Coca-Cola 500ml')
    await user.type(screen.getByLabelText('Buscar en el catálogo'), 'agua')

    expect(screen.queryByText('Coca-Cola 500ml')).not.toBeInTheDocument()
    expect(screen.getByText('Agua mineral')).toBeInTheDocument()
  })

  it('importa lo elegido y avisa que quedó en el menú, sin precio', async () => {
    const user = userEvent.setup()
    montar()

    await screen.findByText('Coca-Cola 500ml')
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: /importar 1/i }))

    await waitFor(() => expect(importarItemAlLocal).toHaveBeenCalledWith('i-1', { businessId: 'b-1', localId: 'loc-1' }))
    expect(await screen.findByText(/1 producto en el menú del local/i)).toBeInTheDocument()
    expect(screen.getByText(/sin precio y desactivados/i)).toBeInTheDocument()
    // La carta se recorre por categoría: hay que decir dónde quedaron.
    expect(screen.getByText(/Los encuentras en la categoría/i)).toBeInTheDocument()
    expect(screen.getByText('Bebidas')).toBeInTheDocument()
    expect(onImportado).toHaveBeenCalled()
  })

  it('lo que ya está en el menú no se puede volver a importar', async () => {
    montar({ yaEnElMenu: ['coca-cola 500ml'] })

    await screen.findByText('Coca-Cola 500ml')
    expect(screen.getByText('Ya en el menú')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')[0]).toBeDisabled()
  })

  it('informa el producto que no se pudo importar, sin perder los que sí', async () => {
    importarItemAlLocal
      .mockResolvedValueOnce({ id: 'p-9', name: 'Coca-Cola 500ml' })
      .mockRejectedValueOnce(new Error('Ítem de catálogo maestro no encontrado'))
    const user = userEvent.setup()
    montar()

    await screen.findByText('Coca-Cola 500ml')
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getAllByRole('checkbox')[1])
    await user.click(screen.getByRole('button', { name: /importar 2/i }))

    expect(await screen.findByText(/1 producto en el menú del local/i)).toBeInTheDocument()
    expect(screen.getByText(/Agua mineral: Ítem de catálogo maestro no encontrado/)).toBeInTheDocument()
  })

  it('si un producto quedó sin registro de stock, lo dice para ese producto', async () => {
    importarItemAlLocal
      .mockResolvedValueOnce({ id: 'p-9', name: 'Coca-Cola 500ml', avisoStock: 'se cayó' })
      .mockResolvedValueOnce({ id: 'p-10', name: 'Agua mineral' })
    const user = userEvent.setup()
    montar()

    await screen.findByText('Coca-Cola 500ml')
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getAllByRole('checkbox')[1])
    await user.click(screen.getByRole('button', { name: /importar 2/i }))

    expect(await screen.findByText(/2 productos en el menú del local/i)).toBeInTheDocument()
    expect(screen.getByText(/Coca-Cola 500ml: quedó en el menú, pero no se pudo crear su registro de stock \(se cayó\)/)).toBeInTheDocument()
    expect(screen.queryByText(/Agua mineral: quedó en el menú/)).not.toBeInTheDocument()
  })

  it('sin nada elegido no deja importar', async () => {
    montar()

    await screen.findByText('Coca-Cola 500ml')
    expect(screen.getByRole('button', { name: /importar/i })).toBeDisabled()
  })

  it('si el catálogo no se puede cargar lo dice', async () => {
    listarCatalogoMaestro.mockRejectedValue(new Error('500: se cayó'))
    montar()

    expect(await screen.findByText(/500: se cayó/)).toBeInTheDocument()
  })
})
