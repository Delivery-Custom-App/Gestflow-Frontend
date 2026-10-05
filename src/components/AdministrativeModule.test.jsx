import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import AdministrativeModule from './AdministrativeModule'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from '../context/AuthContext'
import { listUsers } from '../lib/apiClient'
import { createCaja, getCajasByLocal, getCajasFisicasByLocal, getOrdersByLocal, getResumenDiario, getVentasIndicadores, listarCajasFisicas } from '../lib/administrativeApi'

vi.mock('../lib/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  getAuthContext: vi.fn(() => Promise.resolve({ token: 'test-token' })),
  apiRequest: vi.fn(() => Promise.resolve([])),
  listUsers: vi.fn(() => Promise.resolve([
    { id: 'u-ana', first_name: 'Ana', last_name: 'Rojas' },
    { id: 'u-beto', first_name: 'Beto', last_name: 'Soto' },
  ])),
}))

vi.mock('../lib/inventoryApi', async (importOriginal) => ({
  ...(await importOriginal()),
  getLocalById: vi.fn(() => Promise.resolve({ id: 'loc-1', name: 'Sucursal Centro' })),
}))

vi.mock('../hooks/useSelectedLocal', () => ({
  useSelectedLocal: () => null,
}))

vi.mock('./pos/CajaMpPairingModal', () => ({ default: () => null }))
vi.mock('./pos/CajaFisicaModal', () => ({ default: () => <div>modal de caja física</div> }))
vi.mock('./pos/TicketModal', () => ({ default: ({ tipo }) => <div>ticket de {tipo}</div> }))

// recharts no dibuja en jsdom: basta con verificar qué datos recibe el gráfico.
vi.mock('./charts/IncomeChart', () => ({
  default: ({ data }) => <p>Tendencia: {data.length} días</p>,
}))

const recent = new Date().toISOString()

const mockOrders = [
  {
    id: 'ord-1', status: 'completed', total_amount: 5000, payment_method: 'cash', created_at: recent,
    items: [{ product_name: 'Café Americano', quantity: 2, unit_price: 2500 }],
  },
  {
    id: 'ord-2', status: 'completed', total_amount: 4500, payment_method: 'debit', created_at: recent,
    items: [{ product_name: 'Sandwich Ave Palta', quantity: 1, unit_price: 4500 }],
  },
]

const mockCajas = [
  { id: 'caja-1', name: 'Turno 1', caja_fisica_id: 'cf-1', cashier_user_id: 'u-ana', business_date: '2026-09-13', is_active: true, mp: null },
  { id: 'caja-2', name: 'Turno 2', caja_fisica_id: 'cf-2', cashier_user_id: 'u-beto', business_date: '2026-09-12', is_active: false, status: 'closed', mp: null },
]

const mockIndicadores = {
  hoy: { total: 9500, ordenes: 2 },
  porMetodo: { efectivo: 5000, tarjetas: 4500, otros: 0 },
  tendencia: Array.from({ length: 7 }, (_, i) => ({ date: `2${i}/09`, ingresos: 1000 * i, promedio: 3000 })),
  topProductos: [
    { product_id: 'p1', product_name: 'Café Americano', units_sold: 2, revenue: 5000 },
    { product_id: 'p2', product_name: 'Sandwich Ave Palta', units_sold: 1, revenue: 4500 },
  ],
}

const mockResumenDiario = {
  business_date: '2026-09-26',
  monto_apertura_total: '100000.00',
  total_ingresos: '9400.00',
  total_esperado: '109400.00',
  por_caja_fisica: [
    {
      caja_fisica_id: 'cf-1',
      nombre: 'Caja principal',
      monto_apertura_total: '100000.00',
      total_ingresos: '9400.00',
      total_esperado: '109400.00',
      cajas: [
        { caja_id: 'caja-1', status: 'open', monto_apertura: '50000.00', total_ingresos: '9400.00' },
        { caja_id: 'caja-2', status: 'closed', monto_apertura: '50000.00', total_ingresos: '0.00' },
      ],
    },
  ],
}

const mockCajasFisicas = [
  { id: 'cf-1', name: 'Caja principal', is_active: true, mp: null, mpDisponible: true },
  { id: 'cf-2', name: 'Caja terraza', is_active: true, mp: { pairing_status: 'paired', terminal_id: 'PAX-123' }, mpDisponible: true },
]

