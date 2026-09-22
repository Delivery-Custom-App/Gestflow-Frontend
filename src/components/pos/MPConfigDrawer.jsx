import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  CreditCard, Trash2, RefreshCw, X,
  ChevronDown, ChevronUp, Wifi,
  CheckCircle2, Link2, Settings2,
} from 'lucide-react'
import { apiRequest, setPointDeviceMode } from '../../lib/apiClient'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import { toast } from 'sonner'

const EMPTY_MANUAL = { mp_pos_id: '', name: '' }
const MP_POS_WEBHOOKS = isV2FeatureEnabled('mpPosWebhooks')
const FEATURE_SOON_MSG = 'Todavía no está disponible. Probá de nuevo más tarde.'

function pointMachineId(value) {
  const raw = String(value || '').trim()
  if (!raw) return '—'
  const parts = raw.split('__').filter(Boolean)
  return parts[parts.length - 1] || raw
}

function displayMachineId(device) {
  return device?.machine_id || pointMachineId(device?.id || device?.mp_pos_id)
}

export default function MPConfigDrawer({ localId, onClose, open = true }) {
  // ── Credentials ──────────────────────────────────────────────────────────
  const [mpStatus, setMpStatus]           = useState(undefined) // undefined = cargando
  const [tokenInput, setTokenInput]       = useState('')
  const [savingCred, setSavingCred]       = useState(false)

  // ── OAuth ─────────────────────────────────────────────────────────────────
  const [oauthConnecting, setOauthConnecting] = useState(false)
  const oauthPopupRef = useRef(null)
  const oauthCleanupRef = useRef(null)

  // ── Devices ───────────────────────────────────────────────────────────────
  const [registered, setRegistered]   = useState([])
  const [discovered, setDiscovered]   = useState(null)
  const [discovering, setDiscovering] = useState(false)
  const [linking, setLinking]         = useState(null)

  // ── Manual device (avanzado) ────────────────────────────────────────────
  const [showManual, setShowManual]   = useState(false)
  const [manualForm, setManualForm]   = useState(EMPTY_MANUAL)
  const [saving, setSaving]           = useState(false)
  const [togglingMode, setTogglingMode] = useState(null)

  const loading = mpStatus === undefined

  /** `isStale` permite descartar la respuesta si el efecto que la pidió ya se limpió. */
  const fetchAll = useCallback(async (isStale = () => false) => {
    try {
      const status = await apiRequest(`/locals/${localId}/mp-settings`)
      if (isStale()) return
      setMpStatus(status)

      if (MP_POS_WEBHOOKS) {
        const posData = await apiRequest(`/webhooks/mercadopago-pos?local_id=${localId}`).catch(() => [])
        if (isStale()) return
        setRegistered(posData || [])
      } else {
        setRegistered([])
      }
    } catch (err) {
      if (isStale()) return
      setMpStatus(null)
      toast.error('No se pudo cargar la configuración: ' + err.message)
    }
  }, [localId])

  const cancelOAuthListeners = useCallback(() => {
    if (oauthCleanupRef.current) {
      oauthCleanupRef.current()
      oauthCleanupRef.current = null
    }
  }, [])

  useEffect(() => {
    let stale = false
    if (open) fetchAll(() => stale)
    return () => {
      stale = true
      cancelOAuthListeners()
    }
  }, [open, fetchAll, cancelOAuthListeners])

  // ── OAuth handlers ────────────────────────────────────────────────────────

  async function handleOAuthConnect() {
    if (!localId || oauthConnecting) return
    if (mpStatus?.oauth_available !== true) {
      setShowManual(true)
      return
    }
    cancelOAuthListeners()

    let authorizationUrl = ''
    try {
      const { authorization_url } = await apiRequest('/mp-oauth/exchange', {
        method: 'POST',
        body: { local_id: localId },
      })
      authorizationUrl = authorization_url
    } catch (err) {
      if (err.status === 401) {
        toast.error('Tu sesión expiró. Volvé a iniciar sesión para conectar MercadoPago.')
      } else {
        toast.error('No se pudo iniciar la conexión con MercadoPago: ' + err.message)
      }
      return
    }
    const popup = window.open(authorizationUrl, 'mp_oauth', 'width=660,height=730,left=200,top=80,toolbar=no,menubar=no,scrollbars=yes')

    if (!popup) {
      toast.error('No se pudo abrir la ventana. Permití ventanas emergentes para este sitio.')
      return
    }

    oauthPopupRef.current = popup
    setOauthConnecting(true)

    function onMessage(e) {
      if (!e.data || typeof e.data !== 'object') return
      if (e.data.type === 'mp_oauth_success') {
        finish(true)
      } else if (e.data.type === 'mp_oauth_error') {
        finish(false)
      }
    }

    function finish(success) {
      window.removeEventListener('message', onMessage)
      clearInterval(pollInterval)
      setOauthConnecting(false)
      oauthCleanupRef.current = null
      if (success) {
        toast.success('¡Cuenta MercadoPago conectada!')
        fetchAll()
      } else {
        toast.error('No se pudo conectar la cuenta. Intentá de nuevo.')
      }
    }

    // Poll for popup closure in case user closes without completing
    const pollInterval = setInterval(() => {
      if (popup.closed) {
        window.removeEventListener('message', onMessage)
        clearInterval(pollInterval)
        setOauthConnecting(false)
        oauthCleanupRef.current = null
      }
    }, 800)

    window.addEventListener('message', onMessage)

    oauthCleanupRef.current = () => {
      window.removeEventListener('message', onMessage)
      clearInterval(pollInterval)
    }
  }

  // ── Manual token handlers ─────────────────────────────────────────────────
  async function handleSaveToken(e) {
    e.preventDefault()
    if (!tokenInput.trim()) { toast.error('Ingresá el token'); return }
    setSavingCred(true)
    try {
      await apiRequest(`/locals/${localId}/mp-settings`, {
        method: 'PUT',
        body: { access_token: tokenInput.trim() },
      })
      toast.success('Cuenta conectada')
      setTokenInput('')
      setShowManual(false)
      const updated = await apiRequest(`/locals/${localId}/mp-settings`)
      setMpStatus(updated)
    } catch (err) {
      toast.error('No se pudo guardar: ' + err.message)
    } finally {
      setSavingCred(false)
    }
  }

  async function handleRemoveToken() {
    if (!confirm('¿Desconectar la cuenta de MercadoPago de este local?')) return
    try {
      await apiRequest(`/locals/${localId}/mp-settings`, { method: 'DELETE' })
      toast.success('Cuenta desconectada')
      setMpStatus({ configured: false, preview: null })
      setDiscovered(null)
    } catch (err) {
      toast.error('No se pudo desconectar: ' + err.message)
    }
  }

  // ── Discover handler ──────────────────────────────────────────────────────
  async function handleDiscover() {
    if (!MP_POS_WEBHOOKS) {
      toast.info(FEATURE_SOON_MSG)
      return
    }
    setDiscovering(true)
    try {
      const data = await apiRequest(`/webhooks/mercadopago-pos/discover?local_id=${localId}`)
      const devices = data?.devices || []
      const registeredIds = new Set(registered.map(r => r.mp_pos_id))
      setDiscovered(devices.filter(d => !registeredIds.has(d.id)))

      if (data?.demo) {
        toast.info('Conectá tu cuenta MercadoPago primero.')
      } else if (devices.length === 0) {
        toast.info('No encontramos lectores nuevos.')
      } else {
        toast.success(`${devices.length} lector(es) encontrado(s)`)
      }
    } catch (err) {
      toast.error('No se pudo buscar lectores: ' + err.message)
    } finally {
      setDiscovering(false)
    }
  }

  // ── Link / unlink handlers ────────────────────────────────────────────────
  async function handleLink(device) {
    if (!MP_POS_WEBHOOKS) {
      toast.info(FEATURE_SOON_MSG)
      return
    }
    const terminalName = device.name || `Lector ${displayMachineId(device)}`
    setLinking(device.id)
    try {
      await apiRequest('/webhooks/mercadopago-pos', {
        method: 'POST',
        body: {
          mp_pos_id: device.id,
          local_id: localId,
          name: terminalName,
          pos_id: device.pos_id ? String(device.pos_id) : null,
          terminal_id: device.terminal_id || device.id,
          operating_mode: device.operating_mode || null,
        },
      })
      toast.success(`Lector agregado: ${terminalName}`)
      setDiscovered(prev => prev?.filter(d => d.id !== device.id) ?? [])
      await fetchAll()
    } catch (err) {
      toast.error('No se pudo agregar el lector: ' + err.message)
    } finally {
      setLinking(null)
    }
  }

  async function handleDelete(pos) {
    if (!MP_POS_WEBHOOKS) {
      toast.info(FEATURE_SOON_MSG)
      return
    }
    if (!confirm(`¿Quitar el lector "${pos.name || 'sin nombre'}"?`)) return
    try {
      await apiRequest(`/webhooks/mercadopago-pos/${pos.id}`, { method: 'DELETE' })
      toast.success('Lector quitado')
      await fetchAll()
    } catch (err) {
      toast.error('No se pudo quitar: ' + err.message)
    }
  }

  async function handleToggleMode(pos) {
    const nextMode = pos.operating_mode === 'PDV' ? 'STANDALONE' : 'PDV'
    setTogglingMode(pos.id)
    try {
      await setPointDeviceMode(pos.mp_pos_id, nextMode)
      toast.success(nextMode === 'PDV' ? 'Cobro automático activado' : 'Cobro manual activado')
      await fetchAll()
    } catch (err) {
      toast.error('No se pudo cambiar: ' + err.message)
    } finally {
      setTogglingMode(null)
    }
  }

  async function handleManualAdd(e) {
    e.preventDefault()
    if (!MP_POS_WEBHOOKS) {
      toast.info(FEATURE_SOON_MSG)
      return
    }
    if (!manualForm.mp_pos_id.trim()) { toast.error('Falta el ID del lector'); return }
    setSaving(true)
    try {
      await apiRequest('/webhooks/mercadopago-pos', {
        method: 'POST',
        body: { mp_pos_id: manualForm.mp_pos_id.trim(), local_id: localId, name: manualForm.name.trim() || null },
      })
      toast.success('Lector agregado')
      setManualForm(EMPTY_MANUAL)
      setShowManual(false)
      await fetchAll()
    } catch (err) {
      toast.error('No se pudo agregar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const connected = mpStatus?.configured === true

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ zIndex: 500 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-[hsl(var(--card))] shadow-2xl border-l border-[hsl(var(--border))] flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ zIndex: 501 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
              <CreditCard className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Cobro con tarjeta</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">MercadoPago Point</p>
            </div>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] transition-colors">
            <X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── 1. CUENTA ── */}
          <section className="space-y-3">
            {loading ? (
              <div className="h-16 rounded-lg bg-[hsl(var(--muted)/0.4)] animate-pulse" />
            ) : connected ? (
              /* ── Cuenta conectada ── */
              <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Cuenta conectada</p>
                </div>
                <button
                  onClick={handleRemoveToken}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Desconectar
                </button>
              </div>
            ) : (
              /* ── Sin cuenta ── */
              <div className="space-y-3">
                <div className="text-center py-2">
                  <p className="text-sm text-[hsl(var(--foreground))] font-medium">Conectá tu cuenta de MercadoPago</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    Necesario para usar lectores de tarjeta físicos en este local.
                  </p>
                </div>

                {/* OAuth — primary action */}
                <button
                  onClick={handleOAuthConnect}
                  disabled={oauthConnecting || mpStatus?.oauth_available !== true}
                  className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl font-semibold text-sm text-white bg-[#009ee3] hover:bg-[#0082c0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {oauthConnecting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Esperando autorización...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      Conectar con MercadoPago
                    </>
                  )}
                </button>

                {mpStatus?.oauth_available !== true && (
                  <p className="text-xs text-center text-[hsl(var(--muted-foreground))]">
                    La conexión rápida no está disponible ahora. Usá la opción avanzada más abajo.
                  </p>
                )}
              </div>
            )}
          </section>

          {connected && (
            <>
              <div className="border-t border-[hsl(var(--border))]" />

              {/* ── 2. LECTORES ── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Lectores de tarjeta</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDiscover}
                    disabled={discovering}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${discovering ? 'animate-spin' : ''}`} />
                    {discovering ? 'Buscando...' : 'Buscar lectores'}
                  </Button>
                </div>

                {discovered !== null && discovered.length > 0 && (
                  <div className="space-y-2">
                    {discovered.map(device => (
                      <div
                        key={device.id}
                        className="border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 flex items-center gap-3"
                      >
                        <Wifi className="h-4 w-4 text-blue-500 shrink-0" />
                        <p className="flex-1 text-sm font-medium text-[hsl(var(--foreground))]">
                          Lector {displayMachineId(device)}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleLink(device)}
                          disabled={linking === device.id}
                          className="h-8 px-3 text-xs"
                        >
                          {linking === device.id ? 'Agregando...' : 'Agregar'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {loading ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Cargando...</p>
                ) : registered.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-[hsl(var(--border))] py-8 px-4 text-center">
                    <Wifi className="h-6 w-6 text-[hsl(var(--muted-foreground))] mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Todavía no agregaste ningún lector.<br />Tocá "Buscar lectores" para encontrarlo.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {registered.map(pos => (
                      <li
                        key={pos.id}
                        className="p-3 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                              {pos.name || `Lector ${displayMachineId(pos)}`}
                            </span>
                            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                              Activo
                            </span>
                          </div>
                          <button
                            onClick={() => handleDelete(pos)}
                            title="Quitar lector"
                            className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-red-500 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="rounded-lg bg-[hsl(var(--muted)/0.35)] p-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                              {pos.operating_mode === 'PDV'
                                ? 'Cobro automático: la app envía el monto al lector.'
                                : 'Cobro manual: escribís el monto en el lector.'}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleMode(pos)}
                            disabled={togglingMode === pos.id}
                            className="w-full h-8 text-xs"
                          >
                            {togglingMode === pos.id
                              ? 'Cambiando...'
                              : pos.operating_mode === 'PDV'
                                ? 'Cambiar a cobro manual'
                                : 'Cambiar a cobro automático'}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          <div className="border-t border-[hsl(var(--border))]" />

          {/* ── OPCIONES AVANZADAS ── */}
          <section>
            <button
              onClick={() => setShowManual(v => !v)}
              className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              {showManual ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <Settings2 className="h-3.5 w-3.5" />
              Opciones avanzadas
            </button>

            {showManual && (
              <div className="mt-3 space-y-4 bg-[hsl(var(--muted)/0.3)] rounded-xl p-4 border border-[hsl(var(--border))]">
                {!connected && (
                  <form onSubmit={handleSaveToken} className="space-y-2">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">Conectar con un token</p>
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={e => setTokenInput(e.target.value)}
                      placeholder="Pegá el token acá"
                      className="w-full h-9 border border-[hsl(var(--border))] rounded-md px-3 text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                      autoComplete="off"
                    />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={savingCred}>
                        {savingCred ? 'Guardando...' : 'Conectar'}
                      </Button>
                    </div>
                  </form>
                )}

                {connected && (
                  <form onSubmit={handleManualAdd} className="space-y-2">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">Agregar lector por ID</p>
                    <input
                      type="text"
                      value={manualForm.mp_pos_id}
                      onChange={e => setManualForm(f => ({ ...f, mp_pos_id: e.target.value }))}
                      placeholder="ID del lector"
                      className="w-full h-9 border border-[hsl(var(--border))] rounded-md px-3 text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                      required
                    />
                    <input
                      type="text"
                      value={manualForm.name}
                      onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Nombre (opcional)"
                      className="w-full h-9 border border-[hsl(var(--border))] rounded-md px-3 text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                    />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={saving}>
                        {saving ? 'Guardando...' : 'Agregar'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 border-t border-[hsl(var(--border))] flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </>
  )
}
