import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import POSModule from './POSModule'

const sesion = vi.hoisted(() => ({ isWorker: false, user: { id: 'enc' } }))
const bajaDeMesa = vi.hoisted(() => vi.fn())
const crearGrupo = vi.hoisted(() => vi.fn())
// null = las mesas de siempre (MESAS); un test puede poner otras.
const tablero = vi.hoisted(() => ({ mesas: null }))
const MESAS = [
  { id: 'm1', name: 'Mesa 1', nombre: 'Mesa 1', state: 'ocupada', capacidad: 4, total: 5000,
    ordenes_en_curso: [{ id: 'o1', caja_id: 'caja-ana', waiter_user_id: 'beto' }] },
  { id: 'm2', name: 'Mesa 2', nombre: 'Mesa 2', state: 'libre', capacidad: 2, total: null, ordenes_en_curso: [] },
  { id: 'm3', name: 'Mesa 3', nombre: 'Mesa 3', state: 'libre', capacidad: 2, total: null, ordenes_en_curso: [] },
]
const SIN_MESAS_EN_CURSO = MESAS.filter((m) => m.ordenes_en_curso.length === 0)

vi.mock('../../context/AuthContext', () => ({ useAuth: () => sesion }))
vi.mock('../../hooks/useCajaActiva', () => ({ useCajaActiva: () => ({ cajaId: 'caja-enc' }) }))
vi.mock('../../hooks/useMesasConEstado', () => ({
  useMesasConEstado: () => ({ mesas: tablero.mesas ?? MESAS, loading: false, error: null, refresh: vi.fn(), deleteMesa: bajaDeMesa }),
}))
vi.mock('../../hooks/useMesasKPIs', () => ({ useMesasKPIs: () => ({ kpis: null, loading: false, error: null, refresh: vi.fn() }) }))
vi.mock('../../hooks/useGruposDeMesas', () => ({ useGruposDeMesas: () => ({ porMesa: new Map(), crear: crearGrupo, deshacer: vi.fn() }) }))
vi.mock('./MesasKPICards', () => ({ default: () => null }))
vi.mock('./MPConfigDrawer', () => ({ default: () => null }))
vi.mock('./MesaWorkspace', () => ({ default: ({ atencion }) => <p>mesa abierta · atiende {atencion?.atiende} · antes {atencion?.antes}</p> }))
vi.mock('../../lib/atencionMesas', async (importOriginal) => ({
  ...(await importOriginal()),
  useDatosDeAtencion: () => ({
    usuarios: [
      { id: 'ana', role: 'EMPLEADO', local_id: 'l1', first_name: 'Ana', last_name: 'Rojas' },
      { id: 'beto', role: 'EMPLEADO', local_id: 'l1', first_name: 'Beto', last_name: 'Soto' },
    ],
    usuariosPorId: sesion.isWorker ? new Map() : new Map([
      ['ana', { id: 'ana', first_name: 'Ana', last_name: 'Rojas' }],
      ['beto', { id: 'beto', first_name: 'Beto', last_name: 'Soto' }],
    ]),
    duenoDeTurno: new Map([['caja-ana', 'ana']]),
    recargar: vi.fn(),
  }),
}))

function montar() {
  return render(
    <MemoryRouter initialEntries={['/local/l1/pos']}>
      <Routes><Route path="/local/:localId/pos" element={<POSModule />} /></Routes>
    </MemoryRouter>,
  )
}
const tarjeta = (nombre) => screen.getByText(nombre).closest('div.group')

beforeEach(() => { sesion.isWorker = false; sesion.user = { id: 'enc' }; bajaDeMesa.mockReset(); crearGrupo.mockReset(); tablero.mesas = null })

describe('POSModule · quién atiende y traspasos', () => {
  it('el encargado ve quién atiende cada mesa en curso y quién la atendía', () => {
    montar()
    expect(within(tarjeta('Mesa 1')).getByText('Beto Soto')).toBeInTheDocument()
    expect(within(tarjeta('Mesa 1')).getByText('antes: Ana Rojas')).toBeInTheDocument()
    expect(within(tarjeta('Mesa 2')).queryByText('Atiende')).not.toBeInTheDocument()
  })

  it('el encargado puede traspasar mesas; abre la ventana con las mesas en curso', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(screen.getByRole('button', { name: 'Traspasar mesas' }))
    const dialogo = screen.getByRole('dialog', { name: 'Traspasar mesas' })
    expect(within(dialogo).getByRole('option', { name: 'Beto Soto (1 mesa)' })).toBeInTheDocument()
  })

  it('el vendedor no tiene "Traspasar mesas" y a un compañero lo ve como "Otro vendedor"', () => {
    sesion.isWorker = true
    sesion.user = { id: 'ana' }
    montar()

    expect(screen.queryByRole('button', { name: 'Traspasar mesas' })).not.toBeInTheDocument()
    expect(within(tarjeta('Mesa 1')).getByText('Otro vendedor')).toBeInTheDocument()
    expect(within(tarjeta('Mesa 1')).getByText('antes: Tú')).toBeInTheDocument()
  })

  it('la mesa abierta también dice quién la atiende', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(within(tarjeta('Mesa 1')).getAllByRole('button').at(-1))
    expect(screen.getByText('mesa abierta · atiende Beto Soto · antes Ana Rojas')).toBeInTheDocument()
  })
})

