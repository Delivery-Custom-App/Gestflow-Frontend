/** Búsqueda de direcciones en Chile con Nominatim (OpenStreetMap). */

// Expands Chilean street abbreviations and removes postal codes so Nominatim understands them
export function normalizeChileanAddress(address) {
  return address
    .replace(/\bNte\b\.?/gi,  'Norte')
    .replace(/\bOte\b\.?/gi,  'Oriente')
    .replace(/\bPte\b\.?/gi,  'Poniente')
    .replace(/\bAv\b\.?/gi,   'Avenida')
    .replace(/\bPsje\b\.?/gi, 'Pasaje')
    .replace(/\bPje\b\.?/gi,  'Pasaje')
    .replace(/\bPob\b\.?/gi,  'Población')
    .replace(/\bVlla\b\.?/gi, 'Villa')
    .replace(/\b\d{4,7}\b/g,  '')   // strip postal codes like 2520000
    .replace(/\s{2,}/g,       ' ')
    .trim()
}

/**
 * Traduce un resultado de Nominatim a los campos que guarda el backend. La
 * calle sale de `addressdetails` cuando viene; si no, del primer tramo del
 * nombre mostrado, que es siempre el más específico.
 */
export function ubicacionDesdeNominatim(item) {
  if (!item) return null
  const d = item.address || {}
  const calle = [d.road, d.house_number].filter(Boolean).join(' ')
  return {
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    street: calle || String(item.display_name || '').split(',')[0].trim() || null,
    city: d.city || d.town || d.village || d.municipality || d.county || null,
    state: d.state || d.region || null,
  }
}

export async function geocodeAddress(address) {
  const normalized = normalizeChileanAddress(address)
  const queries = [`${normalized}, Chile`, `${address}, Chile`, address]
  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=cl&addressdetails=1`
      const res = await fetch(url, { headers: { 'User-Agent': 'Gestflow/1.0' } })
      if (!res.ok) continue
      const data = await res.json()
      if (data.length > 0) return ubicacionDesdeNominatim(data[0])
    } catch { /* continue */ }
  }
  return null
}
