import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  Globe,
  Users,
  DollarSign,
  PieChart,
  BarChart3,
  Wallet,
  Target,
  Shield,
  Zap,
  ExternalLink,
  Download,
  Star,
  Share2,
  ChevronDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Heart,
  TrendingUp as Growth,
  Scale,
  FileText,
  Minus,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Select, StatCard, SkeletonCard } from '../components/ui'
import { 
  RevenueChart, 
  PerformanceChart, 
  CashFlowChart, 
  BalanceSheetChart,
  RatiosChart 
} from '../components/charts/FinancialCharts'
import { formatCurrency, formatPercent, formatRatio, formatCompact, getValueColor } from '../utils/formatters'
import { cn } from '../utils/helpers'
import api from '../services/api'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts'

// F-Score Badge Component
const FScoreBadge = ({ score, showDetails = false }) => {
  const getColor = () => {
    if (score >= 7) return 'bg-green-500/20 text-green-400 border-green-500/30'
    if (score >= 5) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    if (score >= 3) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    return 'bg-red-500/20 text-red-400 border-red-500/30'
  }
  
  const getLabel = () => {
    if (score >= 7) return 'Xuất sắc'
    if (score >= 5) return 'Tốt'
    if (score >= 3) return 'Trung bình'
    return 'Yếu'
  }

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
      getColor()
    )}>
      <span className="font-bold text-lg">{score}/9</span>
      {showDetails && <span className="text-sm">{getLabel()}</span>}
    </div>
  )
}

// Health Score Circle
const HealthScoreCircle = ({ score, size = 'lg' }) => {
  const radius = size === 'lg' ? 60 : 40
  const stroke = size === 'lg' ? 8 : 6
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  
  const getColor = () => {
    if (score >= 70) return '#10b981'
    if (score >= 50) return '#f59e0b'
    if (score >= 30) return '#f97316'
    return '#ef4444'
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className={cn(
        'transform -rotate-90',
        size === 'lg' ? 'w-36 h-36' : 'w-24 h-24'
      )}>
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          stroke="#374151"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          stroke={getColor()}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn(
          'font-bold',
          size === 'lg' ? 'text-3xl' : 'text-xl'
        )} style={{ color: getColor() }}>
          {score}
        </span>
        <span className="text-xs text-gray-400">/100</span>
      </div>
    </div>
  )
}

// Warning Card
const WarningCard = ({ warning }) => {
  const icons = {
    critical: <AlertTriangle className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  }
  
  const colors = {
    critical: 'bg-red-500/10 border-red-500/30',
    warning: 'bg-yellow-500/10 border-yellow-500/30',
    info: 'bg-blue-500/10 border-blue-500/30',
  }

  return (
    <div className={cn(
      'p-3 rounded-lg border flex items-start gap-3',
      colors[warning.severity] || colors.info
    )}>
      {icons[warning.severity] || icons.info}
      <div>
        <p className="font-medium text-white text-sm">{warning.title}</p>
        <p className="text-xs text-gray-400 mt-1">{warning.description}</p>
      </div>
    </div>
  )
}

// Ratio Display
const RatioDisplay = ({ label, value, unit = '', benchmark, inverse = false }) => {
  const getStatus = () => {
    if (value == null || benchmark == null) return 'neutral'
    if (inverse) {
      return value <= benchmark ? 'good' : 'bad'
    }
    return value >= benchmark ? 'good' : 'bad'
  }
  
  const status = getStatus()
  const statusColors = {
    good: 'text-green-400',
    bad: 'text-red-400',
    neutral: 'text-gray-400',
  }

  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={cn('font-mono font-medium', statusColors[status])}>
        {value != null ? `${value.toFixed(1)}${unit}` : '-'}
      </span>
    </div>
  )
}

// F-Score Criteria Row
const FScoreCriteriaRow = ({ name, passed, description }) => {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      {passed ? (
        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
      )}
      <div className="flex-1">
        <span className="text-white text-sm">{name}</span>
        {description && (
          <p className="text-xs text-gray-500">{description}</p>
        )}
      </div>
    </div>
  )
}

