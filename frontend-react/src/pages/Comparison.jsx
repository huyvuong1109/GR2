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

const SUGGESTED_COMPARISONS = [
  { label: 'Ngân hàng', tickers: 'VCB,TCB,MBB' },
  { label: 'Bất động sản', tickers: 'VIC,VHM,NVL' },
  { label: 'Thép', tickers: 'HPG,HSG,NKG' },
  { label: 'Chứng khoán', tickers: 'SSI,VND,HCM' },
  { label: 'Bảo hiểm', tickers: 'BVH,PVI,BMI' },
  { label: 'Thực phẩm', tickers: 'VNM,MSN,SAB' },
]

const chartSeriesKey = (index) => `series_${index}`
const chartSeriesHasDataKey = (index) => `${chartSeriesKey(index)}_hasData`
const COMPANY_TYPE_ALIASES = {
  corp: 'corporate',
  corporate: 'corporate',
  bank: 'bank',
  insu: 'insurance',
  insurance: 'insurance',
  secur: 'securities',
  securities: 'securities',
}
const COMPANY_TYPE_LABELS = {
  corporate: 'Doanh nghiệp',
  bank: 'Ngân hàng',
  insurance: 'Bảo hiểm',
  securities: 'Chứng khoán',
}
const normalizeCompanyType = (value) => COMPANY_TYPE_ALIASES[String(value || '').trim().toLowerCase()] || 'corporate'
const companyTypeLabel = (company) => COMPANY_TYPE_LABELS[normalizeCompanyType(company.company_type)] || 'Doanh nghiệp'
const normalizedIndustry = (company) => String(company.industry || '').trim().toLowerCase()
const hasMultipleIndustries = (companies) => new Set(companies.map(normalizedIndustry).filter(Boolean)).size > 1
const hasMultipleCompanyTypes = (companies) => new Set(companies.map((company) => normalizeCompanyType(company.company_type))).size > 1
const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)))
const MIN_VALID_SCORE = 5

