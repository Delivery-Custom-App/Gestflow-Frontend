import { useEffect, useState } from 'react'
import { fetchBusinessSalesSummary } from '@/lib/businessSalesSummary'
import { formatCLPCurrency as CLP } from '@/lib/formatCLP'

function ChangeBadge({ value, suffix }) {
  if (value == null) {
    return (
      <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
        Sin datos previos
      </span>
    )
  }
  const positive = value >= 0
  return (
    <span
      className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
        positive ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'
      }`}
    >
      {positive ? '+' : ''}{value}% {suffix}
    </span>
  )
}

function WeeklyChart({ weekly }) {
  const max = Math.max(1, ...weekly.days.map((d) => d.count))
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          venta general de la semana
        </p>
        <ChangeBadge value={weekly.changeVsYesterday} suffix="vs día anterior" />
      </div>
      <p className="font-marca text-2xl text-[hsl(var(--foreground))] mb-5">{CLP(weekly.total)}</p>
      <div className="flex items-end justify-between gap-2 h-32">
        {weekly.days.map((day) => {
          const heightPct = day.count > 0 ? Math.max(14, Math.round((day.count / max) * 100)) : 8
          return (
            <div key={day.label + day.date.toISOString()} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
              {day.count > 0 && (
                <span className="text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-emerald-500 text-white">
                  {day.count}
                </span>
              )}
              <div
                className={`w-full rounded-md ${day.count > 0 ? 'bg-[hsl(var(--secondary))]' : 'bg-[hsl(var(--muted))]'} ${day.isToday ? 'ring-1 ring-[hsl(var(--primary))]' : ''}`}
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{day.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthlyChart({ monthly }) {
  const max = Math.max(1, ...monthly.months.map((m) => m.total))
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-start justify-between gap-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          comparativa venta mensual histórica
        </p>
        <ChangeBadge value={monthly.accumulatedPercent} suffix={`acumulado x ${monthly.monthsSpan} meses`} />
      </div>
      <div className="flex items-end justify-between gap-3 h-32">
        {monthly.months.map((month, i) => {
          const prevTotal = i > 0 ? monthly.months[i - 1].total : month.total
          const baseHeight = Math.max(10, Math.round((Math.min(month.total, prevTotal) / max) * 100))
          const growthHeight = month.total > prevTotal ? Math.round(((month.total - prevTotal) / max) * 100) : 0
          return (
            <div key={month.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
              {month.momPercent != null && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {month.momPercent >= 0 ? '+' : ''}{month.momPercent}
                </span>
              )}
              <div className="w-full flex flex-col justify-end" style={{ height: `${baseHeight + growthHeight}%` }}>
                {growthHeight > 0 && <div className="w-full rounded-t-md bg-emerald-500" style={{ height: `${growthHeight}%` }} />}
                <div
                  className={`w-full bg-[hsl(var(--secondary))] ${growthHeight > 0 ? '' : 'rounded-t-md'} rounded-b-md`}
                  style={{ height: `${baseHeight}%` }}
                />
              </div>
              <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{month.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FranchiseSalesCharts({ locales }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchBusinessSalesSummary(locales)
      .then((data) => { if (!cancelled) setSummary(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [locales])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 h-56 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!summary) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <WeeklyChart weekly={summary.weekly} />
      <MonthlyChart monthly={summary.monthly} />
    </div>
  )
}

export default FranchiseSalesCharts
