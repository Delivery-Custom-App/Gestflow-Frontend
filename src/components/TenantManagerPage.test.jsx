/**
 * Gestor de negocios (#134): alta de una franquicia con su primer local y la
 * cuenta del dueño en un solo paso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import TenantManagerPage from './TenantManagerPage'

vi.mock('../lib/apiClient', () => ({
  getAuthContext: vi.fn().mockResolvedValue({ token: 'tok' }),
  formatApiErrorDetail: (value) => value,
}))

const superAdmin = vi.hoisted(() => ({
  listBusinesses: vi.fn(),
  updateBusiness: vi.fn(),
  deleteBusiness: vi.fn(),
  getAuditLog: vi.fn(),
}))
vi.mock('../lib/superAdminApi', () => superAdmin)

const alta = vi.hoisted(() => ({ crearFranquicia: vi.fn() }))
vi.mock('../lib/altaFranquicia', async (importOriginal) => ({ ...(await importOriginal()), ...alta }))

function renderPage() {
  return render(<MemoryRouter><TenantManagerPage /></MemoryRouter>)
}

async function completarAlta(user) {
  await user.click(await screen.findByRole('button', { name: /Nueva franquicia/ }))
  await user.type(screen.getByLabelText(/^Nombre/, { selector: '#b-name' }), 'Sushi Sur')
  await user.type(screen.getByLabelText(/^RUT/, { selector: '#b-rut' }), '76.123.456-7')
  await user.type(screen.getByLabelText(/Nombre del local/), 'Casa matriz')
  await user.type(screen.getByLabelText(/^Nombre/, { selector: '#b-dueno-nombre' }), 'Ana')
  await user.type(screen.getByLabelText(/^Correo/), 'ana@sushi.cl')
  await user.click(screen.getByRole('button', { name: /Generar/ }))
  await user.click(screen.getByRole('button', { name: 'Crear franquicia' }))
}

beforeEach(() => {
  superAdmin.listBusinesses.mockResolvedValue([])
})

afterEach(() => vi.clearAllMocks())

describe('TenantManagerPage · alta con datos iniciales (#134)', () => {
  it('envía el negocio, el primer local y el dueño con una clave generada', async () => {
    alta.crearFranquicia.mockResolvedValue({ business: { id: 'b1', name: 'Sushi Sur' }, pendientes: [] })
    const user = userEvent.setup()
    renderPage()
    await completarAlta(user)

    await waitFor(() => expect(alta.crearFranquicia).toHaveBeenCalledTimes(1))
    const [form, token] = alta.crearFranquicia.mock.calls[0]
    expect(token).toBe('tok')
    expect(form).toMatchObject({
      name: 'Sushi Sur', rut: '76.123.456-7', conLocal: true, localName: 'Casa matriz', conDueno: true,
      dueno: expect.objectContaining({ nombre: 'Ana', email: 'ana@sushi.cl' }),
    })
    expect(form.dueno.password).toHaveLength(12)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('si faltó un paso, avisa y enlaza al detalle para completarlo', async () => {
    alta.crearFranquicia.mockResolvedValue({
      business: { id: 'b1', name: 'Sushi Sur' },
      pendientes: ['la cuenta del dueño (Email ya registrado)'],
    })
    const user = userEvent.setup()
    renderPage()
    await completarAlta(user)

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('no se pudo crear la cuenta del dueño (Email ya registrado)')
    expect(screen.getByRole('link', { name: 'Complétalo desde su detalle' })).toHaveAttribute('href', '/gestor/negocios/b1')
  })

  it('no envía nada si falta un dato del dueño', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Nueva franquicia/ }))
    await user.type(screen.getByLabelText(/^Nombre/, { selector: '#b-name' }), 'Sushi Sur')
    await user.type(screen.getByLabelText(/^RUT/, { selector: '#b-rut' }), '76.123.456-7')
    await user.type(screen.getByLabelText(/Nombre del local/), 'Casa matriz')
    await user.click(screen.getByRole('button', { name: 'Crear franquicia' }))

    expect(await screen.findByText('Dueño: Ingresa el nombre.')).toBeInTheDocument()
    expect(alta.crearFranquicia).not.toHaveBeenCalled()
  })
})
