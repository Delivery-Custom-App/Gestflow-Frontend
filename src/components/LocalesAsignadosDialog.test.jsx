/** Diálogo "Locales asignados" del dueño (T-72). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LocalesAsignadosDialog from './LocalesAsignadosDialog'
import { agregarLocal, listarLocalesAsignados, quitarLocal } from '../lib/localesAsignados'

vi.mock('../lib/localesAsignados', async (importOriginal) => ({
  ...(await importOriginal()),
  listarLocalesAsignados: vi.fn(),
  agregarLocal: vi.fn(),
  quitarLocal: vi.fn(),
}))

const LOCALES = [
  { id: 'loc-1', name: 'Sucursal Centro' },
  { id: 'loc-2', name: 'Mostrador Express' },
  { id: 'loc-3', name: 'Local Alameda' },
]
const VICENTE = { id: 'v1', name: 'Vicente Centro', email: 'vicente@demo.cl', role: 'EMPLEADO', local_id: 'loc-1' }

const montar = (onClose = vi.fn()) => render(<LocalesAsignadosDialog usuario={VICENTE} locales={LOCALES} onClose={onClose} />)
const lista = () => screen.getByRole('list', { name: 'Locales asignados' })

beforeEach(() => {
  vi.clearAllMocks()
  listarLocalesAsignados.mockResolvedValue([
    { id: 'a1', local_id: 'loc-1', is_primary: true },
    { id: 'a2', local_id: 'loc-2', is_primary: false },
  ])
})

describe('LocalesAsignadosDialog', () => {
  it('muestra el local principal marcado y los demás asignados', async () => {
    montar()
    expect(await within(await screen.findByRole('list', { name: 'Locales asignados' })).findByText('Mostrador Express')).toBeInTheDocument()
    const principal = within(lista()).getByText('Sucursal Centro').closest('li')
    expect(within(principal).getByText('Principal')).toBeInTheDocument()
    expect(within(principal).queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument()
    expect(listarLocalesAsignados).toHaveBeenCalledWith('v1')
  })

  it('solo ofrece agregar locales del negocio que todavía no tiene', async () => {
    montar()
    const select = await screen.findByLabelText('Agregar un local')
    const opciones = within(select).getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toEqual(['Elige un local', 'Local Alameda'])
  })

  it('agregar un local lo asigna (con el principal y las asignaciones de hoy) y recarga', async () => {
    agregarLocal.mockResolvedValue({ id: 'a3' })
    const user = userEvent.setup()
    montar()
    await user.selectOptions(await screen.findByLabelText('Agregar un local'), 'loc-3')
    await user.click(screen.getByRole('button', { name: /Agregar/ }))

    expect(agregarLocal).toHaveBeenCalledWith('v1', 'loc-3', {
      localPrincipalId: 'loc-1',
      asignaciones: [{ id: 'a1', local_id: 'loc-1', is_primary: true }, { id: 'a2', local_id: 'loc-2', is_primary: false }],
    })
    await waitFor(() => expect(listarLocalesAsignados).toHaveBeenCalledTimes(2))
  })

  it('quitar pide confirmación antes de borrar la asignación', async () => {
    quitarLocal.mockResolvedValue(undefined)
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Quitar Mostrador Express' }))
    expect(quitarLocal).not.toHaveBeenCalled()
    expect(screen.getByText(/ya no podrá cambiarse a ese local/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sí, quitar' }))
    expect(quitarLocal).toHaveBeenCalledWith('v1', 'a2')
  })

  it('"No" cancela sin quitar', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Quitar Mostrador Express' }))
    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(quitarLocal).not.toHaveBeenCalled()
  })

  it('un error del backend se muestra con su detalle', async () => {
    agregarLocal.mockRejectedValue(Object.assign(new Error('400: El local no pertenece al business del usuario'), { detail: 'El local no pertenece al business del usuario' }))
    const user = userEvent.setup()
    montar()
    await user.selectOptions(await screen.findByLabelText('Agregar un local'), 'loc-3')
    await user.click(screen.getByRole('button', { name: /Agregar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El local no pertenece al business del usuario')
  })

  it('si ya tiene todos los locales, lo dice en vez de ofrecer agregar', async () => {
    listarLocalesAsignados.mockResolvedValue([
      { id: 'a1', local_id: 'loc-1' }, { id: 'a2', local_id: 'loc-2' }, { id: 'a3', local_id: 'loc-3' },
    ])
    montar()
    expect(await screen.findByText('Ya tiene asignados todos los locales del negocio.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Agregar un local')).not.toBeInTheDocument()
  })

  it('si no se pueden cargar, lo dice', async () => {
    listarLocalesAsignados.mockRejectedValue(new Error('403: No autorizado'))
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado')
  })
})
