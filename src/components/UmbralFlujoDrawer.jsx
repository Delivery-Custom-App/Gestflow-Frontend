import { useState } from 'react'
import { Gauge, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorDeUmbral, textoDelPeriodo } from '../lib/umbralFlujo'

const enteroDe = (v) => (String(v).trim() === '' ? NaN : Number(v))

/**
 * Umbral de flujo: qué se cuenta, en qué período y qué significa cada color
 * (y la flecha), y el formulario para cambiarlo. Uno solo para todos los
 * locales; se guarda en este navegador hasta que exista en el backend (B-07).
 */
export default function UmbralFlujoDrawer({ umbral, onGuardar, onClose }) {
  const [horas, setHoras] = useState(String(umbral.horas))
  const [medium, setMedium] = useState(String(umbral.medium))
  const [high, setHigh] = useState(String(umbral.high))
  const [error, setError] = useState(null)

  const guardar = (e) => {
    e.preventDefault()
    const nuevo = { horas: enteroDe(horas), medium: enteroDe(medium), high: enteroDe(high) }
    const problema = errorDeUmbral(nuevo)
    if (problema) { setError(problema); return }
    onGuardar(nuevo)
  }

  const periodo = textoDelPeriodo(Number(umbral.horas))

  return (
    <div className="fixed inset-0 z-50">
      <div role="presentation" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="umbral-titulo"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <Gauge size={18} className="text-[hsl(var(--primary))]" />
            </span>
            <h2 id="umbral-titulo" className="text-base font-bold text-[hsl(var(--foreground))]">Umbral de flujo</h2>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {/* Qué significa, en pocas líneas. */}
          <section aria-label="Cómo se lee" className="flex flex-col gap-2 rounded-xl bg-[hsl(var(--muted)/0.4)] p-4 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
            <p>
              Se cuentan las <strong className="text-[hsl(var(--foreground))]">ventas</strong> (órdenes no canceladas)
              de cada franquicia en <strong className="text-[hsl(var(--foreground))]">{periodo}</strong>. El mismo
              umbral vale para todas las franquicias.
            </p>
            <ul className="flex flex-col gap-1">
              <li><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />Verde, flujo bajo: menos de {umbral.medium} ventas.</li>
              <li><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-yellow-500" />Amarillo, flujo medio: desde {umbral.medium} ventas.</li>
              <li><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />Rojo, flujo alto: desde {umbral.high} ventas.</li>
            </ul>
            <p>
              La <strong className="text-[hsl(var(--foreground))]">flecha</strong> compara la última hora con la anterior:
              ↑ si con eso la franquicia subió de color, ↓ si bajó. Sin cambio de color no hay flecha.
            </p>
            <p>Se actualiza solo cada minuto, sin recargar la página.</p>
          </section>

          <form id="umbral-form" onSubmit={guardar} className="flex flex-col gap-4">
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="umbral-horas" className="text-xs">Período (horas)</Label>
              <Input id="umbral-horas" type="number" min="1" max="168" step="1" value={horas}
                onChange={(e) => { setError(null); setHoras(e.target.value) }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="umbral-medio" className="text-xs">Flujo medio desde</Label>
                <Input id="umbral-medio" type="number" min="1" step="1" value={medium}
                  onChange={(e) => { setError(null); setMedium(e.target.value) }} />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">ventas → amarillo</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="umbral-alto" className="text-xs">Flujo alto desde</Label>
                <Input id="umbral-alto" type="number" min="1" step="1" value={high}
                  onChange={(e) => { setError(null); setHigh(e.target.value) }} />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">ventas → rojo</p>
              </div>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Se guarda en este navegador: otro equipo u otra persona no lo ve todavía.
            </p>
          </form>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[hsl(var(--border))] px-6 py-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="umbral-form">Guardar</Button>
        </div>
      </div>
    </div>
  )
}
