import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '../LoadingSpinner'
import { useAuth } from '../../context/AuthContext'
import { listCajas } from '../../lib/salesApi'
import { filtrarTurnos, turnosDe } from '../../lib/registroTurnos'
import TablaTurnos from './TablaTurnos'
import FiltrosTurnos from './FiltrosTurnos'
import DetalleTurno from './DetalleTurno'

function fechaDelTurno(value) {
  const [y, m, d] = String(value || '').split('-')
  return y && m && d ? `${d}/${m}/${y}` : ''
}

/** Panel lateral con el resumen de un turno (solo lectura: el vendedor no cierra turnos). */
function ResumenLateral({ turno, onClose }) {
  const abierto = turno.is_active === true || String(turno.status) === 'open'
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" role="presentation" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="resumen-turno-titulo"
        className="absolute inset-y-0 right-0 w-full max-w-md flex flex-col shadow-2xl overflow-y-auto no-scrollbar bg-[hsl(var(--card))] border-l border-[hsl(var(--border))]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div>
            <h2 id="resumen-turno-titulo" className="text-base font-bold text-[hsl(var(--foreground))]">Resumen del turno</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {fechaDelTurno(turno.business_date)}{abierto ? ' · Abierto' : ' · Cerrado'}
            </p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="p-6">
          <DetalleTurno caja={turno} />
        </div>
      </div>
    </div>
  )
}

/**
 * "Mis turnos" del vendedor: solo los suyos, con fecha, hora de apertura y de
 * cierre y total vendido. Al abrir uno ve su resumen (ventas, ingresos y
 * egresos).
 */
export default function MisTurnos() {
  const { localId } = useParams()
  const { user } = useAuth()
  const [turnos, setTurnos] = useState(null) // null = cargando
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const [fecha, setFecha] = useState('')
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    let ignore = false
    listCajas(localId)
      // El backend ya le entrega solo los suyos; se filtra igual.
      .then((filas) => { if (!ignore) { setTurnos(turnosDe(filas, user?.id)); setError('') } })
      .catch((e) => { if (!ignore) { setTurnos([]); setError(e?.message || 'No se pudieron cargar tus turnos') } })
    return () => { ignore = true }
  }, [localId, user?.id, intento])

  const visibles = filtrarTurnos(turnos, { fecha })

  return (
    <main className="flex-1 overflow-y-auto no-scrollbar px-5 py-6">
      {abierto && <ResumenLateral turno={abierto} onClose={() => setAbierto(null)} />}
      <div className="mb-6">
        <h2 className="text-base font-bold text-[hsl(var(--primary))] tracking-tight">Mis turnos</h2>
        <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">Cuándo abrió y cerró cada uno de tus turnos y cuánto vendiste.</p>
      </div>

      {turnos === null ? (
        <LoadingSpinner message="Cargando tus turnos..." />
      ) : error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { setTurnos(null); setIntento((n) => n + 1) }}>Reintentar</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <FiltrosTurnos fecha={fecha} onFecha={setFecha} />
          <TablaTurnos
            key={fecha}
            turnos={visibles}
            onVer={setAbierto}
            vacio={fecha ? 'No tienes turnos en esa fecha.' : 'Todavía no tienes turnos.'}
          />
        </div>
      )}
    </main>
  )
}
