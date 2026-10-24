import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { createCajaV2 } from '../../lib/salesApi'
import { cajasAbiertas, listarCajasFisicasDelLocal, mensajeCajaFisica } from '../../lib/cajaFisica'

const CAMPO = 'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-sm'

/**
 * El dueño o el encargado que vende en un local al paso necesita su propio
 * turno de venta (#133). Abrir la caja física no lo crea: es la apertura con el
 * fondo. Si no tiene turno, se le ofrece iniciarlo sobre una caja abierta, sin
 * plata (`POST /cajas`); si ninguna está abierta, se le dice dónde abrirla.
 */
export default function IniciarMiTurno({ localId, onIniciado }) {
  const [abiertas, setAbiertas] = useState(null)
  const [cajaId, setCajaId] = useState('')
  const [error, setError] = useState('')
  const [iniciando, setIniciando] = useState(false)

  useEffect(() => {
    let ignore = false
    listarCajasFisicasDelLocal(localId)
      .then((filas) => {
        if (ignore) return
        const lista = cajasAbiertas(filas)
        setAbiertas(lista)
        if (lista.length === 1) setCajaId(String(lista[0].id))
      })
      .catch((err) => { if (!ignore) { setAbiertas([]); setError(mensajeCajaFisica(err, 'No se pudieron cargar las cajas')) } })
    return () => { ignore = true }
  }, [localId])

  const iniciar = async () => {
    if (!cajaId) { setError('Elige la caja donde vas a vender.'); return }
    setIniciando(true)
    setError('')
    try {
      await createCajaV2({ caja_fisica_id: cajaId, monto_apertura: 0 })
      onIniciado?.()
    } catch (err) {
      setError(mensajeCajaFisica(err, 'No se pudo iniciar tu turno'))
      setIniciando(false)
    }
  }

  if (abiertas === null) return null

  return (
    <div role="region" aria-label="Tu turno de venta" className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
      {abiertas.length === 0 ? (
        <p>
          Para vender, primero abre una caja del local en{' '}
          <Link to={`/local/${localId}/administrativo/flujo-caja`} className="font-semibold underline">Administración → Caja y turnos</Link>.
        </p>
      ) : (
        <>
          <p>Para vender necesitas tu turno. No lleva plata: el efectivo es de la caja que se abrió con su fondo.</p>
          <div className="flex flex-wrap items-center gap-2">
            {abiertas.length > 1 && (
              <select aria-label="Caja donde vas a vender" value={cajaId} onChange={(e) => setCajaId(e.target.value)} disabled={iniciando} className={CAMPO}>
                <option value="">Elige la caja</option>
                {abiertas.map((c) => <option key={c.id} value={c.id}>{c.name || 'Caja física'}</option>)}
              </select>
            )}
            <Button type="button" size="sm" onClick={iniciar} disabled={iniciando}>
              {iniciando ? 'Iniciando…' : abiertas.length === 1 ? `Iniciar mi turno en ${abiertas[0].name || 'la caja'}` : 'Iniciar mi turno'}
            </Button>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
