import { useCallback, useEffect, useState } from 'react'
import { CreditCard, MoveRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLocals } from '../hooks/useLocals'
import { listarCajasFisicas } from '../lib/administrativeApi'
import { isAlPasoLocal } from '../lib/salesModel'
import {
  agruparPorLocal, listarMaquinasDelNegocio, mensajeMaquinas, moverMaquina, registrarTerminal, textoOcupacion,
} from '../lib/maquinasNegocio'
import { PROVEEDOR_LABEL } from '../lib/maquinasCobro'
import { isV2FeatureEnabled } from '../lib/v2Features'
import MPConfigDrawer from './pos/MPConfigDrawer'

const CAMPO = 'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm'

/** Elegir local (y caja física si es al paso): sirve para mover o registrar. */
function ElegirDestino({ titulo, descripcion, conNombre = false, onConfirmar, onClose }) {
  const { locales } = useLocals()
  const [localId, setLocalId] = useState('')
  const [cajas, setCajas] = useState([])
  const [cajaId, setCajaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const local = locales.find((l) => String(l.id) === String(localId))
  const alPaso = isAlPasoLocal(local)

  useEffect(() => {
    if (!localId || !alPaso) return undefined
    let ignore = false
    listarCajasFisicas(localId).then((f) => { if (!ignore) setCajas(f) }).catch(() => { if (!ignore) setCajas([]) })
    return () => { ignore = true }
  }, [localId, alPaso])

  const confirmar = async (e) => {
    e.preventDefault()
    if (!localId) { setError('Elige el local.'); return }
    if (alPaso && !conNombre && !cajaId) { setError('En un local al paso, elige la caja física.'); return }
    setOcupado(true)
    setError('')
    try {
      await onConfirmar({ localId, cajaFisicaId: alPaso ? cajaId : null, nombre })
    } catch (err) {
      setError(mensajeMaquinas(err))
      setOcupado(false)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !ocupado) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <form onSubmit={confirmar} className="flex flex-col gap-3 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="destino-local">Local</Label>
            <select id="destino-local" value={localId} onChange={(e) => { setLocalId(e.target.value); setCajaId('') }} className={CAMPO} disabled={ocupado}>
              <option value="">Elige un local</option>
              {locales.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {alPaso && !conNombre && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="destino-caja">Caja física</Label>
              <select id="destino-caja" value={cajaId} onChange={(e) => setCajaId(e.target.value)} className={CAMPO} disabled={ocupado}>
                <option value="">Elige la caja física</option>
                {cajas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {conNombre && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="destino-nombre">Nombre de la máquina</Label>
              <input id="destino-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Point barra" className={CAMPO} disabled={ocupado} />
            </div>
          )}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={ocupado}>Cancelar</Button>
            <Button type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Confirmar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Máquinas POS del negocio (T-44, solo el dueño): agrupadas por local con su
 * caja física, proveedor, terminal y ocupación; las terminales que Mercado
 * Pago ve y GestFlow no («Sin registrar»), con «Registrar en un local»; y
 * «Mover a otro local».
 */
export default function MaquinasNegocioPage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [moviendo, setMoviendo] = useState(null)
  const [registrando, setRegistrando] = useState(null)
  const [version, setVersion] = useState(0)
  const { locales } = useLocals()
  const [localMp, setLocalMp] = useState('')
  const [configurandoMp, setConfigurandoMp] = useState(false)
  const localMpEfectivo = localMp || (locales.length === 1 ? String(locales[0].id) : '')

  useEffect(() => {
    let ignore = false
    listarMaquinasDelNegocio()
      .then((r) => { if (!ignore) { setDatos(r); setError('') } })
      .catch((e) => { if (!ignore) { setDatos({ registradas: [], sin_registrar: [] }); setError(mensajeMaquinas(e)) } })
    return () => { ignore = true }
  }, [version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  const grupos = agruparPorLocal(datos?.registradas || [])
  const sinRegistrar = Array.isArray(datos?.sin_registrar) ? datos.sin_registrar : []

  return (
    <main className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-white"><CreditCard size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Máquinas POS</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Los lectores de cobro de todo el negocio, por local.</p>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {aviso && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p>}
      {datos?.aviso && <p role="note" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{datos.aviso}</p>}

      {isV2FeatureEnabled('mpConfig') && datos !== null && (
        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[hsl(var(--foreground))]">Cuenta de Mercado Pago</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {datos.mercadopago_conectado === false
                ? 'Todavía no hay una cuenta conectada. Conéctala desde el local que la usa.'
                : 'Conecta, cambia o desconecta la cuenta de un local.'}
            </p>
          </div>
          {locales.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-local">Local de la cuenta</Label>
              <select id="mp-local" value={localMp} onChange={(e) => setLocalMp(e.target.value)} className={CAMPO}>
                <option value="">Elige un local</option>
                {locales.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          <Button type="button" disabled={!localMpEfectivo} onClick={() => setConfigurandoMp(true)}>
            <CreditCard size={14} /> {datos.mercadopago_conectado === false ? 'Conectar Mercado Pago' : 'Configurar Mercado Pago'}
          </Button>
        </div>
      )}

      {datos === null ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando las máquinas…</p>
      ) : (
        <div className="flex flex-col gap-5">
          {grupos.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">Todavía no hay máquinas registradas.</p>}
          {grupos.map((g) => (
            <section key={g.localId || g.localName} aria-label={`Máquinas de ${g.localName}`} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <h2 className="mb-3 text-sm font-bold text-[hsl(var(--foreground))]">{g.localName}</h2>
              <ul className="flex flex-col gap-2">
                {g.maquinas.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[hsl(var(--foreground))]">{m.display_name}{m.is_active === false ? ' · desactivada' : ''}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {[m.caja_fisica_nombre && `Caja ${m.caja_fisica_nombre}`, PROVEEDOR_LABEL[m.provider] || m.provider, m.terminal_id].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="text-xs">{textoOcupacion(m)}</span>
                    <Button size="sm" variant="outline" onClick={() => { setMoviendo(m); setAviso('') }} aria-label={`Mover ${m.display_name} a otro local`}>
                      <MoveRight size={13} /> Mover a otro local
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section aria-label="Sin registrar" className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4">
            <h2 className="mb-1 text-sm font-bold text-[hsl(var(--foreground))]">Sin registrar</h2>
            <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">Terminales que Mercado Pago ve en tu cuenta y GestFlow todavía no tiene.</p>
            {sinRegistrar.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">No hay terminales sin registrar.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sinRegistrar.map((s) => (
                  <li key={s.terminal_id} className="flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                    <span>{s.name || 'Terminal'} <span className="text-xs text-[hsl(var(--muted-foreground))]">· {s.terminal_id}</span></span>
                    <Button size="sm" variant="outline" onClick={() => { setRegistrando(s); setAviso('') }} aria-label={`Registrar ${s.terminal_id} en un local`}>
                      <Plus size={13} /> Registrar en un local
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {moviendo && (
        <ElegirDestino
          titulo={`Mover ${moviendo.display_name}`}
          descripcion="Queda libre en el local de destino. No se puede mover si un turno de hoy la usa o tiene un cobro pendiente."
          onClose={() => setMoviendo(null)}
          onConfirmar={async ({ localId, cajaFisicaId }) => {
            await moverMaquina(moviendo.id, { localId, cajaFisicaId })
            setAviso(`${moviendo.display_name} se movió de local.`)
            setMoviendo(null)
            recargar()
          }}
        />
      )}
      {registrando && (
        <ElegirDestino
          titulo="Registrar terminal"
          descripcion={`Terminal ${registrando.terminal_id}. En un restaurante queda libre para que los meseros la elijan.`}
          conNombre
          onClose={() => setRegistrando(null)}
          onConfirmar={async ({ localId, nombre }) => {
            await registrarTerminal({ terminalId: registrando.terminal_id, localId, nombre: nombre || registrando.name })
            setAviso('Terminal registrada.')
            setRegistrando(null)
            recargar()
          }}
        />
      )}

      {isV2FeatureEnabled('mpConfig') && localMpEfectivo && (
        <MPConfigDrawer
          open={configurandoMp}
          localId={localMpEfectivo}
          onClose={() => { setConfigurandoMp(false); recargar() }}
        />
      )}
    </main>
  )
}
