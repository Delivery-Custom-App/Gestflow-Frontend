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
// Grupos de mesas (#221): el índice mesa → grupo y lo que hace «Separar», que cada test decide.
const grupos = vi.hoisted(() => ({ porMesa: new Map(), deshacer: vi.fn(), refresh: vi.fn() }))
const refrescarMesas = vi.hoisted(() => vi.fn())
const toastExito = vi.hoisted(() => vi.fn())
const liberarGrupoMock = vi.hoisted(() => vi.fn())
// Lo que le dice el cobro de una mesa al módulo cuando soltó el resto del grupo.
const cobro = vi.hoisted(() => ({ resultado: null }))
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
  useMesasConEstado: () => ({ mesas: tablero.mesas ?? MESAS, loading: false, error: null, refresh: refrescarMesas, deleteMesa: bajaDeMesa }),
}))
vi.mock('../../hooks/useMesasKPIs', () => ({ useMesasKPIs: () => ({ kpis: null, loading: false, error: null, refresh: vi.fn() }) }))
vi.mock('../../hooks/useGruposDeMesas', () => ({
  useGruposDeMesas: () => ({ porMesa: grupos.porMesa, crear: crearGrupo, deshacer: grupos.deshacer, refresh: grupos.refresh }),
}))
vi.mock('sonner', () => ({ toast: { success: toastExito, error: vi.fn() } }))
// La liberación en sí se prueba en lib/liberarGrupo.test.js: aquí solo importa cómo reacciona la pantalla.
vi.mock('../../lib/liberarGrupo', async (importOriginal) => ({ ...(await importOriginal()), liberarGrupo: liberarGrupoMock }))
vi.mock('./MesasKPICards', () => ({ default: () => null }))
vi.mock('./MPConfigDrawer', () => ({ default: () => null }))
vi.mock('./MesaWorkspace', () => ({
  default: ({ atencion, onGrupoActualizado, onBack }) => (
    <div>
      <p>mesa abierta · atiende {atencion?.atiende} · antes {atencion?.antes}</p>
      <button type="button" onClick={() => { onGrupoActualizado?.(cobro.resultado); onBack() }}>simular cobro</button>
    </div>
  ),
}))
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

beforeEach(() => {
  sesion.isWorker = false; sesion.user = { id: 'enc' }; bajaDeMesa.mockReset(); crearGrupo.mockReset(); tablero.mesas = null
  grupos.porMesa = new Map(); grupos.deshacer.mockReset(); grupos.refresh.mockReset()
  refrescarMesas.mockReset(); toastExito.mockReset(); liberarGrupoMock.mockReset(); cobro.resultado = null
})

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

// Un grupo de 3 atascado: la del medio tiene un pedido sin cobrar y las otras dos quedaron ocupadas sin pedido.
const GRUPO = { id: 'g1', etiqueta: 'Grupo 1', mesaIds: ['m1', 'm2', 'm3'], capacidad: null }
const sinPedido = (id) => ({ id, name: `Mesa ${id[1]}`, nombre: `Mesa ${id[1]}`, state: 'ocupada', capacidad: 2, total: null, ordenes_en_curso: [] })
const GRUPO_ATASCADO = [
  sinPedido('m1'),
  { ...sinPedido('m2'), total: 5400, ordenes_en_curso: [{ id: 'o2', caja_id: 'caja-ana', waiter_user_id: 'beto', total: 5400 }] },
  sinPedido('m3'),
]
const RESULTADO_LIBERADO = { liberadas: [{ id: 'm1', nombre: 'Mesa 1' }, { id: 'm3', nombre: 'Mesa 3' }], fallidas: [], separado: true, errorAlSeparar: null, sinCobrar: 5400 }
const alerta = () => screen.getByRole('alert')

