/**
 * Capacidades disponibles en la integración Backend V2.
 * Lo que está en false se oculta o degrada en la UI (sin runtime legacy).
 */
export const V2_FEATURES = {
  /**
   * Recursos Humanos (fichas, turnos y permisos). Apagado por decisión de
   * producto —el módulo no se va a usar por ahora—, no por falta de backend:
   * V2 sí expone `/employees`, `/shifts`, `/payroll-periods` y `/leave-requests`.
   *
   * Con la bandera apagada ningún rol tiene RRHH en el menú (AppShell.jsx,
   * ítem `hr-hub`) y la ruta `/local/:localId/rrhh` no existe
   * (AuthenticatedRoutes.jsx, `localRoutes`): quien llega por una dirección
   * guardada cae en el inicio de su rol. El código de `components/hr/` y sus
   * hooks se conserva. Para retomarlo basta con poner esta bandera en true:
   * el ítem (gerente y encargado; el trabajador nunca lo ve) y la ruta
   * reaparecen.
   */
  hrModule: false,
  /**
   * Pantalla de Cocina (KDS: comandas en curso para avanzar de estado).
   * Apagada por decisión de producto, no por falta de backend. Sin ella no
   * hay ítem "Cocina" en el menú (AppShell.jsx, `pos-kitchen`) ni ruta
   * `/local/:localId/pos/cocina`; la comanda se sigue viendo e imprimiendo
   * desde la mesa (ComandaActions en MesaWorkspace). Para retomarla, poner
   * esta bandera en true: el ítem y la ruta reaparecen.
   */
  kitchenView: false,
  /**
   * Recetas (inventario). Apagada por decisión de producto: el inventario se
   * lleva por unidades. Sin ella no hay ítem "Recetas" (AppShell.jsx,
   * `inv-recetas`) ni ruta `/local/:localId/inventario/recipes`. Las ventas no
   * dependen de recetas: un producto que se prepara (RECIPE_BASED) se vende
   * igual y el backend solo omite el descuento de ingredientes. El código de
   * `components/inventory/recipes/` se conserva; para retomarla, poner esta
   * bandera en true.
   */
  recipes: false,
  /**
   * RUT del usuario. Backend V2 no tiene dónde guardarlo: `users` no tiene
   * columna `rut` (solo `businesses`), y `POST /users` ignora en silencio los
   * campos que no conoce. Pedir el RUT hoy sería pedir un dato que se pierde.
   * Con la bandera apagada el alta de usuario no lo muestra ni lo envía; el
   * campo y su validación (formato y dígito verificador) ya están hechos en
   * `lib/altaUsuario.js`. Cuando el backend lo acepte (ticket B-04), poner esta
   * bandera en true: el campo aparece, se exige y viaja como `rut`.
   */
  userRut: false,
  /**
   * El vendedor elige su máquina de cobro (T-71, sección 5b del backend).
   * - Restaurante: elige la máquina POS antes de abrir su turno y viaja en
   *   `POST /cajas` (`pos_machine_id`, `compartir`). Una máquina la usan hasta
   *   2 personas: con una adentro se comparte; con dos está llena. Durante el
   *   turno puede cambiarla desde la barra (`PUT /cajas/{id}/maquina`), y si el
   *   administrador se la libera (`pos_machine_released_at`) elige otra o sigue
   *   cobrando sin tarjeta. La máquina se suelta sola al terminar el turno.
   * - Comida al paso: la máquina está anclada a la caja física y no se elige.
   * El estado sale de `ocupacion`, `usuarios` y `disponible` de cada máquina, y
   * el proveedor de `provider` (ya no se pide `/payment-connections`).
   * Necesita el backend con la sección 5b (Develop, octubre 2026).
   */
  eleccionMaquinaVendedor: true,
  /**
   * El encargado de un restaurante abre la caja con el fondo del día
   * (Administración → Caja y turnos). Es el flujo decidido por el equipo, pero
   * el backend todavía responde 403 («En un restaurante el administrador no abre
   * caja propia») a esa apertura (R7, `app/services/cajas.py`). Encenderla
   * cuando el backend lo permita; el dueño y el encargado de un local al paso ya
   * abren la caja sin ella.
   */
  aperturaCajaEncargadoRestaurante: false,
  /**
   * Fondo de emergencia del local (T-26 · T-27): monto fijo, saldo, gastos y
   * reposiciones con fecha, correcciones de gastos e historial por páginas, en
   * Administración, más la tarjeta del dashboard. Lo manejan el dueño y el
   * encargado; el vendedor no lo ve. Usa el contrato del backend B-09
   * (`/locals/{id}/fondo-emergencia`, Develop desde octubre 2026).
   */
  fondoEmergencia: true,
  /**
   * Cobro con tarjeta por el punto único del backend (T-76):
   * `/payments/card/orders/{id}/…` en vez de `/payments/point/orders/{id}/…`.
   * El servidor decide si la máquina del turno cobra con Mercado Pago o con
   * Haulmer. Apagada mientras Haulmer esté en pausa: además, el backend
   * recomienda apagar ese módulo (`card_dispatcher`) en producción mientras
   * ningún cliente lo use, y con él apagado la ruta responde 404. Encenderla
   * solo con el módulo encendido en el servidor. La web no completa un cobro
   * Haulmer (lo hace la app): si la máquina es Haulmer, lo cancela y avisa.
   */
  cobroTarjetaUnificado: false,
  mercadopagoPoint: true,
  mpConfig: true,
  cajaMpPairing: true,
  /** Comanda de cocina: `GET /orders/{id}/comanda`, impresa por el navegador. */
  comandas: true,
  /**
   * Pago multi-comensal. V2 no tiene nada de pagos divididos: `/orders/{id}/
   * split-payments`, su `/summary` y `/split-payments/{id}` devuelven 404, y no
   * existe el modelo en la base. Mientras siga en false, MultiPaymentModal y sus
   * botones no se montan; la UI queda lista para cuando el backend exista.
   */
  splitPayments: false,
  /**
   * Proveedores. V2 no tiene el módulo: no existen `/suppliers` ni sus
   * derivados (detalle, KPIs, historial de compras). Las funciones del front
   * son sustitutos que devuelven listas vacías, así que con la bandera apagada
   * la pantalla lo dice en vez de mostrar ceros que parecen datos reales.
   *
   * Con la bandera apagada, "Proveedores" no se ofrece en el menú de Inventario
   * (AppShell.jsx, ítem `inv-prov`). Para volver a encenderla hace falta que
   * Backend V2 exponga `/suppliers` (CRUD), su detalle, KPIs e historial de
   * compras; luego basta con poner esta bandera en true y el ítem reaparece.
   */
  suppliers: false,
  /**
   * Compras semanales ("Pedidos" en el menú de Inventario). V2 no tiene el
   * módulo: no existe `/weekly-purchase-orders` (listar, crear, detalle, PATCH
   * ni sus items), que es lo que consume `weeklyPurchasesApi.js`; hoy la
   * pantalla falla al abrirse. Con la bandera apagada no se ofrece en el menú
   * (AppShell.jsx, ítem `inv-compras`) ni el acceso "Ir a Pedidos" del Hub de
   * inventario. Para volver a encenderla hace falta ese módulo en el backend
   * —que además depende de `/suppliers`, ver `suppliers`— y luego poner esta
   * bandera en true. Las rutas y las pantallas siguen en el código.
   */
  weeklyPurchases: false,
  /** Boleta del cliente: `GET /orders/{id}/boleta`, impresa por el navegador. */
  receiptPrint: true,
  superAdminAudit: true,
  superAdminObservability: true,
  /** Resumen de caja (total esperado + desglose por método) y su lista de movimientos. */
  movimientosCaja: true,
  /** Legacy /webhooks/mercadopago-pos discover+link — implementado en V2. */
  mpPosWebhooks: true,
}

export function isV2FeatureEnabled(key) {
  return Boolean(V2_FEATURES[key])
}
