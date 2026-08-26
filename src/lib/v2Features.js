/**
 * Capacidades disponibles en la integración Backend V2.
 * Lo que está en false se oculta o degrada en la UI (sin runtime legacy).
 */
export const V2_FEATURES = {
  hrModule: true,
  mercadopagoPoint: true,
  mpConfig: true,
  cajaMpPairing: true,
  printers: false,
  comandas: false,
  splitPayments: true,
  receiptPrint: false,
  superAdminAudit: true,
  superAdminObservability: true,
  /** Gastos, transferencias y dashboard de rendiciones (aún no en V2). */
  rendiciones: false,
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
