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

// Mock data for company
const mockCompanyData = {
  VNM: {
    ticker: 'VNM',
    name: 'Công ty Cổ phần Sữa Việt Nam',
    industry: 'Thực phẩm & Đồ uống',
    exchange: 'HOSE',
    description: 'Vinamilk là công ty sản xuất và kinh doanh sữa lớn nhất Việt Nam với hơn 50 năm kinh nghiệm. Công ty có mạng lưới phân phối rộng khắp cả nước và xuất khẩu sang hơn 50 quốc gia.',
    website: 'https://www.vinamilk.com.vn',
    founded: 1976,
    employees: 10000,
    headquarters: 'TP. Hồ Chí Minh',
    
    currentPrice: 82500,
    priceChange: 3.2,
    marketCap: 164000000000000,
    sharesOutstanding: 2000000000,
    
    // Financial ratios
    pe: 18.5,
    pb: 4.2,
    ps: 3.1,
    evEbitda: 12.5,
    roe: 28.4,
    roa: 18.2,
    roic: 25.3,
    grossMargin: 42.5,
    netMargin: 16.8,
    de: 0.3,
    currentRatio: 2.8,
    quickRatio: 2.1,
    dividendYield: 3.8,
    payoutRatio: 65,
    
    // Growth rates
    revenueGrowth5Y: 12.5,
    profitGrowth5Y: 15.2,
    epsGrowth5Y: 14.8,
    
    // Historical data
    revenueHistory: [
      { year: '2019', revenue: 55000000000000, profit: 10200000000000 },
      { year: '2020', revenue: 58500000000000, profit: 11000000000000 },
      { year: '2021', revenue: 62800000000000, profit: 12500000000000 },
      { year: '2022', revenue: 68500000000000, profit: 14200000000000 },
      { year: '2023', revenue: 75200000000000, profit: 15800000000000 },
      { year: '2024', revenue: 78500000000000, profit: 17200000000000 },
    ],
    
    performanceHistory: [
      { year: '2019', roe: 25.2, roa: 16.5, roic: 22.1 },
      { year: '2020', roe: 26.5, roa: 17.2, roic: 23.5 },
      { year: '2021', roe: 27.8, roa: 17.8, roic: 24.2 },
      { year: '2022', roe: 28.1, roa: 18.0, roic: 24.8 },
      { year: '2023', roe: 28.2, roa: 18.1, roic: 25.0 },
      { year: '2024', roe: 28.4, roa: 18.2, roic: 25.3 },
    ],
    
    cashFlowHistory: [
      { year: '2019', operating: 12500000000000, investing: -5200000000000, financing: -6800000000000 },
      { year: '2020', operating: 13200000000000, investing: -4800000000000, financing: -7200000000000 },
      { year: '2021', operating: 14500000000000, investing: -5500000000000, financing: -7800000000000 },
      { year: '2022', operating: 15800000000000, investing: -6200000000000, financing: -8500000000000 },
      { year: '2023', operating: 17200000000000, investing: -6800000000000, financing: -9200000000000 },
      { year: '2024', operating: 18500000000000, investing: -7200000000000, financing: -9800000000000 },
    ],
    
    balanceSheet: [
      { name: 'Tiền & TĐ Tiền', value: 8500000000000 },
      { name: 'Đầu tư ngắn hạn', value: 12500000000000 },
      { name: 'Phải thu', value: 6200000000000 },
      { name: 'Hàng tồn kho', value: 4800000000000 },
      { name: 'TSCĐ', value: 15200000000000 },
      { name: 'Đầu tư dài hạn', value: 5500000000000 },
    ],
    
    ratiosData: [
      { name: 'ROE', value: 28.4 },
      { name: 'ROA', value: 18.2 },
      { name: 'ROIC', value: 25.3 },
      { name: 'Gross Margin', value: 42.5 },
      { name: 'Net Margin', value: 16.8 },
    ],
  }
}

