import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  PieChart,
  ArrowUpRight,
  Building2,
  Activity,
  Target,
  Zap,
  ChevronRight,
  BarChart3,
  Wallet,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, StatCard, Badge, SkeletonCard } from '../components/ui'
import { RevenueChart, PerformanceChart, SectorPieChart } from '../components/charts/FinancialCharts'
import { formatCurrency, formatPercent, formatCompact, getValueColor } from '../utils/formatters'
import { cn } from '../utils/helpers'
import { marketApi, companiesApi } from '../services/api'
import toast from 'react-hot-toast'

// Mock data - sẽ thay bằng API call thực tế
const mockMarketStats = {
  totalMarketCap: 5234000000000000,
  marketCapChange: 2.34,
  tradingVolume: 12500000000000,
  volumeChange: 15.2,
  totalCompanies: 1580,
  topGainersCount: 245,
}

const mockTopStocks = [
  { ticker: 'VNM', name: 'Vinamilk', price: 82500, change: 3.2, marketCap: 164000000000000, pe: 18.5, roe: 28.4 },
  { ticker: 'FPT', name: 'FPT Corp', price: 121000, change: 2.8, marketCap: 132000000000000, pe: 22.3, roe: 24.1 },
  { ticker: 'VIC', name: 'Vingroup', price: 43200, change: -1.2, marketCap: 185000000000000, pe: 45.2, roe: 8.5 },
  { ticker: 'VHM', name: 'Vinhomes', price: 38500, change: 1.5, marketCap: 167000000000000, pe: 12.8, roe: 15.2 },
  { ticker: 'HPG', name: 'Hòa Phát', price: 25800, change: -0.8, marketCap: 116000000000000, pe: 8.5, roe: 12.8 },
  { ticker: 'MSN', name: 'Masan', price: 67800, change: 2.1, marketCap: 78000000000000, pe: 35.2, roe: 18.5 },
]

const mockRevenueData = [
  { year: '2019', revenue: 45000000000000, profit: 8500000000000 },
  { year: '2020', revenue: 52000000000000, profit: 9200000000000 },
  { year: '2021', revenue: 58000000000000, profit: 11500000000000 },
  { year: '2022', revenue: 65000000000000, profit: 13200000000000 },
  { year: '2023', revenue: 72000000000000, profit: 15800000000000 },
  { year: '2024', revenue: 78000000000000, profit: 17500000000000 },
]

