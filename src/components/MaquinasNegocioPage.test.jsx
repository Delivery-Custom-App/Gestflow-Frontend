/** Máquinas POS del negocio para el dueño (T-44). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MaquinasNegocioPage from './MaquinasNegocioPage'
import { apiRequest } from '../lib/apiClient'
import { agruparPorLocal, textoOcupacion } from '../lib/maquinasNegocio'

vi.mock('../lib/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: LOCALES }) }))
vi.mock('../lib/administrativeApi', () => ({ listarCajasFisicas: vi.fn(() => Promise.resolve([{ id: 'cf-9', name: 'Caja mostrador' }])) }))

const LOCALES = [
  { id: 'l1', name: 'Restaurante Centro', sales_model: 'RESTAURANT' },
  { id: 'l2', name: 'Mostrador Express', sales_model: 'AL_PASO' },
]
const RESPUESTA = {
  mercadopago_conectado: true,
  registradas: [
    { id: 'm1', display_name: 'Point barra', local_id: 'l1', local_name: 'Restaurante Centro', provider: 'mercadopago', terminal_id: 'NEWLAND_1', ocupacion: 1, usuarios: ['Ana'], is_active: true },
    { id: 'm2', display_name: 'Point caja', local_id: 'l2', local_name: 'Mostrador Express', caja_fisica_nombre: 'Principal', provider: 'mercadopago', terminal_id: 'NEWLAND_2', ocupacion: 0, usuarios: [], is_active: true },
  ],
  sin_registrar: [{ terminal_id: 'NEWLAND_3', name: 'Point nuevo' }],
  aviso: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  apiRequest.mockImplementation(async (path) => (path === '/pos-machines/negocio' ? RESPUESTA : {}))
})

describe('lib/maquinasNegocio', () => {
  it('agrupa por local y describe la ocupación', () => {
    expect(agruparPorLocal(RESPUESTA.registradas).map((g) => g.localName)).toEqual(['Mostrador Express', 'Restaurante Centro'])
    expect(textoOcupacion({ ocupacion: 0 })).toBe('Libre')
    expect(textoOcupacion({ ocupacion: 2, usuarios: ['Ana', 'Luis'] })).toBe('Llena: Ana y Luis')
  })
})

describe('MaquinasNegocioPage', () => {
  it('lista las máquinas por local con caja, proveedor, terminal y ocupación, y las sin registrar', async () => {
    render(<MaquinasNegocioPage />)
    const centro = await screen.findByRole('region', { name: 'Máquinas de Restaurante Centro' })
    expect(centro).toHaveTextContent('Point barra')
    expect(centro).toHaveTextContent('Mercado Pago · NEWLAND_1')
    expect(centro).toHaveTextContent('En uso: Ana')
    expect(screen.getByRole('region', { name: 'Máquinas de Mostrador Express' })).toHaveTextContent('Caja Principal')
    expect(within(screen.getByRole('region', { name: 'Sin registrar' })).getByText(/NEWLAND_3/)).toBeInTheDocument()
  })

  it('mover a un local al paso pide la caja física y llama a /mover', async () => {
    const user = userEvent.setup()
    render(<MaquinasNegocioPage />)
    await user.click(await screen.findByRole('button', { name: 'Mover Point barra a otro local' }))
    await user.selectOptions(screen.getByLabelText('Local'), 'l2')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/caja física/)
    await waitFor(() => expect(screen.getByRole('option', { name: 'Caja mostrador' })).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText('Caja física'), 'cf-9')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(apiRequest).toHaveBeenCalledWith('/pos-machines/m1/mover', { method: 'POST', body: { local_id: 'l2', caja_fisica_id: 'cf-9' } })
    expect(await screen.findByRole('status')).toHaveTextContent('Point barra se movió de local.')
  })

  it('el 409 al mover se muestra', async () => {
    const user = userEvent.setup()
    apiRequest.mockImplementation(async (path) => {
      if (path === '/pos-machines/negocio') return RESPUESTA
      throw Object.assign(new Error('409: x'), { detail: 'La máquina la usa un turno de hoy' })
    })
    render(<MaquinasNegocioPage />)
    await user.click(await screen.findByRole('button', { name: 'Mover Point barra a otro local' }))
    await user.selectOptions(screen.getByLabelText('Local'), 'l1')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La máquina la usa un turno de hoy')
  })

  it('registrar una terminal en un local', async () => {
    const user = userEvent.setup()
    render(<MaquinasNegocioPage />)
    await user.click(await screen.findByRole('button', { name: 'Registrar NEWLAND_3 en un local' }))
    await user.selectOptions(screen.getByLabelText('Local'), 'l1')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(apiRequest).toHaveBeenCalledWith('/webhooks/mercadopago-pos', { method: 'POST', body: { mp_pos_id: 'NEWLAND_3', local_id: 'l1', name: 'Point nuevo' } })
  })

  it('si Mercado Pago no responde, muestra el aviso y las registradas igual', async () => {
    apiRequest.mockImplementation(async () => ({ ...RESPUESTA, sin_registrar: [], aviso: 'Mercado Pago no respondió' }))
    render(<MaquinasNegocioPage />)
    expect(await screen.findByRole('note')).toHaveTextContent('Mercado Pago no respondió')
    expect(screen.getByText('Point barra')).toBeInTheDocument()
  })
})
