import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Filter,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  X,
  ChevronDown,
  RotateCcw,
  Download,
  Star,
  Eye,
  AlertTriangle,
  Scale,
  Percent,
  DollarSign,
  Building2,
  RefreshCw,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Badge, SkeletonTable } from '../components/ui'
import { cn } from '../utils/helpers'
import api from '../services/api'
import DynamicScreenerPanel from '../components/screener/DynamicScreenerPanel'

const fallbackTickerGroups = [
  { code: 'bank', label: 'Ngan hang', tickers: [] },
  { code: 'securities', label: 'Chung khoan', tickers: [] },
  { code: 'insurance', label: 'Bao hiem', tickers: [] },
  { code: 'corporate', label: 'Doanh nghiep', tickers: [] },
]

// Preset strategies
const presetFilters = [
  {
    id: 'value',
    name: 'Value Investing',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-600',
    desc: 'P/E < 15, P/B < 1.5, ROE > 15%',
    filters: { max_pe: 15, max_pb: 1.5, min_roe: 15 }
  },
  {
    id: 'growth',
    name: 'Tăng trưởng',
    icon: TrendingUp,
    color: 'from-blue-500 to-cyan-600',
    desc: 'Tăng trưởng doanh thu & LN > 15%',
    filters: { min_revenue_growth: 15, min_profit_growth: 15, min_roe: 10 }
  },
  {
    id: 'dividend',
    name: 'Cổ tức cao',
    icon: Percent,
    color: 'from-purple-500 to-pink-600',
    desc: 'Dividend Yield > 5%, D/E < 1',
    filters: { min_dividend_yield: 5, max_de: 1 }
  },
  {
    id: 'quality',
    name: 'Chất lượng cao',
    icon: Star,
    color: 'from-yellow-500 to-orange-600',
    desc: 'ROE > 20%, D/E < 0.5, F-Score ≥ 7',
    filters: { min_roe: 20, max_de: 0.5, min_f_score: 7 }
  },
  {
    id: 'undervalued',
    name: 'Co phieu gia tri',
    icon: Scale,
    color: 'from-teal-500 to-green-600',
    desc: 'P/E < 10, P/B < 1',
    filters: { max_pe: 10, max_pb: 1 }
  },
  {
    id: 'strong_financial',
    name: 'Tài chính vững',
    icon: Building2,
    color: 'from-indigo-500 to-blue-600',
    desc: 'Current Ratio > 1.5, D/E < 0.5',
    filters: { min_current_ratio: 1.5, max_de: 0.5, min_roa: 8 }
  },
]

const initialFilters = {
  search: '',
  ticker_group: '',
  min_pe: '',
  max_pe: '',
  min_pb: '',
  max_pb: '',
  min_roe: '',
  max_roe: '',
  min_roa: '',
  max_de: '',
  min_current_ratio: '',
  min_gross_margin: '',
  min_net_margin: '',
  min_revenue_growth: '',
  min_profit_growth: '',
  min_f_score: '',
}

