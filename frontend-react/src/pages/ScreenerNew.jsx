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
import StarButton from '../components/StarButton'



// Presets removed as per request

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
  if (score === null || score === undefined) return <span className="text-slate-500">-</span>
  
  let color = 'bg-slate-500'
  if (score >= 8) color = 'bg-green-500'
  else if (score >= 6) color = 'bg-blue-500'
  else if (score >= 4) color = 'bg-yellow-500'
  else if (score >= 2) color = 'bg-orange-500'
  else color = 'bg-red-500'
  
  return (
    <span className={`${color} text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full`}>
      {score}/9
    </span>
  )
}

// Ratio display with color coding
const RatioValue = ({ value, type, inverse = false }) => {
  if (value === null || value === undefined || isNaN(value)) {
    return <span className="text-slate-500">-</span>
  }
  
  let colorClass = 'text-slate-900'
  
  switch(type) {
    case 'pe':
      if (value < 10) colorClass = 'text-success-600'
      else if (value < 15) colorClass = 'text-primary-600'
      else if (value < 25) colorClass = 'text-warning-600'
      else colorClass = 'text-danger-600'
      break
    case 'pb':
      if (value < 1) colorClass = 'text-success-600'
      else if (value < 2) colorClass = 'text-primary-600'
      else if (value < 3) colorClass = 'text-warning-600'
      else colorClass = 'text-danger-600'
      break
    case 'roe':
    case 'roa':
    case 'margin':
      if (value >= 20) colorClass = 'text-success-600'
      else if (value >= 15) colorClass = 'text-primary-600'
      else if (value >= 10) colorClass = 'text-warning-600'
      else if (value > 0) colorClass = 'text-orange-400'
      else colorClass = 'text-danger-600'
      break
    case 'de':
      if (value < 0.5) colorClass = 'text-success-600'
      else if (value < 1) colorClass = 'text-primary-600'
      else if (value < 2) colorClass = 'text-warning-600'
      else colorClass = 'text-danger-600'
      break
    case 'growth':
      if (value >= 20) colorClass = 'text-success-600'
      else if (value >= 10) colorClass = 'text-primary-600'
      else if (value >= 0) colorClass = 'text-warning-600'
      else colorClass = 'text-danger-600'
      break
  }
  
  return <span className={colorClass}>{value.toFixed(1)}</span>
}

