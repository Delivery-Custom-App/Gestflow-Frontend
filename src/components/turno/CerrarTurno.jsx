import { useEffect, useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { montoDesdeTexto } from '../../lib/fondoEmergencia'
import { closeCaja, getCajaResumen } from '../../lib/salesApi'
import { mensajeCierreTurno } from '../../lib/turnos'
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
export default function CerrarTurno({ cajaId, onCerrado, onCancelar }) {
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
      onCerrado()
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

  return (
    <form onSubmit={cerrar} aria-label="Cerrar turno" className="flex flex-col gap-3">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Cuenta el efectivo del cajón. Es el cierre del arqueo del día: el turno no se puede reabrir.
      </p>
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
