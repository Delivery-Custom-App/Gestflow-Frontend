import { useState, useRef } from 'react'
import { X, Building2, MapPin, Loader2 } from 'lucide-react'
import { apiRequest, getAuthContext } from '../lib/apiClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Expands Chilean street abbreviations and removes postal codes so Nominatim understands them
function normalizeChileanAddress(address) {
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

async function geocodeAddress(address) {
  const normalized = normalizeChileanAddress(address)
  const queries = [`${normalized}, Chile`, `${address}, Chile`, address]
  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=cl`
      const res = await fetch(url, { headers: { 'User-Agent': 'SibaGestion/1.0' } })
      const data = await res.json()
      if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch { /* continue */ }
  }
  return null
}

function CreateLocalDrawer({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData]       = useState({ name: '', address: '', phone: '', category: '' })
  const [loading, setLoading]         = useState(false)
  const [geocoding, setGeocoding]     = useState(false)
  const [geocodeOk, setGeocodeOk]     = useState(null)   // true | false | null
  const [error, setError]             = useState(null)

  const [suggestions, setSuggestions]           = useState([])
  const [showSuggestions, setShowSuggestions]   = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedCoords, setSelectedCoords]     = useState(null)
  const debounceTimer = useRef(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddressChange = (e) => {
    const value = e.target.value
    setFormData((prev) => ({ ...prev, address: value }))
    setSelectedCoords(null)
    setGeocodeOk(null)

    clearTimeout(debounceTimer.current)
    if (value.length < 4) {
      setSuggestions([])
      setShowSuggestions(false)
      setLoadingSuggestions(false)
      return
    }

    setLoadingSuggestions(true)
    debounceTimer.current = setTimeout(async () => {
      try {
        const normalized = normalizeChileanAddress(value)
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(normalized + ', Chile')}&format=json&limit=6&countrycodes=cl`
        const res = await fetch(url, { headers: { 'User-Agent': 'SibaGestion/1.0' } })
        const data = await res.json()
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
      } catch {
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setLoadingSuggestions(false)
      }
    }, 450)
  }

  const handleSelectSuggestion = (suggestion) => {
    setFormData((prev) => ({ ...prev, address: suggestion.display_name }))
    setSelectedCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) })
    setGeocodeOk(true)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (!formData.name.trim())    throw new Error('El nombre del local es requerido')
      if (!formData.address.trim()) throw new Error('La dirección es requerida')
      if (!formData.phone.trim())   throw new Error('El teléfono es requerido')

      const { token, businessId } = await getAuthContext()
      if (!businessId) throw new Error('No se encontró business_id en el token')

      // Use already-resolved coords from autocomplete; fall back to geocoding
      let coords = selectedCoords
      if (!coords) {
        setGeocoding(true)
        coords = await geocodeAddress(formData.address.trim())
        setGeocoding(false)
        setGeocodeOk(coords !== null)
      }

      const body = {
        business_id: businessId,
        name: formData.name.trim(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
      }
      if (formData.category.trim()) body.category = formData.category.trim()
      if (coords) { body.lat = coords.lat; body.lng = coords.lng }

      await apiRequest('/locals', { method: 'POST', token, body })

      setFormData({ name: '', address: '', phone: '', category: '' })
      setSelectedCoords(null)
      setGeocodeOk(null)
      onSuccess()
      onClose()
    } catch (err) {
      setGeocoding(false)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setError(null)
      setGeocodeOk(null)
      setSelectedCoords(null)
      setSuggestions([])
      setShowSuggestions(false)
      onClose()
    }
  }

  const isBusy = loading || geocoding

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ zIndex: 500 }}
        onClick={handleClose}
      />

      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-[hsl(var(--card))] shadow-2xl border-l border-[hsl(var(--border))] flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ zIndex: 501 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <Building2 className="h-4 w-4 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Nueva Franquicia</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Completa los datos del nuevo local</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-6 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre del local <span className="text-red-500">*</span></Label>
            <Input
              id="name" name="name"
              placeholder="Ej: Franquicia Centro"
              value={formData.name}
              onChange={handleChange}
              disabled={isBusy}
            />
          </div>

          {/* Address with autocomplete dropdown */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">
              Dirección <span className="text-red-500">*</span>
              {geocoding && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-[hsl(var(--primary))]">
                  <Loader2 className="h-3 w-3 animate-spin" /> Ubicando en mapa…
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="address" name="address"
                placeholder="Ej: 5 Norte 147, Viña del Mar"
                value={formData.address}
                onChange={handleAddressChange}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                disabled={isBusy}
                className="pr-8"
                autoComplete="off"
              />
              {loadingSuggestions
                ? <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
                : <MapPin className="absolute right-2.5 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              }

              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s) }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))] last:border-b-0 transition-colors flex items-start gap-2"
                    >
                      <MapPin className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
                      <span className="line-clamp-2 text-[hsl(var(--foreground))]">{s.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {geocodeOk === true && (
              <p className="text-xs text-green-600 font-medium">Ubicación encontrada — aparecerá en el mapa.</p>
            )}
            {geocodeOk === false && (
              <p className="text-xs text-amber-600">No se encontró la ubicación. El local se creará igualmente pero no aparecerá en el mapa.</p>
            )}
            {geocodeOk === null && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Escribe la dirección para ver sugerencias.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Teléfono <span className="text-red-500">*</span></Label>
            <Input
              id="phone" name="phone" type="tel"
              placeholder="Ej: +56912345678"
              value={formData.phone}
              onChange={handleChange}
              disabled={isBusy}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">
              Categoría
              <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">(opcional)</span>
            </Label>
            <Input
              id="category" name="category"
              placeholder="Ej: Zona Norte, Centro, Mall"
              value={formData.category}
              onChange={handleChange}
              disabled={isBusy}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Los locales con la misma categoría se agruparán en la vista.</p>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[hsl(var(--border))]">
          <Button variant="outline" onClick={handleClose} disabled={isBusy}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isBusy}>
            {geocoding ? (
              <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Ubicando…</span>
            ) : loading ? 'Creando…' : 'Crear Franquicia'}
          </Button>
        </div>
      </div>
    </>
  )
}

export default CreateLocalDrawer
