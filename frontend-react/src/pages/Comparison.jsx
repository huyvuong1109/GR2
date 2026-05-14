import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Scale,
  Plus,
  X,
  Download,
  BarChart3,
  Activity,
  Search,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react'
import { Button, Input, Badge } from '../components/ui'
import { formatCompact } from '../utils/formatters'
import { cn } from '../utils/helpers'
import api from '../services/api'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

const COLORS = ['#4edea3', '#adc6ff', '#fbbf24', '#c084fc', '#ffb4ab']

const METRIC_CONFIGS = {
  pe_ratio: {
    name: 'P/E',
    unit: 'x',
    lowerIsBetter: true,
    description: 'Giá trên lợi nhuận',
    meaning: 'Nhà đầu tư đang trả bao nhiêu đồng cho 1 đồng lợi nhuận.',
    isValid: (value) => Number(value) > 0,
  },
  pb_ratio: {
    name: 'P/B',
    unit: 'x',
    lowerIsBetter: true,
    description: 'Giá trên giá trị sổ sách',
    meaning: 'Giá thị trường đang cao/thấp bao nhiêu so với giá trị sổ sách.',
    isValid: (value) => Number(value) > 0,
  },
  roe: {
    name: 'ROE',
    unit: '%',
    lowerIsBetter: false,
    description: 'Tỷ suất sinh lời trên vốn chủ',
    meaning: 'Doanh nghiệp tạo ra bao nhiêu lợi nhuận trên vốn chủ sở hữu.',
  },
  roa: {
    name: 'ROA',
    unit: '%',
    lowerIsBetter: false,
    description: 'Tỷ suất sinh lời trên tổng tài sản',
    meaning: 'Doanh nghiệp dùng tổng tài sản hiệu quả đến mức nào để tạo lợi nhuận.',
  },
  debt_to_equity: {
    name: 'D/E',
    unit: 'x',
    lowerIsBetter: true,
    description: 'Nợ trên vốn chủ sở hữu',
    meaning: 'Doanh nghiệp dùng bao nhiêu nợ so với vốn chủ.',
  },
  current_ratio: {
    name: 'Thanh toán hiện hành',
    unit: 'x',
    lowerIsBetter: false,
    description: 'Khả năng thanh toán ngắn hạn',
    meaning: 'Tài sản ngắn hạn có đủ phủ nợ ngắn hạn hay không.',
  },
  gross_margin: {
    name: 'Biên LN gộp',
    unit: '%',
    lowerIsBetter: false,
    description: 'Biên lợi nhuận gộp',
    meaning: 'Sau giá vốn, doanh nghiệp giữ lại bao nhiêu lợi nhuận trên doanh thu.',
  },
  net_margin: {
    name: 'Biên LN ròng',
    unit: '%',
    lowerIsBetter: false,
    description: 'Biên lợi nhuận ròng',
    meaning: 'Sau toàn bộ chi phí, doanh nghiệp giữ lại bao nhiêu lợi nhuận ròng.',
  },
  revenue_growth: {
    name: 'TT Doanh thu',
    unit: '%',
    lowerIsBetter: false,
    description: 'Tăng trưởng doanh thu theo năm',
    meaning: 'Quy mô bán hàng của doanh nghiệp đang tăng hay giảm.',
  },
  profit_growth: {
    name: 'TT Lợi nhuận',
    unit: '%',
    lowerIsBetter: false,
    description: 'Tăng trưởng lợi nhuận theo năm',
    meaning: 'Lợi nhuận thuộc về cổ đông đang tăng hay giảm.',
  },
}

const CATEGORY_CONFIGS = [
  { key: 'valuation', label: 'Định giá', metrics: ['pe_ratio', 'pb_ratio'], weight: 0.25 },
  { key: 'profitability', label: 'Sinh lời', metrics: ['roe', 'roa', 'gross_margin', 'net_margin'], weight: 0.3 },
  { key: 'health', label: 'Sức khỏe tài chính', metrics: ['debt_to_equity', 'current_ratio'], weight: 0.25 },
  { key: 'growth', label: 'Tăng trưởng', metrics: ['revenue_growth', 'profit_growth'], weight: 0.2 },
]