const mockSectorData = [
  { name: 'Ngân hàng', value: 28.5 },
  { name: 'Bất động sản', value: 18.2 },
  { name: 'Thực phẩm', value: 12.4 },
  { name: 'Công nghệ', value: 10.8 },
  { name: 'Năng lượng', value: 8.5 },
  { name: 'Khác', value: 21.6 },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

export default function Dashboard() {
  // Fetch market overview data
  const { data: marketOverview, isLoading: marketLoading } = useQuery({
    queryKey: ['marketOverview'],
    queryFn: marketApi.getOverview,
    staleTime: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      console.error('Error fetching market overview:', error)
      toast.error('Không thể tải dữ liệu thị trường')
    }
  })

  // Fetch sector data
  const { data: sectorData, isLoading: sectorLoading } = useQuery({
    queryKey: ['sectorPerformance'],
    queryFn: marketApi.getSectorPerformance,
    staleTime: 5 * 60 * 1000,
    onError: (error) => {
      console.error('Error fetching sector data:', error)
    }
  })

  // Fetch top companies
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: companiesApi.getAll,
    staleTime: 5 * 60 * 1000,
    select: (data) => data.slice(0, 6), // Top 6 companies
    onError: (error) => {
      console.error('Error fetching companies:', error)
    }
  })

  const loading = marketLoading || sectorLoading || companiesLoading

  // Use mock data as fallback
  const stats = marketOverview || mockMarketStats
  const sectors = sectorData || mockSectorData
  const topStocks = companies || mockTopStocks

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-white">
            Tổng quan thị trường
          </h1>
          <p className="text-dark-400 mt-1">
            Phân tích và theo dõi thị trường chứng khoán Việt Nam
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" size="lg">
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Cập nhật realtime
          </Badge>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Tổng vốn hóa thị trường"
          value={stats.totalMarketCap}
          change={stats.marketCapChange}
          format="currency"
          icon={PieChart}
          iconColor="primary"
        />
        <StatCard
          title="Khối lượng giao dịch"
          value={stats.tradingVolume}
          change={stats.volumeChange}
          format="currency"
          icon={Activity}
          iconColor="success"
        />
        <StatCard
          title="Số công ty niêm yết"
          value={stats.totalCompanies}
          icon={Building2}
          iconColor="accent"
        />
        <StatCard
          title="Cổ phiếu tăng giá"
          value={stats.topGainersCount}
          icon={TrendingUp}
          iconColor="success"
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Sàng lọc cổ phiếu', desc: 'Tìm kiếm theo tiêu chí đầu tư', icon: Target, href: '/screener', color: 'primary' },
          { title: 'Định giá DCF', desc: 'Định giá dựa trên dòng tiền', icon: Calculator, href: '/valuation', color: 'success' },
          { title: 'So sánh công ty', desc: 'So sánh các chỉ số tài chính', icon: BarChart3, href: '/compare', color: 'accent' },
        ].map((action, idx) => (
          <Link
            key={idx}
            to={action.href}
            className="glass-card-hover p-5 flex items-center gap-4 group"
          >
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
              action.color === 'primary' && 'bg-primary-500/20 text-primary-400',
              action.color === 'success' && 'bg-success-500/20 text-success-400',
              action.color === 'accent' && 'bg-accent-500/20 text-accent-400',
            )}>
              <action.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                {action.title}
              </h3>
              <p className="text-sm text-dark-400">{action.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-primary-400 transition-all group-hover:translate-x-1" />
          </Link>
        ))}
      </motion.div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tăng trưởng Doanh thu & Lợi nhuận</CardTitle>
                  <p className="text-sm text-dark-400 mt-1">Xu hướng 6 năm gần nhất</p>
                </div>
                <Badge variant="info">VNM</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <RevenueChart data={mockRevenueData} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Sector Allocation */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Phân bổ theo ngành</CardTitle>
              <p className="text-sm text-dark-400 mt-1">% vốn hóa thị trường</p>
            </CardHeader>
            <CardContent>
              <SectorPieChart data={mockSectorData} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Stocks Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-warning-400" />
                  Top cổ phiếu theo vốn hóa
                </CardTitle>
                <p className="text-sm text-dark-400 mt-1">Cập nhật theo thời gian thực</p>
              </div>
              <Link 
                to="/screener" 
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                Xem tất cả
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Mã CK</th>
                    <th>Công ty</th>
                    <th className="text-right">Giá</th>
                    <th className="text-right">Thay đổi</th>
                    <th className="text-right">Vốn hóa</th>
                    <th className="text-right">P/E</th>
                    <th className="text-right">ROE</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {topStocks?.map((stock) => (
                    <tr key={stock.ticker} className="group">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary-400">
                              {stock.ticker.slice(0, 2)}
                            </span>
                          </div>
                          <span className="font-semibold text-white">{stock.ticker}</span>
                        </div>
                      </td>
                      <td className="text-dark-300">{stock.name}</td>
                      <td className="text-right font-mono font-medium text-white">
                        {stock.current_price?.toLocaleString('vi-VN') || stock.price?.toLocaleString('vi-VN') || 'N/A'}
                      </td>
                      <td className="text-right">
                        <span className={cn(
                          'inline-flex items-center gap-1 font-medium',
                          (stock.change || 0) > 0 ? 'text-success-400' : 'text-danger-400'
                        )}>
                          {(stock.change || 0) > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          {(stock.change || 0) > 0 ? '+' : ''}{(stock.change || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right text-dark-300">
                        {formatCurrency(stock.market_cap || stock.marketCap || 0)}
                      </td>
                      <td className="text-right font-mono text-dark-300">
                        {(stock.pe || 0).toFixed(1)}
                      </td>
                      <td className="text-right">
                        <Badge variant={(stock.roe || 0) >= 20 ? 'success' : (stock.roe || 0) >= 15 ? 'warning' : 'danger'}>
                          {(stock.roe || 0).toFixed(1)}%
                        </Badge>
                      </td>
                      <td>
                        <Link 
                          to={`/company/${stock.ticker}`}
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-all"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Value Investing Tips */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-success-400" />
                Tiêu chí Value Investing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'P/E < 15', desc: 'Giá rẻ so với lợi nhuận', status: 'good' },
                  { label: 'P/B < 1.5', desc: 'Giá rẻ so với tài sản', status: 'good' },
                  { label: 'ROE > 15%', desc: 'Hiệu quả sử dụng vốn tốt', status: 'warning' },
                  { label: 'D/E < 1', desc: 'Nợ ở mức kiểm soát', status: 'good' },
                  { label: 'Tăng trưởng ổn định', desc: '5+ năm tăng trưởng liên tục', status: 'info' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 rounded-xl bg-dark-800/30">
                    <div className={cn(
                      'w-3 h-3 rounded-full',
                      item.status === 'good' && 'bg-success-500',
                      item.status === 'warning' && 'bg-warning-500',
                      item.status === 'info' && 'bg-primary-500',
                    )} />
                    <div className="flex-1">
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-xs text-dark-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Company Reports List */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary-400" />
                  Báo cáo tài chính các công ty
                </CardTitle>
                <Link 
                  to="/reports" 
                  className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
                >
                  Xem tất cả
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topStocks?.slice(0, 8).map((company, idx) => (
                  <Link 
                    key={idx} 
                    to={`/company/${company.ticker}/reports`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-dark-800/50 transition-all group cursor-pointer border border-transparent hover:border-primary-500/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-400">
                        {company.ticker.slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                        {company.ticker}
                      </p>
                      <p className="text-xs text-dark-400 truncate">
                        {company.name || company.company_name || 'N/A'}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Add Calculator icon import
function Calculator(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="16" x2="16" y1="14" y2="18" />
      <path d="M16 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 10h.01" />
      <path d="M12 14h.01" />
      <path d="M8 14h.01" />
      <path d="M12 18h.01" />
      <path d="M8 18h.01" />
    </svg>
  )
}