export default function CompanyAnalysis() {
  const { ticker } = useParams()
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState(null)
  const [selectedYear, setSelectedYear] = useState('2024')

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setCompany(mockCompanyData[ticker] || mockCompanyData.VNM)
      setLoading(false)
    }, 800)
  }, [ticker])

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-32" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold text-white mb-2">Không tìm thấy công ty</h2>
        <p className="text-dark-400 mb-4">Mã cổ phiếu "{ticker}" không tồn tại</p>
        <Link to="/screener">
          <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Quay lại sàng lọc
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Back button */}
      <Link 
        to="/screener" 
        className="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại sàng lọc
      </Link>

      {/* Company Header */}
      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{company.ticker.slice(0, 2)}</span>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">{company.ticker}</h1>
                <Badge variant="info">{company.exchange}</Badge>
                <Badge variant="default">{company.industry}</Badge>
              </div>
              <p className="text-dark-400">{company.name}</p>
              <p className="text-sm text-dark-500 mt-2 max-w-2xl">{company.description}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-3xl font-bold text-white font-mono">
                {company.currentPrice.toLocaleString('vi-VN')}
                <span className="text-sm text-dark-400 font-normal ml-1">VNĐ</span>
              </p>
              <div className={cn(
                'flex items-center gap-1 justify-end mt-1',
                company.priceChange > 0 ? 'text-success-400' : 'text-danger-400'
              )}>
                {company.priceChange > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="font-semibold">
                  {company.priceChange > 0 ? '+' : ''}{company.priceChange}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button variant="ghost" size="sm" leftIcon={<Star className="w-4 h-4" />}>
                Theo dõi
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Share2 className="w-4 h-4" />}>
                Chia sẻ
              </Button>
              <Button variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                Xuất báo cáo
              </Button>
            </div>
          </div>
        </div>

        {/* Company Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-dark-700">
          <div>
            <p className="text-xs text-dark-500 mb-1">Vốn hóa</p>
            <p className="font-semibold text-white">{formatCurrency(company.marketCap)}</p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Số CP lưu hành</p>
            <p className="font-semibold text-white">{formatCompact(company.sharesOutstanding)}</p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Năm thành lập</p>
            <p className="font-semibold text-white">{company.founded}</p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Nhân viên</p>
            <p className="font-semibold text-white">{company.employees.toLocaleString()}+</p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Trụ sở</p>
            <p className="font-semibold text-white">{company.headquarters}</p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Website</p>
            <a 
              href={company.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold text-primary-400 hover:underline flex items-center gap-1"
            >
              Truy cập
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Valuation Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          title="P/E"
          value={company.pe}
          format="ratio"
          icon={Target}
          iconColor={company.pe <= 15 ? 'success' : company.pe <= 25 ? 'warning' : 'danger'}
        />
        <StatCard
          title="P/B"
          value={company.pb}
          format="ratio"
          icon={BarChart3}
          iconColor={company.pb <= 1.5 ? 'success' : company.pb <= 3 ? 'warning' : 'danger'}
        />
        <StatCard
          title="ROE"
          value={company.roe}
          format="percent"
          icon={Zap}
          iconColor={company.roe >= 20 ? 'success' : company.roe >= 15 ? 'warning' : 'danger'}
        />
        <StatCard
          title="ROA"
          value={company.roa}
          format="percent"
          icon={PieChart}
          iconColor={company.roa >= 10 ? 'success' : company.roa >= 5 ? 'warning' : 'danger'}
        />
        <StatCard
          title="D/E"
          value={company.de}
          format="ratio"
          icon={Shield}
          iconColor={company.de <= 0.5 ? 'success' : company.de <= 1 ? 'warning' : 'danger'}
        />
        <StatCard
          title="Cổ tức"
          value={company.dividendYield}
          format="percent"
          icon={Wallet}
          iconColor={company.dividendYield >= 5 ? 'success' : company.dividendYield >= 3 ? 'warning' : 'accent'}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & Profit Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-success-400" />
              Doanh thu & Lợi nhuận
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={company.revenueHistory} />
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-400" />
              Chỉ số hiệu quả (ROE, ROA, ROIC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceChart data={company.performanceHistory} />
          </CardContent>
        </Card>

        {/* Cash Flow Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-accent-400" />
              Dòng tiền
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={company.cashFlowHistory} />
          </CardContent>
        </Card>

        {/* Balance Sheet Structure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-warning-400" />
              Cấu trúc tài sản
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BalanceSheetChart data={company.balanceSheet} />
          </CardContent>
        </Card>
      </div>

      {/* Financial Ratios Detailed */}
      <Card>
        <CardHeader>
          <CardTitle>Chi tiết các chỉ số tài chính</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Valuation */}
            <div>
              <h4 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-4">
                Định giá
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'P/E', value: company.pe, good: 15, warning: 25 },
                  { label: 'P/B', value: company.pb, good: 1.5, warning: 3 },
                  { label: 'P/S', value: company.ps, good: 2, warning: 5 },
                  { label: 'EV/EBITDA', value: company.evEbitda, good: 10, warning: 15 },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-dark-400">{item.label}</span>
                    <span className={cn(
                      'font-mono font-medium',
                      item.value <= item.good ? 'text-success-400' : 
                      item.value <= item.warning ? 'text-warning-400' : 'text-danger-400'
                    )}>
                      {formatRatio(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Profitability */}
            <div>
              <h4 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-4">
                Khả năng sinh lời
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'ROE', value: company.roe, good: 20, warning: 15 },
                  { label: 'ROA', value: company.roa, good: 10, warning: 5 },
                  { label: 'ROIC', value: company.roic, good: 15, warning: 10 },
                  { label: 'Net Margin', value: company.netMargin, good: 15, warning: 10 },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-dark-400">{item.label}</span>
                    <span className={cn(
                      'font-mono font-medium',
                      item.value >= item.good ? 'text-success-400' : 
                      item.value >= item.warning ? 'text-warning-400' : 'text-danger-400'
                    )}>
                      {formatPercent(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Health */}
            <div>
              <h4 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-4">
                Sức khỏe tài chính
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'D/E', value: company.de, good: 0.5, warning: 1, inverse: true },
                  { label: 'Current Ratio', value: company.currentRatio, good: 2, warning: 1.5 },
                  { label: 'Quick Ratio', value: company.quickRatio, good: 1.5, warning: 1 },
                  { label: 'Gross Margin', value: company.grossMargin, good: 30, warning: 20 },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-dark-400">{item.label}</span>
                    <span className={cn(
                      'font-mono font-medium',
                      item.inverse 
                        ? (item.value <= item.good ? 'text-success-400' : item.value <= item.warning ? 'text-warning-400' : 'text-danger-400')
                        : (item.value >= item.good ? 'text-success-400' : item.value >= item.warning ? 'text-warning-400' : 'text-danger-400')
                    )}>
                      {item.label.includes('Ratio') || item.label === 'D/E' 
                        ? formatRatio(item.value) 
                        : formatPercent(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dividend & Growth */}
            <div>
              <h4 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-4">
                Cổ tức & Tăng trưởng
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'Dividend Yield', value: company.dividendYield, format: 'percent' },
                  { label: 'Payout Ratio', value: company.payoutRatio, format: 'percent' },
                  { label: 'DT Growth 5Y', value: company.revenueGrowth5Y, format: 'percent' },
                  { label: 'LN Growth 5Y', value: company.profitGrowth5Y, format: 'percent' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-dark-400">{item.label}</span>
                    <span className={cn(
                      'font-mono font-medium',
                      item.value > 0 ? 'text-success-400' : item.value < 0 ? 'text-danger-400' : 'text-dark-300'
                    )}>
                      {formatPercent(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Value Investing Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-400" />
            Đánh giá theo tiêu chí Value Investing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { 
                label: 'P/E hợp lý (< 15)', 
                passed: company.pe <= 15,
                value: `P/E = ${formatRatio(company.pe)}`,
                desc: company.pe <= 15 ? 'Định giá hấp dẫn' : 'Định giá cao'
              },
              { 
                label: 'P/B hợp lý (< 1.5)', 
                passed: company.pb <= 1.5,
                value: `P/B = ${formatRatio(company.pb)}`,
                desc: company.pb <= 1.5 ? 'Dưới giá trị sổ sách' : 'Cao hơn GTSS'
              },
              { 
                label: 'ROE tốt (> 15%)', 
                passed: company.roe >= 15,
                value: `ROE = ${formatPercent(company.roe)}`,
                desc: company.roe >= 15 ? 'Hiệu quả vốn tốt' : 'Hiệu quả vốn thấp'
              },
              { 
                label: 'D/E an toàn (< 1)', 
                passed: company.de <= 1,
                value: `D/E = ${formatRatio(company.de)}`,
                desc: company.de <= 1 ? 'Nợ kiểm soát tốt' : 'Đòn bẩy cao'
              },
              { 
                label: 'Có trả cổ tức', 
                passed: company.dividendYield > 0,
                value: `Yield = ${formatPercent(company.dividendYield)}`,
                desc: company.dividendYield > 0 ? 'Chia sẻ lợi nhuận' : 'Không có cổ tức'
              },
              { 
                label: 'Tăng trưởng ổn định', 
                passed: company.profitGrowth5Y >= 10,
                value: `5Y CAGR = ${formatPercent(company.profitGrowth5Y)}`,
                desc: company.profitGrowth5Y >= 10 ? 'Tăng trưởng tốt' : 'Tăng trưởng chậm'
              },
            ].map((criteria, idx) => (
              <div 
                key={idx}
                className={cn(
                  'p-4 rounded-xl border',
                  criteria.passed 
                    ? 'bg-success-500/10 border-success-500/30' 
                    : 'bg-danger-500/10 border-danger-500/30'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-white">{criteria.label}</span>
                  <Badge variant={criteria.passed ? 'success' : 'danger'} size="sm">
                    {criteria.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                  </Badge>
                </div>
                <p className={cn(
                  'text-lg font-semibold font-mono',
                  criteria.passed ? 'text-success-400' : 'text-danger-400'
                )}>
                  {criteria.value}
                </p>
                <p className="text-xs text-dark-400 mt-1">{criteria.desc}</p>
              </div>
            ))}
          </div>

          {/* Summary Score */}
          <div className="mt-6 p-4 rounded-xl bg-dark-800/50 border border-dark-700">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-white">Điểm Value Investing</h4>
                <p className="text-sm text-dark-400">Dựa trên 6 tiêu chí Benjamin Graham</p>
              </div>
              <div className="text-right">
                <span className="text-4xl font-bold text-primary-400">
                  {[
                    company.pe <= 15,
                    company.pb <= 1.5,
                    company.roe >= 15,
                    company.de <= 1,
                    company.dividendYield > 0,
                    company.profitGrowth5Y >= 10,
                  ].filter(Boolean).length}
                </span>
                <span className="text-xl text-dark-400">/6</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