describe('POSModule · liberar el grupo completo (#221)', () => {
  beforeEach(() => {
    tablero.mesas = GRUPO_ATASCADO
    grupos.porMesa = new Map(GRUPO.mesaIds.map((id) => [id, GRUPO]))
  })

  it('el encargado tiene «Liberar grupo» junto a «Separar»; el vendedor solo «Separar»', () => {
    const { unmount } = montar()
    expect(screen.getAllByRole('button', { name: 'Liberar grupo' })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'Separar' })).toHaveLength(3)
    unmount()

    sesion.isWorker = true
    sesion.user = { id: 'ana' }
    montar()
    expect(screen.queryByRole('button', { name: 'Liberar grupo' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Separar' })).toHaveLength(3)
  })

  describe('«Separar» con mesas todavía ocupadas (409)', () => {
    beforeEach(() => {
      grupos.deshacer.mockRejectedValue(Object.assign(
        new Error('No se puede separar: Mesa 1, Mesa 2, Mesa 3 todavía no está(n) disponible(s). Libéralas antes de separarlas.'),
        { status: 409 },
      ))
    })

    it('en vez del texto del backend dice qué mesas siguen ocupadas y ofrece «Liberar grupo» y ir a la que tiene pedido', async () => {
      const user = userEvent.setup()
      montar()
      await user.click(screen.getAllByRole('button', { name: 'Separar' })[0])

      const aviso = await screen.findByRole('alert')
      expect(aviso).toHaveTextContent('No se puede separar Grupo 1: Mesa 1, Mesa 2 y Mesa 3 siguen ocupadas.')
      expect(aviso).toHaveTextContent('Mesa 1: ocupada, sin pedido (hay que liberarla)')
      expect(aviso).toHaveTextContent('Mesa 2: pedido abierto por $5.400 (cóbralo o libera el grupo)')
      expect(aviso).toHaveTextContent('Mesa 3: ocupada, sin pedido (hay que liberarla)')
      expect(aviso).not.toHaveTextContent('Libéralas antes de separarlas')
      expect(within(aviso).getByRole('button', { name: 'Liberar grupo' })).toBeInTheDocument()
      expect(within(aviso).getByRole('button', { name: 'Ir a Mesa 2' })).toBeInTheDocument()
      expect(within(aviso).queryByRole('button', { name: 'Ir a Mesa 1' })).not.toBeInTheDocument()
    })

    it('«Liberar grupo» del aviso abre la ventana del grupo', async () => {
      const user = userEvent.setup()
      montar()
      await user.click(screen.getAllByRole('button', { name: 'Separar' })[0])
      await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Liberar grupo' }))

      expect(screen.getByRole('dialog', { name: 'Liberar grupo' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('«Ir a Mesa 2» lleva a la mesa con el pedido abierto, para cobrarlo', async () => {
      const user = userEvent.setup()
      montar()
      await user.click(screen.getAllByRole('button', { name: 'Separar' })[0])
      await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Ir a Mesa 2' }))

      expect(screen.getByText(/mesa abierta/)).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('el vendedor ve lo mismo, pero sin «Liberar grupo»: le dice que lo pida al encargado', async () => {
      sesion.isWorker = true
      sesion.user = { id: 'ana' }
      const user = userEvent.setup()
      montar()
      await user.click(screen.getAllByRole('button', { name: 'Separar' })[0])

      const aviso = await screen.findByRole('alert')
      expect(aviso).toHaveTextContent('No se puede separar Grupo 1: Mesa 1, Mesa 2 y Mesa 3 siguen ocupadas.')
      expect(aviso).toHaveTextContent('Pídele al encargado o al dueño que libere el grupo.')
      expect(within(aviso).queryByRole('button', { name: 'Liberar grupo' })).not.toBeInTheDocument()
      expect(within(aviso).getByRole('button', { name: 'Ir a Mesa 2' })).toBeInTheDocument()
    })

    it('otra falla (no un 409) se muestra tal cual, sin ofrecer liberar nada', async () => {
      grupos.deshacer.mockRejectedValue(new Error('Sin conexión'))
      const user = userEvent.setup()
      montar()
      await user.click(screen.getAllByRole('button', { name: 'Separar' })[0])

      expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
      expect(within(alerta()).queryByRole('button', { name: 'Liberar grupo' })).not.toBeInTheDocument()
    })
  })

  describe('ventana «Liberar grupo»', () => {
    const abrir = async (user) => {
      await user.click(screen.getAllByRole('button', { name: 'Liberar grupo' })[0])
      return screen.getByRole('dialog', { name: 'Liberar grupo' })
    }

    it('avisa del pedido abierto, libera el grupo con el motivo y la vista de mesas se refresca sola', async () => {
      const user = userEvent.setup()
      liberarGrupoMock.mockResolvedValue(RESULTADO_LIBERADO)
      montar()
      const dialogo = await abrir(user)

      expect(within(dialogo).getByRole('note', { name: 'Pedidos abiertos que quedarán sin cobrar' })).toHaveTextContent('$5.400')
      await user.type(within(dialogo).getByLabelText('Motivo'), 'Se fueron los clientes')
      await user.click(within(dialogo).getByRole('button', { name: 'Liberar grupo' }))

      expect(liberarGrupoMock).toHaveBeenCalledWith({
        grupoId: 'g1',
        mesas: [
          expect.objectContaining({ id: 'm1', ocupada: true, conPedido: false }),
          expect.objectContaining({ id: 'm2', ocupada: true, conPedido: true, total: 5400 }),
          expect.objectContaining({ id: 'm3', ocupada: true, conPedido: false }),
        ],
        motivo: 'Se fueron los clientes',
      })
      refrescarMesas.mockClear()
      grupos.refresh.mockClear()
      await user.click(await screen.findByRole('button', { name: 'Volver a mesas' }))

      expect(refrescarMesas).toHaveBeenCalled()
      expect(grupos.refresh).toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('falla parcial: deja dicho en la vista de mesas cuáles no se pudieron liberar y permite reintentar', async () => {
      const user = userEvent.setup()
      liberarGrupoMock.mockResolvedValue({
        liberadas: [{ id: 'm1', nombre: 'Mesa 1' }, { id: 'm3', nombre: 'Mesa 3' }],
        fallidas: [{ id: 'm2', nombre: 'Mesa 2', mensaje: 'Hay un cobro con tarjeta en curso' }],
        separado: false, errorAlSeparar: null, sinCobrar: 0,
      })
      montar()
      const dialogo = await abrir(user)
      await user.type(within(dialogo).getByLabelText('Motivo'), 'Cierre')
      await user.click(within(dialogo).getByRole('button', { name: 'Liberar grupo' }))
      await user.click(await screen.findByRole('button', { name: 'Volver a mesas' }))

      const aviso = alerta()
      expect(aviso).toHaveTextContent('Grupo 1 sigue junto: no se pudo liberar Mesa 2.')
      expect(aviso).toHaveTextContent('Mesa 2: Hay un cobro con tarjeta en curso')
      await user.click(within(aviso).getByRole('button', { name: 'Liberar grupo' }))
      expect(screen.getByRole('dialog', { name: 'Liberar grupo' })).toBeInTheDocument()
    })
  })

  describe('al cobrar una mesa del grupo', () => {
    // El cobro de la mesa ya soltó lo que pudo: la pantalla le dice a quien cobró cómo quedó el grupo.
    const cobrar = async (user) => {
      await user.click(within(tarjeta('Mesa 2')).getAllByRole('button').at(-1))
      await user.click(screen.getByRole('button', { name: 'simular cobro' }))
    }

    it('si quedó todo libre y el grupo separado, lo avisa y refresca los grupos', async () => {
      const user = userEvent.setup()
      cobro.resultado = { ...RESULTADO_LIBERADO, conPedido: [], mesaCobrada: 'Mesa 2' }
      montar()
      await cobrar(user)

      expect(toastExito).toHaveBeenCalledWith('Mesa 2 cobrada: Mesa 1 y Mesa 3 quedaron libres y el grupo se separó.')
      expect(grupos.refresh).toHaveBeenCalled()
      expect(refrescarMesas).toHaveBeenCalled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('si otra mesa del grupo tiene un pedido abierto, avisa cuál es y ofrece ir a ella', async () => {
      const user = userEvent.setup()
      cobro.resultado = {
        liberadas: [{ id: 'm1', nombre: 'Mesa 1' }], fallidas: [], separado: false, errorAlSeparar: null, error: null, mesaCobrada: 'Mesa 2',
        conPedido: [{ id: 'm3', nombre: 'Mesa 3', total: 5400 }],
      }
      montar()
      await cobrar(user)

      const aviso = alerta()
      expect(aviso).toHaveTextContent('Se cobró Mesa 2, pero el grupo sigue junto.')
      expect(aviso).toHaveTextContent('Mesa 1 quedó libre.')
      expect(aviso).toHaveTextContent('Mesa 3 todavía tiene un pedido abierto por $5.400: cóbralo para liberar el grupo.')
      expect(toastExito).not.toHaveBeenCalled()
      await user.click(within(aviso).getByRole('button', { name: 'Ir a Mesa 3' }))
      expect(screen.getByText(/mesa abierta/)).toBeInTheDocument()
    })

    it('si una mesa no se pudo liberar, muestra cuál y por qué', async () => {
      const user = userEvent.setup()
      cobro.resultado = {
        liberadas: [{ id: 'm3', nombre: 'Mesa 3' }], conPedido: [], separado: false, errorAlSeparar: null, error: null, mesaCobrada: 'Mesa 2',
        fallidas: [{ id: 'm1', nombre: 'Mesa 1', mensaje: 'La mesa Mesa 1 tiene un pedido en curso' }],
      }
      montar()
      await cobrar(user)

      const aviso = alerta()
      expect(aviso).toHaveTextContent('Se cobró Mesa 2, pero el grupo sigue junto.')
      expect(aviso).toHaveTextContent('Mesa 3 quedó libre.')
      expect(aviso).toHaveTextContent('No se pudo liberar Mesa 1: La mesa Mesa 1 tiene un pedido en curso')
    })

    it('si no se pudo revisar el grupo, el cobro igual quedó hecho y se explica', async () => {
      const user = userEvent.setup()
      cobro.resultado = { liberadas: [], conPedido: [], fallidas: [], separado: false, errorAlSeparar: null, error: 'Sin conexión', mesaCobrada: 'Mesa 2' }
      montar()
      await cobrar(user)

      expect(alerta()).toHaveTextContent('Se cobró Mesa 2, pero no se pudo revisar el grupo: Sin conexión')
    })

    it('una mesa que no estaba en un grupo no muestra nada', async () => {
      const user = userEvent.setup()
      cobro.resultado = null
      montar()
      await cobrar(user)

      expect(toastExito).not.toHaveBeenCalled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