describe('POSModule · dar de baja una mesa (T-70)', () => {
  it('el encargado confirma y se da de baja la mesa elegida, con su id', async () => {
    const user = userEvent.setup()
    bajaDeMesa.mockResolvedValue(undefined)
    montar()

    await user.click(within(tarjeta('Mesa 2')).getByRole('button', { name: 'Eliminar mesa' }))
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText(/Sus pedidos anteriores se conservan/)).toBeInTheDocument()
    expect(within(dialogo).getByText(/se puede reactivar/)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar Mesa' }))

    expect(bajaDeMesa).toHaveBeenCalledWith('m2')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('si el backend la rechaza (409) el motivo queda en el diálogo y la mesa sigue', async () => {
    const user = userEvent.setup()
    bajaDeMesa.mockRejectedValue(new Error('409: La mesa Mesa 1 está en uso: cóbrala antes de darla de baja'))
    montar()

    await user.click(within(tarjeta('Mesa 1')).getByRole('button', { name: 'Eliminar mesa' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar Mesa' }))

    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText('La mesa Mesa 1 está en uso: cóbrala antes de darla de baja')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Eliminar Mesa' })).toBeDisabled()
    expect(bajaDeMesa).toHaveBeenCalledWith('m1')
  })

  it('el vendedor no ve la acción de eliminar', () => {
    sesion.isWorker = true
    sesion.user = { id: 'ana' }
    montar()
    expect(screen.queryByRole('button', { name: 'Eliminar mesa' })).not.toBeInTheDocument()
  })
})

describe('POSModule · acciones de mesas (UI de botones)', () => {
  const acciones = () => screen.getByRole('group', { name: 'Acciones de mesas' })
  const nombresDeBotones = () => within(acciones()).getAllByRole('button').map((b) => b.textContent.trim())

  it('Traspasar y Agrupar miden lo mismo que «Crear mesa» (40 px)', () => {
    montar()
    for (const nombre of ['Crear mesa', 'Traspasar mesas', 'Agrupar mesas']) {
      expect(screen.getByRole('button', { name: nombre })).toHaveClass('h-10')
    }
  })

  it('están en un solo lugar, junto a «Crear mesa», y en el mismo orden', () => {
    montar()
    expect(nombresDeBotones()).toEqual(['POS', 'Traspasar mesas', 'Agrupar mesas', 'Crear mesa'])
  })

  it('sin mesas en curso, «Traspasar mesas» queda desactivado y dice por qué a la vista', () => {
    tablero.mesas = SIN_MESAS_EN_CURSO
    montar()

    const boton = screen.getByRole('button', { name: 'Traspasar mesas' })
    expect(boton).toBeDisabled()
    expect(screen.getByText('No hay mesas en curso para traspasar.')).toBeVisible()
    expect(boton).toHaveAccessibleDescription('No hay mesas en curso para traspasar.')
    // Desactivado no es «casi invisible»: no se baja la opacidad del botón.
    expect(boton.className).not.toMatch(/opacity/)
  })

  it('con mesas en curso «Traspasar mesas» está activo y no muestra ningún motivo', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Traspasar mesas' })).toBeEnabled()
    expect(screen.queryByText(/No hay mesas en curso/)).not.toBeInTheDocument()
  })

  it('al agrupar, las acciones siguen en su lugar: se desactivan y dicen por qué', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(screen.getByRole('button', { name: 'Agrupar mesas' }))

    expect(nombresDeBotones()).toEqual(['POS', 'Traspasar mesas', 'Agrupar mesas', 'Crear mesa'])
    expect(screen.getByRole('button', { name: 'Traspasar mesas' })).toBeDisabled()
    expect(screen.getByText('Termina de juntar mesas para traspasar.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Agrupar mesas' })).toBeDisabled()
    expect(screen.getByText('Elige las mesas de abajo para juntarlas.')).toBeVisible()
  })

  it('«Juntar mesas» mide 40 px, dice que faltan mesas y se activa con dos elegidas', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Agrupar mesas' }))

    const juntar = screen.getByRole('button', { name: 'Juntar mesas' })
    expect(juntar).toHaveClass('h-10')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('h-10')
    expect(juntar).toBeDisabled()
    expect(screen.getByText('Elige al menos 2 mesas.')).toBeVisible()

    await user.click(screen.getByText('Mesa 2').closest('button'))
    expect(juntar).toBeDisabled()
    await user.click(screen.getByText('Mesa 3').closest('button'))

    expect(juntar).toBeEnabled()
    expect(screen.queryByText('Elige al menos 2 mesas.')).not.toBeInTheDocument()
    await user.click(juntar)
    expect(crearGrupo).toHaveBeenCalledWith(['m2', 'm3'])
  })

  it('«Cancelar» sale de agrupar y las acciones vuelven a estar activas', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Agrupar mesas' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('button', { name: 'Agrupar mesas' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Traspasar mesas' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Juntar mesas' })).not.toBeInTheDocument()
  })

  it('el vendedor solo tiene «Agrupar mesas», en el mismo grupo de acciones y del mismo alto', () => {
    sesion.isWorker = true
    sesion.user = { id: 'ana' }
    montar()

    expect(nombresDeBotones()).toEqual(['Agrupar mesas'])
    expect(screen.getByRole('button', { name: 'Agrupar mesas' })).toHaveClass('h-10')
  })
})
