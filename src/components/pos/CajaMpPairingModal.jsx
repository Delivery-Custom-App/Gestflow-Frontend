import { useEffect, useState } from 'react'
import {
  provisionCajaMp,
  verifyCajaMpPairing,
  putLocalMpLocation,
  getAvailableMpPos,
  assignExistingMpPos,
} from '../../lib/administrativeApi'

// step machine: 'choose_method' | 'loading_available' | 'choose_existing' | 'provisioning'
//             | 'needs_location' | 'awaiting_pairing' | 'verifying' | 'paired' | 'error'
export default function CajaMpPairingModal({ caja, localId, onClose, onUpdated }) {
  const [step, setStep]           = useState('choose_method')
  const [error, setError]         = useState(null)
  const [info, setInfo]           = useState(null)
  const [terminalId, setTerminalId] = useState(caja?.mp?.terminal_id || null)
  const [savingLocation, setSavingLocation] = useState(false)
  const [location, setLocation]   = useState({ street_name: '', city_name: '', state_name: '', latitude: '', longitude: '' })
  const [availablePos, setAvailablePos] = useState([])
  const [assigning, setAssigning] = useState(false)

  const handleProvision = async () => {
    setStep('provisioning')
    setError(null)
    try {
      await provisionCajaMp(caja.id)
      onUpdated()
      setStep('awaiting_pairing')
    } catch (e) {
      const msg = e?.message || 'Error al provisionar en MercadoPago'
      if (msg.toLowerCase().includes('direccion')) {
        setError(null)
        setStep('needs_location')
      } else {
        setError(msg)
        setStep('error')
      }
    }
  }

  const handleShowExisting = async () => {
    setStep('loading_available')
    setError(null)
    try {
      const list = await getAvailableMpPos(localId)
      setAvailablePos(list || [])
      setStep('choose_existing')
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los POS disponibles')
      setStep('error')
    }
  }

  const handleSelectExisting = async (posRow) => {
    setAssigning(true)
    setError(null)
    try {
      const res = await assignExistingMpPos(caja.id, posRow.id)
      onUpdated()
      if (res.pairing_status === 'paired') {
        setTerminalId(res.terminal_id)
        setStep('paired')
      } else {
        setStep('awaiting_pairing')
      }
    } catch (e) {
      setError(e?.message || 'No se pudo asignar ese POS')
      setAssigning(false)
    }
  }

  useEffect(() => {
    if (caja?.mp?.pairing_status === 'paired') {
      setTerminalId(caja.mp.terminal_id)
      setStep('paired')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveLocation = async (e) => {
    e.preventDefault()
    setSavingLocation(true)
    setError(null)
    try {
      await putLocalMpLocation(localId, {
        street_name: location.street_name.trim(),
        city_name: location.city_name.trim(),
        state_name: location.state_name.trim(),
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
      })
      setSavingLocation(false)
      await handleProvision()
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la dirección')
      setSavingLocation(false)
    }
  }

  const handleVerify = async () => {
    setStep('verifying')
    setError(null)
    setInfo(null)
    try {
      const res = await verifyCajaMpPairing(caja.id)
      if (res.pairing_status === 'paired') {
        setTerminalId(res.terminal_id)
        setStep('paired')
        onUpdated()
      } else {
        setStep('awaiting_pairing')
        setInfo('Todavía no detectamos la terminal. Verifica que hayas elegido esta Caja en la terminal y volvé a intentar.')
      }
    } catch (e) {
      setError(e?.message || 'Error al verificar el emparejamiento')
      setStep('awaiting_pairing')
    }
  }

  const inputCls = 'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.4)] transition-colors'
  const labelCls = 'text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl w-full max-w-sm mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
          <div>
            <h2 className="font-semibold text-[hsl(var(--foreground))] text-sm">Vincular MercadoPago</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Caja: <span className="font-bold text-[hsl(var(--foreground))]">{caja?.name}</span></p>
          </div>
          <button
            onClick={onClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-xl leading-none disabled:opacity-30"
            disabled={step === 'provisioning' || step === 'verifying' || assigning}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">

          {step === 'choose_method' && (
            <div className="space-y-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                ¿Cómo querés vincular esta caja a MercadoPago?
              </p>
              <button
                onClick={handleShowExisting}
                className="w-full py-2.5 rounded-xl border-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))] text-sm font-semibold hover:bg-[hsl(var(--accent))] transition-colors"
              >
                Usar un POS que ya existe en mi cuenta MercadoPago
              </button>
              <button
                onClick={handleProvision}
                className="w-full py-2.5 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Crear una Caja nueva en MercadoPago
              </button>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          )}

          {step === 'loading_available' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Buscando POS ya registrados...</p>
            </div>
          )}

          {step === 'choose_existing' && (
            <div className="space-y-3">
              {availablePos.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  No encontramos POS sin asignar en tu cuenta. Conectá la cuenta MercadoPago del local
                  o creá una Caja nueva.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availablePos.map((p) => (
                    <button
                      key={p.id}
                      disabled={assigning}
                      onClick={() => handleSelectExisting(p)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-50"
                    >
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{p.name || p.pos_id || p.mp_pos_id}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {p.terminal_id ? `Terminal: ${p.terminal_id}` : 'Sin terminal emparejada aún'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={() => setStep('choose_method')}
                disabled={assigning}
                className="w-full py-2 rounded-lg border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
              >
                Volver
              </button>
            </div>
          )}

          {step === 'provisioning' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Creando Sucursal/Caja en MercadoPago...</p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-3">
              <p className="text-xs text-red-600">{error}</p>
              <button onClick={() => setStep('choose_method')} className="w-full py-2.5 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold hover:opacity-90 transition-opacity">
                Reintentar
              </button>
            </div>
          )}

          {step === 'needs_location' && (
            <form onSubmit={handleSaveLocation} className="space-y-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                MercadoPago necesita la dirección exacta de esta sucursal antes de crear la Caja. Completala una sola vez por local.
              </p>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Calle</label>
                <input required className={inputCls} value={location.street_name} onChange={e => setLocation(l => ({ ...l, street_name: e.target.value }))} placeholder="Ej: Veinte Norte" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Comuna</label>
                  <input required className={inputCls} value={location.city_name} onChange={e => setLocation(l => ({ ...l, city_name: e.target.value }))} placeholder="Ej: Viña Del Mar" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Región</label>
                  <input required className={inputCls} value={location.state_name} onChange={e => setLocation(l => ({ ...l, state_name: e.target.value }))} placeholder="Ej: Valparaíso" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Latitud</label>
                  <input required type="number" step="any" className={inputCls} value={location.latitude} onChange={e => setLocation(l => ({ ...l, latitude: e.target.value }))} placeholder="-33.0125" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Longitud</label>
                  <input required type="number" step="any" className={inputCls} value={location.longitude} onChange={e => setLocation(l => ({ ...l, longitude: e.target.value }))} placeholder="-71.5422" />
                </div>
              </div>
              <button type="submit" disabled={savingLocation} className="w-full py-2.5 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {savingLocation ? 'Guardando...' : 'Guardar y continuar'}
              </button>
            </form>
          )}

          {step === 'awaiting_pairing' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">Emparejá la terminal física</p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Enciende la terminal Point Smart.</li>
                  <li>Desde tu celular, abrí la app de Mercado Pago con la cuenta conectada.</li>
                  <li>Escaneá el código QR que muestra la terminal.</li>
                  <li>En la terminal, seleccioná la Caja: <span className="font-bold">{caja?.name}</span>.</li>
                </ol>
              </div>
              {info && <p className="text-xs text-[hsl(var(--muted-foreground))]">{info}</p>}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={handleVerify}
                disabled={step === 'verifying'}
                className="w-full py-2.5 rounded-xl bg-[#009ee3] hover:bg-[#0082c0] text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                Ya la vinculé, verificar
              </button>
            </div>
          )}

          {step === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Consultando MercadoPago...</p>
            </div>
          )}

          {step === 'paired' && (
            <div className="space-y-3 text-center py-2">
              <p className="text-3xl">✅</p>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Caja vinculada</p>
              {terminalId && <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono break-all">Terminal: {terminalId}</p>}
              <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
