import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'

// Fits the map to show all markers automatically
function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], 15)
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [40, 40] })
    }
  }, [map, positions])
  return null
}

function FranchisesMap({ locales }) {
  const withCoords = locales.filter((l) => l.lat != null && l.lng != null)

  if (withCoords.length === 0) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
          <MapPin className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
        </div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">Sin ubicaciones registradas</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">
          Las franquicias que crees con una dirección válida aparecerán aquí automáticamente.
        </p>
      </div>
    )
  }

  const positions = withCoords.map((l) => [l.lat, l.lng])
  // Default center — will be overridden by FitBounds
  const defaultCenter = positions[0]

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden shadow-sm" style={{ height: 700, position: 'relative', zIndex: 0 }}>
      <MapContainer
        center={defaultCenter}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={positions} />
        {withCoords.map((local) => (
          <CircleMarker
            key={local.id}
            center={[local.lat, local.lng]}
            radius={12}
            pathOptions={{
              fillColor: '#F2A623',
              color: '#ffffff',
              weight: 2.5,
              fillOpacity: 0.9,
            }}
          >
            <Tooltip permanent={false} direction="top" offset={[0, -14]}>
              <span className="text-xs font-semibold">{local.name}</span>
              {local.address && <><br /><span className="text-xs text-gray-500">{local.address}</span></>}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

export default FranchisesMap