export default function CompanyAnalysisNew() {
  const { ticker } = useParams()
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState(null)
  const [healthScore, setHealthScore] = useState(null)
  const [fScore, setFScore] = useState(null)
  const [ratios, setRatios] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [financials, setFinancials] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [viewMode, setViewMode] = useState('annual')
  const [error, setError] = useState(null)

  console.log('CompanyAnalysisNew render:', { ticker, loading, company, error })

  useEffect(() => {
    console.log('useEffect triggered, ticker:', ticker)
    if (ticker) {
      fetchAllData()
    }
  }, [ticker])

  const fetchAllData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch all data in parallel
      const [companyRes, healthRes, ratiosRes, financialsRes] = await Promise.all([
        api.get(`/companies/${ticker}`).catch(e => { console.log('Company error:', e); return null; }),
        api.get(`/analysis/${ticker}/health-score`).catch(e => { console.log('Health error:', e); return null; }),
        api.get(`/analysis/${ticker}/ratios`).catch(e => { console.log('Ratios error:', e); return null; }),
        api.get(`/companies/${ticker}/financials`).catch(e => { console.log('Financials error:', e); return null; }),
      ])
      
      console.log('Company response:', companyRes)
      
      // Response interceptor already returns data, not response.data
      if (companyRes) {
        setCompany(companyRes)
      }
      
      if (healthRes) {
        setHealthScore(healthRes)
        setFScore(healthRes.f_score)
        setWarnings(healthRes.warnings || [])
      }
      
      if (ratiosRes) {
        setRatios(ratiosRes)
      }
      
      if (financialsRes) {
        setFinancials(financialsRes)
      }
      
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Không thể tải dữ liệu công ty')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format = 'csv') => {
    try {
      window.open(`/export/${ticker}?format=${format}`, '_blank')
    } catch (err) {
      console.error('Export error:', err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-8">
        <div className="text-white text-xl">Đang tải dữ liệu cho {ticker}...</div>
        <SkeletonCard className="h-32" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <AlertTriangle className="w-16 h-16 text-yellow-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Không tìm thấy công ty</h2>
        <p className="text-gray-400 mb-4">Mã cổ phiếu "{ticker}" không tồn tại</p>
        <Link to="/screener">
          <Button variant="primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại sàng lọc
          </Button>
        </Link>
      </div>
    )
  }

  // Prepare chart data from financials
  const revenueChartData = financials?.income_statements?.map(item => ({
    period: item.fiscal_year || item.quarter,
    revenue: item.revenue / 1e9,
    profit: item.net_income / 1e9,
  })) || []

  const performanceChartData = financials?.income_statements?.map(item => ({
    period: item.fiscal_year || item.quarter,
    roe: item.roe || 0,
    roa: item.roa || 0,
  })) || []

  return (
    <div className="space-y-6">
      {/* Debug info */}
      <div className="p-4 bg-blue-500/20 rounded text-white">
        <p>Ticker: {ticker}</p>
        <p>Company: {company ? company.name : 'null'}</p>
        <p>Loading: {loading ? 'true' : 'false'}</p>
      </div>
      
      {/* Back button */}
      <Link 
        to="/screener" 
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại sàng lọc
      </Link>

      {/* Company Header */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{ticker.slice(0, 2)}</span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-white">{ticker}</h1>
                  <Badge className="bg-cyan-500/20 text-cyan-400">HOSE</Badge>
                  <Badge variant="outline">{company.industry || 'N/A'}</Badge>
                </div>
                <p className="text-gray-400">{company.company_name || company.name}</p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <p className="text-3xl font-bold text-white font-mono">
                  {company.current_price?.toLocaleString('vi-VN') || '-'}
                  <span className="text-sm text-gray-400 font-normal ml-1">VNĐ</span>
                </p>
                {company.price_change && (
                  <div className={cn(
                    'flex items-center gap-1 justify-end mt-1',
                    company.price_change > 0 ? 'text-green-400' : 'text-red-400'
                  )}>
                    {company.price_change > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span className="font-semibold">
                      {company.price_change > 0 ? '+' : ''}{company.price_change}%
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Link to={`/compare?tickers=${ticker}`}>
                  <Button variant="outline" size="sm">
                    <Scale className="w-4 h-4 mr-2" />
                    So sánh
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                  <Download className="w-4 h-4 mr-2" />
                  Xuất CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Company Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-white/10">
            <div>
              <p className="text-xs text-gray-500 mb-1">Vốn hóa</p>
              <p className="font-semibold text-white">
                {company.market_cap ? `${(company.market_cap / 1e12).toFixed(1)}T` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">P/E</p>
              <p className="font-semibold text-white">
                {ratios?.pe_ratio?.toFixed(1) || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">P/B</p>
              <p className="font-semibold text-white">
                {ratios?.pb_ratio?.toFixed(1) || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">ROE</p>
              <p className="font-semibold text-white">
                {ratios?.roe?.toFixed(1) || '-'}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">F-Score</p>
              <p className="font-semibold text-white">
                {fScore?.total_score || '-'}/9
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Health Score</p>
              <p className="font-semibold text-white">
                {healthScore?.health_score?.total_score?.toFixed(0) || '-'}/100
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {[
          { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
          { id: 'health', label: 'Sức khỏe', icon: Heart },
          { id: 'financials', label: 'Tài chính', icon: FileText },
          { id: 'ratios', label: 'Chỉ số', icon: Activity },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              activeTab === tab.id 
                ? 'bg-cyan-500/20 text-cyan-400' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Health Score Summary */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-400" />
                Điểm sức khỏe
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <HealthScoreCircle 
                score={healthScore?.health_score?.total_score || 0} 
                size="lg" 
              />
              <p className="text-gray-400 text-sm mt-4 text-center">
                {healthScore?.health_score?.interpretation || 'Chưa có đánh giá'}
              </p>
              <div className="w-full mt-4 space-y-2">
                {healthScore?.health_score?.breakdown && 
                  Object.entries(healthScore.health_score.breakdown).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-400 capitalize">{key.replace('_', ' ')}</span>
                      <span className="text-white">{value}/25</span>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>

          {/* F-Score */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                Piotroski F-Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <FScoreBadge score={fScore?.total_score || 0} showDetails />
              </div>
              <div className="space-y-1">
                {fScore?.criteria?.map((criterion, idx) => (
                  <FScoreCriteriaRow
                    key={idx}
                    name={criterion.name}
                    passed={criterion.passed}
                    description={criterion.description}
                  />
                )) || (
                  <p className="text-gray-500 text-center">Không có dữ liệu</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                Cảnh báo rủi ro
              </CardTitle>
            </CardHeader>
            <CardContent>
              {warnings.length > 0 ? (
                <div className="space-y-3">
                  {warnings.map((warning, idx) => (
                    <WarningCard key={idx} warning={warning} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                  <p className="text-green-400 font-medium">Không có cảnh báo</p>
                  <p className="text-gray-500 text-sm">Công ty đang hoạt động tốt</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* Health Score Detail */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Chi tiết điểm sức khỏe tài chính</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {healthScore?.health_score?.breakdown && 
                  Object.entries(healthScore.health_score.breakdown).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <HealthScoreCircle score={value * 4} size="sm" />
                      <p className="text-white font-medium mt-2 capitalize">
                        {key.replace('_', ' ')}
                      </p>
                      <p className="text-gray-500 text-sm">{value}/25 điểm</p>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>

          {/* F-Score Detail */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Chi tiết Piotroski F-Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profitability */}
                <div>
                  <h4 className="text-cyan-400 font-medium mb-3">Khả năng sinh lời (4 điểm)</h4>
                  <div className="space-y-2">
                    {fScore?.criteria?.filter(c => 
                      ['ROA dương', 'CFO dương', 'ROA tăng', 'CFO > Net Income'].includes(c.name)
                    ).map((criterion, idx) => (
                      <FScoreCriteriaRow
                        key={idx}
                        name={criterion.name}
                        passed={criterion.passed}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Leverage */}
                <div>
                  <h4 className="text-cyan-400 font-medium mb-3">Đòn bẩy & Thanh khoản (3 điểm)</h4>
                  <div className="space-y-2">
                    {fScore?.criteria?.filter(c => 
                      ['Nợ/TS giảm', 'Current Ratio tăng', 'Không phát hành CP'].includes(c.name)
                    ).map((criterion, idx) => (
                      <FScoreCriteriaRow
                        key={idx}
                        name={criterion.name}
                        passed={criterion.passed}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Efficiency */}
                <div>
                  <h4 className="text-cyan-400 font-medium mb-3">Hiệu quả hoạt động (2 điểm)</h4>
                  <div className="space-y-2">
                    {fScore?.criteria?.filter(c => 
                      ['Gross Margin tăng', 'Asset Turnover tăng'].includes(c.name)
                    ).map((criterion, idx) => (
                      <FScoreCriteriaRow
                        key={idx}
                        name={criterion.name}
                        passed={criterion.passed}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Warnings */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Tất cả cảnh báo</CardTitle>
            </CardHeader>
            <CardContent>
              {warnings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {warnings.map((warning, idx) => (
                    <WarningCard key={idx} warning={warning} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-3" />
                  <p className="text-green-400 text-xl font-medium">Tình hình tài chính ổn định</p>
                  <p className="text-gray-500 mt-2">Không phát hiện rủi ro đáng lo ngại</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'financials' && (
        <div className="space-y-6">
          {/* View Mode Toggle */}
          <div className="flex justify-end">
            <div className="flex bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setViewMode('annual')}
                className={cn(
                  'px-4 py-2 rounded text-sm transition-colors',
                  viewMode === 'annual' ? 'bg-cyan-500 text-white' : 'text-gray-400'
                )}
              >
                Theo năm
              </button>
              <button
                onClick={() => setViewMode('quarterly')}
                className={cn(
                  'px-4 py-2 rounded text-sm transition-colors',
                  viewMode === 'quarterly' ? 'bg-cyan-500 text-white' : 'text-gray-400'
                )}
              >
                Theo quý
              </button>
            </div>
          </div>

          {/* Revenue & Profit Chart */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Doanh thu & Lợi nhuận</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="period" tick={{ fill: '#9ca3af' }} />
                    <YAxis tick={{ fill: '#9ca3af' }} unit="B" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => `${value.toFixed(0)} tỷ`}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Doanh thu" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="profit" name="Lợi nhuận" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Không có dữ liệu tài chính
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial Statements Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Statement */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Kết quả kinh doanh
                </CardTitle>
              </CardHeader>
              <CardContent>
                {financials?.income_statements?.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="mb-4 pb-4 border-b border-white/5 last:border-0">
                    <p className="text-cyan-400 font-medium mb-2">{item.fiscal_year || item.quarter}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Doanh thu</span>
                        <span className="text-white">{(item.revenue / 1e9).toFixed(0)}B</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Lợi nhuận gộp</span>
                        <span className="text-white">{(item.gross_profit / 1e9).toFixed(0)}B</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Lợi nhuận ròng</span>
                        <span className="text-white">{(item.net_income / 1e9).toFixed(0)}B</span>
                      </div>
                    </div>
                  </div>
                )) || (
                  <p className="text-gray-500 text-center">Không có dữ liệu</p>
                )}
              </CardContent>
            </Card>

            {/* Balance Sheet */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-400" />
                  Bảng cân đối
                </CardTitle>
              </CardHeader>
              <CardContent>
                {financials?.balance_sheets?.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="mb-4 pb-4 border-b border-white/5 last:border-0">
                    <p className="text-cyan-400 font-medium mb-2">{item.fiscal_year || item.quarter}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tổng tài sản</span>
                        <span className="text-white">{(item.total_assets / 1e9).toFixed(0)}B</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Nợ phải trả</span>
                        <span className="text-white">{(item.total_liabilities / 1e9).toFixed(0)}B</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Vốn chủ sở hữu</span>
                        <span className="text-white">{(item.shareholders_equity / 1e9).toFixed(0)}B</span>
                      </div>
                    </div>
                  </div>
                )) || (
                  <p className="text-gray-500 text-center">Không có dữ liệu</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'ratios' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Valuation */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                Định giá
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RatioDisplay label="P/E" value={ratios?.pe_ratio} unit="x" benchmark={15} inverse />
              <RatioDisplay label="P/B" value={ratios?.pb_ratio} unit="x" benchmark={1.5} inverse />
              <RatioDisplay label="P/S" value={ratios?.ps_ratio} unit="x" benchmark={2} inverse />
              <RatioDisplay label="EV/EBITDA" value={ratios?.ev_ebitda} unit="x" benchmark={10} inverse />
              <RatioDisplay label="EPS" value={ratios?.eps} unit="" />
              <RatioDisplay label="BVPS" value={ratios?.bvps} unit="" />
            </CardContent>
          </Card>

          {/* Profitability */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Sinh lợi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RatioDisplay label="ROE" value={ratios?.roe} unit="%" benchmark={15} />
              <RatioDisplay label="ROA" value={ratios?.roa} unit="%" benchmark={5} />
              <RatioDisplay label="ROIC" value={ratios?.roic} unit="%" benchmark={10} />
              <RatioDisplay label="Biên LN gộp" value={ratios?.gross_margin} unit="%" benchmark={20} />
              <RatioDisplay label="Biên LN ròng" value={ratios?.net_margin} unit="%" benchmark={10} />
              <RatioDisplay label="Biên EBITDA" value={ratios?.ebitda_margin} unit="%" benchmark={15} />
            </CardContent>
          </Card>

          {/* Financial Health */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                Sức khỏe tài chính
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RatioDisplay label="D/E" value={ratios?.debt_to_equity} unit="x" benchmark={1} inverse />
              <RatioDisplay label="Debt/Assets" value={ratios?.debt_to_assets} unit="%" benchmark={50} inverse />
              <RatioDisplay label="Current Ratio" value={ratios?.current_ratio} unit="x" benchmark={1.5} />
              <RatioDisplay label="Quick Ratio" value={ratios?.quick_ratio} unit="x" benchmark={1} />
              <RatioDisplay label="Interest Coverage" value={ratios?.interest_coverage} unit="x" benchmark={3} />
            </CardContent>
          </Card>

          {/* Growth */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Growth className="w-5 h-5 text-yellow-400" />
                Tăng trưởng
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RatioDisplay label="TT Doanh thu (YoY)" value={ratios?.revenue_growth} unit="%" />
              <RatioDisplay label="TT Lợi nhuận (YoY)" value={ratios?.profit_growth} unit="%" />
              <RatioDisplay label="TT EPS (YoY)" value={ratios?.eps_growth} unit="%" />
              <RatioDisplay label="TT Tài sản (YoY)" value={ratios?.asset_growth} unit="%" />
            </CardContent>
          </Card>

          {/* Efficiency */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                Hiệu quả
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RatioDisplay label="Asset Turnover" value={ratios?.asset_turnover} unit="x" benchmark={0.5} />
              <RatioDisplay label="Inventory Turnover" value={ratios?.inventory_turnover} unit="x" benchmark={5} />
              <RatioDisplay label="Receivable Turnover" value={ratios?.receivable_turnover} unit="x" benchmark={5} />
            </CardContent>
          </Card>

          {/* Dividend */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-pink-400" />
                Cổ tức
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RatioDisplay label="Dividend Yield" value={ratios?.dividend_yield} unit="%" benchmark={3} />
              <RatioDisplay label="Payout Ratio" value={ratios?.payout_ratio} unit="%" benchmark={50} inverse />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