const RADAR_METRICS = [
  { key: 'roe', label: 'ROE score' },
  { key: 'roa', label: 'ROA score' },
  { key: 'gross_margin', label: 'Biên LN gộp score' },
  { key: 'net_margin', label: 'Biên LN ròng score' },
  { key: 'current_ratio', label: 'Thanh toán score' },
  { key: 'debt_to_equity', label: 'Đòn bẩy score' },
]

const normalizedIndustry = (company) => String(company.industry || '').trim().toLowerCase()
const hasMultipleIndustries = (companies) => new Set(companies.map(normalizedIndustry).filter(Boolean)).size > 1
const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)))

const metricValue = (company, metric) => {
  if (metric === 'f_score') return company.f_score
  return company.ratios?.[metric]
}

const validMetricEntries = (companies, metric) => {
  const config = METRIC_CONFIGS[metric]
  return companies
    .map((company) => ({ company, value: Number(metricValue(company, metric)) }))
    .filter(({ value }) => Number.isFinite(value) && (config?.isValid ? config.isValid(value) : true))
}

const metricScores = (companies, metric) => {
  const config = METRIC_CONFIGS[metric]
  const entries = validMetricEntries(companies, metric)
  const scores = Object.fromEntries(companies.map((company) => [company.ticker, null]))

  if (!entries.length) return scores
  if (metric === 'f_score') {
    entries.forEach(({ company, value }) => {
      scores[company.ticker] = clampScore((value / 9) * 100)
    })
    return scores
  }

  const values = entries.map((entry) => entry.value)
  const min = Math.min(...values)
  const max = Math.max(...values)

  entries.forEach(({ company, value }) => {
    if (max === min) {
      scores[company.ticker] = 70
      return
    }
    const ratio = config?.lowerIsBetter ? (max - value) / (max - min) : (value - min) / (max - min)
    scores[company.ticker] = clampScore(ratio * 100)
  })

  return scores
}

const averageScores = (values) => {
  const valid = values.filter((value) => Number.isFinite(value))
  if (!valid.length) return null
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length)
}

const buildComparisonScores = (companies) => {
  const scoreMaps = Object.fromEntries(Object.keys(METRIC_CONFIGS).map((metric) => [metric, metricScores(companies, metric)]))
  const fScoreMap = metricScores(companies, 'f_score')

  return companies.map((company) => {
    const categories = Object.fromEntries(
      CATEGORY_CONFIGS.map((category) => {
        const baseScores = category.metrics.map((metric) => scoreMaps[metric]?.[company.ticker])
        const values = category.key === 'health' ? [...baseScores, fScoreMap[company.ticker]] : baseScores
        return [category.key, averageScores(values)]
      })
    )

    const totalWeight = CATEGORY_CONFIGS.reduce((sum, category) => (
      Number.isFinite(categories[category.key]) ? sum + category.weight : sum
    ), 0)
    const total = totalWeight
      ? Math.round(CATEGORY_CONFIGS.reduce((sum, category) => (
          Number.isFinite(categories[category.key]) ? sum + categories[category.key] * category.weight : sum
        ), 0) / totalWeight)
      : null

    return { company, categories, total }
  }).sort((a, b) => (b.total ?? -1) - (a.total ?? -1))
}

const transformForRadar = (companies) => {
  return RADAR_METRICS.map((metric) => {
    const scores = metricScores(companies, metric.key)
    const dataPoint = { metric: metric.label }
    companies.forEach((company) => {
      dataPoint[company.ticker] = scores[company.ticker] ?? 0
    })
    return dataPoint
  })
}