// Health Score badge component
const HealthScoreBadge = ({ score }) => {
  if (score === null || score === undefined) return <span className="text-gray-500">-</span>
  
  let color = 'bg-gray-500'
  if (score >= 8) color = 'bg-green-500'
  else if (score >= 6) color = 'bg-blue-500'
  else if (score >= 4) color = 'bg-yellow-500'
  else if (score >= 2) color = 'bg-orange-500'
  else color = 'bg-red-500'
  
  return (
    <span className={`${color} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
      {score}/9
    </span>
  )
}

// Ratio display with color coding
const RatioValue = ({ value, type, inverse = false }) => {
  if (value === null || value === undefined || isNaN(value)) {
    return <span className="text-gray-500">-</span>
  }
  
  let colorClass = 'text-white'
  
  switch(type) {
    case 'pe':
      if (value < 10) colorClass = 'text-green-400'
      else if (value < 15) colorClass = 'text-blue-400'
      else if (value < 25) colorClass = 'text-yellow-400'
      else colorClass = 'text-red-400'
      break
    case 'pb':
      if (value < 1) colorClass = 'text-green-400'
      else if (value < 2) colorClass = 'text-blue-400'
      else if (value < 3) colorClass = 'text-yellow-400'
      else colorClass = 'text-red-400'
      break
    case 'roe':
    case 'roa':
    case 'margin':
      if (value >= 20) colorClass = 'text-green-400'
      else if (value >= 15) colorClass = 'text-blue-400'
      else if (value >= 10) colorClass = 'text-yellow-400'
      else if (value > 0) colorClass = 'text-orange-400'
      else colorClass = 'text-red-400'
      break
    case 'de':
      if (value < 0.5) colorClass = 'text-green-400'
      else if (value < 1) colorClass = 'text-blue-400'
      else if (value < 2) colorClass = 'text-yellow-400'
      else colorClass = 'text-red-400'
      break
    case 'growth':
      if (value >= 20) colorClass = 'text-green-400'
      else if (value >= 10) colorClass = 'text-blue-400'
      else if (value >= 0) colorClass = 'text-yellow-400'
      else colorClass = 'text-red-400'
      break
  }
  
  return <span className={colorClass}>{value.toFixed(1)}</span>
}

export default function Screener() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(initialFilters)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: 'market_cap', direction: 'desc' })
  const [selectedStocks, setSelectedStocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [stocks, setStocks] = useState([])
  const [activePreset, setActivePreset] = useState(null)
  const [error, setError] = useState(null)
  const [dynamicPayload, setDynamicPayload] = useState([])
  const [dynamicNotice, setDynamicNotice] = useState('')
  const [tickerGroups, setTickerGroups] = useState([])

  const groupOptions = useMemo(() => {
    const groups = tickerGroups.length ? tickerGroups : fallbackTickerGroups
    return [
      { value: '', label: 'Tat ca ma nganh' },
      ...groups.map((group) => ({
        value: group.code,
        label: group.label,
      })),
    ]
  }, [tickerGroups])

  const tickerToGroupCode = useMemo(() => {
    const map = {}
    const groups = tickerGroups.length ? tickerGroups : fallbackTickerGroups
    groups.forEach((group) => {
      ;(group.tickers || []).forEach((ticker) => {
        map[String(ticker).toUpperCase()] = group.code
      })
    })
    return map
  }, [tickerGroups])

  // Fetch stocks with filters
  const fetchStocks = async (filterParams = {}, activeDynamicPayload = []) => {
    setLoading(true)
    setError(null)
    
    try {
      // Build query params
      const params = new URLSearchParams()
      
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value)
        }
      })

      if (activeDynamicPayload.length > 0) {
        params.append('dynamic_filters', JSON.stringify(activeDynamicPayload))
      }
      
      params.append('sort_by', sortConfig.key)
      params.append('sort_order', sortConfig.direction)
      params.append('limit', '100')
      
      const response = await api.get(`/screener/advanced?${params.toString()}`)
      // Note: api interceptor returns response.data directly
      // /screener/advanced returns {total, limit, filters_applied, results}
      setStocks(response.results || [])
    } catch (err) {
      console.error('Error fetching stocks:', err)
      setError('Không thể tải dữ liệu. Vui lòng thử lại.')
      // Fallback to basic endpoint
      try {
        const response = await api.get('/companies')
        // Note: api interceptor returns response.data directly
        setStocks(Array.isArray(response) ? response : [])
      } catch (e) {
        setStocks([])
      }
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchStocks()
  }, [])

  useEffect(() => {
    const fetchTickerGroups = async () => {
      try {
        const payload = await api.get('/ticker-groups?limit=4')
        setTickerGroups(Array.isArray(payload) ? payload : [])
      } catch (groupError) {
        console.error('Error fetching ticker groups:', groupError)
        setTickerGroups([])
      }
    }

    fetchTickerGroups()
  }, [])

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setActivePreset(null)
  }

  const buildApiFiltersFromQuickInputs = () => {
    const apiFilters = {}

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && key !== 'search' && key !== 'ticker_group') {
        apiFilters[key] = value
      }
    })

    return apiFilters
  }

  // Apply filters
  const applyFilters = () => {
    const apiFilters = buildApiFiltersFromQuickInputs()
    fetchStocks(apiFilters, dynamicPayload)
  }

  // Apply preset
  const applyPreset = (preset) => {
    setActivePreset(preset.id)
    setFilters({ ...initialFilters, ...preset.filters })
    setDynamicPayload([])
    setDynamicNotice('')
    fetchStocks(preset.filters)
  }

  // Reset filters
  const resetFilters = () => {
    setFilters(initialFilters)
    setActivePreset(null)
    setDynamicPayload([])
    setDynamicNotice('')
    fetchStocks()
  }

  // Sort handler
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }))
  }

  // Client-side search filter
  const filteredStocks = useMemo(() => {
    const selectedGroupCode = filters.ticker_group
    const selectedGroup = (tickerGroups.length ? tickerGroups : fallbackTickerGroups).find(
      (group) => group.code === selectedGroupCode
    )

    const allowedTickers = selectedGroup
      ? new Set((selectedGroup.tickers || []).map((ticker) => String(ticker).toUpperCase()))
      : null

    return stocks.filter((stock) => {
      const ticker = String(stock.ticker || '').toUpperCase()

      if (allowedTickers && !allowedTickers.has(ticker)) {
        return false
      }

      if (!filters.search) {
        return true
      }

      const search = filters.search.toLowerCase()
      return stock.ticker?.toLowerCase().includes(search) || stock.name?.toLowerCase().includes(search)
    })
  }, [stocks, filters.search, filters.ticker_group, tickerGroups])

  // Export to CSV
  const handleExport = () => {
    if (filteredStocks.length === 0) return
    
    const headers = ['Mã CK', 'Tên công ty', 'Mã ngành', 'Giá', 'Vốn hóa', 'P/E', 'P/B', 'ROE', 'ROA', 'D/E', 'F-Score']
    const rows = filteredStocks.map(s => [
      s.ticker,
      s.name,
      tickerToGroupCode[String(s.ticker || '').toUpperCase()] || 'N/A',
      s.price,
      s.market_cap,
      s.pe_ratio,
      s.pb_ratio,
      s.roe,
      s.roa,
      s.debt_to_equity,
      s.f_score
    ])
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `stock_screener_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Compare selected stocks
  const handleCompare = () => {
    if (selectedStocks.length >= 2) {
      navigate(`/compare?tickers=${selectedStocks.join(',')}`)
    }
  }

  // Toggle stock selection
  const toggleStockSelection = (ticker) => {
    setSelectedStocks(prev =>
      prev.includes(ticker)
        ? prev.filter(t => t !== ticker)
        : prev.length < 5 ? [...prev, ticker] : prev
    )
  }

  const pushDynamicPayloadToApi = async (payload, queryParams) => {
    if (!payload || payload.length === 0) {
      return
    }

    try {
      await api.post('/screener', {
        dynamic_filters: payload,
        mapped_filters: queryParams,
      })
    } catch (postError) {
      console.warn('Dynamic payload endpoint chưa xử lý đầy đủ:', postError)
    }
  }

  const handleDynamicApply = async ({ payload, queryParams }) => {
    setActivePreset(null)
    setDynamicPayload(payload)
    setDynamicNotice(`Đã tạo payload ${payload.length} điều kiện và gửi API lọc.`)

    const mergedFilters = {
      ...buildApiFiltersFromQuickInputs(),
      ...queryParams,
    }

    await pushDynamicPayloadToApi(payload, queryParams)
    fetchStocks(mergedFilters, payload)
  }

  const handleDynamicSave = async ({ payload, queryParams }) => {
    setDynamicPayload(payload)

    const saveSnapshot = {
      savedAt: new Date().toISOString(),
      payload,
      queryParams,
    }

    localStorage.setItem('dynamic_screener_snapshot', JSON.stringify(saveSnapshot))
    await pushDynamicPayloadToApi(payload, queryParams)
    setDynamicNotice(`Đã lưu ${payload.length} điều kiện lọc động.`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Bộ lọc cổ phiếu</h1>
          <p className="text-gray-400 mt-1">Tìm kiếm cổ phiếu phù hợp với chiến lược đầu tư của bạn</p>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedStocks.length >= 2 && (
            <Button
              onClick={handleCompare}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Scale className="w-4 h-4 mr-2" />
              So sánh ({selectedStocks.length})
            </Button>
          )}
          <Button
            onClick={handleExport}
            variant="outline"
            disabled={filteredStocks.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Xuất CSV
          </Button>
        </div>
      </div>

      {/* Preset Strategies */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {presetFilters.map((preset) => {
          const Icon = preset.icon
          return (
            <motion.button
              key={preset.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => applyPreset(preset)}
              className={cn(
                'relative overflow-hidden rounded-xl p-4 text-left transition-all',
                'border border-white/10 backdrop-blur-sm',
                activePreset === preset.id
                  ? `bg-gradient-to-br ${preset.color} border-transparent shadow-lg`
                  : 'bg-white/5 hover:bg-white/10'
              )}
            >
              <Icon className="w-6 h-6 mb-2 text-white" />
              <h3 className="font-semibold text-white text-sm">{preset.name}</h3>
              <p className="text-xs text-white/70 mt-1 line-clamp-2">{preset.desc}</p>
              {activePreset === preset.id && (
                <motion.div
                  layoutId="activePreset"
                  className="absolute inset-0 border-2 border-white/30 rounded-xl"
                />
              )}
            </motion.button>
          )
        })}
      </div>

      <DynamicScreenerPanel
        onApplyFilters={handleDynamicApply}
        onSaveFilters={handleDynamicSave}
      />

      {dynamicNotice && (
        <p className="text-xs text-cyan-300">{dynamicNotice}</p>
      )}

      {/* Search & Quick Filters */}
      <Card className="bg-white/5 border-white/10 relative z-20">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end relative">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-400 mb-1 block">Tìm kiếm</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Mã CK hoặc tên công ty..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 bg-white/5 border-white/20"
                />
              </div>
            </div>

            {/* Ticker Group */}
            <div className="w-48">
              <label className="text-sm text-gray-400 mb-1 block">Mã ngành</label>
              <Select
                value={filters.ticker_group}
                onChange={(e) => handleFilterChange('ticker_group', e.target.value)}
                options={groupOptions}
                className="bg-white/5 border-white/20"
              />
            </div>

            {/* Quick filters */}
            <div className="w-32">
              <label className="text-sm text-gray-400 mb-1 block">P/E tối đa</label>
              <Input
                type="number"
                placeholder="Vd: 15"
                value={filters.max_pe}
                onChange={(e) => handleFilterChange('max_pe', e.target.value)}
                className="bg-white/5 border-white/20"
              />
            </div>

            <div className="w-32">
              <label className="text-sm text-gray-400 mb-1 block">ROE tối thiểu</label>
              <Input
                type="number"
                placeholder="Vd: 15"
                value={filters.min_roe}
                onChange={(e) => handleFilterChange('min_roe', e.target.value)}
                className="bg-white/5 border-white/20"
              />
            </div>

            {/* Toggle advanced */}
            <Button
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-cyan-400"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              {showAdvanced ? 'Ẩn nâng cao' : 'Bộ lọc nâng cao'}
              <ChevronDown className={cn('w-4 h-4 ml-1 transition-transform', showAdvanced && 'rotate-180')} />
            </Button>

            {/* Action buttons */}
            <Button onClick={applyFilters} className="bg-cyan-600 hover:bg-cyan-700">
              <Filter className="w-4 h-4 mr-2" />
              Lọc
            </Button>

            <Button variant="outline" onClick={resetFilters}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-white/10 mt-4 pt-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Bộ lọc nâng cao</h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {/* Market ratios */}
                    <div>
                      <label className="text-xs text-gray-500">P/B tối đa</label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Vd: 2"
                        value={filters.max_pb}
                        onChange={(e) => handleFilterChange('max_pb', e.target.value)}
                        className="bg-white/5 border-white/20 text-sm"
                      />
                    </div>

                    {/* Profitability */}
                    <div>
                      <label className="text-xs text-gray-500">ROA tối thiểu (%)</label>
                      <Input
                        type="number"
                        placeholder="Vd: 8"
                        value={filters.min_roa}
                        onChange={(e) => handleFilterChange('min_roa', e.target.value)}
                        className="bg-white/5 border-white/20 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">Biên LN gộp (%)</label>
                      <Input
                        type="number"
                        placeholder="Vd: 20"
                        value={filters.min_gross_margin}
                        onChange={(e) => handleFilterChange('min_gross_margin', e.target.value)}
                        className="bg-white/5 border-white/20 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">Biên LN ròng (%)</label>
                      <Input
                        type="number"
                        placeholder="Vd: 10"
                        value={filters.min_net_margin}
                        onChange={(e) => handleFilterChange('min_net_margin', e.target.value)}
                        className="bg-white/5 border-white/20 text-sm"
                      />
                    </div>

                    {/* Financial health */}
                    <div>
                      <label className="text-xs text-gray-500">D/E tối đa</label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Vd: 1"
                        value={filters.max_de}
                        onChange={(e) => handleFilterChange('max_de', e.target.value)}
                        className="bg-white/5 border-white/20 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">Current Ratio min</label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Vd: 1.5"
                        value={filters.min_current_ratio}
                        onChange={(e) => handleFilterChange('min_current_ratio', e.target.value)}
                        className="bg-white/5 border-white/20 text-sm"
                      />
                    </div>

                    {/* Growth */}
                    <div>
                      <label className="text-xs text-gray-500">TT Doanh thu (%)</label>
                      <Input
                        type="number"
                        placeholder="Vd: 10"
                        value={filters.min_revenue_growth}
                        onChange={(e) => handleFilterChange('min_revenue_growth', e.target.value)}
                        className="bg-white/5 border-white/20 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">TT Lợi nhuận (%)</label>
                      <Input
                        type="number"
                        placeholder="Vd: 15"
                        value={filters.min_profit_growth}
                        onChange={(e) => handleFilterChange('min_profit_growth', e.target.value)}
                        className="bg-white/5 border-white/20 text-sm"
                      />
                    </div>

                    {/* F-Score */}
                    <div>
                      <label className="text-xs text-gray-500">F-Score tối thiểu</label>
                      <Input
                        type="number"
                        min="0"
                        max="9"
                        placeholder="0-9"
                        value={filters.min_f_score}
                        onChange={(e) => handleFilterChange('min_f_score', e.target.value)}
                        className="bg-white/5 border-white/20 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Kết quả</CardTitle>
            <p className="text-sm text-gray-400">
              Tìm thấy {filteredStocks.length} cổ phiếu
              {activePreset && ` (Chiến lược: ${presetFilters.find(p => p.id === activePreset)?.name})`}
            </p>
          </div>
          
          {selectedStocks.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Đã chọn: {selectedStocks.join(', ')}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStocks([])}
                className="text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <SkeletonTable rows={10} cols={12} />
          ) : error ? (
            <div className="p-8 text-center text-red-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{error}</p>
              <Button onClick={() => fetchStocks()} className="mt-4" variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Thử lại
              </Button>
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Không tìm thấy cổ phiếu phù hợp với tiêu chí</p>
              <Button onClick={resetFilters} className="mt-4" variant="outline">
                Reset bộ lọc
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="p-3 text-gray-400 font-medium w-8">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStocks(filteredStocks.slice(0, 5).map(s => s.ticker))
                          } else {
                            setSelectedStocks([])
                          }
                        }}
                        checked={selectedStocks.length > 0}
                        className="rounded bg-white/10 border-white/30"
                      />
                    </th>
                    <th className="p-3 text-gray-400 font-medium">Mã CK</th>
                    <th className="p-3 text-gray-400 font-medium">Mã ngành</th>
                    <th className="p-3 text-gray-400 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('price')}>
                      Giá {sortConfig.key === 'price' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-gray-400 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('market_cap')}>
                      Vốn hóa {sortConfig.key === 'market_cap' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-gray-400 font-medium text-center cursor-pointer hover:text-white" onClick={() => handleSort('pe_ratio')}>
                      P/E {sortConfig.key === 'pe_ratio' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-gray-400 font-medium text-center cursor-pointer hover:text-white" onClick={() => handleSort('pb_ratio')}>
                      P/B {sortConfig.key === 'pb_ratio' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-gray-400 font-medium text-center cursor-pointer hover:text-white" onClick={() => handleSort('roe')}>
                      ROE {sortConfig.key === 'roe' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-gray-400 font-medium text-center cursor-pointer hover:text-white" onClick={() => handleSort('debt_to_equity')}>
                      D/E {sortConfig.key === 'debt_to_equity' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-gray-400 font-medium text-center cursor-pointer hover:text-white" onClick={() => handleSort('gross_margin')}>
                      GM% {sortConfig.key === 'gross_margin' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-gray-400 font-medium text-center cursor-pointer hover:text-white" onClick={() => handleSort('revenue_growth')}>
                      TT DT% {sortConfig.key === 'revenue_growth' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-gray-400 font-medium text-center">F-Score</th>
                    <th className="p-3 text-gray-400 font-medium text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map((stock, idx) => (
                    <motion.tr
                      key={stock.ticker}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className={cn(
                        'border-b border-white/5 hover:bg-white/5 transition-colors',
                        selectedStocks.includes(stock.ticker) && 'bg-cyan-500/10'
                      )}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedStocks.includes(stock.ticker)}
                          onChange={() => toggleStockSelection(stock.ticker)}
                          className="rounded bg-white/10 border-white/30"
                        />
                      </td>
                      <td className="p-3">
                        <Link to={`/company/${stock.ticker}`} className="flex items-center gap-2 group">
                          <span className="font-bold text-cyan-400 group-hover:text-cyan-300">
                            {stock.ticker}
                          </span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <span className="text-xs text-gray-500 line-clamp-1">{stock.name}</span>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {tickerToGroupCode[String(stock.ticker || '').toUpperCase()] || 'N/A'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-white">
                        {stock.price ? `${stock.price.toLocaleString()}đ` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono text-white">
                        {stock.market_cap ? `${(stock.market_cap / 1e9).toFixed(0)}B` : '-'}
                      </td>
                      <td className="p-3 text-center font-mono">
                        <RatioValue value={stock.pe_ratio} type="pe" />
                      </td>
                      <td className="p-3 text-center font-mono">
                        <RatioValue value={stock.pb_ratio} type="pb" />
                      </td>
                      <td className="p-3 text-center font-mono">
                        <RatioValue value={stock.roe} type="roe" />%
                      </td>
                      <td className="p-3 text-center font-mono">
                        <RatioValue value={stock.debt_to_equity} type="de" />
                      </td>
                      <td className="p-3 text-center font-mono">
                        <RatioValue value={stock.gross_margin} type="margin" />%
                      </td>
                      <td className="p-3 text-center font-mono">
                        <RatioValue value={stock.revenue_growth} type="growth" />%
                      </td>
                      <td className="p-3 text-center">
                        <HealthScoreBadge score={stock.f_score} />
                      </td>
                      <td className="p-3 text-center">
                        <Link to={`/company/${stock.ticker}`}>
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Chú thích màu sắc</h4>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold">■</span>
              <span className="text-gray-400">Tốt / Rẻ</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400 font-bold">■</span>
              <span className="text-gray-400">Khá</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 font-bold">■</span>
              <span className="text-gray-400">Trung bình</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-400 font-bold">■</span>
              <span className="text-gray-400">Cần xem xét</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400 font-bold">■</span>
              <span className="text-gray-400">Rủi ro / Đắt</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