const SCORE_BENCHMARKS = {
  corporate: {
    pe_ratio: [[8, 100], [15, 85], [25, 55], [40, 25], [60, 5], [80, 0]],
    pb_ratio: [[0.5, 100], [1, 95], [2, 75], [3, 45], [5, 15], [8, 0]],
    roe: [[-10, 0], [0, 10], [5, 35], [10, 65], [15, 85], [20, 100]],
    roa: [[-5, 0], [0, 10], [2, 40], [5, 70], [8, 90], [12, 100]],
    debt_to_equity: [[0, 100], [0.5, 90], [1, 75], [2, 45], [4, 15], [6, 0]],
    current_ratio: [[0, 0], [0.8, 35], [1, 55], [1.5, 85], [2, 100], [3, 90], [5, 65]],
    gross_margin: [[0, 0], [15, 25], [25, 45], [35, 65], [45, 85], [60, 100]],
    net_margin: [[-10, 0], [0, 10], [5, 35], [10, 60], [15, 80], [25, 100]],
    revenue_growth: [[-30, 0], [-10, 20], [0, 40], [10, 65], [20, 85], [35, 100]],
    profit_growth: [[-30, 0], [-10, 20], [0, 40], [10, 65], [20, 85], [35, 100]],
  },
  bank: {
    pe_ratio: [[5, 100], [9, 90], [14, 70], [20, 40], [30, 15], [45, 0]],
    pb_ratio: [[0.5, 80], [0.8, 100], [1.2, 90], [1.8, 65], [2.5, 35], [4, 0]],
    roe: [[-5, 0], [0, 10], [8, 40], [15, 75], [22, 100], [30, 85]],
    roa: [[-1, 0], [0, 10], [0.5, 40], [1, 70], [1.8, 100], [3, 85]],
    debt_to_equity: [[0, 20], [4, 45], [8, 80], [12, 95], [16, 70], [22, 35], [30, 0]],
    current_ratio: [[0.9, 0], [1, 45], [1.05, 75], [1.12, 100], [1.25, 85], [1.5, 55]],
    gross_margin: [[0, 0], [20, 30], [35, 55], [50, 80], [65, 100]],
    net_margin: [[-10, 0], [0, 10], [10, 35], [20, 65], [30, 90], [40, 100]],
    revenue_growth: [[-20, 0], [-5, 25], [0, 45], [8, 70], [15, 90], [25, 100]],
    profit_growth: [[-25, 0], [-10, 20], [0, 45], [10, 70], [20, 90], [35, 100]],
  },
  insurance: {
    pe_ratio: [[6, 100], [12, 85], [20, 60], [32, 30], [50, 5], [70, 0]],
    pb_ratio: [[0.5, 90], [1, 100], [1.8, 80], [3, 50], [5, 15], [8, 0]],
    roe: [[-5, 0], [0, 10], [6, 40], [12, 70], [18, 95], [25, 100]],
    roa: [[-2, 0], [0, 10], [1, 35], [3, 70], [5, 95], [8, 100]],
    debt_to_equity: [[0, 20], [1, 50], [3, 75], [6, 95], [10, 85], [15, 55], [25, 0]],
    current_ratio: [[0, 0], [0.8, 35], [1, 60], [1.5, 90], [2.5, 100], [4, 80]],
    gross_margin: [[-20, 0], [0, 20], [10, 45], [25, 75], [40, 100]],
    net_margin: [[-10, 0], [0, 10], [5, 35], [12, 65], [20, 90], [30, 100]],
    revenue_growth: [[-20, 0], [-5, 25], [0, 45], [8, 70], [15, 90], [25, 100]],
    profit_growth: [[-25, 0], [-10, 20], [0, 45], [10, 70], [20, 90], [35, 100]],
  },
  securities: {
    pe_ratio: [[5, 100], [10, 85], [18, 60], [30, 30], [45, 10], [60, 0]],
    pb_ratio: [[0.5, 85], [1, 100], [1.8, 80], [3, 50], [5, 20], [8, 0]],
    roe: [[-10, 0], [0, 10], [6, 35], [12, 65], [20, 95], [30, 100]],
    roa: [[-5, 0], [0, 10], [2, 35], [5, 70], [8, 90], [12, 100]],
    debt_to_equity: [[0, 90], [0.5, 100], [1.2, 85], [2, 60], [3.5, 25], [5, 0]],
    current_ratio: [[0, 0], [1, 45], [1.5, 75], [2.5, 100], [4, 85], [6, 60]],
    gross_margin: [[0, 0], [20, 30], [35, 55], [50, 80], [65, 100]],
    net_margin: [[-10, 0], [0, 10], [10, 40], [20, 70], [35, 95], [50, 100]],
    revenue_growth: [[-30, 0], [-10, 20], [0, 45], [15, 70], [30, 90], [50, 100]],
    profit_growth: [[-40, 0], [-15, 20], [0, 45], [20, 70], [40, 90], [70, 100]],
  },
}

const getScoreBenchmarks = (metric, company) => {
  const companyType = normalizeCompanyType(company.company_type)
  return SCORE_BENCHMARKS[companyType]?.[metric] || SCORE_BENCHMARKS.corporate[metric]
}