vi.mock('../lib/administrativeApi', async (importOriginal) => ({
  ...(await importOriginal()),
  getOrdersByLocal: vi.fn(() => Promise.resolve(mockOrders)),
  getLocalDashboard: vi.fn(() => Promise.resolve({ monthly_sales: 120000 })),
  getCajasByLocal: vi.fn(() => Promise.resolve(mockCajas)),
  getCajasFisicasByLocal: vi.fn(() => Promise.resolve(mockCajasFisicas)),
  getVentasIndicadores: vi.fn(() => Promise.resolve(mockIndicadores)),
  getResumenDiario: vi.fn(() => Promise.resolve(mockResumenDiario)),
  listarCajasFisicas: vi.fn(() => Promise.resolve(mockCajasFisicas)),
  createCaja: vi.fn(() => Promise.resolve({ id: 'caja-9', caja_fisica_id: 'cf-1' })),
}))

// El módulo lee el rol del contexto: las cajas físicas son supervisorias y no
// se muestran a quien atiende. Por defecto se monta como dueña del negocio.
function renderAdmin(section, userRole = 'Admin Negocio') {
  return render(
    <AuthProvider user={{ id: 'u-1' }} userRole={userRole} logout={() => {}}>
      <MemoryRouter initialEntries={[`/local/loc-1/administrativo/${section}`]}>
        <Routes>
          <Route path="/local/:localId/administrativo/:sectionId?" element={<AdministrativeModule />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('AdministrativeModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(['rendiciones', 'reportes', 'alertas', 'bonos', 'dashboard'])(
    'redirige la sección eliminada "%s" a Ventas',
    async (section) => {
      renderAdmin(section)

      expect(await screen.findByRole('heading', { name: 'Ventas' })).toBeInTheDocument()
      await waitFor(() => expect(getVentasIndicadores).toHaveBeenCalledWith('loc-1'))
    },
  )

  it('Ventas incluye la tendencia y el top de productos que antes estaban en Reportes', async () => {
    renderAdmin('ventas')

    expect(await screen.findByText('Tendencia: 7 días')).toBeInTheDocument()
    const topPanel = screen.getByRole('heading', { name: 'Top Productos' }).closest('article')
    expect(within(topPanel).getByText('Café Americano')).toBeInTheDocument()
    expect(within(topPanel).getByText('Sandwich Ave Palta')).toBeInTheDocument()
  })

  it('los indicadores salen de los reportes agregados, sin descargar el histórico de órdenes', async () => {
    renderAdmin('ventas')

    await waitFor(() => expect(getVentasIndicadores).toHaveBeenCalledWith('loc-1'))
    expect(getOrdersByLocal).not.toHaveBeenCalled()

    // Los KPI del día vienen del backend, no de sumar órdenes en el navegador.
    const kpi = (await screen.findByText('Total Hoy')).closest('article')
    expect(within(kpi).getByText('$9.500')).toBeInTheDocument()
    expect(within(kpi).getByText('2 ventas')).toBeInTheDocument()
  })

  it('el detalle orden por orden se descarga solo si el usuario lo pide', async () => {
    const user = userEvent.setup()
    renderAdmin('ventas')

    const boton = await screen.findByRole('button', { name: 'Cargar detalle de órdenes' })
    expect(getOrdersByLocal).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Histórico y Consolidados' })).not.toBeInTheDocument()

    await user.click(boton)

    await waitFor(() => expect(getOrdersByLocal).toHaveBeenCalledWith('loc-1', 'test-token'))
    expect(await screen.findByRole('heading', { name: 'Histórico y Consolidados' })).toBeInTheDocument()
  })

  it('el panel "Ventas del Día" ya no se muestra al cargar el detalle', async () => {
    const user = userEvent.setup()
    renderAdmin('ventas')

    await user.click(await screen.findByRole('button', { name: 'Cargar detalle de órdenes' }))
    expect(await screen.findByRole('heading', { name: 'Histórico y Consolidados' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ventas del Día' })).not.toBeInTheDocument()
    expect(screen.queryByText(/últimas 24 h/)).not.toBeInTheDocument()
  })

  it('Caja y turnos vincula MercadoPago desde las cajas físicas, no desde los turnos', async () => {
    renderAdmin('flujo-caja')

    // El panel de cajas físicas es el que ofrece la vinculación.
    const panelFisicas = (await screen.findByRole('heading', { name: 'Cajas físicas' })).closest('article')
    expect(within(panelFisicas).getByText('Caja principal')).toBeInTheDocument()
    expect(within(panelFisicas).getByText('PAX-123')).toBeInTheDocument()
    // Una acción de vinculación por caja física (además de crear y renombrar).
    expect(within(panelFisicas).getByRole('button', { name: 'Vincular MP' })).toBeInTheDocument()
    expect(within(panelFisicas).getByRole('button', { name: 'Ver vinculación' })).toBeInTheDocument()

    // La tabla de turnos ya no habla de MercadoPago: ese estado era por caja física.
    const panelTurnos = screen.getByRole('heading', { name: 'Turnos de caja' }).closest('article')
    expect(within(panelTurnos).queryByText('MercadoPago')).not.toBeInTheDocument()
    expect(within(panelTurnos).queryByText('Vincular MP')).not.toBeInTheDocument()
  })

  it('el resumen del día muestra el detalle por caja física, no un mensaje de "sin cajas"', async () => {
    renderAdmin('flujo-caja')

    const resumen = (await screen.findByRole('heading', { name: 'Resumen del día' })).closest('article')
    expect(within(resumen).queryByText(/Todavía no se abrió ninguna caja/)).not.toBeInTheDocument()
    expect(within(resumen).getByText('Detalle por caja física')).toBeInTheDocument()
    expect(within(resumen).getByText('Caja principal')).toBeInTheDocument()
    // Dos turnos del día, uno de ellos abierto.
    expect(within(resumen).getByText('2 · 1 abierto')).toBeInTheDocument()
  })

  it('avisa que no se abrió ningún turno solo cuando de verdad no hay turnos del día', async () => {
    getResumenDiario.mockResolvedValueOnce({
      business_date: '2026-09-26',
      monto_apertura_total: '0.00',
      total_ingresos: '0.00',
      total_esperado: '0.00',
      por_caja_fisica: [],
    })
    renderAdmin('flujo-caja')

    const resumen = (await screen.findByRole('heading', { name: 'Resumen del día' })).closest('article')
    expect(within(resumen).getByText('Todavía no se abrió ningún turno de caja hoy en este local.')).toBeInTheDocument()
    expect(within(resumen).queryByText('Detalle por caja física')).not.toBeInTheDocument()
  })

  it('si no se puede consultar el estado de MercadoPago, no se afirma que la caja está sin vincular', async () => {
    getCajasFisicasByLocal.mockResolvedValueOnce([
      { id: 'cf-1', name: 'Caja principal', is_active: true, mp: null, mpDisponible: false },
    ])
    renderAdmin('flujo-caja')

    const panel = (await screen.findByRole('heading', { name: 'Cajas físicas' })).closest('article')
    expect(within(panel).getByText('Estado no disponible')).toBeInTheDocument()
    expect(within(panel).queryByText('Sin vincular')).not.toBeInTheDocument()
    // Y la pantalla lo dice, en vez de dejarlo en silencio.
    expect(within(panel).getByText(/No se pudo consultar el estado de MercadoPago/i)).toBeInTheDocument()
  })

  it('con el estado disponible, la columna refleja la vinculación real de cada caja', async () => {
    renderAdmin('flujo-caja')

    const panel = (await screen.findByRole('heading', { name: 'Cajas físicas' })).closest('article')
    expect(within(panel).getByText('Sin vincular')).toBeInTheDocument()
    expect(within(panel).getByText('Vinculada')).toBeInTheDocument()
    expect(within(panel).getByText('PAX-123')).toBeInTheDocument()
    expect(within(panel).queryByText('Estado no disponible')).not.toBeInTheDocument()
  })

  it('el panel de cajas físicas ofrece crearlas y renombrarlas', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    const panel = (await screen.findByRole('heading', { name: 'Cajas físicas' })).closest('article')
    expect(within(panel).getByRole('button', { name: '+ Nueva caja física' })).toBeInTheDocument()
    expect(within(panel).getAllByRole('button', { name: 'Renombrar' })).toHaveLength(mockCajasFisicas.length)

    await user.click(within(panel).getByRole('button', { name: '+ Nueva caja física' }))
    expect(await screen.findByText('modal de caja física')).toBeInTheDocument()
  })

  it.each(['Empleado', 'Cajero'])('%s no ve el panel de cajas físicas', async (rol) => {
    renderAdmin('flujo-caja', rol)

    // La sección sigue funcionando: lo que desaparece es el panel supervisorio.
    expect(await screen.findByRole('heading', { name: 'Turnos de caja' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cajas físicas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Nueva caja física' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Renombrar' })).not.toBeInTheDocument()
    expect(screen.queryByText(/estado de MercadoPago/i)).not.toBeInTheDocument()
  })

  it('a un empleado no se le piden las cajas físicas: el backend le responde 403', async () => {
    renderAdmin('flujo-caja', 'Empleado')

    await waitFor(() => expect(getCajasByLocal).toHaveBeenCalled())
    expect(getCajasFisicasByLocal).not.toHaveBeenCalled()
  })

  it.each(['Admin', 'Admin Negocio', 'Superadmin'])('%s sigue viendo y gestionando las cajas físicas', async (rol) => {
    renderAdmin('flujo-caja', rol)

    const panel = (await screen.findByRole('heading', { name: 'Cajas físicas' })).closest('article')
    expect(within(panel).getByText('Caja principal')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: '+ Nueva caja física' })).toBeInTheDocument()
    await waitFor(() => expect(getCajasFisicasByLocal).toHaveBeenCalledWith('loc-1'))
  })

  it('Caja y turnos muestra ingresos del mes y turnos abiertos, sin gastos ni flujo neto', async () => {
    renderAdmin('flujo-caja')

    const cajasCard = (await screen.findByText('Turnos Abiertos')).closest('article')
    expect(within(cajasCard).getByText('1')).toBeInTheDocument()
    expect(within(cajasCard).getByText('De 2 registrados')).toBeInTheDocument()
    expect(screen.getByText('Ingresos del Mes')).toBeInTheDocument()
    expect(screen.queryByText('Total Gastos')).not.toBeInTheDocument()
    expect(screen.queryByText('Flujo Neto')).not.toBeInTheDocument()
    expect(getCajasByLocal).toHaveBeenCalledWith('loc-1', 'test-token')
  })

  it('la boleta de cada venta se ve desde el detalle de órdenes del histórico', async () => {
    const user = userEvent.setup()
    renderAdmin('ventas')

    await user.click(await screen.findByRole('button', { name: 'Cargar detalle de órdenes' }))
    // Sin desplegar un período no hay órdenes a la vista.
    expect(screen.queryByRole('button', { name: 'Boleta' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /2 ventas/ }))
    const botones = await screen.findAllByRole('button', { name: 'Boleta' })
    expect(botones).toHaveLength(mockOrders.length)

    await user.click(botones[0])
    expect(await screen.findByText('ticket de boleta')).toBeInTheDocument()
  })

  // «Caja» significaba dos cosas en la misma pantalla: el turno que se abre y
  // cierra cada día, y el mueble donde está la terminal. Vocabulario fijado:
  // "turno de caja" y "caja física".
  it('nombra el turno como turno y el mueble como caja física, sin usar "caja" a secas', async () => {
    renderAdmin('flujo-caja')

    expect(await screen.findByRole('heading', { name: 'Turnos de caja' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cajas físicas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Abrir turno de caja' })).toBeInTheDocument()
    expect(screen.getByText('Turnos Abiertos')).toBeInTheDocument()

    // Los nombres viejos, que se leían como si fueran el mismo concepto.
    expect(screen.queryByRole('heading', { name: 'Cajas del Local' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Nueva Caja' })).not.toBeInTheDocument()
    expect(screen.queryByText('Cajas Abiertas')).not.toBeInTheDocument()

    // El turno es masculino: el estado de la tabla concuerda.
    const panelTurnos = screen.getByRole('heading', { name: 'Turnos de caja' }).closest('article')
    expect(within(panelTurnos).getByText('Abierto')).toBeInTheDocument()
    expect(within(panelTurnos).getByText('Cerrado')).toBeInTheDocument()
  })

  it('explica en pantalla la diferencia entre turno de caja y caja física', async () => {
    renderAdmin('flujo-caja')

    expect(await screen.findByText(/Turno de caja:/)).toBeInTheDocument()
    expect(screen.getByText(/se abre y se cierra cada día/)).toBeInTheDocument()
    expect(screen.getByText(/Caja física:/)).toBeInTheDocument()
    expect(screen.getByText(/el puesto donde está la terminal/)).toBeInTheDocument()
  })

  it('el formulario de apertura pide caja física y efectivo inicial, no un nombre', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))

    expect(await screen.findByRole('heading', { name: 'Abrir turno de caja' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Caja física')).toBeInTheDocument()
    expect(screen.getByLabelText('Monto de apertura')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir turno' })).toBeInTheDocument()
    // El turno no tiene nombre en el modelo: pedirlo era pedir un dato que se descartaba.
    expect(screen.queryByPlaceholderText('Ej: Turno mañana')).not.toBeInTheDocument()
  })

  it('abre el turno sobre la caja física elegida y con el monto escrito', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))
    await user.selectOptions(await screen.findByLabelText('Caja física'), 'cf-2')
    await user.type(screen.getByLabelText('Monto de apertura'), '50000')
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))

    // El contrato del backend (ticket #40): la caja física, no el local.
    await waitFor(() => expect(createCaja).toHaveBeenCalledWith({
      caja_fisica_id: 'cf-2',
      monto_apertura: 50000,
    }))
  })

  it('acepta el monto escrito con puntos de miles', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))
    await user.selectOptions(await screen.findByLabelText('Caja física'), 'cf-1')
    await user.type(screen.getByLabelText('Monto de apertura'), '50.000')
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))

    await waitFor(() => expect(createCaja).toHaveBeenCalledWith({
      caja_fisica_id: 'cf-1',
      monto_apertura: 50000,
    }))
  })

  it('un segundo turno del día en la misma caja física se explica en castellano', async () => {
    createCaja.mockRejectedValueOnce(new Error('409: Ya existe una caja abierta hoy para este cajero en esta caja física'))
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))
    await user.selectOptions(await screen.findByLabelText('Caja física'), 'cf-1')
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))

    expect(await screen.findByText(/ya tienes un turno abierto hoy en esa caja física/i)).toBeInTheDocument()
    expect(screen.queryByText(/^409/)).not.toBeInTheDocument()
  })

  it('sin cajas físicas explica por qué no se puede abrir un turno y ofrece crearla', async () => {
    listarCajasFisicas.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))

    expect(await screen.findByText(/todavía no tiene ninguna caja física registrada/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear caja física' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Monto de apertura')).not.toBeInTheDocument()
    expect(createCaja).not.toHaveBeenCalled()
  })

  it('a un empleado sin cajas físicas se le dice a quién pedírsela, sin ofrecerle crearla', async () => {
    listarCajasFisicas.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderAdmin('flujo-caja', 'Empleado')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))

    expect(await screen.findByText(/pídele a un administrador/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear caja física' })).not.toBeInTheDocument()
  })

  it('la tabla de turnos dice sobre qué caja física se abrió cada uno', async () => {
    renderAdmin('flujo-caja')

    const panel = (await screen.findByRole('heading', { name: 'Turnos de caja' })).closest('article')
    expect(within(panel).getByText('Caja principal')).toBeInTheDocument()
  })

  it.each(['Admin', 'Admin Negocio'])('%s ve de quién es cada turno y lo filtra por vendedor y fecha', async (rol) => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja', rol)

    const panel = (await screen.findByRole('heading', { name: 'Turnos de caja' })).closest('article')
    const tabla = () => within(panel).getByRole('table')
    const filas = () => within(tabla()).getAllByRole('row').slice(1)
    expect(await within(tabla()).findByText('Ana Rojas')).toBeInTheDocument()
    expect(within(tabla()).getByText('Beto Soto')).toBeInTheDocument()
    expect(filas()).toHaveLength(2)

    await user.selectOptions(within(panel).getByLabelText('Vendedor'), 'u-beto')
    expect(filas()).toHaveLength(1)
    expect(within(filas()[0]).getByText('Beto Soto')).toBeInTheDocument()

    await user.selectOptions(within(panel).getByLabelText('Vendedor'), '')
    await user.type(within(panel).getByLabelText('Fecha'), '2026-09-13')
    expect(filas()).toHaveLength(1)
    expect(within(filas()[0]).getByText('Ana Rojas')).toBeInTheDocument()
  })

  it('al abrir un turno ve su resumen: ventas, ingresos, egresos y el arqueo para cerrarlo', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja', 'Admin')

    const panel = (await screen.findByRole('heading', { name: 'Turnos de caja' })).closest('article')
    const filaAna = (await within(within(panel).getByRole('table')).findByText('Ana Rojas')).closest('tr')
    await user.click(within(filaAna).getByRole('button', { name: 'Ver resumen' }))

    // El panel lateral: lo que rodea al título del resumen.
    const lateral = (await screen.findByRole('heading', { name: 'Resumen del turno' })).closest('.fixed')
    expect(within(lateral).getByText(/Ana Rojas · 13\/09\/2026 · Abierto/)).toBeInTheDocument()
    for (const cifra of ['Ventas', 'Ingresos', 'Egresos', 'Apertura', 'Total esperado']) {
      expect(await within(lateral).findByText(cifra)).toBeInTheDocument()
    }
    expect(within(lateral).getByRole('button', { name: /Cerrar turno \(arqueo del día\)/ })).toBeInTheDocument()
  })

  it('si no se pueden leer los nombres, la tabla igual distingue a cada vendedor', async () => {
    listUsers.mockRejectedValueOnce(new Error('403'))
    renderAdmin('flujo-caja', 'Admin')

    const panel = (await screen.findByRole('heading', { name: 'Turnos de caja' })).closest('article')
    expect(await within(within(panel).getByRole('table')).findByText('Usuario u-ana')).toBeInTheDocument()
  })

})
