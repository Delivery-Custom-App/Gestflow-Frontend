import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import AdministrativeModule from './AdministrativeModule'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from '../context/AuthContext'
import { listUsers } from '../lib/apiClient'
import { V2_FEATURES } from '../lib/v2Features'
import { cambiarEstadoCajaFisica, createCaja, eliminarCajaFisica, getCajasByLocal, getCajasFisicasByLocal, getOrdersByLocal, getResumenDiario, getVentasIndicadores, listarCajasFisicas } from '../lib/administrativeApi'

import { apiRequest } from '../lib/apiClient'

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
  cambiarEstadoCajaFisica: vi.fn(() => Promise.resolve({})),
  eliminarCajaFisica: vi.fn(() => Promise.resolve()),
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

  it('con la bandera fondoEmergencia apagada, la sección no existe y su dirección lleva a Ventas', async () => {
    V2_FEATURES.fondoEmergencia = false
    try {
      renderAdmin('fondo-emergencia')
      expect(await screen.findByRole('heading', { name: 'Ventas' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Fondo de emergencia' })).not.toBeInTheDocument()
    } finally {
      V2_FEATURES.fondoEmergencia = true
    }
  })

  it('la bandera está encendida: Administración tiene la sección "Fondo de emergencia"', async () => {
    expect(V2_FEATURES.fondoEmergencia).toBe(true)
    renderAdmin('fondo-emergencia', 'Admin')
    expect(await screen.findByRole('heading', { name: 'Fondo de emergencia' })).toBeInTheDocument()
    expect(await screen.findByText(/todavía no tiene fondo de emergencia/)).toBeInTheDocument()
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

  it('T-63: egresos, efectivo esperado y diferencias del local, de cada caja física y de cada turno', async () => {
    getResumenDiario.mockResolvedValueOnce({
      ...mockResumenDiario,
      total_egresos: '1000.00', efectivo_esperado: '108400.00', diferencia_total: '-300.00',
      por_caja_fisica: [{
        ...mockResumenDiario.por_caja_fisica[0], total_egresos: '1000.00', efectivo_esperado: '108400.00', diferencia_total: '-300.00',
        cajas: [
          { caja_id: 'caja-1', cashier_user_id: 'u-ana', status: 'open', total_egresos: '1000.00', efectivo_esperado: '58400.00', monto_cierre_declarado: null, diferencia: null },
          { caja_id: 'caja-2', cashier_user_id: 'u-beto', status: 'closed', total_egresos: '0.00', efectivo_esperado: '50000.00', monto_cierre_declarado: '49700.00', diferencia: '-300.00' },
          { caja_id: 'caja-3', cashier_user_id: 'u-beto', status: 'closed', total_egresos: '0.00', efectivo_esperado: '0.00', monto_cierre_declarado: null, diferencia: null },
        ],
      }],
    })
    renderAdmin('flujo-caja')

    const resumen = (await screen.findByRole('heading', { name: 'Resumen del día' })).closest('article')
    expect(within(resumen).getByTestId('egresos-dia')).toHaveTextContent('$1.000')
    expect(within(resumen).getByTestId('efectivo-esperado-dia')).toHaveTextContent('$108.400')
    expect(within(resumen).getByTestId('diferencia-dia')).toHaveTextContent('Faltan $300')
    const turnos = within(resumen).getByRole('list', { name: 'Turnos del día' })
    const filas = within(turnos).getAllByRole('listitem')
    expect(filas).toHaveLength(3)
    expect(filas[1]).toHaveAttribute('data-diferencia', 'si')
    expect(filas[1]).toHaveTextContent('Contado $49.700 · Faltan $300')
    expect(filas[0]).toHaveTextContent('Sin cerrar')
    expect(filas[2]).toHaveTextContent('Sin arqueo')
  })

  it('sin arqueos del día, la diferencia dice «Sin arqueo»', async () => {
    renderAdmin('flujo-caja')
    const resumen = (await screen.findByRole('heading', { name: 'Resumen del día' })).closest('article')
    expect(within(resumen).getByTestId('diferencia-dia')).toHaveTextContent('Sin arqueo')
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
    expect(within(panel).getAllByRole('button', { name: 'Editar' })).toHaveLength(mockCajasFisicas.length)

    await user.click(within(panel).getByRole('button', { name: '+ Nueva caja física' }))
    expect(await screen.findByText('modal de caja física')).toBeInTheDocument()
  })

  it.each(['Empleado', 'Cajero'])('%s no ve el panel de cajas físicas', async (rol) => {
    renderAdmin('flujo-caja', rol)

    // La sección sigue funcionando: lo que desaparece es el panel supervisorio.
    expect(await screen.findByRole('heading', { name: 'Turnos de caja' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cajas físicas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Nueva caja física' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument()
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

  it('el formulario de apertura pide caja física y el conteo del efectivo, sin elegir "con o sin efectivo"', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))

    expect(await screen.findByRole('heading', { name: 'Abrir turno de caja' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Caja física')).toBeInTheDocument()
    // El conteo está siempre a la vista (T-40): billetes y monedas.
    expect(screen.getByRole('region', { name: 'Billetes' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Monedas' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Monto de apertura')).not.toBeInTheDocument()
    expect(screen.queryByText(/con efectivo|sin efectivo/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir turno' })).toBeInTheDocument()
    // El turno no tiene nombre en el modelo: pedirlo era pedir un dato que se descartaba.
    expect(screen.queryByPlaceholderText('Ej: Turno mañana')).not.toBeInTheDocument()
  })

  it('abre el turno sobre la caja física elegida con el total de lo contado', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))
    await user.selectOptions(await screen.findByLabelText('Caja física'), 'cf-2')
    await user.type(screen.getByLabelText('Cantidad de billetes de $20.000'), '2')
    await user.type(screen.getByLabelText('Cantidad de billetes de $5.000'), '1')
    await user.click(screen.getByRole('button', { name: 'Agregar uno: monedas de $500' }))
    expect(screen.getByTestId('total-efectivo')).toHaveTextContent('$45.500')
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))

    // El contrato del backend (ticket #40): la caja física, no el local. Sin el
    // B-28 (bandera apagada) el desglose no viaja: el backend lo descartaría.
    await waitFor(() => expect(createCaja).toHaveBeenCalledWith({
      caja_fisica_id: 'cf-2',
      monto_apertura: 45500,
    }))
  })

  it('con la bandera desgloseEfectivo, además manda los billetes y monedas contados', async () => {
    V2_FEATURES.desgloseEfectivo = true
    try {
      const user = userEvent.setup()
      renderAdmin('flujo-caja')

      await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))
      await user.selectOptions(await screen.findByLabelText('Caja física'), 'cf-1')
      await user.type(screen.getByLabelText('Cantidad de billetes de $10.000'), '3')
      await user.type(screen.getByLabelText('Cantidad de monedas de $100'), '15')
      await user.click(screen.getByRole('button', { name: 'Abrir turno' }))

      await waitFor(() => expect(createCaja).toHaveBeenCalledWith({
        caja_fisica_id: 'cf-1',
        monto_apertura: 31500,
        apertura_desglose: [
          { denominacion: 10000, tipo: 'billete', cantidad: 3 },
          { denominacion: 100, tipo: 'moneda', cantidad: 15 },
        ],
      }))
    } finally {
      V2_FEATURES.desgloseEfectivo = false
    }
  })

  it('sin efectivo contado pide confirmar antes de abrir en $0', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))
    await user.selectOptions(await screen.findByLabelText('Caja física'), 'cf-1')
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))

    expect(screen.getByRole('alertdialog', { name: '¿Abrir la caja sin efectivo?' })).toBeInTheDocument()
    expect(createCaja).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Sí, abrir sin efectivo' }))
    await waitFor(() => expect(createCaja).toHaveBeenCalledWith({ caja_fisica_id: 'cf-1', monto_apertura: 0 }))
  })

  it('"Volver a contar" cierra la confirmación sin abrir, y contar algo la quita', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))
    await user.selectOptions(await screen.findByLabelText('Caja física'), 'cf-1')
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))
    await user.click(screen.getByRole('button', { name: 'Volver a contar' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))
    await user.click(screen.getByRole('button', { name: 'Agregar uno: billetes de $1.000' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(createCaja).not.toHaveBeenCalled()
  })

  it('un segundo turno del día en la misma caja física se explica en castellano', async () => {
    createCaja.mockRejectedValueOnce(new Error('409: Ya existe una caja abierta hoy para este cajero en esta caja física'))
    const user = userEvent.setup()
    renderAdmin('flujo-caja')

    await user.click(await screen.findByRole('button', { name: '+ Abrir turno de caja' }))
    await user.selectOptions(await screen.findByLabelText('Caja física'), 'cf-1')
    await user.click(screen.getByRole('button', { name: 'Agregar uno: billetes de $1.000' }))
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
    expect(screen.queryByRole('region', { name: 'Billetes' })).not.toBeInTheDocument()
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

    // A-01: con filtros, la lista la entrega el servidor (GET /cajas con los parámetros).
    apiRequest.mockImplementation(async (path) => {
      if (!String(path).startsWith('/cajas?')) return []
      const q = new URLSearchParams(String(path).split('?')[1])
      return mockCajas.filter((c) => (!q.get('cashier_user_id') || c.cashier_user_id === q.get('cashier_user_id'))
        && (!q.get('business_date') || c.business_date === q.get('business_date')))
    })
    try {
      await user.selectOptions(within(panel).getByLabelText('Vendedor'), 'u-beto')
      await waitFor(() => expect(filas()).toHaveLength(1))
      expect(within(filas()[0]).getByText('Beto Soto')).toBeInTheDocument()
      expect(apiRequest).toHaveBeenCalledWith('/cajas?local_id=loc-1&cashier_user_id=u-beto')

      await user.selectOptions(within(panel).getByLabelText('Vendedor'), '')
      await user.type(within(panel).getByLabelText('Fecha'), '2026-09-13')
      await waitFor(() => expect(within(filas()[0]).getByText('Ana Rojas')).toBeInTheDocument())
      expect(filas()).toHaveLength(1)
      expect(apiRequest).toHaveBeenCalledWith('/cajas?local_id=loc-1&business_date=2026-09-13')
    } finally {
      apiRequest.mockImplementation(() => Promise.resolve([]))
    }
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

  it('T-56: en un turno abierto el encargado ve «Registrar movimiento»', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja', 'Admin')
    const panel = (await screen.findByRole('heading', { name: 'Turnos de caja' })).closest('article')
    const filaAna = (await within(within(panel).getByRole('table')).findByText('Ana Rojas')).closest('tr')
    await user.click(within(filaAna).getByRole('button', { name: 'Ver resumen' }))
    const lateral = (await screen.findByRole('heading', { name: 'Resumen del turno' })).closest('.fixed')
    await user.click(within(lateral).getByRole('button', { name: 'Registrar movimiento' }))
    expect(within(lateral).getByRole('form', { name: 'Registrar movimiento' })).toBeInTheDocument()
  })

  it('si no se pueden leer los nombres, la tabla igual distingue a cada vendedor', async () => {
    listUsers.mockRejectedValueOnce(new Error('403'))
    renderAdmin('flujo-caja', 'Admin')

    const panel = (await screen.findByRole('heading', { name: 'Turnos de caja' })).closest('article')
    expect(await within(within(panel).getByRole('table')).findByText('Usuario u-ana')).toBeInTheDocument()
  })

})

describe('AdministrativeModule · desactivar y eliminar cajas físicas (T-75)', () => {
  const panelCajas = async () => (await screen.findByRole('heading', { name: 'Cajas físicas' })).closest('article')

  it('una caja activa se desactiva con confirmación (PATCH is_active=false) y la lista se recarga', async () => {
    const user = userEvent.setup()
    renderAdmin('flujo-caja')
    const panel = await panelCajas()
    const fila = within(panel).getByText('Caja principal').closest('tr')
    await user.click(within(fila).getByRole('button', { name: 'Desactivar' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Desactivar caja física' })
    expect(within(dialogo).getByText(/Deja de ofrecerse al abrir turnos/)).toBeInTheDocument()
    const llamadasAntes = getCajasFisicasByLocal.mock.calls.length
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar' }))

    expect(cambiarEstadoCajaFisica).toHaveBeenCalledWith('cf-1', false)
    await waitFor(() => expect(getCajasFisicasByLocal.mock.calls.length).toBeGreaterThan(llamadasAntes))
  })

  it('una desactivada se marca y ofrece reactivar o eliminar (no vincular MercadoPago)', async () => {
    getCajasFisicasByLocal.mockResolvedValueOnce([
      { id: 'cf-9', name: 'Caja vieja', is_active: false, mp: null, mpDisponible: true },
    ])
    renderAdmin('flujo-caja')
    const panel = await panelCajas()
    const fila = within(panel).getByText('Caja vieja').closest('tr')
    expect(within(fila).getByText('Desactivada')).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Reactivar' })).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
    expect(within(fila).queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument()
    expect(within(fila).queryByRole('button', { name: /Vincular/ })).not.toBeInTheDocument()
  })

  it('eliminar una con turnos históricos muestra el motivo del backend y la caja sigue', async () => {
    getCajasFisicasByLocal.mockResolvedValueOnce([
      { id: 'cf-9', name: 'Caja vieja', is_active: false, mp: null, mpDisponible: true },
    ])
    eliminarCajaFisica.mockRejectedValueOnce(new Error('400: Esta caja física tiene turnos históricos -- no se puede borrar de forma permanente sin perder ese historial. Queda desactivada (archivada).'))
    const user = userEvent.setup()
    renderAdmin('flujo-caja')
    const panel = await panelCajas()
    await user.click(within(within(panel).getByText('Caja vieja').closest('tr')).getByRole('button', { name: 'Eliminar' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Eliminar caja física' })
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar para siempre' }))

    expect(eliminarCajaFisica).toHaveBeenCalledWith('cf-9')
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Esta caja física tiene turnos históricos')
    expect(within(panel).getByText('Caja vieja')).toBeInTheDocument()
  })
})