const benchmarkScore = (metric, value, company) => {
  const points = getScoreBenchmarks(metric, company)
  if (!points || !Number.isFinite(value)) return null

  if (value <= points[0][0]) return Math.max(MIN_VALID_SCORE, clampScore(points[0][1]))

  for (let index = 1; index < points.length; index += 1) {
    const [rightValue, rightScore] = points[index]
    const [leftValue, leftScore] = points[index - 1]
    if (value <= rightValue) {
      const ratio = (value - leftValue) / (rightValue - leftValue)
      return Math.max(MIN_VALID_SCORE, clampScore(leftScore + ratio * (rightScore - leftScore)))
    }
  }

  return Math.max(MIN_VALID_SCORE, clampScore(points[points.length - 1][1]))
}

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

  if (entries.some(({ company }) => getScoreBenchmarks(metric, company))) {
    entries.forEach(({ company, value }) => {
      scores[company.ticker] = benchmarkScore(metric, value, company)
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
    companies.forEach((company, index) => {
      const score = scores[company.ticker]
      const hasData = Number.isFinite(score)
      dataPoint[chartSeriesKey(index)] = hasData ? score : 0
      dataPoint[chartSeriesHasDataKey(index)] = hasData
    })
    return dataPoint
  })
}

const hasRadarScoreData = (radarData, companies) => (
  radarData.some((item) => companies.some((_, index) => item[chartSeriesHasDataKey(index)]))
)

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

