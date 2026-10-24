/**
 * Iniciar turno con la caja física mandando (#133): solo sobre una caja
 * abierta; en un restaurante la caja sale de la máquina elegida.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InicioDeTurno from './InicioDeTurno'
import { createCajaV2, getMiTurnoDeHoy } from '../../lib/salesApi'
import { listarCajasFisicasDelLocal } from '../../lib/cajaFisica'
import { listarCajasFisicas } from '../../lib/administrativeApi'
import { V2_FEATURES } from '../../lib/v2Features'

const sesion = vi.hoisted(() => ({ modelo: 'RESTAURANT' }))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'yo', email: 'ana@demo', local_sales_model: sesion.modelo }, logout: vi.fn() }),
}))
vi.mock('../../lib/salesApi', () => ({ getMiTurnoDeHoy: vi.fn(), createCajaV2: vi.fn() }))
vi.mock('../../lib/administrativeApi', () => ({ listarCajasFisicas: vi.fn() }))
vi.mock('../../lib/cajaFisica', async (importOriginal) => ({ ...(await importOriginal()), listarCajasFisicasDelLocal: vi.fn() }))
vi.mock('../CambiarLocal', () => ({ default: () => null }))
// La lista de máquinas tiene sus propias pruebas: aquí se muestran tres y se respeta `motivoNoElegible`.
const MAQUINAS = [
  { id: 'pm-1', nombre: 'Point barra', cajaFisicaId: 'cf-1' },
  { id: 'pm-2', nombre: 'Point terraza', cajaFisicaId: 'cf-2' },
  { id: 'pm-3', nombre: 'Point nueva', cajaFisicaId: null },
]
vi.mock('./ElegirMaquina', () => ({
  default: function ElegirSimulado({ onConfirmar, motivoNoElegible }) {
    return (
      <ul>
        {MAQUINAS.map((m) => {
          const motivo = motivoNoElegible ? motivoNoElegible(m) : null
          return (
            <li key={m.id}>
              <button type="button" disabled={Boolean(motivo)} onClick={() => onConfirmar(m, { compartir: false })}>{m.nombre}</button>
              {motivo && <span>{`${m.nombre}: ${motivo}`}</span>}
            </li>
          )
        })}
      </ul>
    )
  },
}))

const montar = () => render(<InicioDeTurno localId="loc-1"><p>punto de venta</p></InicioDeTurno>)
const CAJAS = [
  { id: 'cf-1', name: 'Caja principal', is_active: true, abierta: true },
  { id: 'cf-2', name: 'Caja terraza', is_active: true, abierta: false },
  { id: 'cf-3', name: 'Archivada', is_active: false, abierta: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  V2_FEATURES.cajaFisicaManda = true
  V2_FEATURES.eleccionMaquinaVendedor = true
  getMiTurnoDeHoy.mockResolvedValue(null)
  createCajaV2.mockResolvedValue({ id: 'turno-1', status: 'open' })
})
afterEach(() => {
  V2_FEATURES.cajaFisicaManda = false
  sesion.modelo = 'RESTAURANT'
})

describe('InicioDeTurno · la caja física manda', () => {
  it('si no hay ninguna caja abierta, «El encargado todavía no abre la caja» y se puede volver a revisar', async () => {
    listarCajasFisicasDelLocal.mockResolvedValue(CAJAS.map((c) => ({ ...c, abierta: false })))
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    expect(await screen.findByRole('heading', { name: 'El encargado todavía no abre la caja' })).toBeInTheDocument()
    expect(createCajaV2).not.toHaveBeenCalled()
    expect(listarCajasFisicas).not.toHaveBeenCalled()

    listarCajasFisicasDelLocal.mockResolvedValue(CAJAS)
    await user.click(screen.getByRole('button', { name: 'Volver a revisar' }))
    expect(await screen.findByRole('button', { name: 'Point barra' })).toBeInTheDocument()
  })

  it('en un restaurante solo se elige una máquina de una caja abierta, y la caja del turno es la de la máquina', async () => {
    listarCajasFisicasDelLocal.mockResolvedValue(CAJAS)
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    expect(await screen.findByText('Point terraza: Su caja no está abierta')).toBeInTheDocument()
    expect(screen.getByText(/Point nueva: Sin caja/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Point terraza' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Point barra' }))
    expect(createCajaV2).toHaveBeenCalledWith({ caja_fisica_id: 'cf-1', monto_apertura: 0, pos_machine_id: 'pm-1', compartir: false })
    expect(await screen.findByText('punto de venta')).toBeInTheDocument()
  })

  it('en un local al paso solo se ofrecen las cajas abiertas y activas', async () => {
    sesion.modelo = 'AL_PASO'
    listarCajasFisicasDelLocal.mockResolvedValue([...CAJAS, { id: 'cf-4', name: 'Caja 2', is_active: true, abierta: true }])
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    const select = await screen.findByLabelText('Caja física')
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Elige dónde trabajarás', 'Caja principal', 'Caja 2'])
    await user.selectOptions(select, 'cf-4')
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))
    expect(createCajaV2).toHaveBeenCalledWith({ caja_fisica_id: 'cf-4', monto_apertura: 0 })
  })

  it('si el backend responde que la caja no está abierta, lo dice', async () => {
    sesion.modelo = 'AL_PASO'
    listarCajasFisicasDelLocal.mockResolvedValue([CAJAS[0]])
    createCajaV2.mockRejectedValue(Object.assign(new Error('409: El encargado todavía no abre la caja'), { status: 409, detail: 'El encargado todavía no abre la caja' }))
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Iniciar turno' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir turno' }))
    expect(await screen.findByRole('heading', { name: 'El encargado todavía no abre la caja' })).toBeInTheDocument()
  })
})

describe('InicioDeTurno · quién inicia', () => {
  it('se ve el nombre de la persona, no su correo', async () => {
    getMiTurnoDeHoy.mockResolvedValue(null)
    montar()
    expect(await screen.findByRole('heading', { name: '¿Iniciar turno?' })).toBeInTheDocument()
    // La sesión de prueba no tiene nombre cargado: se muestra lo del correo («Ana»), no «ana@demo».
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.queryByText('ana@demo')).not.toBeInTheDocument()
  })
})
