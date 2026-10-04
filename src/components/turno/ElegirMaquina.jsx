import { useCallback, useEffect, useRef, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  listarMaquinasDelVendedor, maquinasParaElegir, resumenDeMaquinas, tomarMaquina, webCobraCon,
} from '../../lib/maquinasCobro'

/**
 * Después de abrir el turno, el vendedor elige con qué máquina cobrará con
 * tarjeta. Las que tiene otra persona aparecen "En uso" y no se pueden elegir.
 * Si ya tiene una asignada, viene elegida (soltarla no es posible: B-02). Sin
 * máquinas, el turno sigue igual y solo podrá cobrar sin tarjeta.
 *
 * `saltarSiTiene`: al volver a entrar con el turno ya abierto, si ya tiene su
 * máquina no se le vuelve a preguntar.
 *
 * Detrás de la bandera `eleccionMaquinaVendedor` (depende de B-01 y B-02).
 */
export default function ElegirMaquina({ localId, userId, onListo, saltarSiTiene = false }) {
  const [maquinas, setMaquinas] = useState(null) // null = cargando
  const [falloCarga, setFalloCarga] = useState(false)
  const [elegida, setElegida] = useState('')
  const [error, setError] = useState('')
  const [tomando, setTomando] = useState(false)
  const [intento, setIntento] = useState(0)
  // El padre puede pasar una función nueva en cada render: no debe volver a pedir las máquinas.
  const onListoRef = useRef(onListo)
  useEffect(() => { onListoRef.current = onListo }, [onListo])

  useEffect(() => {
    let ignore = false
    listarMaquinasDelVendedor(localId, userId)
      .then((filas) => {
        if (ignore) return
        const resumen = resumenDeMaquinas(filas)
        if (saltarSiTiene && resumen.tipo === 'una') { onListoRef.current(resumen.maquina); return }
        setMaquinas(filas)
        setFalloCarga(false)
        setElegida(resumen.tipo === 'una' ? String(resumen.maquina.id) : '')
      })
      .catch((e) => {
        if (ignore) return
        // No se afirma que no haya máquinas: solo que no se pudieron consultar.
        setMaquinas([])
        setFalloCarga(true)
        setError(e?.message || 'No se pudieron cargar las máquinas de cobro')
      })
    return () => { ignore = true }
  }, [localId, userId, saltarSiTiene, intento])

  const recargar = useCallback(() => { setMaquinas(null); setError(''); setIntento((n) => n + 1) }, [])

  const resumen = resumenDeMaquinas(maquinas)
  const lista = maquinasParaElegir(maquinas)

  const usar = async () => {
    const maquina = lista.find((m) => String(m.id) === elegida)
    if (!maquina) { setError('Elige una máquina o sigue sin máquina'); return }
    // Ya es suya: no hay nada que pedirle al backend.
    if (maquina.estado === 'mia') { onListo(maquina); return }
    setTomando(true)
    setError('')
    try {
      await tomarMaquina(maquina.id, userId)
      onListo({ ...maquina, estado: 'mia' })
    } catch (e) {
      setTomando(false)
      if (e?.conflicto) {
        // Otra persona la tomó recién: la lista ya no es la misma.
        recargar()
        setError(e.message)
        return
      }
      setError(e?.message || 'No se pudo tomar la máquina')
    }
  }

  if (maquinas === null) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando las máquinas de cobro…</p>
  }

  const avisoError = error && (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">{error}</p>
  )

  if (falloCarga) {
    return (
      <div className="flex flex-col gap-4">
        {avisoError}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={() => onListo(null)}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            Continuar sin elegir
          </button>
          <Button variant="outline" onClick={recargar}>Reintentar</Button>
        </div>
      </div>
    )
  }

  const tieneUna = resumen.tipo === 'una'
  const tieneVarias = resumen.tipo === 'varias'

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        {tieneUna
          ? 'Ya tienes una máquina de cobro a tu nombre: cobrarás con ella durante el turno.'
          : 'Elige con qué máquina cobrarás con tarjeta. Queda contigo hasta que se cierre el turno.'}
      </p>

      {avisoError}

      {tieneVarias && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
          Tienes {resumen.mias.length} máquinas a tu nombre y el cobro con tarjeta necesita una sola. Pídele al encargado que deje solo una.
        </p>
      )}

      {lista.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
          No hay máquinas de cobro disponibles para ti. Tu turno queda abierto igual: solo podrás cobrar sin tarjeta.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Máquinas de cobro">
          {lista.map((m) => {
            // Con una a su nombre, tomar otra le dejaría dos (el cobro fallaría); soltarla no es posible (B-02).
            const bloqueada = m.estado === 'en_uso' || (resumen.mias.length > 0 && m.estado !== 'mia')
            return (
              <li key={m.id}>
                <label className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  bloqueada ? 'border-[hsl(var(--border))] opacity-60'
                    : elegida === String(m.id) ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] cursor-pointer'
                      : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.4)] cursor-pointer'}`}>
                  <input type="radio" name="maquina-cobro" value={m.id} checked={elegida === String(m.id)}
                    disabled={bloqueada || tomando} onChange={() => { setElegida(String(m.id)); setError('') }} />
                  <CreditCard className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[hsl(var(--foreground))]">{m.nombre}</span>
                    {m.proveedorLabel && <span className="block text-xs text-[hsl(var(--muted-foreground))]">{m.proveedorLabel}</span>}
                    {!webCobraCon(m.proveedor) && (
                      <span className="block text-xs text-amber-700 dark:text-amber-300">La web todavía no cobra con Haulmer</span>
                    )}
                    {!m.activa && <span className="block text-xs text-amber-700 dark:text-amber-300">Desactivada</span>}
                  </span>
                  {m.estado === 'en_uso' && (
                    <span className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">En uso por otra persona</span>
                  )}
                  {m.estado === 'mia' && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Es tuya</span>
                  )}
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {/* Con una máquina a su nombre no hay "seguir sin máquina": no se puede soltar (B-02). */}
        {resumen.mias.length === 0 ? (
          <button type="button" onClick={() => onListo(null)} disabled={tomando}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-40">
            {lista.length === 0 ? 'Continuar' : 'Seguir sin máquina'}
          </button>
        ) : <span />}
        {tieneVarias ? (
          <Button onClick={() => onListo(null)}>Continuar</Button>
        ) : lista.length > 0 && (
          <Button onClick={usar} disabled={tomando || !elegida}>
            {tomando ? 'Tomando…' : tieneUna ? 'Continuar con mi máquina' : 'Usar esta máquina'}
          </Button>
        )}
      </div>
    </div>
  )
}