function MetricRow({ metric, companies, onMetricTooltip, onMetricTooltipHide }) {
  const config = METRIC_CONFIGS[metric]
  const winner = getComparableWinner(companies, metric)

  return (
    <tr>
      <td>
        <button
          type="button"
          className="group inline-flex max-w-full cursor-help flex-col items-start text-left"
          onMouseEnter={(event) => onMetricTooltip(metric, event)}
          onMouseLeave={onMetricTooltipHide}
          onFocus={(event) => onMetricTooltip(metric, event)}
          onBlur={onMetricTooltipHide}
        >
          <span className="flex items-center gap-2">
            <span className="font-bold text-slate-100 transition group-hover:text-emerald-300 group-focus:text-emerald-300">{config.name}</span>
            <Info className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-emerald-300 group-focus:text-emerald-300" />
          </span>
          <span className="text-xs text-slate-500">{config.description}</span>
        </button>
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
  const [metricTooltip, setMetricTooltip] = useState(null)

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
          company_type: r.company_type,
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
    const rows = [
      ['Loại hình', ...companies.map((company) => companyTypeLabel(company))],
      ['Ngành', ...companies.map((company) => company.industry || '')],
      ...Object.keys(METRIC_CONFIGS).map((metric) => {
        const config = METRIC_CONFIGS[metric]
        return [config.name, ...companies.map((company) => company.ratios?.[metric] || '')]
      }),
    ]
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `so_sanh_${tickers.join('_')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const showMetricTooltip = (metric, event) => {
    const config = METRIC_CONFIGS[metric]
    if (!config) return

    const tooltipWidth = 320
    const tooltipHeight = 150
    const margin = 12
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const targetRect = event.currentTarget.getBoundingClientRect()
    const preferredX = targetRect.right + 16
    const fallbackX = targetRect.left - tooltipWidth - 16
    const baseX = preferredX + tooltipWidth + margin <= viewportWidth ? preferredX : fallbackX
    const baseY = targetRect.top

    setMetricTooltip({
      title: config.name,
      description: config.description,
      meaning: config.meaning,
      x: Math.max(margin, Math.min(baseX + 16, viewportWidth - tooltipWidth - margin)),
      y: Math.max(margin, Math.min(baseY + 16, viewportHeight - tooltipHeight - margin)),
    })
  }

  const metricTooltipProps = {
    onMetricTooltip: showMetricTooltip,
    onMetricTooltipHide: () => setMetricTooltip(null),
  }

  const radarData = transformForRadar(companies)
  const radarHasData = hasRadarScoreData(radarData, companies)
  const comparisonScores = buildComparisonScores(companies)
  const multipleIndustries = hasMultipleIndustries(companies)
  const multipleCompanyTypes = hasMultipleCompanyTypes(companies)
  const barChartData = CATEGORY_CONFIGS.map((category) => ({
    name: category.label,
    ...Object.fromEntries(
      companies.map((company, index) => {
        const score = comparisonScores.find((item) => item.company.ticker === company.ticker)
        return [chartSeriesKey(index), score?.categories[category.key] ?? 0]
      })
    ),
  }))

  if (tickers.length < 2) {
    return (
      <div className="space-y-6">
        <PageIntro
          title="So sánh cổ phiếu"
          description="Đánh giá tương quan 2-5 doanh nghiệp theo định giá, sinh lời, tăng trưởng và sức khỏe tài chính. Nên ưu tiên so sánh các mã cùng ngành để kết quả có ý nghĩa hơn."
        />

        <div className="glass-card mx-auto max-w-3xl p-8 text-center">
          <Scale className="mx-auto mb-5 h-16 w-16 text-emerald-300/70" />
          <h2 className="text-2xl font-black text-slate-100">Chọn mã để so sánh</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Chọn 2-5 cổ phiếu cùng ngành để đặt các chỉ số tài chính cạnh nhau và đánh giá tương quan.</p>
          <div className="mx-auto mt-5 max-w-xl rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-left text-sm leading-6 text-amber-50/85">
            <AlertCircle className="mr-2 inline h-4 w-4 text-amber-300" />
            So sánh khác ngành chỉ mang tính tham khảo, vì cấu trúc tài chính và biên lợi nhuận có thể khác biệt đáng kể giữa các nhóm doanh nghiệp.
          </div>

          <div className="relative mx-auto mt-8 max-w-md">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Nhập mã hoặc tên doanh nghiệp..."
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
            <p className="text-sm text-slate-500">Nhóm cùng ngành</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTED_COMPARISONS.map((suggestion) => (
                <button
                  key={suggestion.tickers}
                  className="btn-outline px-3 py-2 text-sm"
                  onClick={() => setSearchParams({ tickers: suggestion.tickers })}
                >
                  {suggestion.label} · {suggestion.tickers.replaceAll(',', ' · ')}
                </button>
              ))}
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
          {(multipleCompanyTypes || multipleIndustries) && <IndustryWarning hasMultipleCompanyTypes={multipleCompanyTypes} />}

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
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">{companyTypeLabel(company)}</Badge>
                    <Badge variant="outline">{company.industry || 'Không có ngành'}</Badge>
                  </div>

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

          <section className="grid gap-6 lg:grid-cols-2">
            <ChartPanel title="Radar điểm chuẩn hóa" icon={<Activity className="h-5 w-5 text-emerald-300" />}>
              {radarHasData ? (
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart
                    data={radarData}
                    cx="50%"
                    cy="49%"
                    outerRadius="67%"
                    margin={{ top: 28, right: 72, bottom: 28, left: 72 }}
                  >
                    <PolarGrid stroke="rgba(255,255,255,0.12)" radialLines />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#c6c6cd', fontSize: 12 }} />
                    <PolarRadiusAxis
                      angle={90}
                      axisLine={false}
                      domain={[0, 100]}
                      tick={{ fill: '#909097', fontSize: 11 }}
                      tickCount={5}
                      tickLine={false}
                    />
                    {companies.map((company, idx) => (
                      <Radar
                        key={company.ticker}
                        name={company.ticker}
                        dataKey={chartSeriesKey(idx)}
                        stroke={COLORS[idx]}
                        fill={COLORS[idx]}
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${Number(value).toFixed(0)}/100`} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="Không đủ dữ liệu chỉ số để vẽ radar điểm chuẩn hóa." />
              )}
            </ChartPanel>

            <ChartPanel title="Điểm theo nhóm tiêu chí" icon={<BarChart3 className="h-5 w-5 text-emerald-300" />}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: '#c6c6cd' }} />
                  <YAxis tick={{ fill: '#c6c6cd' }} domain={[0, 100]} />
                  {companies.map((company, idx) => (
                    <Bar key={company.ticker} name={company.ticker} dataKey={chartSeriesKey(idx)} fill={COLORS[idx]} radius={[4, 4, 0, 0]} />
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
                  <MetricRow metric="pe_ratio" companies={companies} {...metricTooltipProps} />
                  <MetricRow metric="pb_ratio" companies={companies} {...metricTooltipProps} />
                  <GroupRow label="Sinh lời" colSpan={companies.length + 1} />
                  <MetricRow metric="roe" companies={companies} {...metricTooltipProps} />
                  <MetricRow metric="roa" companies={companies} {...metricTooltipProps} />
                  <MetricRow metric="gross_margin" companies={companies} {...metricTooltipProps} />
                  <MetricRow metric="net_margin" companies={companies} {...metricTooltipProps} />
                  <GroupRow label="Sức khỏe tài chính" colSpan={companies.length + 1} />
                  <MetricRow metric="debt_to_equity" companies={companies} {...metricTooltipProps} />
                  <MetricRow metric="current_ratio" companies={companies} {...metricTooltipProps} />
                  <GroupRow label="Tăng trưởng" colSpan={companies.length + 1} />
                  <MetricRow metric="revenue_growth" companies={companies} {...metricTooltipProps} />
                  <MetricRow metric="profit_growth" companies={companies} {...metricTooltipProps} />
                </tbody>
              </table>
            </div>
          </section>

          <ComparisonConclusion scores={comparisonScores} />

          <MetricMeaningTooltip tooltip={metricTooltip} />
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

function MetricMeaningTooltip({ tooltip }) {
  if (!tooltip) return null

  return (
    <div
      className="pointer-events-none fixed w-80 rounded-xl border border-white/10 bg-[#191c1e] p-3 text-xs leading-5 text-slate-300 shadow-2xl"
      style={{ left: tooltip.x, top: tooltip.y, zIndex: 80 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <Info className="h-3.5 w-3.5 text-emerald-300" />
        <span className="text-sm font-black text-slate-100">{tooltip.title}</span>
      </div>
      <p className="font-semibold text-slate-400">{tooltip.description}</p>
      <p className="mt-2">{tooltip.meaning}</p>
    </div>
  )
}

function PageIntro({ title, description }) {
  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-black leading-tight text-slate-100 md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-4xl text-base leading-7 text-slate-400">{description}</p>
    </div>
  )
}

function IndustryWarning({ hasMultipleCompanyTypes }) {
  return (
    <div className="alert-warning flex items-start gap-3 text-sm leading-6">
      <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
      <p>
        {hasMultipleCompanyTypes
          ? 'Các mã đang thuộc nhiều loại hình báo cáo khác nhau. Điểm 0-100 đã được quy đổi theo benchmark riêng cho doanh nghiệp, ngân hàng, bảo hiểm và chứng khoán trước khi so sánh.'
          : 'Các mã đang thuộc nhiều ngành khác nhau. Điểm 0-100 được chuẩn hóa theo loại hình báo cáo, nhưng vẫn nên đọc kèm bối cảnh ngành khi ra quyết định.'}
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
          Mỗi tiêu chí được chấm theo benchmark riêng của từng loại hình báo cáo trước khi quy về thang 0-100.
        </p>
      </div>

      <div className="panel-body space-y-4">
        {leader && (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4">
            <p className="text-sm font-bold text-emerald-300">Mã nổi bật nhất trong nhóm hiện tại</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              {leader.company.ticker} đang có điểm so sánh tổng hợp cao nhất với {leader.total}/100. Điểm này phản ánh định giá, sinh lời, sức khỏe tài chính và tăng trưởng sau khi chuẩn hóa theo loại hình báo cáo của từng mã.
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
          Điểm này chỉ dùng để tham khảo nhanh chất lượng chỉ số theo thang chuẩn hóa, không phải khuyến nghị mua bán.
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

function EmptyChartState({ message }) {
  return (
    <div className="flex h-[350px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] px-6 text-center text-sm font-semibold text-slate-400">
      {message}
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
