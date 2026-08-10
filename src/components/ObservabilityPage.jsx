import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Gauge, Loader2, RefreshCw } from 'lucide-react'
import { getAuthContext, formatApiErrorDetail } from '../lib/apiClient'
import { getObservability } from '../lib/superAdminApi'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const METHOD_COLOR = {
  GET: 'bg-blue-100 text-blue-700 border-blue-200',
  POST: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PATCH: 'bg-amber-100 text-amber-700 border-amber-200',
  PUT: 'bg-amber-100 text-amber-700 border-amber-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
}

function latencyColor(ms) {
  if (ms < 100) return 'bg-emerald-500'
  if (ms < 300) return 'bg-amber-500'
  return 'bg-red-500'
}

function formatMs(ms) {
  if (ms === null || ms === undefined) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

export default function ObservabilityPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ctx = await getAuthContext()
      const stats = await getObservability(ctx.token)
      setData(stats)
      setErr('')
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.detail) || e2.message || 'Error al cargar la observabilidad')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const endpoints = data?.endpoints || []
  const maxAvg = endpoints.length ? Math.max(...endpoints.map((e) => e.avg_ms)) : 0
  const totalCalls = endpoints.reduce((acc, e) => acc + e.count, 0)
  const totalErrors = endpoints.reduce((acc, e) => acc + e.errors, 0)

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[hsl(var(--background))]">
      <div className="p-6 md:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center">
              <Gauge size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Observabilidad</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Latencia por endpoint · acumulado desde el último reinicio del servicio
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refrescar
          </Button>
        </div>

        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

        {loading && !data ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando observabilidad…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 max-w-lg">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Endpoints</p>
                  <p className="text-xl font-bold text-[hsl(var(--foreground))]">{endpoints.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Peticiones</p>
                  <p className="text-xl font-bold text-[hsl(var(--foreground))]">{totalCalls}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Errores 5xx</p>
                  <p className={`text-xl font-bold ${totalErrors ? 'text-red-600' : 'text-[hsl(var(--foreground))]'}`}>{totalErrors}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-4">Latencia por endpoint</h3>
                {endpoints.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Aún no hay datos. Realiza peticiones a la API y vuelve a cargar para ver la latencia de cada endpoint.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                    {endpoints.map((e, i) => (
                      <motion.div
                        key={`${e.method}-${e.path}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                        className="py-3"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className={`text-[10px] font-bold uppercase tracking-wide rounded px-2 py-0.5 border ${METHOD_COLOR[e.method] || METHOD_COLOR.GET}`}>
                            {e.method}
                          </Badge>
                          <span className="text-sm font-mono text-[hsl(var(--foreground))] flex-1 min-w-0 truncate">{e.path}</span>
                          <div className="flex items-center gap-4 shrink-0 text-xs">
                            <span className="text-[hsl(var(--muted-foreground))]">{e.count} req</span>
                            <span className="text-[hsl(var(--muted-foreground))]">
                              avg <span className="font-semibold text-[hsl(var(--foreground))]">{formatMs(e.avg_ms)}</span>
                            </span>
                            <span className="text-[hsl(var(--muted-foreground))]">
                              p95 <span className="font-semibold text-[hsl(var(--foreground))]">{formatMs(e.p95_ms)}</span>
                            </span>
                            {e.errors > 0 && <span className="font-semibold text-red-600">{e.errors} err</span>}
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${maxAvg ? (e.avg_ms / maxAvg) * 100 : 0}%` }}
                            transition={{ duration: 0.5 }}
                            className={`h-full rounded-full ${latencyColor(e.avg_ms)}`}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
