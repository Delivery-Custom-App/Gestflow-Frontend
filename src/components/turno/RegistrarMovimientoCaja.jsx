import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { montoDesdeTexto } from '../../lib/fondoEmergencia'
import {
  METODOS_MOVIMIENTO, NOTA_MAXIMA, TIPOS_MOVIMIENTO, mensajeMovimientoCaja, registrarMovimientoCaja, validarMovimientoCaja,
} from '../../lib/movimientosCaja'

const selectCls = 'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))]'

/**
 * Formulario para anotar un retiro, gasto o ingreso de caja en un turno abierto
 * (T-56). No se edita ni se borra después: un error se compensa con otro.
 */
export default function RegistrarMovimientoCaja({ cajaId, onRegistrado, onCancelar }) {
  const [tipo, setTipo] = useState('egreso')
  const [montoTexto, setMontoTexto] = useState('')
  const [note, setNote] = useState('')
  const [metodo, setMetodo] = useState('cash')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const monto = montoDesdeTexto(montoTexto)

  const guardar = async (e) => {
    e.preventDefault()
    const problema = validarMovimientoCaja({ tipo, monto, note })
    if (problema) { setError(problema); return }
    setGuardando(true)
    setError('')
    try {
      await registrarMovimientoCaja(cajaId, { tipo, monto, note, payment_method: metodo })
      onRegistrado({ tipo, monto })
    } catch (err) {
      setError(mensajeMovimientoCaja(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} aria-label="Registrar movimiento" className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mov-tipo">Tipo</Label>
        <select id="mov-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={guardando} className={selectCls}>
          {TIPOS_MOVIMIENTO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mov-monto">Monto</Label>
          <Input id="mov-monto" inputMode="numeric" placeholder="$0" value={montoTexto}
            onChange={(e) => setMontoTexto(e.target.value)} disabled={guardando} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mov-metodo">Método</Label>
          <select id="mov-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)} disabled={guardando} className={selectCls}>
            {METODOS_MOVIMIENTO.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
          </select>
        </div>
      </div>
      {metodo !== 'cash' && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Queda registrado, pero no cambia el efectivo esperado en el cajón: solo el efectivo lo mueve.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mov-nota">{tipo === 'egreso' ? 'Para qué salió la plata' : 'Nota (opcional)'}</Label>
        <Input id="mov-nota" maxLength={NOTA_MAXIMA} placeholder={tipo === 'egreso' ? 'Ej: Compra de hielo' : 'Ej: Cambio traído del banco'}
          value={note} onChange={(e) => setNote(e.target.value)} disabled={guardando} />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Un movimiento no se edita ni se borra: si te equivocas, registra otro que lo compense.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar'}</Button>
      </div>
    </form>
  )
}
