/** Mesas dadas de baja y reactivar (A-05). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MesasDadasDeBaja from './MesasDadasDeBaja'
import { listMesas, reactivarMesa } from '../../lib/salesApi'

vi.mock('../../lib/salesApi', () => ({ listMesas: vi.fn(), reactivarMesa: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  listMesas.mockResolvedValue([
    { id: 'm1', name: 'Mesa 1', is_active: true },
    { id: 'm2', name: 'Mesa 2', is_active: false, zona: 'Terraza' },
  ])
  reactivarMesa.mockResolvedValue({})
})

describe('MesasDadasDeBaja', () => {
  it('lista solo las dadas de baja y las reactiva', async () => {
    const user = userEvent.setup()
    const onReactivada = vi.fn()
    render(<MesasDadasDeBaja localId="loc-1" onReactivada={onReactivada} />)
    expect(await screen.findByText('Mesa 2')).toBeInTheDocument()
    expect(screen.queryByText('Mesa 1')).not.toBeInTheDocument()
    expect(listMesas).toHaveBeenCalledWith('loc-1', { incluirInactivas: true })
    await user.click(screen.getByRole('button', { name: 'Reactivar Mesa 2' }))
    expect(reactivarMesa).toHaveBeenCalledWith('m2')
    await waitFor(() => expect(onReactivada).toHaveBeenCalled())
  })

  it('sin dadas de baja lo dice', async () => {
    listMesas.mockResolvedValue([{ id: 'm1', name: 'Mesa 1', is_active: true }])
    render(<MesasDadasDeBaja localId="loc-1" />)
    expect(await screen.findByText('No hay mesas dadas de baja.')).toBeInTheDocument()
  })
})
