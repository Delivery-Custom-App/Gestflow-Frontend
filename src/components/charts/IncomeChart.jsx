import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import ChartSkeleton from '../ui/ChartSkeleton'

const CLP = (v) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

function IncomeChart({ data = [], loading = false, showCashFlow = false }) {
  if (loading) return <ChartSkeleton className="h-[220px]" />
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-[hsl(var(--muted-foreground))]">
        Sin pedidos registrados en el período.
      </div>
    )
  }

  if (showCashFlow) {
    // 7d mode: ingresos + flujo_neto from API
    const chartData = data.map((item) => ({
      date:      item.date,
      ingresos:  Math.max(0, Number(item.ingresos)  || 0),
      flujo_neto: Number(item.flujo_neto) || 0,
    }))

    const minY = Math.min(0, ...chartData.map((d) => d.flujo_neto))

    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradIngresos7d" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--chart-brand)" className="chart-brand-stop" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--chart-brand)" className="chart-brand-stop" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradFlujo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--chart-secondary)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--chart-secondary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
            width={48}
            domain={[minY < 0 ? minY : 0, 'auto']}
          />
          <Tooltip
            formatter={(value, name) => [
              CLP(value),
              name === 'ingresos' ? 'Ingresos' : 'Flujo Neto',
            ]}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: 12,
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          <Legend
            formatter={(value) => value === 'ingresos' ? 'Ingresos' : 'Flujo Neto'}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
          />

          <Area
            type="monotoneX"
            dataKey="flujo_neto"
            stroke="var(--chart-secondary)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            fill="url(#gradFlujo)"
            dot={false}
            name="flujo_neto"
          />
          <Area
            type="monotoneX"
            dataKey="ingresos"
            stroke="var(--chart-brand)" className="chart-brand-stroke"
            strokeWidth={2.5}
            fill="url(#gradIngresos7d)"
            dot={{ className: 'chart-brand-fill', fill: 'var(--chart-brand)', r: 4, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, className: 'chart-brand-fill', fill: 'var(--chart-brand)', stroke: '#fff', strokeWidth: 2 }}
            name="ingresos"
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // Sub-day mode: ingresos + promedio from order bucketing
  const chartData = data.map((item) => ({
    date:     item.date || item.period || item.name || '—',
    ingresos: Number(item.ingresos) || Number(item.revenue) || 0,
    promedio: Number(item.promedio) || Number(item.average) || 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--chart-brand)" className="chart-brand-stop" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-brand)" className="chart-brand-stop" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradPromedio" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--chart-secondary)" stopOpacity={0.18} />
            <stop offset="95%" stopColor="var(--chart-secondary)" stopOpacity={0.01} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="date"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
          width={48}
          domain={[0, 'auto']}
        />
        <Tooltip
          formatter={(value, name) => [CLP(value), name === 'ingresos' ? 'Ingresos' : 'Promedio']}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: 12,
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
        />

        <Area
          type="monotoneX"
          dataKey="promedio"
          stroke="var(--chart-secondary)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="url(#gradPromedio)"
          dot={false}
          name="promedio"
        />
        <Area
          type="monotoneX"
          dataKey="ingresos"
          stroke="var(--chart-brand)" className="chart-brand-stroke"
          strokeWidth={2.5}
          fill="url(#gradIngresos)"
          dot={{ className: 'chart-brand-fill', fill: 'var(--chart-brand)', r: 4, strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 6, className: 'chart-brand-fill', fill: 'var(--chart-brand)', stroke: '#fff', strokeWidth: 2 }}
          name="ingresos"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default IncomeChart