export default function Screener() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(initialFilters)
  const [sortConfig, setSortConfig] = useState({ key: 'market_cap', direction: 'desc' })
  const [selectedStocks, setSelectedStocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [stocks, setStocks] = useState([])
  const [error, setError] = useState(null)
  const [dynamicPayload, setDynamicPayload] = useState([])
  const [dynamicNotice, setDynamicNotice] = useState('')
  const groupOptions = useMemo(() => {
    const industries = [...new Set(stocks.map(s => s.industry).filter(Boolean))]
    industries.sort()
    return [
      { value: '', label: 'Tất cả mã ngành' },
      ...industries.map((ind) => ({
        value: ind,
        label: ind,
      })),
    ]
  }, [stocks])

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
      params.append('limit', '2000') // fetch all up to 2000
      
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



  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
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



  // Reset filters
  const resetFilters = () => {
    setFilters(initialFilters)
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
    let result = stocks.filter((stock) => {
      if (filters.ticker_group && stock.industry !== filters.ticker_group) {
        return false
      }

      if (!filters.search) {
        return true
      }

      const search = filters.search.toLowerCase()
      return stock.ticker?.toLowerCase().includes(search) || stock.name?.toLowerCase().includes(search)
    })
    
    // Sort local result
    result.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? 0
      const bVal = b[sortConfig.key] ?? 0
      if (aVal === bVal) return 0;
      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    })
    
    return result
  }, [stocks, filters.search, filters.ticker_group, sortConfig])

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
          <h1 className="text-3xl font-bold text-slate-900">Bộ lọc cổ phiếu</h1>
          <p className="text-slate-600 mt-1">Tìm kiếm cổ phiếu phù hợp với chiến lược đầu tư của bạn</p>
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
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Top bar: Quick Filters */}
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Mã CK hoặc tên công ty..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-primary-500/20"
              />
            </div>
          </div>

          {/* Ticker Group */}
          <div className="w-48">
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Mã ngành</label>
            <Select
              value={filters.ticker_group}
              onChange={(e) => handleFilterChange('ticker_group', e.target.value)}
              options={groupOptions}
              className="bg-white border-slate-200 text-slate-900 focus:border-primary-500 focus:ring-primary-500/20"
            />
          </div>

          <Button onClick={applyFilters} className="bg-primary-600 hover:bg-primary-700 text-white shadow-sm">
            <Filter className="w-4 h-4 mr-2" />
            Lọc
          </Button>

          <Button variant="outline" onClick={resetFilters} className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Dynamic Panel */}
        <div className="p-4 sm:p-6">
          <DynamicScreenerPanel
            onApplyFilters={handleDynamicApply}
            onSaveFilters={handleDynamicSave}
          />
          {dynamicNotice && (
            <p className="mt-3 text-xs text-primary-700 font-medium">{dynamicNotice}</p>
          )}
        </div>
      </Card>

      {/* Results */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <div>
            <CardTitle className="text-slate-900">Kết quả</CardTitle>
            <p className="text-sm text-slate-600">
              Tìm thấy {filteredStocks.length} cổ phiếu
            </p>
          </div>
          
          {selectedStocks.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Đã chọn: {selectedStocks.join(', ')}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStocks([])}
                className="text-danger-600 hover:text-danger-600"
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
            <div className="p-8 text-center text-danger-600">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{error}</p>
              <Button onClick={() => fetchStocks()} className="mt-4" variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Thử lại
              </Button>
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="p-8 text-center text-slate-600">
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
                  <tr className="border-b border-slate-200 text-left">
                    <th className="p-3 text-slate-600 font-medium w-8">
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
                        className="rounded bg-slate-50 border-white/30"
                      />
                    </th>
                    <th className="p-3 text-slate-600 font-medium">Mã CK</th>
                    <th className="p-3 text-slate-600 font-medium text-center">Theo dõi</th>
                    <th className="p-3 text-slate-600 font-medium">Mã ngành</th>
                    <th className="p-3 text-slate-600 font-medium text-right cursor-pointer hover:text-slate-900" onClick={() => handleSort('price')}>
                      Giá {sortConfig.key === 'price' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-slate-600 font-medium text-right cursor-pointer hover:text-slate-900" onClick={() => handleSort('market_cap')}>
                      Vốn hóa {sortConfig.key === 'market_cap' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-slate-600 font-medium text-center cursor-pointer hover:text-slate-900" onClick={() => handleSort('pe_ratio')}>
                      P/E {sortConfig.key === 'pe_ratio' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-slate-600 font-medium text-center cursor-pointer hover:text-slate-900" onClick={() => handleSort('pb_ratio')}>
                      P/B {sortConfig.key === 'pb_ratio' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-slate-600 font-medium text-center cursor-pointer hover:text-slate-900" onClick={() => handleSort('roe')}>
                      ROE {sortConfig.key === 'roe' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-slate-600 font-medium text-center cursor-pointer hover:text-slate-900" onClick={() => handleSort('debt_to_equity')}>
                      D/E {sortConfig.key === 'debt_to_equity' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-slate-600 font-medium text-center cursor-pointer hover:text-slate-900" onClick={() => handleSort('gross_margin')}>
                      GM% {sortConfig.key === 'gross_margin' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-slate-600 font-medium text-center cursor-pointer hover:text-slate-900" onClick={() => handleSort('revenue_growth')}>
                      TT DT% {sortConfig.key === 'revenue_growth' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="p-3 text-slate-600 font-medium text-center">F-Score</th>
                    <th className="p-3 text-slate-600 font-medium text-center">Action</th>
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
                        'border-b border-slate-100 hover:bg-white transition-colors',
                        selectedStocks.includes(stock.ticker) && 'bg-primary-50'
                      )}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedStocks.includes(stock.ticker)}
                          onChange={() => toggleStockSelection(stock.ticker)}
                          className="rounded bg-slate-50 border-white/30"
                        />
                      </td>
                      <td className="p-3">
                        <Link to={`/company/${stock.ticker}`} className="flex items-center gap-2 group">
                          <span className="font-bold text-primary-700 group-hover:text-primary-700">
                            {stock.ticker}
                          </span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <span className="text-xs text-slate-500 line-clamp-1">{stock.name}</span>
                      </td>
                      <td className="p-3 text-center">
                        <StarButton ticker={stock.ticker} />
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {stock.industry || 'N/A'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-900">
                        {stock.price ? `${stock.price.toLocaleString()}đ` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-900">
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
                          <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
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
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Chú thích màu sắc</h4>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-success-600 font-bold">■</span>
              <span className="text-slate-600">Tốt / Rẻ</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary-600 font-bold">■</span>
              <span className="text-slate-600">Khá</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-warning-600 font-bold">■</span>
              <span className="text-slate-600">Trung bình</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-400 font-bold">■</span>
              <span className="text-slate-600">Cần xem xét</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-danger-600 font-bold">■</span>
              <span className="text-slate-600">Rủi ro / Đắt</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
