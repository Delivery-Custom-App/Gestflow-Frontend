/**
 * Capacidades disponibles en la integración Backend V2.
 * Lo que está en false se oculta o degrada en la UI (sin runtime legacy).
 */
export const V2_FEATURES = {
  hrModule: true,
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
   */
  suppliers: false,
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
