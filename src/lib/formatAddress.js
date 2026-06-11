const SKIP = /^(Poblaci[oó]n|Regi[oó]n|Provincia|Área|Area|\d{4,}|Chile|Argentina|Bolivia|Uruguay|Per[uú]|Paraguay)/i

export function formatShortAddress(address) {
  if (!address) return ''
  const parts = address.split(',').map((p) => p.trim()).filter((p) => p && !SKIP.test(p))
  return parts.slice(0, 3).join(', ')
}
