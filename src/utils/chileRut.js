/**
 * Valida dígito verificador del RUT chileno. Devuelve mensaje de error o null si es válido.
 * @param {string} value
 * @returns {string | null}
 */
export function validateChileRutMessage(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/-/g, '')
  if (raw.length < 2) return 'Ingresa un RUT válido.'
  const body = raw.slice(0, -1)
  const dvChar = raw.slice(-1)
  if (!/^\d+$/.test(body) || body.length < 7) return 'El RUT debe tener al menos 7 dígitos antes del verificador.'
  if (!/^[\dK]$/.test(dvChar)) return 'Dígito verificador inválido.'
  const factors = [2, 3, 4, 5, 6, 7]
  let total = 0
  let i = 0
  for (const ch of [...body].reverse()) {
    total += parseInt(ch, 10) * factors[i % 6]
    i += 1
  }
  const rest = 11 - (total % 11)
  const expected = rest === 11 ? '0' : rest === 10 ? 'K' : String(rest)
  if (dvChar !== expected) return 'RUT inválido (dígito verificador).'
  return null
}

/**
 * @param {string} phone
 * @returns {string | null} error message or null
 */
export function validateChilePhoneMessage(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return 'El teléfono debe tener entre 8 y 15 dígitos.'
  return null
}
