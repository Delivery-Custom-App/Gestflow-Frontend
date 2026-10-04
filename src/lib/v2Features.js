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
  mercadopagoPoint: true,
  mpConfig: true,
  cajaMpPairing: true,
  /**
   * Administración de impresoras: registrar una, probarla, mandarle a
   * imprimir. Eso no existe en V2 (`/printers` y `/comandas/{id}/print`
   * devuelven 404) y no está previsto: la impresión la resuelve el navegador.
   * La pantalla de configuración queda apagada con su código intacto.
   */
  printers: false,
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
  /** Endpoints legacy /dashboard/* (aún no en V2). Se calculan desde órdenes. */
  adminDashboard: false,
  /** Motor de alertas / SSE (aún no en V2). */
  alerts: false,
  /** Legacy /webhooks/mercadopago-pos discover+link — implementado en V2. */
  mpPosWebhooks: true,
}

export function isV2FeatureEnabled(key) {
  return Boolean(V2_FEATURES[key])
}
