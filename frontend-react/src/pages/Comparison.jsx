import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Scale,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Download,
  BarChart3,
  Activity,
  Building2,
  Search,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '../components/ui'
import { formatCompact, formatCurrency, formatPercent, formatRatio } from '../utils/formatters'
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

// Colors for each company in comparison
const COLORS = ['#06b6d4', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

// Metric configurations
const METRIC_CONFIGS = {
  pe_ratio: { name: 'P/E', unit: 'x', inverse: true, description: 'Gia tren loi nhuan' },
  pb_ratio: { name: 'P/B', unit: 'x', inverse: true, description: 'Gia tren gia tri so sach' },
  roe: { name: 'ROE', unit: '%', inverse: false, description: 'Ty suat sinh loi tren von chu' },
  roa: { name: 'ROA', unit: '%', inverse: false, description: 'Ty suat sinh loi tren tong tai san' },
  debt_to_equity: { name: 'D/E', unit: 'x', inverse: true, description: 'No tren von chu so huu' },
  current_ratio: { name: 'Thanh toan hien hanh', unit: 'x', inverse: false, description: 'Kha nang thanh toan ngan han' },
  gross_margin: { name: 'Bien LN gop', unit: '%', inverse: false, description: 'Bien loi nhuan gop' },
  net_margin: { name: 'Bien LN rong', unit: '%', inverse: false, description: 'Bien loi nhuan rong' },
  revenue_growth: { name: 'TT Doanh thu', unit: '%', inverse: false, description: 'Tang truong doanh thu theo nam' },
  profit_growth: { name: 'TT Loi nhuan', unit: '%', inverse: false, description: 'Tang truong loi nhuan theo nam' },
}

// Radar chart data transformer
const transformForRadar = (companies) => {
  const metrics = ['roe', 'roa', 'gross_margin', 'net_margin', 'current_ratio']
  
  return metrics.map(metric => {
    const config = METRIC_CONFIGS[metric]
    const dataPoint = { metric: config.name }
    
    companies.forEach(company => {
      // Normalize to 0-100 scale for radar chart
      let value = company.ratios?.[metric] || 0
      // Cap values for better visualization
      value = Math.min(Math.max(value, 0), 50)
      dataPoint[company.ticker] = value
    })
    
    return dataPoint
  })
}

// Get winner for a metric
const getWinner = (companies, metric, inverse = false) => {
  const validCompanies = companies.filter(c => c.ratios?.[metric] != null)
  if (validCompanies.length === 0) return null
  
  if (inverse) {
    return validCompanies.reduce((a, b) => 
      (a.ratios[metric] < b.ratios[metric]) ? a : b
    )
  } else {
    return validCompanies.reduce((a, b) => 
      (a.ratios[metric] > b.ratios[metric]) ? a : b
    )
  }
}

// Metric comparison row
const MetricRow = ({ metric, companies }) => {
  const config = METRIC_CONFIGS[metric]
  const winner = getWinner(companies, metric, config.inverse)
  
  return (
    <tr className="border-b border-slate-100 hover:bg-white">
      <td className="p-3">
        <div>
          <span className="text-slate-900 font-medium">{config.name}</span>
          <p className="text-xs text-slate-500">{config.description}</p>
        </div>
      </td>
      {companies.map((company, idx) => {
        const value = company.ratios?.[metric]
        const isWinner = winner?.ticker === company.ticker
        
        return (
          <td key={company.ticker} className="p-3 text-center">
            <div className={cn(
              'font-mono text-lg',
              isWinner ? 'text-success-600 font-bold' : 'text-slate-900'
            )}>
              {value != null ? (
                <>
                  {value.toFixed(1)}{config.unit}
                  {isWinner && <CheckCircle className="w-4 h-4 inline ml-1" />}
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

  // Get tickers from URL
  const tickers = searchParams.get('tickers')?.split(',').filter(Boolean) || []

  // Fetch comparison data
  useEffect(() => {
    if (tickers.length >= 2) {
      fetchComparison(tickers)
    }
  }, [searchParams])

  const fetchComparison = async (tickerList) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.post('/compare', { tickers: tickerList })
      // Note: api interceptor returns response.data directly, so response IS the data
      setCompanies(response.companies || [])
    } catch (err) {
      console.error('Error fetching comparison:', err)
      setError('Không thể tải dữ liệu so sánh')
      
      // Fallback: fetch individual companies
      try {
        const results = await Promise.all(
          tickerList.map(ticker => api.get(`/analysis/${ticker}/health-score`))
        )
        setCompanies(results.map(r => ({
          ticker: r.ticker,
          name: r.company_name,
          industry: r.industry,
          f_score: r.f_score?.total_score,
          ratios: r.key_ratios,
          price: r.price_info?.current_price,
          market_cap: r.price_info?.market_cap
        })))
      } catch (e) {
        setCompanies([])
      }
    } finally {
      setLoading(false)
    }
  }

  // Search companies
  const handleSearch = async (query) => {
    setSearchQuery(query)
    if (query.length < 1) {
      setSearchResults([])
      return
    }
    
    try {
      const response = await api.get(`/companies/search?q=${query}`)
      // Note: api interceptor returns response.data directly
      setSearchResults(response.results || [])
    } catch (err) {
      setSearchResults([])
    }
  }

  // Add company to comparison
  const addCompany = (ticker) => {
    if (tickers.length >= 5) return
    if (tickers.includes(ticker)) return
    
    const newTickers = [...tickers, ticker]
    setSearchParams({ tickers: newTickers.join(',') })
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  // Remove company from comparison
  const removeCompany = (ticker) => {
    const newTickers = tickers.filter(t => t !== ticker)
    if (newTickers.length >= 2) {
      setSearchParams({ tickers: newTickers.join(',') })
    } else {
      setSearchParams({})
    }
  }

  // Export comparison
  const handleExport = () => {
    if (companies.length === 0) return
    
    const headers = ['Chỉ số', ...companies.map(c => c.ticker)]
    const metrics = Object.keys(METRIC_CONFIGS)
    const rows = metrics.map(metric => {
      const config = METRIC_CONFIGS[metric]
      return [config.name, ...companies.map(c => c.ratios?.[metric] || '')]
    })
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `so_sanh_${tickers.join('_')}.csv`
    link.click()
  }

  // Radar chart data
  const radarData = transformForRadar(companies)

  // Bar chart data for comparison
  const barChartData = [
    { name: 'ROE', ...Object.fromEntries(companies.map(c => [c.ticker, c.ratios?.roe || 0])) },
    { name: 'ROA', ...Object.fromEntries(companies.map(c => [c.ticker, c.ratios?.roa || 0])) },
    { name: 'Biên LN gộp', ...Object.fromEntries(companies.map(c => [c.ticker, c.ratios?.gross_margin || 0])) },
    { name: 'Biên LN ròng', ...Object.fromEntries(companies.map(c => [c.ticker, c.ratios?.net_margin || 0])) },
  ]

  if (tickers.length < 2) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-8 text-center">
            <Scale className="w-16 h-16 mx-auto mb-4 text-primary-700 opacity-50" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">So sánh cổ phiếu</h2>
            <p className="text-slate-600 mb-6">
              Chọn 2-5 mã cổ phiếu để so sánh các chỉ số tài chính
            </p>
            
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
              <Input
                placeholder="Tìm kiếm mã cổ phiếu..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-300 text-lg"
              />
              
              {searchResults.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-white border border-slate-300 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                  {searchResults.map(stock => (
                    <button
                      key={stock.ticker}
                      onClick={() => addCompany(stock.ticker)}
                      className="w-full p-3 text-left hover:bg-slate-50 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-primary-700">{stock.ticker}</span>
                        <span className="text-slate-600 ml-2 text-sm">{stock.name}</span>
                      </div>
                      <Plus className="w-4 h-4 text-slate-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {tickers.length === 1 && (
              <div className="mt-6">
                <Badge className="bg-primary-50 text-primary-700">
                  {tickers[0]} đã chọn - Thêm ít nhất 1 mã nữa
                </Badge>
              </div>
            )}
            
            <div className="mt-8 text-sm text-slate-500">
              <p>Gợi ý so sánh:</p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchParams({ tickers: 'VNM,MSN,VCB' })}
                >
                  VNM vs MSN vs VCB
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchParams({ tickers: 'VIC,VHM' })}
                >
                  VIC vs VHM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchParams({ tickers: 'HPG,HSG' })}
                >
                  HPG vs HSG
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Scale className="w-8 h-8 text-primary-700" />
            So sánh cổ phiếu
          </h1>
          <p className="text-slate-600 mt-1">
            Đang so sánh {companies.length} công ty
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {tickers.length < 5 && (
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowSearch(!showSearch)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Thêm mã
              </Button>
              
              {showSearch && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-300 rounded-lg shadow-xl z-10 p-3">
                  <Input
                    placeholder="Tìm mã cổ phiếu..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="bg-slate-50 border-slate-300"
                    autoFocus
                  />
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto">
                      {searchResults.filter(s => !tickers.includes(s.ticker)).map(stock => (
                        <button
                          key={stock.ticker}
                          onClick={() => addCompany(stock.ticker)}
                          className="w-full p-2 text-left hover:bg-slate-50 rounded flex justify-between items-center"
                        >
                          <span className="font-bold text-primary-700">{stock.ticker}</span>
                          <Plus className="w-4 h-4 text-slate-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <Button onClick={handleExport} variant="outline" disabled={companies.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Xuất CSV
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <Card className="bg-white border-slate-200">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-primary-300 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Đang tải dữ liệu so sánh...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="bg-danger-50 border-danger-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-danger-600" />
              <div>
                <p className="text-danger-600 font-medium">{error}</p>
                <p className="text-sm text-slate-600 mt-1">
                  Vui lòng thử lại hoặc chọn mã khác
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!loading && companies.length === 0 && tickers.length >= 2 && (
        <Card className="bg-white border-slate-200">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-warning-600 opacity-50" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Không có dữ liệu</h3>
            <p className="text-slate-600">
              Không tìm thấy dữ liệu cho các mã: {tickers.join(', ')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content - Only show when we have data */}
      {!loading && companies.length > 0 && (
        <>
      {/* Company Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {companies.map((company, idx) => (
          <motion.div
            key={company.ticker}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="bg-white border-slate-200 relative group">
              <button
                onClick={() => removeCompany(company.ticker)}
                className="absolute top-2 right-2 p-1 rounded-full bg-red-500/20 text-danger-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
              
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[idx] }}
                  />
                  <Link to={`/company/${company.ticker}`}>
                    <span className="text-xl font-bold text-slate-900 hover:text-primary-700">
                      {company.ticker}
                    </span>
                  </Link>
                </div>
                
                <p className="text-sm text-slate-600 mb-2 line-clamp-1">{company.name}</p>
                <Badge variant="outline" className="text-xs mb-3">
                  {company.industry || 'Khong co'}
                </Badge>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Giá</span>
                    <span className="text-slate-900 font-mono">
                      {company.price ? `${company.price.toLocaleString()}đ` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vốn hóa</span>
                    <span className="text-slate-900 font-mono">
                      {company.market_cap ? formatCompact(company.market_cap) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">F-Score</span>
                    <span className={cn(
                      'font-bold',
                      company.f_score >= 7 ? 'text-success-600' :
                      company.f_score >= 5 ? 'text-warning-600' : 'text-danger-600'
                    )}>
                      {company.f_score || '-'}/9
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-700" />
              Biểu đồ Radar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--chart-grid))" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--chart-axis))', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 50]} tick={{ fill: 'hsl(var(--chart-axis))' }} />
                {companies.map((company, idx) => (
                  <Radar
                    key={company.ticker}
                    name={company.ticker}
                    dataKey={company.ticker}
                    stroke={COLORS[idx]}
                    fill={COLORS[idx]}
                    fillOpacity={0.2}
                  />
                ))}
                <Legend />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--chart-tooltip-bg))',
                    border: '1px solid hsl(var(--chart-tooltip-border))',
                    borderRadius: '8px',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-700" />
              So sánh sinh lợi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--chart-axis))' }} />
                <YAxis tick={{ fill: 'hsl(var(--chart-axis))' }} unit="%" />
                {companies.map((company, idx) => (
                  <Bar
                    key={company.ticker}
                    dataKey={company.ticker}
                    fill={COLORS[idx]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
                <Legend />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--chart-tooltip-bg))',
                    border: '1px solid hsl(var(--chart-tooltip-border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => `${value.toFixed(1)}%`}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Comparison Table */}
      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">So sánh chi tiết</CardTitle>
          <p className="text-sm text-slate-600">
            <CheckCircle className="w-4 h-4 inline mr-1 text-success-600" />
            = Tốt nhất trong nhóm
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="p-3 text-left text-slate-600 font-medium">Chỉ số</th>
                  {companies.map((company, idx) => (
                    <th key={company.ticker} className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx] }}
                        />
                        <span className="text-slate-900 font-bold">{company.ticker}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Market Ratios */}
                <tr className="bg-white">
                  <td colSpan={companies.length + 1} className="p-2 text-xs text-primary-700 font-medium">
                    CHI SO THI TRUONG
                  </td>
                </tr>
                <MetricRow metric="pe_ratio" companies={companies} />
                <MetricRow metric="pb_ratio" companies={companies} />
                
                {/* Profitability */}
                <tr className="bg-white">
                  <td colSpan={companies.length + 1} className="p-2 text-xs text-primary-700 font-medium">
                    SINH LỢI
                  </td>
                </tr>
                <MetricRow metric="roe" companies={companies} />
                <MetricRow metric="roa" companies={companies} />
                <MetricRow metric="gross_margin" companies={companies} />
                <MetricRow metric="net_margin" companies={companies} />
                
                {/* Financial Health */}
                <tr className="bg-white">
                  <td colSpan={companies.length + 1} className="p-2 text-xs text-primary-700 font-medium">
                    SỨC KHỎE TÀI CHÍNH
                  </td>
                </tr>
                <MetricRow metric="debt_to_equity" companies={companies} />
                <MetricRow metric="current_ratio" companies={companies} />
                
                {/* Growth */}
                <tr className="bg-white">
                  <td colSpan={companies.length + 1} className="p-2 text-xs text-primary-700 font-medium">
                    TĂNG TRƯỞNG
                  </td>
                </tr>
                <MetricRow metric="revenue_growth" companies={companies} />
                <MetricRow metric="profit_growth" companies={companies} />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-gradient-to-r from-primary-500/10 to-blue-500/10 border-primary-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">📊 Tóm tắt so sánh</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Best ROE */}
            {getWinner(companies, 'roe') && (
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                <div className="w-10 h-10 rounded-full bg-success-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">ROE cao nhất</p>
                  <p className="font-bold text-slate-900">
                    {getWinner(companies, 'roe').ticker} ({getWinner(companies, 'roe').ratios?.roe?.toFixed(1)}%)
                  </p>
                </div>
              </div>
            )}
            
            {/* Best D/E */}
            {getWinner(companies, 'debt_to_equity', true) && (
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                <div className="w-10 h-10 rounded-full bg-warning-50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-warning-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">D/E thấp nhất</p>
                  <p className="font-bold text-slate-900">
                    {getWinner(companies, 'debt_to_equity', true).ticker} ({getWinner(companies, 'debt_to_equity', true).ratios?.debt_to_equity?.toFixed(2)}x)
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  )
}
