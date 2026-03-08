import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import { chartColors, formatCompact, formatPercent } from '../../utils/formatters'

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, valueFormatter = formatCompact }) => {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-dark-800/95 backdrop-blur-sm border border-dark-600 rounded-xl p-4 shadow-xl">
      <p className="text-sm font-medium text-dark-300 mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-dark-400">{entry.name}:</span>
            <span className="text-sm font-semibold text-white">
              {valueFormatter(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Revenue & Profit Growth Chart
export function RevenueChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.3} />
            <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.success} stopOpacity={0.3} />
            <stop offset="100%" stopColor={chartColors.success} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis 
          dataKey="year" 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickFormatter={formatCompact}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ paddingTop: 20 }}
          iconType="circle"
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Doanh thu"
          stroke={chartColors.primary}
          fill="url(#revenueGradient)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="profit"
          name="Lợi nhuận"
          stroke={chartColors.success}
          fill="url(#profitGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Financial Ratios Chart
export function RatiosChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
        <XAxis 
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickFormatter={(val) => `${val}%`}
        />
        <YAxis 
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          width={100}
        />
        <Tooltip 
          content={<CustomTooltip valueFormatter={formatPercent} />}
        />
        <Bar 
          dataKey="value" 
          fill={chartColors.primary}
          radius={[0, 8, 8, 0]}
          maxBarSize={30}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Sector Allocation Pie Chart
export function SectorPieChart({ data }) {
  const COLORS = chartColors.series

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const data = payload[0].payload
            return (
              <div className="bg-dark-800/95 backdrop-blur-sm border border-dark-600 rounded-xl p-3 shadow-xl">
                <p className="text-sm font-medium text-white">{data.name}</p>
                <p className="text-sm text-dark-400">{formatPercent(data.value)}</p>
              </div>
            )
          }}
        />
        <Legend 
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          wrapperStyle={{ paddingLeft: 20 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Multi-Year Performance Chart
export function PerformanceChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="year" 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickFormatter={(val) => `${val}%`}
        />
        <Tooltip content={<CustomTooltip valueFormatter={formatPercent} />} />
        <Legend iconType="circle" />
        <Line
          type="monotone"
          dataKey="roe"
          name="ROE"
          stroke={chartColors.primary}
          strokeWidth={2}
          dot={{ fill: chartColors.primary, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: chartColors.primary, strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="roa"
          name="ROA"
          stroke={chartColors.success}
          strokeWidth={2}
          dot={{ fill: chartColors.success, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: chartColors.success, strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="roic"
          name="ROIC"
          stroke={chartColors.secondary}
          strokeWidth={2}
          dot={{ fill: chartColors.secondary, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: chartColors.secondary, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Cash Flow Chart
export function CashFlowChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis 
          dataKey="year"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickFormatter={formatCompact}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" />
        <Bar 
          dataKey="operating" 
          name="Hoạt động KD" 
          fill={chartColors.primary}
          radius={[4, 4, 0, 0]}
        />
        <Bar 
          dataKey="investing" 
          name="Đầu tư" 
          fill={chartColors.warning}
          radius={[4, 4, 0, 0]}
        />
        <Bar 
          dataKey="financing" 
          name="Tài chính" 
          fill={chartColors.secondary}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Balance Sheet Structure Chart
export function BalanceSheetChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
        <XAxis 
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickFormatter={formatCompact}
        />
        <YAxis 
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          width={120}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar 
          dataKey="value" 
          fill={chartColors.primary}
          radius={[0, 8, 8, 0]}
          maxBarSize={40}
        >
          {data.map((entry, index) => (
            <Cell 
              key={index} 
              fill={chartColors.series[index % chartColors.series.length]} 
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Mini Sparkline Chart
export function SparklineChart({ data, color = chartColors.primary, height = 40 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill={`url(#spark-${color})`}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default {
  RevenueChart,
  RatiosChart,
  SectorPieChart,
  PerformanceChart,
  CashFlowChart,
  BalanceSheetChart,
  SparklineChart,
}