const getComparableWinner = (companies, metric) => {
  const config = METRIC_CONFIGS[metric]
  const entries = validMetricEntries(companies, metric)
  if (!entries.length) return null
  return entries.reduce((best, current) => (
    config?.lowerIsBetter
      ? (current.value < best.value ? current : best)
      : (current.value > best.value ? current : best)
  )).company
}

function MetricRow({ metric, companies }) {
  const config = METRIC_CONFIGS[metric]
  const winner = getComparableWinner(companies, metric)

  return (
    <tr>
      <td>
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-100">{config.name}</span>
          <span className="group relative inline-flex">
            <Info className="h-3.5 w-3.5 cursor-help text-slate-500 transition group-hover:text-emerald-300" />
            <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-white/10 bg-[#191c1e] p-3 text-xs leading-5 text-slate-300 shadow-2xl group-hover:block">
              {config.meaning}
            </span>
          </span>
        </div>
        <p className="text-xs text-slate-500">{config.description}</p>
      </td>
      {companies.map((company) => {
        const value = metricValue(company, metric)
        const isWinner = winner?.ticker === company.ticker
        return (
          <td key={company.ticker} className="text-center">
            <div className={cn('font-mono text-lg', isWinner ? 'font-black text-emerald-300' : 'text-slate-200')}>
              {value != null ? (
                <>
                  {Number(value).toFixed(1)}{config.unit}
                  {isWinner && <CheckCircle className="ml-1 inline h-4 w-4" />}
                </>
              ) : (
                <span className="text-slate-500">-</span>
              )}
            </div>
          </td>
        )
      })}
    </tr>
  )
}

export default function Comparison() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)

  const tickers = searchParams.get('tickers')?.split(',').filter(Boolean) || []

  useEffect(() => {
    if (tickers.length >= 2) fetchComparison(tickers)
  }, [searchParams])

  const fetchComparison = async (tickerList) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/compare', { tickers: tickerList })
      setCompanies(response.companies || [])
    } catch (err) {
      console.error('Error fetching comparison:', err)
      setError('Không thể tải dữ liệu so sánh')
      try {
        const results = await Promise.all(tickerList.map((ticker) => api.get(`/analysis/${ticker}/health-score`)))
        setCompanies(results.map((r) => ({
          ticker: r.ticker,
          name: r.company_name,
          industry: r.industry,
          f_score: r.f_score?.total_score,
          ratios: r.key_ratios,
          price: r.price_info?.current_price,
          market_cap: r.price_info?.market_cap,
        })))
      } catch {
        setCompanies([])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query) => {
    setSearchQuery(query)
    if (query.length < 1) {
      setSearchResults([])
      return
    }

    try {
      const response = await api.get(`/companies/search?q=${query}`)
      setSearchResults(response.results || [])
    } catch {
      setSearchResults([])
    }
  }

  const addCompany = (ticker) => {
    if (tickers.length >= 5 || tickers.includes(ticker)) return
    setSearchParams({ tickers: [...tickers, ticker].join(',') })
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const removeCompany = (ticker) => {
    const newTickers = tickers.filter((item) => item !== ticker)
    setSearchParams(newTickers.length >= 2 ? { tickers: newTickers.join(',') } : {})
  }

  const handleExport = () => {
    if (companies.length === 0) return
    const headers = ['Chỉ số', ...companies.map((company) => company.ticker)]
    const rows = Object.keys(METRIC_CONFIGS).map((metric) => {
      const config = METRIC_CONFIGS[metric]
      return [config.name, ...companies.map((company) => company.ratios?.[metric] || '')]
    })
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `so_sanh_${tickers.join('_')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const radarData = transformForRadar(companies)
  const comparisonScores = buildComparisonScores(companies)
  const multipleIndustries = hasMultipleIndustries(companies)
  const barChartData = CATEGORY_CONFIGS.map((category) => ({
    name: category.label,
    ...Object.fromEntries(
      comparisonScores.map((item) => [item.company.ticker, item.categories[category.key] ?? 0])
    ),
  }))

  if (tickers.length < 2) {
    return (
      <div className="space-y-6">
        <PageIntro
          title="So sánh cổ phiếu"
          description="Đặt 2-5 mã cạnh nhau để nhìn nhanh định giá, sức khỏe tài chính, khả năng sinh lời và tăng trưởng."
        />

        <div className="glass-card mx-auto max-w-3xl p-8 text-center">
          <Scale className="mx-auto mb-5 h-16 w-16 text-emerald-300/70" />
          <h2 className="text-2xl font-black text-slate-100">Chọn mã để bắt đầu</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Chọn 2-5 mã cổ phiếu để so sánh các chỉ số tài chính quan trọng.</p>

          <div className="relative mx-auto mt-8 max-w-md">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Tìm kiếm mã cổ phiếu..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="py-3 pl-12 text-lg"
            />

            <SearchResults results={searchResults} onAdd={addCompany} tickers={tickers} />
          </div>

          {tickers.length === 1 && (
            <div className="mt-6">
              <Badge variant="info">{tickers[0]} đã chọn - thêm ít nhất 1 mã nữa</Badge>
            </div>
          )}

          <div className="mt-8">
            <p className="text-sm text-slate-500">Gợi ý so sánh</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button className="btn-outline px-3 py-2 text-sm" onClick={() => setSearchParams({ tickers: 'VNM,MSN,VCB' })}>VNM vs MSN vs VCB</button>
              <button className="btn-outline px-3 py-2 text-sm" onClick={() => setSearchParams({ tickers: 'VIC,VHM' })}>VIC vs VHM</button>
              <button className="btn-outline px-3 py-2 text-sm" onClick={() => setSearchParams({ tickers: 'HPG,HSG' })}>HPG vs HSG</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageIntro
          title="So sánh cổ phiếu"
          description={`Đang so sánh ${companies.length} công ty theo định giá, sinh lời, tăng trưởng và sức khỏe tài chính.`}
        />

        <div className="flex flex-wrap items-center gap-3">
          {tickers.length < 5 && (
            <div className="relative">
              <button type="button" onClick={() => setShowSearch(!showSearch)} className="btn-outline flex items-center gap-2 px-4 py-2.5">
                <Plus className="h-4 w-4" />
                Thêm mã
              </button>

              {showSearch && (
                <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-white/10 bg-[#191c1e] p-3 shadow-2xl">
                  <Input
                    placeholder="Tìm mã cổ phiếu..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    autoFocus
                  />
                  <SearchResults results={searchResults} onAdd={addCompany} tickers={tickers} compact />
                </div>
              )}
            </div>
          )}

          <button type="button" onClick={handleExport} disabled={companies.length === 0} className="btn-outline flex items-center gap-2 px-4 py-2.5 disabled:opacity-50">
            <Download className="h-4 w-4" />
            Xuất CSV
          </button>
        </div>
      </section>

      {loading && (
        <div className="glass-card p-12 text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-emerald-300/20 border-t-emerald-300" />
          <p className="text-slate-400">Đang tải dữ liệu so sánh...</p>
        </div>
      )}

      {error && !loading && (
        <div className="alert-danger flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6" />
          <div>
            <p className="font-bold">{error}</p>
            <p className="mt-1 text-sm text-red-100/75">Vui lòng thử lại hoặc chọn mã khác.</p>
          </div>
        </div>
      )}

      {!loading && companies.length === 0 && tickers.length >= 2 && (
        <div className="glass-card p-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-amber-300/70" />
          <h3 className="text-xl font-black text-slate-100">Không có dữ liệu</h3>
          <p className="mt-2 text-slate-400">Không tìm thấy dữ liệu cho các mã: {tickers.join(', ')}</p>
        </div>
      )}

      {!loading && companies.length > 0 && (
        <>
          {multipleIndustries && <IndustryWarning />}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {companies.map((company, idx) => (
              <motion.div key={company.ticker} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
                <div className="glass-card relative p-5">
                  <button
                    type="button"
                    onClick={() => removeCompany(company.ticker)}
                    className="btn-ghost absolute right-3 top-3 p-1.5 text-red-300 opacity-70 hover:opacity-100"
                    aria-label={`Xóa ${company.ticker}`}
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                    <Link to={`/company/${company.ticker}`} className="text-2xl font-black text-slate-100 hover:text-emerald-300">
                      {company.ticker}
                    </Link>
                  </div>

                  <p className="mb-3 line-clamp-1 text-sm text-slate-400">{company.name}</p>
                  <Badge variant="outline">{company.industry || 'Không có ngành'}</Badge>

                  <div className="mt-5 space-y-3 text-sm">
                    <DataLine label="Giá" value={company.price ? `${company.price.toLocaleString('vi-VN')}₫` : '-'} />
                    <DataLine label="Vốn hóa" value={company.market_cap ? formatCompact(company.market_cap) : '-'} />
                    <DataLine
                      label="F-Score"
                      value={`${company.f_score || '-'}/9`}
                      valueClass={company.f_score >= 7 ? 'text-emerald-300' : company.f_score >= 5 ? 'text-amber-300' : 'text-red-300'}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </section>

          <ComparisonConclusion scores={comparisonScores} />

          <section className="grid gap-6 lg:grid-cols-2">
            <ChartPanel title="Radar điểm chuẩn hóa" icon={<Activity className="h-5 w-5 text-emerald-300" />}>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.12)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#c6c6cd', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#909097' }} />
                  {companies.map((company, idx) => (
                    <Radar key={company.ticker} name={company.ticker} dataKey={company.ticker} stroke={COLORS[idx]} fill={COLORS[idx]} fillOpacity={0.18} />
                  ))}
                  <Legend />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${Number(value).toFixed(0)}/100`} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Điểm theo nhóm tiêu chí" icon={<BarChart3 className="h-5 w-5 text-emerald-300" />}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: '#c6c6cd' }} />
                  <YAxis tick={{ fill: '#c6c6cd' }} domain={[0, 100]} />
                  {companies.map((company, idx) => (
                    <Bar key={company.ticker} dataKey={company.ticker} fill={COLORS[idx]} radius={[4, 4, 0, 0]} />
                  ))}
                  <Legend />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${Number(value).toFixed(0)}/100`} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2 className="section-title">So sánh chi tiết</h2>
              <p className="section-subtitle">
                <CheckCircle className="mr-1 inline h-4 w-4 text-emerald-300" /> = tốt hơn trong nhóm theo đúng chiều tốt/xấu của chỉ số. Hover biểu tượng thông tin để xem ý nghĩa chỉ số.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="table-financial min-w-[760px]">
                <thead>
                  <tr>
                    <th className="w-[220px]">Chỉ số</th>
                    {companies.map((company, idx) => (
                      <th key={company.ticker} className="text-center">
                        <span className="inline-flex items-center justify-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                          {company.ticker}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <GroupRow label="Chỉ số thị trường" colSpan={companies.length + 1} />
                  <MetricRow metric="pe_ratio" companies={companies} />
                  <MetricRow metric="pb_ratio" companies={companies} />
                  <GroupRow label="Sinh lời" colSpan={companies.length + 1} />
                  <MetricRow metric="roe" companies={companies} />
                  <MetricRow metric="roa" companies={companies} />
                  <MetricRow metric="gross_margin" companies={companies} />
                  <MetricRow metric="net_margin" companies={companies} />
                  <GroupRow label="Sức khỏe tài chính" colSpan={companies.length + 1} />
                  <MetricRow metric="debt_to_equity" companies={companies} />
                  <MetricRow metric="current_ratio" companies={companies} />
                  <GroupRow label="Tăng trưởng" colSpan={companies.length + 1} />
                  <MetricRow metric="revenue_growth" companies={companies} />
                  <MetricRow metric="profit_growth" companies={companies} />
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

const tooltipStyle = {
  backgroundColor: 'rgba(25, 28, 30, 0.94)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '12px',
  color: '#e0e3e5',
  boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
}

function PageIntro({ title, description }) {
  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-black leading-tight text-slate-100 md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-4xl text-base leading-7 text-slate-400">{description}</p>
    </div>
  )
}

function IndustryWarning() {
  return (
    <div className="alert-warning flex items-start gap-3 text-sm leading-6">
      <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
      <p>
        Các mã đang thuộc nhiều ngành khác nhau. Một số chỉ số như biên lợi nhuận, D/E, thanh toán hiện hành có thể không so sánh trực tiếp. Nên ưu tiên so với trung bình ngành.
      </p>
    </div>
  )
}

function ComparisonConclusion({ scores }) {
  const leader = scores.find((item) => Number.isFinite(item.total))

  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="section-title">Kết luận so sánh</h2>
        <p className="section-subtitle">
          Mỗi tiêu chí được chuẩn hóa về thang 0-100 trong riêng nhóm mã đang chọn.
        </p>
      </div>

      <div className="panel-body space-y-4">
        {leader && (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4">
            <p className="text-sm font-bold text-emerald-300">Mã nổi bật nhất trong nhóm hiện tại</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              {leader.company.ticker} đang có điểm so sánh tổng hợp cao nhất với {leader.total}/100. Điểm này phản ánh tương quan định giá, sinh lời, sức khỏe tài chính và tăng trưởng so với các mã còn lại trong nhóm.
            </p>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-3">
          {scores.map((item, index) => (
            <div key={item.company.ticker} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-black text-slate-100">
                    {index + 1}. {item.company.ticker}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.company.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-black text-emerald-300">{item.total ?? '-'}</p>
                  <p className="text-xs font-bold text-slate-500">/100</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs">
                {CATEGORY_CONFIGS.map((category) => (
                  <ScoreLine
                    key={`${item.company.ticker}-${category.key}`}
                    label={category.label}
                    score={item.categories[category.key]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-500">
          Điểm này chỉ dùng để so sánh tương đối trong nhóm mã đang chọn, không phải khuyến nghị mua bán.
        </p>
      </div>
    </section>
  )
}

function ScoreLine({ label, score }) {
  const width = Number.isFinite(score) ? score : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono font-bold text-slate-200">{score ?? '-'}/100</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-emerald-300" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function SearchResults({ results, onAdd, tickers, compact = false }) {
  if (!results.length) return null
  return (
    <div className={cn('absolute top-full z-10 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#191c1e] shadow-2xl', compact && 'relative top-auto mt-2')}>
      <div className="max-h-60 overflow-y-auto py-2">
        {results.filter((stock) => !tickers.includes(stock.ticker)).map((stock) => (
          <button
            key={stock.ticker}
            type="button"
            onClick={() => onAdd(stock.ticker)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
          >
            <span>
              <span className="font-black text-emerald-300">{stock.ticker}</span>
              <span className="ml-2 text-sm text-slate-400">{stock.name}</span>
            </span>
            <Plus className="h-4 w-4 text-slate-500" />
          </button>
        ))}
      </div>
    </div>
  )
}

function DataLine({ label, value, valueClass = 'text-slate-100' }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={cn('font-mono font-bold', valueClass)}>{value}</span>
    </div>
  )
}

function ChartPanel({ title, icon, children }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="section-title flex items-center gap-2">{icon}{title}</h2>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  )
}

function GroupRow({ label, colSpan }) {
  return (
    <tr className="bg-white/[0.035]">
      <td colSpan={colSpan} className="text-xs font-black uppercase tracking-widest text-emerald-300">
        {label}
      </td>
    </tr>
  )
}

function SummaryItem({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05]">{icon}</div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="font-black text-slate-100">{value}</p>
      </div>
    </div>
  )
}
