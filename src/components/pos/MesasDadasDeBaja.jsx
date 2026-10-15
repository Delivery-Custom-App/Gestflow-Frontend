import { useCallback, useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listMesas, reactivarMesa } from '../../lib/salesApi'

/**
 * Mesas dadas de baja del local (A-05): `GET /mesas?include_inactive=true`
 * filtradas a las inactivas, con «Reactivar» (`PATCH is_active: true`). Solo
 * para el administrador y el dueño.
 */
export default function MesasDadasDeBaja({ localId, onReactivada }) {
  const [mesas, setMesas] = useState(null) // null = cargando
  const [error, setError] = useState('')
  const [ocupada, setOcupada] = useState('')

  const cargar = useCallback(() => {
    listMesas(localId, { incluirInactivas: true })
      .then((filas) => { setMesas(filas.filter((m) => m.is_active === false)); setError('') })
      .catch((e) => { setMesas([]); setError(String(e?.detail || e?.message || 'No se pudieron cargar').replace(/^\d{3}:\s*/, '')) })
  }, [localId])

  useEffect(() => { cargar() }, [cargar])

  const reactivar = async (mesa) => {
    setOcupada(String(mesa.id))
    setError('')
    try {
      await reactivarMesa(mesa.id)
      cargar()
      onReactivada?.(mesa)
    } catch (e) {
      setError(String(e?.detail || e?.message || 'No se pudo reactivar').replace(/^\d{3}:\s*/, ''))
    } finally {
      setOcupada('')
    }
  }

  return (
    <section aria-label="Mesas dadas de baja" className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <h2 className="mb-2 text-sm font-semibold text-[hsl(var(--foreground))]">Mesas dadas de baja</h2>
      {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
      {mesas === null ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Cargando…</p>
      ) : mesas.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No hay mesas dadas de baja.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {mesas.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
              <span>{m.name}{m.zona ? <span className="text-xs text-[hsl(var(--muted-foreground))]"> · {m.zona}</span> : null}</span>
              <Button size="sm" variant="outline" disabled={ocupada === String(m.id)} onClick={() => reactivar(m)}
                aria-label={`Reactivar ${m.name}`}>
                <RotateCcw size={13} /> Reactivar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
