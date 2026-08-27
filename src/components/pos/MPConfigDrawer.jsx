import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  CreditCard, Trash2, RefreshCw, X,
  ChevronDown, ChevronUp, Wifi, Eye, EyeOff,
  CheckCircle2, AlertCircle, ExternalLink, Link2,
} from 'lucide-react'
import { apiRequest, getAuthContext, setPointDeviceMode } from '../../lib/apiClient'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import { toast } from 'sonner'

const API_BASE = import.meta.env.VITE_API_URL || ''
const EMPTY_MANUAL = { mp_pos_id: '', name: '' }
const MP_POS_WEBHOOKS = isV2FeatureEnabled('mpPosWebhooks')

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
  const [mpStatus, setMpStatus]           = useState(null)
  const [tokenInput, setTokenInput]       = useState('')
  const [showToken, setShowToken]         = useState(false)
  const [editingCred, setEditingCred]     = useState(false)
  const [savingCred, setSavingCred]       = useState(false)
  const [showManualToken, setShowManualToken] = useState(false)

  // ── OAuth ─────────────────────────────────────────────────────────────────
  const [oauthConnecting, setOauthConnecting] = useState(false)
  const oauthPopupRef = useRef(null)
  const oauthCleanupRef = useRef(null)

  // ── Devices ───────────────────────────────────────────────────────────────
  const [registered, setRegistered]   = useState([])
  const [discovered, setDiscovered]   = useState(null)
  const [loading, setLoading]         = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [linking, setLinking]         = useState(null)

  // ── Manual device ─────────────────────────────────────────────────────────
  const [showManual, setShowManual]   = useState(false)
  const [manualForm, setManualForm]   = useState(EMPTY_MANUAL)
  const [saving, setSaving]           = useState(false)
  const [togglingMode, setTogglingMode] = useState(null)

  useEffect(() => {
    if (open) fetchAll()
    return () => cancelOAuthListeners()
  }, [localId, open])

  async function fetchAll() {
    setLoading(true)
    try {
      const status = await apiRequest(`/locals/${localId}/mp-settings`)
      setMpStatus(status)

      if (MP_POS_WEBHOOKS) {
        const posData = await apiRequest(`/webhooks/mercadopago-pos?local_id=${localId}`).catch(() => [])
        setRegistered(posData || [])
      } else {
        setRegistered([])
      }
    } catch (err) {
      setMpStatus(null)
      toast.error('Error al cargar configuración: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── OAuth handlers ────────────────────────────────────────────────────────
  function cancelOAuthListeners() {
    if (oauthCleanupRef.current) {
      oauthCleanupRef.current()
      oauthCleanupRef.current = null
    }
  }

  async function handleOAuthConnect() {
    if (!localId || oauthConnecting) return
    if (mpStatus?.oauth_available !== true) {
      setShowManualToken(true)
      toast.info('La conexión automática aún no está configurada en el servidor.')
      return
    }
    cancelOAuthListeners()

    let token = ''
    try {
      token = (await getAuthContext()).token
    } catch {
      toast.error('Tu sesión expiró. Vuelve a iniciar sesión para conectar MercadoPago.')
      return
    }
    const url = `${API_BASE}/api/mp-oauth/start?local_id=${encodeURIComponent(localId)}&auth_token=${encodeURIComponent(token)}`
    const popup = window.open(url, 'mp_oauth', 'width=660,height=730,left=200,top=80,toolbar=no,menubar=no,scrollbars=yes')

    if (!popup) {
      toast.error('No se pudo abrir el popup. Permite ventanas emergentes para este sitio.')
      return
    }

    oauthPopupRef.current = popup
    setOauthConnecting(true)

    function onMessage(e) {
      if (!e.data || typeof e.data !== 'object') return
      if (e.data.type === 'mp_oauth_success') {
        finish(true)
      } else if (e.data.type === 'mp_oauth_error') {
        const detail = e.data.detail || 'Error desconocido'
        const tip = typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? ' Si el popup de MP dice “Tenemos un problema”, agregá http://localhost:8002/api/mp-oauth/callback como Redirect URI en el panel de desarrolladores.'
          : ''
        finish(false, detail + tip)
      }
    }

    function finish(success, errorDetail) {
      window.removeEventListener('message', onMessage)
      clearInterval(pollInterval)
      setOauthConnecting(false)
      oauthCleanupRef.current = null
      if (success) {
        toast.success('¡Cuenta MercadoPago conectada!')
        fetchAll()
      } else {
        toast.error('Error al conectar: ' + errorDetail)
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
    if (!tokenInput.trim()) { toast.error('Ingresa el Access Token'); return }
    setSavingCred(true)
    try {
      await apiRequest(`/locals/${localId}/mp-settings`, {
        method: 'PUT',
        body: { access_token: tokenInput.trim() },
      })
      toast.success('Credenciales guardadas')
      setTokenInput('')
      setEditingCred(false)
      setShowManualToken(false)
      const updated = await apiRequest(`/locals/${localId}/mp-settings`)
      setMpStatus(updated)
    } catch (err) {
      toast.error('Error al guardar: ' + err.message)
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
      toast.error('Error al desconectar: ' + err.message)
    }
  }

  // ── Discover handler ──────────────────────────────────────────────────────
  async function handleDiscover() {
    if (!MP_POS_WEBHOOKS) {
      toast.info('Importar dispositivos Point aún no está disponible en Backend V2. Podés registrar el ID manualmente.')
      return
    }
    setDiscovering(true)
    try {
      const data = await apiRequest(`/webhooks/mercadopago-pos/discover?local_id=${localId}`)
      const devices = data?.devices || []
      const registeredIds = new Set(registered.map(r => r.mp_pos_id))
      setDiscovered(devices.filter(d => !registeredIds.has(d.id)))

      if (data?.demo) {
        toast.info('Conecta tu cuenta MercadoPago primero para importar dispositivos.')
      } else if (devices.length === 0) {
        toast.info('No se encontraron dispositivos Point en esta cuenta.')
      } else {
        toast.success(`${devices.length} dispositivo(s) encontrado(s)`)
      }
    } catch (err) {
      toast.error('Error al importar dispositivos: ' + err.message)
    } finally {
      setDiscovering(false)
    }
  }

  // ── Link / unlink handlers ────────────────────────────────────────────────
  async function handleLink(device) {
    if (!MP_POS_WEBHOOKS) {
      toast.info('Vincular Point aún no está disponible en Backend V2.')
      return
    }
    const terminalName = device.name || `POS ${displayMachineId(device)}`
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
      toast.success(`POS vinculado: ${terminalName}`)
      setDiscovered(prev => prev?.filter(d => d.id !== device.id) ?? [])
      await fetchAll()
    } catch (err) {
      toast.error('Error al vincular: ' + err.message)
    } finally {
      setLinking(null)
    }
  }

  async function handleDelete(pos) {
    if (!MP_POS_WEBHOOKS) {
      toast.info('Desvincular Point aún no está disponible en Backend V2.')
      return
    }
    if (!confirm(`¿Desvincular el POS "${pos.name || pos.mp_pos_id}"?`)) return
    try {
      await apiRequest(`/webhooks/mercadopago-pos/${pos.id}`, { method: 'DELETE' })
      toast.success('POS desvinculado')
      await fetchAll()
    } catch (err) {
      toast.error('Error al desvincular: ' + err.message)
    }
  }

  async function handleToggleMode(pos) {
    const nextMode = pos.operating_mode === 'PDV' ? 'STANDALONE' : 'PDV'
    setTogglingMode(pos.id)
    try {
      await setPointDeviceMode(pos.mp_pos_id, nextMode)
      toast.success(nextMode === 'PDV' ? 'Modo PDV activado' : 'Modo STANDALONE activado')
      await fetchAll()
    } catch (err) {
      toast.error('Error al cambiar el modo: ' + err.message)
    } finally {
      setTogglingMode(null)
    }
  }

  async function handleManualAdd(e) {
    e.preventDefault()
    if (!MP_POS_WEBHOOKS) {
      toast.info('Registro de Point aún no está disponible en Backend V2.')
      return
    }
    if (!manualForm.mp_pos_id.trim()) { toast.error('El ID del dispositivo es obligatorio'); return }
    setSaving(true)
    try {
      await apiRequest('/webhooks/mercadopago-pos', {
        method: 'POST',
        body: { mp_pos_id: manualForm.mp_pos_id.trim(), local_id: localId, name: manualForm.name.trim() || null },
      })
      toast.success('Dispositivo registrado')
      setManualForm(EMPTY_MANUAL)
      setShowManual(false)
      await fetchAll()
    } catch (err) {
      toast.error('Error al registrar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

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
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">MercadoPago Point</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Lectores de tarjeta · configuración del local</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] transition-colors">
            <X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── 1. CUENTA ── */}
          <section className="space-y-3">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Cuenta MercadoPago</p>

            {loading ? (
              <div className="h-16 rounded-lg bg-[hsl(var(--muted)/0.4)] animate-pulse" />
            ) : mpStatus?.configured && !editingCred ? (
              /* ── Cuenta conectada ── */
              <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Conectado</p>
                    <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">{mpStatus.preview}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingCred(true); setShowManualToken(true) }}
                    className="text-xs px-2 py-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 transition-colors"
                  >
                    Cambiar
                  </button>
                  <button
                    onClick={handleRemoveToken}
                    className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-red-500 transition-colors"
                    title="Desconectar cuenta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* ── Sin cuenta / editando ── */
              <div className="space-y-3">
                {!mpStatus?.configured && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      Conecta tu cuenta MercadoPago para habilitar los lectores de tarjeta físicos.
                    </p>
                  </div>
                )}

                {mpStatus && mpStatus.oauth_available !== true && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
                    <p className="font-semibold">Conexión automática pendiente de activación</p>
                    <p className="mt-1">
                      Cuando el servidor tenga OAuth configurado, podrás enlazar MercadoPago con un solo botón,
                      sin copiar tokens manualmente.
                    </p>
                  </div>
                )}

                {mpStatus?.oauth_available === true && typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1.5">
                    <p className="font-semibold">Redirect URI requerida en el panel de MercadoPago</p>
                    <p>
                      Si ves “Tenemos un problema…”, agregá esta URI exacta en tu aplicación MP
                      (Developers → tu app → Redirect URIs), además de la de producción:
                    </p>
                    <code className="block break-all rounded bg-white/80 px-2 py-1.5 font-mono text-[11px] border border-amber-100">
                      {mpStatus.oauth_redirect_uri || 'http://localhost:8002/api/mp-oauth/callback'}
                    </code>
                  </div>
                )}

                {/* OAuth — primary action */}
                <button
                  onClick={handleOAuthConnect}
                  disabled={oauthConnecting}
                  className="w-full flex items-center justify-center gap-2.5 h-10 rounded-lg font-semibold text-sm text-white bg-[#009ee3] hover:bg-[#0082c0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {oauthConnecting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Esperando autorización...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                  {mpStatus?.oauth_available === true ? 'Conectar con MercadoPago' : 'Conexión automática no disponible'}
                    </>
                  )}
                </button>

                {/* Manual token — collapsible fallback */}
                <button
                  onClick={() => setShowManualToken(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mx-auto"
                >
                  {showManualToken ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {mpStatus?.oauth_available === true ? '¿Prefieres ingresar tu token manualmente?' : 'Usar token manual temporalmente'}
                </button>

                {showManualToken && (
                  <form onSubmit={handleSaveToken} className="space-y-3 bg-[hsl(var(--muted)/0.3)] rounded-lg p-3 border border-[hsl(var(--border))]">
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Ingresa el <strong>Access Token de Producción</strong> desde el{' '}
                      <a
                        href="https://www.mercadopago.cl/developers/panel/app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline inline-flex items-center gap-0.5 hover:opacity-80"
                      >
                        panel de desarrolladores <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                    <div className="relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={tokenInput}
                        onChange={e => setTokenInput(e.target.value)}
                        placeholder="APP_USR-..."
                        className="w-full h-9 border border-[hsl(var(--border))] rounded-md pl-3 pr-9 text-sm font-mono bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex gap-2 justify-end">
                      {editingCred && (
                        <Button type="button" variant="outline" size="sm" onClick={() => { setEditingCred(false); setShowManualToken(false) }}>
                          Cancelar
                        </Button>
                      )}
                      <Button type="submit" size="sm" disabled={savingCred}>
                        {savingCred ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </section>

          <div className="border-t border-[hsl(var(--border))]" />

          {/* ── 2. IMPORTAR DISPOSITIVOS ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Importar dispositivos</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDiscover}
                disabled={discovering}
                className="gap-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${discovering ? 'animate-spin' : ''}`} />
                {discovering ? 'Buscando...' : 'Importar desde MP'}
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Trae automáticamente los lectores Point registrados en tu cuenta MercadoPago.
            </p>

            {!MP_POS_WEBHOOKS && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                La importación automática de Point aún no está en Backend V2. Podés conectar la cuenta
                por OAuth y registrar el dispositivo manualmente más abajo.
              </div>
            )}

            {discovered !== null && (
              <div className="space-y-2">
                {discovered.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] italic">
                    No hay dispositivos nuevos por vincular.
                  </p>
                ) : (
                  discovered.map(device => (
                    <div
                      key={device.id}
                      className="border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                            POS {displayMachineId(device)}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono">
                            ID completo: {device.id} · {device.status?.state ?? '—'}
                          </p>
                        </div>
                        <Wifi className="h-4 w-4 text-blue-500 shrink-0" />
                      </div>
                      <div className="flex gap-2">
                        <p className="flex-1 text-xs text-blue-700 bg-white/70 rounded-md px-2 py-1.5 border border-blue-100">
                          Se vinculará como terminal del local, sin asociarla a una mesa.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleLink(device)}
                          disabled={linking === device.id}
                          className="h-8 px-3 text-xs"
                        >
                          {linking === device.id ? 'Vinculando...' : 'Vincular'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          <div className="border-t border-[hsl(var(--border))]" />

          {/* ── 3. DISPOSITIVOS VINCULADOS ── */}
          <section className="space-y-3">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Dispositivos vinculados</p>
            {loading ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Cargando...</p>
            ) : registered.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] italic">
                No hay lectores registrados. Usa "Importar desde MP" para vincularlos.
              </p>
            ) : (
              <ul className="space-y-2">
                {registered.map(pos => (
                  <li
                    key={pos.id}
                    className="p-3 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                            POS {displayMachineId(pos)}
                          </span>
                          <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                            Activo
                          </span>
                        </div>
                        {pos.name && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                            Nombre interno: {pos.name}
                          </p>
                        )}
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 font-mono break-all">
                          ID completo: {pos.mp_pos_id}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(pos)}
                        title="Desvincular"
                        className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-red-500 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="rounded-lg bg-[hsl(var(--muted)/0.35)] p-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Modo de cobro</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          pos.operating_mode === 'PDV'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {pos.operating_mode === 'PDV' ? 'PDV' : 'STANDALONE'}
                        </span>
                      </div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {pos.operating_mode === 'PDV'
                          ? 'Gestflow envía el cobro directamente a la terminal.'
                          : 'Ingresa el monto manualmente en el lector. Gestflow detecta el pago aprobado por monto y ventana de tiempo.'}
                      </p>
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
                            ? 'Volver a STANDALONE'
                            : 'Activar modo PDV'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="border-t border-[hsl(var(--border))]" />

          {/* ── 4. AGREGAR MANUALMENTE ── */}
          <section className="space-y-3">
            <button
              onClick={() => setShowManual(v => !v)}
              className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              {showManual ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Agregar dispositivo manualmente
            </button>

            {showManual && (
              <form onSubmit={handleManualAdd} className="space-y-3 bg-[hsl(var(--muted)/0.3)] rounded-lg p-4 border border-[hsl(var(--border))]">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Usa esto si conoces el ID del dispositivo desde el panel de MercadoPago.
                </p>
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--foreground))] mb-1">ID del dispositivo *</label>
                  <input
                    type="text"
                    value={manualForm.mp_pos_id}
                    onChange={e => setManualForm(f => ({ ...f, mp_pos_id: e.target.value }))}
                    placeholder="Ej: PAX_A920__12345678"
                    className="w-full h-9 border border-[hsl(var(--border))] rounded-md px-3 text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--foreground))] mb-1">Nombre del terminal</label>
                  <input
                    type="text"
                    value={manualForm.name}
                    onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: POS barra"
                    className="w-full h-9 border border-[hsl(var(--border))] rounded-md px-3 text-sm bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? 'Guardando...' : 'Registrar'}
                  </Button>
                </div>
              </form>
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
