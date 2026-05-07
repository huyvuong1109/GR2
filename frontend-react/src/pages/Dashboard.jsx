import { motion } from 'framer-motion'
import { useContext, useEffect, useMemo, useState } from 'react'
import {
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Eye,
} from 'lucide-react'
import { AuthContext } from '../contexts/AuthContext'
import { WatchlistContext } from '../contexts/WatchlistContext'
import { companiesApi, priceHistoryApi } from '../services/api'

function formatCompactVnd(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} ₫`
}

export default function Dashboard() {
  const { user } = useContext(AuthContext)
  const { items: watchlistItems } = useContext(WatchlistContext)
  const userName = user?.username || 'Khách'
  const [watchlistCompanies, setWatchlistCompanies] = useState([])
  const [priceHistory, setPriceHistory] = useState({})
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(false)

  const chartTickers = useMemo(
    () => watchlistItems.map((item) => item.ticker).slice(0, 5),
    [watchlistItems]
  )

  const lastUpdateDate = useMemo(() => {
    const dates = new Set()
    Object.values(priceHistory).forEach((series) => {
      ;(series || []).forEach((point) => {
        if (point?.trade_date) dates.add(point.trade_date)
      })
    })
    const sorted = Array.from(dates).sort()
    return sorted[sorted.length - 1] || null
  }, [priceHistory])

  useEffect(() => {
    const fetchWatchlistData = async () => {
      if (!chartTickers.length) {
        setWatchlistCompanies([])
        setPriceHistory({})
        setChartData([])
        return
      }

      setLoading(true)
      try {
        const [companies, history] = await Promise.all([
          companiesApi.getBatch(chartTickers),
          priceHistoryApi.getForTickers(chartTickers, 7),
        ])

        setWatchlistCompanies(Array.isArray(companies) ? companies : [])
        setPriceHistory(history || {})

        const dateSet = new Set()
        chartTickers.forEach((ticker) => {
          ;(history?.[ticker] || []).forEach((point) => {
            if (point?.trade_date) dateSet.add(point.trade_date)
          })
        })

        const sortedDates = Array.from(dateSet).sort()
        const lastDates = sortedDates.slice(-7)

        const seriesMap = {}
        chartTickers.forEach((ticker) => {
          seriesMap[ticker] = new Map(
            (history?.[ticker] || []).map((point) => [point.trade_date, point.close_price])
          )
        })

        const data = lastDates.map((date) => {
          const row = { date }
          chartTickers.forEach((ticker) => {
            row[ticker] = seriesMap[ticker].get(date) ?? null
          })
          return row
        })

        setChartData(data)
      } catch (error) {
        console.error('Failed to load watchlist data', error)
        setWatchlistCompanies([])
        setPriceHistory({})
        setChartData([])
      } finally {
        setLoading(false)
      }
    }

    fetchWatchlistData()
  }, [chartTickers])

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
              Chào buổi sáng
            </p>
            <h1 className="mt-1 text-3xl font-serif font-bold text-slate-900">
              Xin chào, {userName}
            </h1>
          </div>
          
          {lastUpdateDate && (
            <div className="alert-info inline-flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">
                Cập nhật: {lastUpdateDate}
              </span>
            </div>
          )}
        </div>
      </motion.section>

      <div className="grid gap-6 xl:grid-cols-12">
        {/* Main Content */}
        <section className="space-y-6 xl:col-span-8">
          {/* Price Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="panel"
          >
            <div className="panel-header">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title">Biểu đồ giá cổ phiếu</h2>
                  <p className="section-subtitle">Biến động giá 7 ngày gần nhất</p>
                </div>
                <TrendingUp className="h-5 w-5 text-success-600" />
              </div>
            </div>

            <div className="panel-body">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      stroke="#cbd5e1"
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      stroke="#cbd5e1"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      }}
                      formatter={(value) => [Number(value).toLocaleString('vi-VN') + ' ₫', '']}
                      labelFormatter={(label) => `Ngày: ${label}`}
                    />
                    {chartTickers.map((ticker, index) => (
                      <Line
                        key={ticker}
                        type="monotone"
                        dataKey={ticker}
                        stroke={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'][index % 5]}
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4">
                {chartTickers.length === 0 ? (
                  <p className="text-sm text-slate-600">Chưa có mã theo dõi để vẽ biểu đồ.</p>
                ) : (
                  chartTickers.map((ticker, index) => (
                    <div key={ticker} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span
                        className="h-3 w-3 rounded-full shadow-sm"
                        style={{ backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'][index % 5] }}
                      />
                      {ticker}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          {/* Signals Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="panel"
          >
            <div className="panel-header">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title">Tín hiệu đầu tư</h2>
                  <p className="section-subtitle">Từ các bộ lọc và phân tích</p>
                </div>
                <a 
                  href="/screener" 
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Mở bộ lọc
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="panel-body">
              <div className="alert-info text-center">
                <p className="text-sm">Chưa có dữ liệu tín hiệu từ bộ lọc.</p>
                <p className="mt-1 text-xs text-slate-600">
                  Sử dụng bộ lọc cổ phiếu để tìm kiếm cơ hội đầu tư
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Watchlist Sidebar */}
        <section className="space-y-6 xl:col-span-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="panel"
          >
            <div className="panel-header">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title">Danh mục quan tâm</h2>
                  <p className="section-subtitle">{watchlistCompanies.length} cổ phiếu</p>
                </div>
                <Eye className="h-5 w-5 text-primary-600" />
              </div>
            </div>

            <div className="panel-body">
              <div className="space-y-3">
                {loading && (
                  <div className="alert-info text-center text-sm">
                    Đang tải danh sách theo dõi...
                  </div>
                )}

                {!loading && watchlistCompanies.length === 0 && (
                  <div className="alert-info text-center">
                    <p className="text-sm">Chưa có mã theo dõi.</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Thêm cổ phiếu vào danh sách để theo dõi
                    </p>
                  </div>
                )}

                {!loading && watchlistCompanies.map((company) => {
                  const symbol = company.ticker
                  const history = priceHistory?.[symbol] || []
                  const latest = history[history.length - 1]
                  const previous = history[history.length - 2]
                  const change = latest && previous && previous.close_price
                    ? ((latest.close_price - previous.close_price) / previous.close_price) * 100
                    : null
                  const positive = change !== null ? change >= 0 : true

                  return (
                    <div
                      key={symbol}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 hover:border-primary-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-200 bg-gradient-to-br from-primary-50 to-slate-50 text-sm font-bold text-primary-700">
                          {symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{symbol}</p>
                          <p className="text-xs text-slate-600 truncate max-w-[120px]">
                            {company.name || 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 font-mono">
                          {company.current_price ? formatCompactVnd(company.current_price) : '—'}
                        </p>
                        <div className={`inline-flex items-center gap-1 text-xs font-semibold ${positive ? 'text-success-600' : 'text-danger-600'}`}>
                          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {change === null ? '—' : `${positive ? '+' : ''}${change.toFixed(2)}%`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  )
}
