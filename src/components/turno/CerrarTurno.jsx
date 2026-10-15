import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { montoDesdeTexto } from '../../lib/fondoEmergencia'
import { closeCaja, getCajaResumen, listMesas, listOrdenesDelTurno } from '../../lib/salesApi'
import { mensajeCierreTurno, pendientesAlCerrar } from '../../lib/turnos'
import { diferenciaDe, monto, textoDiferencia } from '../../lib/arqueo'
import { totalesDelConteo } from '../../lib/efectivo'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import ConteoEfectivo from './ConteoEfectivo'

export const NOTA_CIERRE_MAX = 300

/**
 * Cierre de un turno con arqueo (T-55, B-18): el administrador cuenta el
 * efectivo del cajón y lo manda con el cierre (`monto_cierre_declarado`). Se
 * compara con el efectivo esperado; si no coincide (falta o sobra) la nota es
 * obligatoria. Si el backend responde 400 «Explícala en nota_cierre», no se
 * pierde lo escrito y se enfoca la nota. Un cierre exacto no pide nota.
 *
 * Con la bandera `desgloseEfectivo`, el conteo por billetes y monedas llena el
 * campo (el backend guarda solo el total).
 */
export default function CerrarTurno({ cajaId, localId = null, onCerrado, onCancelar }) {
  const [esperado, setEsperado] = useState(undefined) // undefined = cargando, null = sin dato
  const [contadoTexto, setContadoTexto] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [conDesglose, setConDesglose] = useState(false)
  const [cantidades, setCantidades] = useState({})
  const notaRef = useRef(null)
  // Enfocar la nota después de que el formulario vuelve a estar habilitado.
  const [enfocarNota, setEnfocarNota] = useState(0)
  useEffect(() => { if (enfocarNota) notaRef.current?.focus() }, [enfocarNota])
  const desgloseDisponible = isV2FeatureEnabled('desgloseEfectivo')
  // T-45: lo que sigue abierto al cerrar (las mesas quedan «no cobradas»).
  const [pendientes, setPendientes] = useState(null)
  const [cerradoConMesas, setCerradoConMesas] = useState(false)

  useEffect(() => {
    let ignore = false
    Promise.all([listOrdenesDelTurno(cajaId), localId ? listMesas(localId).catch(() => []) : []])
      .then(([ordenes, mesas]) => {
        if (ignore) return
        const nombres = new Map((mesas || []).map((m) => [String(m.id), m.name || m.nombre]))
        setPendientes(pendientesAlCerrar(ordenes, (id) => nombres.get(String(id))))
      })
      .catch(() => { if (!ignore) setPendientes(null) })
    return () => { ignore = true }
  }, [cajaId, localId])

  useEffect(() => {
    let ignore = false
    getCajaResumen(cajaId)
      .then((r) => { if (!ignore) setEsperado(monto(r?.efectivo_esperado)) })
      .catch(() => { if (!ignore) setEsperado(null) })
    return () => { ignore = true }
  }, [cajaId])

  const contado = conDesglose ? totalesDelConteo(cantidades).total : montoDesdeTexto(contadoTexto)
  const diferencia = contado === null ? null : diferenciaDe(contado, esperado)
  const pideNota = diferencia !== null && diferencia !== 0

  const cerrar = async (e) => {
    e.preventDefault()
    if (contado === null) { setError('Escribe el efectivo que contaste (0 si el cajón está vacío).'); return }
    if (pideNota && !nota.trim()) {
      setError('Lo contado no coincide con lo esperado: explica la diferencia en la nota.')
      notaRef.current?.focus()
      return
    }
    setCerrando(true)
    setError('')
    try {
      await closeCaja(cajaId, { montoCierreDeclarado: contado, notaCierre: nota })
      // Si quedaron mesas sin cobrar, se ofrece ir a verlas antes de salir.
      if (pendientes?.mesas.length && localId) setCerradoConMesas(true)
      else onCerrado()
    } catch (err) {
      const texto = String(err?.detail || err?.message || '')
      if (/nota_cierre/i.test(texto)) {
        setError(texto.replace(/^\d{3}:\s*/, '').replace(/\.? Explícala en nota_cierre\.?$/, ': explícala en la nota.'))
        setEnfocarNota((n) => n + 1)
      } else {
        setError(mensajeCierreTurno(err))
      }
    } finally {
      setCerrando(false)
    }
  }

  if (cerradoConMesas) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="text-sm text-[hsl(var(--foreground))]">
          Turno cerrado. {pendientes.mesas.length === 1 ? 'Una mesa quedó' : `${pendientes.mesas.length} mesas quedaron`} como «no cobrada» por {formatMoney(pendientes.totalMesas)}.
        </p>
        <div className="flex justify-end gap-2">
          <Link to={`/local/${localId}/administrativo/no-cobradas`} onClick={() => onCerrado()}
            className="inline-flex items-center rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]">
            Ver mesas no cobradas
          </Link>
          <Button type="button" size="sm" onClick={() => onCerrado()}>Listo</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={cerrar} aria-label="Cerrar turno" className="flex flex-col gap-3">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Cuenta el efectivo del cajón. Es el cierre del arqueo del día: el turno no se puede reabrir.
      </p>
      {pendientes?.mesas.length > 0 && (
        <div role="note" aria-label="Mesas que quedarán no cobradas" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Al cerrar, estas mesas abiertas quedarán como «no cobradas» (sin ingreso):</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {pendientes.mesas.map((m) => (
              <li key={m.id} className="flex justify-between gap-3"><span>{m.mesa}</span><span>{formatMoney(m.total)}</span></li>
            ))}
          </ul>
          <p className="mt-1 text-xs">Total sin cobrar: {formatMoney(pendientes.totalMesas)}</p>
        </div>
      )}
      {pendientes?.mostrador.length > 0 && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Hay {pendientes.mostrador.length === 1 ? 'un pedido' : `${pendientes.mostrador.length} pedidos`} de mostrador sin cobrar: si llevan más de 15 minutos sin cambios vencen al cerrar; si son recientes, hay que cobrarlos o esperar.
        </p>
      )}

      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-sm">
        Efectivo esperado: <strong data-testid="efectivo-esperado-cierre">{esperado === undefined ? '…' : esperado === null ? '—' : formatMoney(esperado)}</strong>
      </div>

      {desgloseDisponible && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={conDesglose} onChange={(e) => setConDesglose(e.target.checked)} disabled={cerrando} />
          Contar por billetes y monedas
        </label>
      )}
      {conDesglose ? (
        <ConteoEfectivo cantidades={cantidades} onChange={setCantidades} disabled={cerrando} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="efectivo-contado">Efectivo contado</Label>
          <Input id="efectivo-contado" inputMode="numeric" placeholder="$0" value={contadoTexto}
            onChange={(e) => setContadoTexto(e.target.value)} disabled={cerrando} />
        </div>
      )}

      {diferencia !== null && (
        <p data-testid="diferencia-al-cerrar" className={`text-sm font-semibold ${diferencia < 0 ? 'text-red-600' : diferencia > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
          {textoDiferencia(diferencia)}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nota-cierre">{pideNota ? 'Nota (obligatoria: explica la diferencia)' : 'Nota (opcional)'}</Label>
        <textarea id="nota-cierre" ref={notaRef} rows={2} maxLength={NOTA_CIERRE_MAX} value={nota}
          onChange={(e) => setNota(e.target.value)} disabled={cerrando}
          placeholder={pideNota ? 'Ej: Faltan $300: vuelto mal dado en la mañana' : ''}
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm" />
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancelar} disabled={cerrando}>Cancelar</Button>
        <Button type="submit" variant="danger" size="sm" disabled={cerrando}>
          <Lock size={14} /> {cerrando ? 'Cerrando…' : 'Cerrar turno'}
        </Button>
      </div>
    </form>
  )
}
