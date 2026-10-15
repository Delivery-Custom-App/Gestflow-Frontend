/**
 * El vendedor inicia su turno al entrar: sin turno de hoy se le pregunta
 * "¿Iniciar turno?"; con turno, entra directo a vender.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InicioDeTurno from './InicioDeTurno'
import { useTurnoVendedor } from '../../context/turnoVendedor'
import { createCajaV2, getMiTurnoDeHoy } from '../../lib/salesApi'
import { listarCajasFisicas } from '../../lib/administrativeApi'
import { V2_FEATURES } from '../../lib/v2Features'
import { elegirMaquinaDelTurno } from '../../lib/maquinasCobro'

const sesion = vi.hoisted(() => ({ logout: vi.fn(), modelo: 'RESTAURANT' }))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'yo', email: 'cajero@demo.gestflow.dev', local_sales_model: sesion.modelo },
    logout: sesion.logout,
  }),
}))
vi.mock('../../lib/salesApi', () => ({ getMiTurnoDeHoy: vi.fn(), createCajaV2: vi.fn() }))
vi.mock('../../lib/maquinasCobro', async (importOriginal) => ({
  ...(await importOriginal()),
  elegirMaquinaDelTurno: vi.fn(),
}))
vi.mock('../../lib/administrativeApi', () => ({ listarCajasFisicas: vi.fn() }))
// El cambio de local tiene sus propias pruebas.
vi.mock('../CambiarLocal', () => ({ default: () => null }))
// La lista de máquinas tiene sus propias pruebas: aquí se simula que eligió una.
// Si la acción falla, el simulado muestra el mensaje, como hace el componente real.
vi.mock('./ElegirMaquina', async () => {
  const { useState } = await import('react')
  return {
    default: function ElegirSimulado({ localId, onConfirmar, onSinMaquina, textoConfirmar, textoSinMaquina }) {
      const [error, setError] = useState('')
      const elegir = (compartir) => onConfirmar({ id: 'm-1', nombre: 'Point barra' }, { compartir })
        .catch((e) => setError(`${e.message}${e.conflicto ? ' · recarga la lista' : ''}`))
      return (
        <div>
          <p>{`máquinas de ${localId}`}</p>
          <button type="button" onClick={() => elegir(false)}>{textoConfirmar || 'Usar esta máquina'}</button>
          <button type="button" onClick={() => elegir(true)}>Compartir esta máquina</button>
          {onSinMaquina && <button type="button" onClick={onSinMaquina}>{textoSinMaquina}</button>}
          {error && <p role="alert">{error}</p>}
        </div>
      )
    },
  }
})

const TURNO = { id: 'turno-1', status: 'open', opened_at: '2026-10-04T12:00:00Z', cashier_user_id: 'yo' }
const UNA_CAJA = [{ id: 'cf-1', name: 'Caja principal' }]

// Lo que ve el vendedor una vez adentro, y el turno que le llega por contexto.
function PuntoDeVenta() {
  const { turno, alCerrar } = useTurnoVendedor()
  return (
    <div>
      <p>punto de venta · {turno.id}</p>
      <button type="button" onClick={alCerrar}>simular cierre</button>
    </div>
  )
}

const montar = () => render(<InicioDeTurno localId="loc-1"><PuntoDeVenta /></InicioDeTurno>)

const original = { ...V2_FEATURES }

beforeEach(() => {
  vi.clearAllMocks()
  // Las pruebas de siempre corren sin elegir máquina; las de la máquina la encienden.
  V2_FEATURES.eleccionMaquinaVendedor = false
  sesion.modelo = 'RESTAURANT'
  getMiTurnoDeHoy.mockResolvedValue(null)
  listarCajasFisicas.mockResolvedValue(UNA_CAJA)
  createCajaV2.mockResolvedValue(TURNO)
})

describe('InicioDeTurno', () => {
  it('con su turno de hoy abierto entra directo a vender (bandera de máquina apagada)', async () => {
    getMiTurnoDeHoy.mockResolvedValue(TURNO)
    montar()

    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
    expect(getMiTurnoDeHoy).toHaveBeenCalledWith('loc-1')
    expect(screen.queryByRole('heading', { name: '¿Iniciar turno?' })).not.toBeInTheDocument()
  })

  it('sin turno no puede vender: se le pregunta "¿Iniciar turno?"', async () => {
    montar()

    expect(await screen.findByRole('heading', { name: '¿Iniciar turno?' })).toBeInTheDocument()
    expect(screen.queryByText(/punto de venta/)).not.toBeInTheDocument()
  })

  it('al aceptar, con una sola caja física se elige sola y el turno queda a su nombre', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    expect(await screen.findByText('Caja principal')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))

    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
    // Sin cashier_user_id: el turno queda a nombre de quien lo abre.
    expect(createCajaV2).toHaveBeenCalledWith({ caja_fisica_id: 'cf-1', monto_apertura: 0 })
  })

  it('no le pide efectivo inicial: eso lo registra el encargado al abrir la caja', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    expect(await screen.findByRole('button', { name: 'Abrir turno' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/efectivo|monto|dinero/i)).not.toBeInTheDocument()
  })

  it('con varias cajas físicas elige dónde trabajará antes de abrir', async () => {
    listarCajasFisicas.mockResolvedValue([{ id: 'cf-1', name: 'Caja 1' }, { id: 'cf-2', name: 'Caja 2' }])
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))
    expect(screen.getByText('Elige la caja física donde trabajarás')).toBeInTheDocument()
    expect(createCajaV2).not.toHaveBeenCalled()

    await user.selectOptions(screen.getByLabelText('Caja física'), 'cf-2')
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))
    await waitFor(() => expect(createCajaV2).toHaveBeenCalledWith({ caja_fisica_id: 'cf-2', monto_apertura: 0 }))
  })

  it('si su local no tiene caja física, le dice a quién pedirla', async () => {
    listarCajasFisicas.mockResolvedValue([])
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    expect(await screen.findByText(/Pídele al encargado que la cree/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir turno' })).not.toBeInTheDocument()
  })

  it('si ya tenía un turno abierto en esa caja (409), lo toma y entra', async () => {
    createCajaV2.mockRejectedValue(new Error('Ya existe una caja abierta hoy para este cajero en esta caja física'))
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    getMiTurnoDeHoy.mockResolvedValue(TURNO)
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))

    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
  })

  it('si no se puede abrir, lo dice y sigue sin dejarlo vender', async () => {
    createCajaV2.mockRejectedValue(new Error('La caja física no existe'))
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))

    expect(await screen.findByText('La caja física no existe')).toBeInTheDocument()
    expect(screen.queryByText(/punto de venta/)).not.toBeInTheDocument()
  })

  it('cuando su turno se cierra, vuelve a preguntar', async () => {
    getMiTurnoDeHoy.mockResolvedValue(TURNO)
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'simular cierre' }))
    expect(screen.getByRole('heading', { name: '¿Iniciar turno?' })).toBeInTheDocument()
  })

  it('si no se puede revisar el turno, permite reintentar', async () => {
    getMiTurnoDeHoy.mockRejectedValueOnce(new Error('sin conexión')).mockResolvedValueOnce(TURNO)
    const user = userEvent.setup()
    montar()

    expect(await screen.findByText('sin conexión')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
  })

  it('con la bandera eleccionMaquinaVendedor apagada, al abrir el turno entra directo', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))

    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
    expect(screen.queryByText(/máquinas de/)).not.toBeInTheDocument()
    expect(createCajaV2).toHaveBeenCalledWith({ caja_fisica_id: 'cf-1', monto_apertura: 0 })
  })

  it('puede cerrar sesión en vez de iniciar turno', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(sesion.logout).toHaveBeenCalled()
  })
})

describe('InicioDeTurno · máquina POS (T-71)', () => {
  beforeEach(() => { V2_FEATURES.eleccionMaquinaVendedor = true })
  afterAll(() => { Object.assign(V2_FEATURES, original) })

  it('restaurante: elige la máquina antes de abrir, y el turno se abre con ella', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))
    expect(await screen.findByRole('heading', { name: 'Elige tu máquina de cobro' })).toBeInTheDocument()
    expect(screen.getByText('máquinas de loc-1')).toBeInTheDocument()
    // Todavía no se abrió nada: la máquina va en la apertura.
    expect(createCajaV2).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Abrir turno con esta máquina' }))

    expect(createCajaV2).toHaveBeenCalledWith({
      caja_fisica_id: 'cf-1', monto_apertura: 0, pos_machine_id: 'm-1', compartir: false,
    })
    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
  })

  it('restaurante: si la máquina ya la usa alguien, abre compartiéndola', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))
    await user.click(await screen.findByRole('button', { name: 'Compartir esta máquina' }))

    expect(createCajaV2).toHaveBeenCalledWith(expect.objectContaining({ pos_machine_id: 'm-1', compartir: true }))
  })

  it('restaurante: un 409 de la máquina (se llenó) muestra el motivo del backend y pide recargar', async () => {
    const error = Object.assign(new Error('409: La máquina «Point barra» ya la usan 2 personas (Ana y Luis): elige otra'), { status: 409 })
    createCajaV2.mockRejectedValue(error)
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno con esta máquina' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La máquina «Point barra» ya la usan 2 personas (Ana y Luis): elige otra · recarga la lista',
    )
    expect(screen.queryByText(/punto de venta/)).not.toBeInTheDocument()
  })

  it('restaurante: si ya tenía su turno abierto en esa caja, lo toma y entra', async () => {
    createCajaV2.mockRejectedValue(Object.assign(new Error('409: Ya existe una caja abierta hoy para este cajero en esta caja física'), { status: 409 }))
    getMiTurnoDeHoy.mockResolvedValueOnce(null).mockResolvedValue({ ...TURNO, pos_machine_id: 'm-1' })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno con esta máquina' }))

    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
  })

  it('restaurante: "Volver" regresa a elegir la caja física sin abrir nada', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))
    await user.click(await screen.findByRole('button', { name: 'Volver' }))

    expect(await screen.findByRole('button', { name: 'Abrir turno' })).toBeInTheDocument()
    expect(createCajaV2).not.toHaveBeenCalled()
  })

  it('restaurante: al volver a entrar con su máquina, entra directo', async () => {
    getMiTurnoDeHoy.mockResolvedValue({ ...TURNO, pos_machine_id: 'm-1', pos_machine_released_at: null })
    montar()
    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
  })

  it('restaurante: si le liberaron la máquina, elige otra con PUT /cajas/{id}/maquina', async () => {
    getMiTurnoDeHoy.mockResolvedValue({ ...TURNO, pos_machine_id: 'm-9', pos_machine_released_at: '2026-10-14T13:00:00Z' })
    elegirMaquinaDelTurno.mockResolvedValue({ ...TURNO, pos_machine_id: 'm-1', pos_machine_released_at: null })
    const user = userEvent.setup()
    montar()

    expect(await screen.findByRole('heading', { name: 'Tu turno no tiene máquina de cobro' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Usar esta máquina' }))

    expect(elegirMaquinaDelTurno).toHaveBeenCalledWith('turno-1', 'm-1', { compartir: false })
    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
  })

  it('restaurante: sin máquina puede seguir cobrando sin tarjeta', async () => {
    getMiTurnoDeHoy.mockResolvedValue(TURNO)
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Seguir sin tarjeta' }))
    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
    expect(elegirMaquinaDelTurno).not.toHaveBeenCalled()
  })

  it('al paso: no elige máquina (está anclada a la caja) y abre directo sin mandarla', async () => {
    sesion.modelo = 'AL_PASO'
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))

    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
    expect(screen.queryByText(/máquinas de/)).not.toBeInTheDocument()
    expect(createCajaV2).toHaveBeenCalledWith({ caja_fisica_id: 'cf-1', monto_apertura: 0 })
  })
})

describe('InicioDeTurno · turno terminado (T-41)', () => {
  it('si su turno de hoy ya terminó por el administrador, muestra el motivo y no lo deja vender', async () => {
    getMiTurnoDeHoy.mockResolvedValue({
      id: 't-1', local_id: 'loc-1', status: 'open', turno_terminado_at: '2026-10-14T18:00:00Z',
      turno_terminado_forzado: true, turno_terminado_motivo: 'Se retiró por una emergencia',
    })
    render(<InicioDeTurno localId="loc-1"><p>punto de venta</p></InicioDeTurno>)
    expect(await screen.findByRole('heading', { name: 'Tu turno terminó' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('El administrador terminó tu turno. Motivo: Se retiró por una emergencia')
    expect(screen.queryByText('punto de venta')).not.toBeInTheDocument()
  })

  it('si lo terminó él, se lo recuerda', async () => {
    getMiTurnoDeHoy.mockResolvedValue({ id: 't-1', local_id: 'loc-1', status: 'open', turno_terminado_at: '2026-10-14T18:00:00Z', turno_terminado_forzado: false })
    render(<InicioDeTurno localId="loc-1"><p>punto de venta</p></InicioDeTurno>)
    expect(await screen.findByRole('status')).toHaveTextContent('Terminaste tu turno')
  })
})
