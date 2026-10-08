/**
 * El vendedor inicia su turno al entrar: sin turno de hoy se le pregunta
 * "¿Iniciar turno?"; con turno, entra directo a vender.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InicioDeTurno from './InicioDeTurno'
import { useTurnoVendedor } from '../../context/turnoVendedor'
import { createCajaV2, getMiTurnoDeHoy } from '../../lib/salesApi'
import { listarCajasFisicas } from '../../lib/administrativeApi'
import { V2_FEATURES } from '../../lib/v2Features'

const sesion = vi.hoisted(() => ({ logout: vi.fn() }))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'yo', email: 'cajero@demo.gestflow.dev' }, logout: sesion.logout }),
}))
vi.mock('../../lib/salesApi', () => ({ getMiTurnoDeHoy: vi.fn(), createCajaV2: vi.fn() }))
vi.mock('../../lib/administrativeApi', () => ({ listarCajasFisicas: vi.fn() }))
// La elección de máquina tiene sus propias pruebas: aquí solo importa cuándo aparece.
// Muestra qué recibe, para comprobar que le llegan el local, el usuario y si es un reingreso.
vi.mock('./ElegirMaquina', () => ({
  default: ({ onListo, localId, userId, saltarSiTiene }) => (
    <button type="button" onClick={() => onListo(null)}>
      {`elegir máquina (simulado) · ${localId} · ${userId} · ${saltarSiTiene ? 'reingreso' : 'recién abierto'}`}
    </button>
  ),
}))

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

beforeEach(() => {
  vi.clearAllMocks()
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
    expect(V2_FEATURES.eleccionMaquinaVendedor).toBe(false)
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))

    expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
    expect(screen.queryByText(/elegir máquina/)).not.toBeInTheDocument()
  })

  it('con la bandera encendida, después de abrir el turno elige su máquina y recién ahí vende', async () => {
    V2_FEATURES.eleccionMaquinaVendedor = true
    try {
      const user = userEvent.setup()
      montar()

      await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
      await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))
      expect(await screen.findByRole('heading', { name: 'Elige tu máquina de cobro' })).toBeInTheDocument()
      expect(screen.queryByText(/punto de venta/)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'elegir máquina (simulado) · loc-1 · yo · recién abierto' }))
      expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
    } finally {
      V2_FEATURES.eleccionMaquinaVendedor = false
    }
  })

  it('con la bandera encendida, al volver a entrar con el turno abierto pasa por el selector como reingreso', async () => {
    V2_FEATURES.eleccionMaquinaVendedor = true
    try {
      getMiTurnoDeHoy.mockResolvedValue(TURNO)
      const user = userEvent.setup()
      montar()

      // El selector se salta solo si ya tiene su máquina (lo prueba ElegirMaquina).
      await user.click(await screen.findByRole('button', { name: 'elegir máquina (simulado) · loc-1 · yo · reingreso' }))
      expect(await screen.findByText('punto de venta · turno-1')).toBeInTheDocument()
    } finally {
      V2_FEATURES.eleccionMaquinaVendedor = false
    }
  })

  it('puede cerrar sesión en vez de iniciar turno', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(sesion.logout).toHaveBeenCalled()
  })
})
