/** Máquinas POS del negocio para el dueño (T-44). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MaquinasNegocioPage from './MaquinasNegocioPage'
import { apiRequest } from '../lib/apiClient'
import { agruparPorLocal, textoOcupacion } from '../lib/maquinasNegocio'
import { V2_FEATURES } from '../lib/v2Features'

vi.mock('../lib/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: LOCALES }) }))
vi.mock('./pos/MPConfigDrawer', () => ({
  default: ({ open, localId }) => (open ? <div role="dialog" aria-label="Configurar POS">drawer del local {localId}</div> : null),
}))
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
  it('con la cuenta sin conectar ofrece conectarla: elige el local y abre la configuración de ese local', async () => {
    const user = userEvent.setup()
    apiRequest.mockImplementation(async (path) => (path === '/pos-machines/negocio'
      ? { ...RESPUESTA, mercadopago_conectado: false, registradas: [], aviso: 'Conecta tu cuenta de Mercado Pago para ver las máquinas de la cuenta' }
      : {}))
    render(<MaquinasNegocioPage />)
    const boton = await screen.findByRole('button', { name: /Conectar Mercado Pago/ })
    expect(boton).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Local de la cuenta'), 'l2')
    await user.click(boton)
    expect(await screen.findByRole('dialog', { name: 'Configurar POS' })).toHaveTextContent('drawer del local l2')
  })

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

describe('MaquinasNegocioPage · la caja física manda (#140)', () => {
  beforeEach(() => { V2_FEATURES.cajaFisicaManda = true })
  afterEach(() => { V2_FEATURES.cajaFisicaManda = false })

  it('mover a un restaurante ofrece la caja, pero no es obligatoria', async () => {
    const user = userEvent.setup()
    render(<MaquinasNegocioPage />)
    await user.click(await screen.findByRole('button', { name: 'Mover Point caja a otro local' }))
    // Antes de elegir el local no hay caja que elegir.
    expect(screen.queryByLabelText('Caja física')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Local'), 'l1')
    expect(await screen.findByRole('option', { name: 'Sin caja por ahora (se asigna después)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(apiRequest).toHaveBeenCalledWith('/pos-machines/m2/mover', { method: 'POST', body: { local_id: 'l1' } })
  })

  it('con 3 personas la máquina está llena; con 2, en uso', () => {
    expect(textoOcupacion({ ocupacion: 2, usuarios: ['Ana', 'Luis'] })).toBe('En uso: Ana y Luis')
    expect(textoOcupacion({ ocupacion: 3, usuarios: ['Ana', 'Luis', 'Pedro'] })).toBe('Llena: Ana y Luis y Pedro')
  })
})

describe('MaquinasNegocioPage · nombre de la caja', () => {
  it('no repite «Caja» si el nombre ya lo dice', async () => {
    apiRequest.mockImplementation(async () => ({ ...RESPUESTA, registradas: [{ ...RESPUESTA.registradas[1], caja_fisica_nombre: 'Caja principal' }] }))
    render(<MaquinasNegocioPage />)
    const region = await screen.findByRole('region', { name: 'Máquinas de Mostrador Express' })
    expect(region).toHaveTextContent('Caja principal · Mercado Pago')
    expect(region).not.toHaveTextContent('Caja Caja')
  })
})
