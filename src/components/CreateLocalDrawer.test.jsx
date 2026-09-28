/**
 * Alta de local: la ubicación que el formulario ya resolvía se guardaba en
 * ninguna parte. El comentario del código decía que Backend V2 no aceptaba
 * dirección ni coordenadas, y hoy `LocalCreate` sí las acepta — por eso los
 * locales creados desde la web quedaban sin dirección y el mapa de
 * franquicias estaba siempre vacío.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateLocalDrawer from './CreateLocalDrawer'
import { apiRequest, getAuthContext } from '../lib/apiClient'

vi.mock('../lib/apiClient', () => ({
  apiRequest: vi.fn(() => Promise.resolve({ id: 'loc-nuevo' })),
  getAuthContext: vi.fn(() => Promise.resolve({ token: 't', businessId: 'biz-1' })),
}))

const RESULTADO_NOMINATIM = {
  lat: '-33.0173060',
  lon: '-71.5576000',
  display_name: '147, 5 Norte, Viña del Mar, Valparaíso, Chile',
  address: { house_number: '147', road: '5 Norte', city: 'Viña del Mar', state: 'Valparaíso' },
}

function responderNominatim(resultados) {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(resultados) }))
}

async function completarYEnviar(user, direccion = '5 Norte 147, Viña del Mar') {
  await user.type(screen.getByPlaceholderText('Ej: Franquicia Centro'), 'Franquicia Centro')
  await user.type(screen.getByPlaceholderText(/5 Norte 147/i), direccion)
  await user.type(screen.getByPlaceholderText(/\+569/), '+56912345678')
  await user.click(screen.getByRole('button', { name: 'Crear Franquicia' }))
}

describe('CreateLocalDrawer — ubicación del local', () => {
  let onClose
  let onSuccess

  beforeEach(() => {
    vi.clearAllMocks()
    onClose = vi.fn()
    onSuccess = vi.fn()
    apiRequest.mockResolvedValue({ id: 'loc-nuevo' })
    getAuthContext.mockResolvedValue({ token: 't', businessId: 'biz-1' })
  })

  const montar = () => render(<CreateLocalDrawer isOpen onClose={onClose} onSuccess={onSuccess} />)

  it('guarda la dirección y las coordenadas que ya había resuelto', async () => {
    responderNominatim([RESULTADO_NOMINATIM])
    const user = userEvent.setup()
    montar()

    await completarYEnviar(user)

    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    const [ruta, opciones] = apiRequest.mock.calls[0]
    expect(ruta).toBe('/locals')
    expect(opciones.body).toMatchObject({
      business_id: 'biz-1',
      name: 'Franquicia Centro',
      street_name: '5 Norte 147',
      city_name: 'Viña del Mar',
      state_name: 'Valparaíso',
      latitude: -33.017306,
      longitude: -71.5576,
    })
  })

  it('si la dirección no se pudo ubicar, crea el local igual y avisa', async () => {
    responderNominatim([])
    const user = userEvent.setup()
    montar()

    await completarYEnviar(user, 'Una dirección que no existe')

    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(await screen.findByText(/quedó sin ubicación/i)).toBeInTheDocument()
    // El aviso se lee antes de cerrar: no es una sorpresa para después. El
    // refresco de la lista también espera, porque desmonta este cajón.
    expect(onClose).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    // Sobre el aviso la única acción es cerrarlo: el formulario no queda detrás.
    expect(screen.queryByRole('button', { name: 'Crear Franquicia' })).not.toBeInTheDocument()
  })

  it('sin ubicación no inventa coordenadas: guarda la dirección escrita y nada más', async () => {
    responderNominatim([])
    const user = userEvent.setup()
    montar()

    await completarYEnviar(user, 'Una dirección que no existe')

    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    const { body } = apiRequest.mock.calls[0][1]
    expect(body.street_name).toBe('Una dirección que no existe')
    expect(body).not.toHaveProperty('latitude')
    expect(body).not.toHaveProperty('longitude')
  })

  it('el aviso se cierra con Entendido', async () => {
    responderNominatim([])
    const user = userEvent.setup()
    montar()

    await completarYEnviar(user, 'Una dirección que no existe')
    await user.click(await screen.findByRole('button', { name: 'Entendido' }))

    expect(onClose).toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalled()
  })
})
