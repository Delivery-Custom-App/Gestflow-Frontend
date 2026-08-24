/**
 * Capacidades disponibles en la integración Backend V2.
 * Lo que está en false se oculta o degrada en la UI (sin runtime legacy).
 */
export const V2_FEATURES = {
  hrModule: true,
  mercadopagoPoint: false,
  mpConfig: false,
  cajaMpPairing: false,
  printers: false,
  comandas: false,
  splitPayments: false,
  receiptPrint: false,
  superAdminAudit: true,
  superAdminObservability: true,
}

export function isV2FeatureEnabled(key) {
  return Boolean(V2_FEATURES[key])
}
