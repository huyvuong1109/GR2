import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Calendar,
  Building2,
  TrendingUp,
  DollarSign,
  Wallet,
  Search,
  Download,
  X,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '../components/ui'
import { formatFullCurrency } from '../utils/formatters'
import { cn } from '../utils/helpers'
import api from '../services/api'

// Report type badges
const REPORT_TYPES = [
  { id: 'balance_sheet', name: 'Cân đối kế toán', icon: Wallet, color: 'bg-blue-500/20 text-blue-400', activeColor: 'bg-blue-500 text-white' },
  { id: 'income_statement', name: 'Kết quả kinh doanh', icon: TrendingUp, color: 'bg-green-500/20 text-green-400', activeColor: 'bg-green-500 text-white' },
  { id: 'cash_flow', name: 'Lưu chuyển tiền tệ', icon: DollarSign, color: 'bg-purple-500/20 text-purple-400', activeColor: 'bg-purple-500 text-white' },
]

// Modal hiển thị báo cáo chi tiết - với tabs cho 3 loại báo cáo
const ReportModal = ({ isOpen, onClose, company, reports, selectedYear }) => {
  const [activeTab, setActiveTab] = useState('balance_sheet')
  
  if (!isOpen || !company) return null

  // Lấy báo cáo theo năm đã chọn
  const getReportByYear = (reportList, year) => {
    return reportList?.find(r => (r.period_year || r.fiscal_year) === year) || reportList?.[0] || {}
  }

  const balanceSheet = getReportByYear(reports?.balance_sheets, selectedYear)
  const incomeStatement = getReportByYear(reports?.income_statements, selectedYear)
  const cashFlow = getReportByYear(reports?.cash_flows, selectedYear)

  const renderBalanceSheet = (data) => (
    <div className="space-y-6">
      {/* Tài sản */}
      <div>
        <h4 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          TÀI SẢN
        </h4>
        <div className="space-y-2 pl-4">
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-gray-400">Tổng tài sản</span>
            <span className="text-white font-mono font-bold">
              {formatFullCurrency(data.total_assets)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Tài sản ngắn hạn</span>
            <span className="text-gray-300 font-mono">
              {formatFullCurrency(data.current_assets)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500 pl-4">+ Tiền và tương đương tiền</span>
            <span className="text-gray-300 font-mono">
              {formatFullCurrency(data.cash || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500 pl-4">+ Đầu tư tài chính ngắn hạn</span>
            <span className="text-gray-300 font-mono">
              {formatFullCurrency(data.short_term_investments || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500 pl-4">+ Hàng tồn kho</span>
            <span className="text-gray-300 font-mono">
              {formatFullCurrency(data.inventories || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Tài sản dài hạn</span>
            <span className="text-gray-300 font-mono">
              {formatFullCurrency(data.non_current_assets)}
            </span>
          </div>
        </div>
      </div>

      {/* Nợ phải trả */}
      <div>
        <h4 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          NỢ PHẢI TRẢ
        </h4>
        <div className="space-y-2 pl-4">
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-gray-400">Tổng nợ</span>
            <span className="text-white font-mono font-bold">
              {formatFullCurrency(data.total_liabilities)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Nợ ngắn hạn</span>
            <span className="text-gray-300 font-mono">
              {formatFullCurrency(data.current_liabilities)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Nợ dài hạn</span>
            <span className="text-gray-300 font-mono">
              {formatFullCurrency(data.non_current_liabilities)}
            </span>
          </div>
        </div>
      </div>

      {/* Vốn chủ sở hữu */}
      <div>
        <h4 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          VỐN CHỦ SỞ HỮU
        </h4>
        <div className="space-y-2 pl-4">
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-gray-400">Tổng vốn CSH</span>
            <span className="text-white font-mono font-bold">
              {formatFullCurrency(data.total_equity)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Lợi nhuận chưa phân phối</span>
            <span className="text-gray-300 font-mono">
              {formatFullCurrency(data.retained_earnings)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderIncomeStatement = (data) => (
    <div className="space-y-6">
      {/* Doanh thu */}
      <div>
        <h4 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          DOANH THU
        </h4>
        <div className="space-y-2 pl-4">
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-gray-400">Doanh thu thuần</span>
            <span className="text-white font-mono font-bold">
              {formatFullCurrency(data.revenue)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Giá vốn hàng bán</span>
            <span className="text-red-300 font-mono">
              ({formatFullCurrency(data.cost_of_goods_sold || 0)})
            </span>
          </div>
        </div>
      </div>

      {/* Lợi nhuận */}
      <div>
        <h4 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          LỢI NHUẬN
        </h4>
        <div className="space-y-2 pl-4">
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-gray-400">Lợi nhuận gộp</span>
            <span className="text-green-400 font-mono font-bold">
              {formatFullCurrency(data.gross_profit)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Chi phí bán hàng</span>
            <span className="text-red-300 font-mono">
              ({formatFullCurrency(data.selling_expenses || 0)})
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Chi phí quản lý</span>
            <span className="text-red-300 font-mono">
              ({formatFullCurrency(data.admin_expenses || 0)})
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-white/5 mt-2">
            <span className="text-gray-400">Lợi nhuận hoạt động</span>
            <span className="text-green-400 font-mono font-bold">
              {formatFullCurrency(data.operating_income)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">+ Thu nhập tài chính</span>
            <span className="text-green-300 font-mono">
              {formatFullCurrency(data.financial_income || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Chi phí tài chính</span>
            <span className="text-red-300 font-mono">
              ({formatFullCurrency(data.financial_expenses || 0)})
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-white/5 mt-2">
            <span className="text-gray-400">Lợi nhuận trước thuế</span>
            <span className="text-green-400 font-mono font-bold">
              {formatFullCurrency(data.profit_before_tax)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Thuế TNDN</span>
            <span className="text-red-300 font-mono">
              ({formatFullCurrency(data.income_tax || 0)})
            </span>
          </div>
          <div className="flex justify-between py-3 border-t-2 border-green-500/30 mt-2">
            <span className="text-white font-semibold">LỢI NHUẬN SAU THUẾ</span>
            <span className="text-green-400 font-mono font-bold text-lg">
              {formatFullCurrency(data.net_income)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderCashFlow = (data) => (
    <div className="space-y-6">
      {/* Hoạt động kinh doanh */}
      <div>
        <h4 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          HOẠT ĐỘNG KINH DOANH
        </h4>
        <div className="space-y-2 pl-4">
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-gray-400">Lưu chuyển tiền từ HĐKD</span>
            <span className={cn(
              "font-mono font-bold",
              (data.operating_cash_flow || 0) > 0 ? "text-green-400" : "text-red-400"
            )}>
              {formatFullCurrency(data.operating_cash_flow || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Hoạt động đầu tư */}
      <div>
        <h4 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          HOẠT ĐỘNG ĐẦU TƯ
        </h4>
        <div className="space-y-2 pl-4">
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-gray-400">Lưu chuyển tiền từ đầu tư</span>
            <span className={cn(
              "font-mono font-bold",
              (data.investing_cash_flow || 0) > 0 ? "text-green-400" : "text-red-400"
            )}>
              {formatFullCurrency(data.investing_cash_flow || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Mua sắm TSCĐ (CAPEX)</span>
            <span className="text-red-300 font-mono">
              ({formatFullCurrency(Math.abs(data.capex || 0))})
            </span>
          </div>
        </div>
      </div>

      {/* Hoạt động tài chính */}
      <div>
        <h4 className="text-purple-400 font-semibold mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          HOẠT ĐỘNG TÀI CHÍNH
        </h4>
        <div className="space-y-2 pl-4">
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-gray-400">Lưu chuyển tiền từ tài chính</span>
            <span className={cn(
              "font-mono font-bold",
              (data.financing_cash_flow || 0) > 0 ? "text-green-400" : "text-red-400"
            )}>
              {formatFullCurrency(data.financing_cash_flow || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-500">- Cổ tức đã trả</span>
            <span className="text-red-300 font-mono">
              ({formatFullCurrency(Math.abs(data.dividends_paid || 0))})
            </span>
          </div>
        </div>
      </div>

      {/* Tổng hợp */}
      <div className="border-t-2 border-white/10 pt-4">
        <div className="flex justify-between py-3 bg-white/5 rounded-lg px-4 mb-2">
          <span className="text-white font-semibold">Tăng/Giảm tiền thuần</span>
          <span className={cn(
            "font-mono font-bold text-lg",
            ((data.operating_cash_flow || 0) + (data.investing_cash_flow || 0) + (data.financing_cash_flow || 0)) > 0 
              ? "text-green-400" 
              : "text-red-400"
          )}>
            {formatFullCurrency(
              (data.operating_cash_flow || 0) + 
              (data.investing_cash_flow || 0) + 
              (data.financing_cash_flow || 0)
            )}
          </span>
        </div>
        <div className="flex justify-between py-3 bg-cyan-500/10 rounded-lg px-4">
          <span className="text-cyan-400 font-semibold">Tiền cuối kỳ</span>
          <span className="text-cyan-400 font-mono font-bold text-lg">
            {formatFullCurrency(data.ending_cash || 0)}
          </span>
        </div>
      </div>
    </div>
  )

  const currentData = activeTab === 'balance_sheet' ? balanceSheet : 
                      activeTab === 'income_statement' ? incomeStatement : cashFlow

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 border border-white/10 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-white/10 p-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{company.ticker?.slice(0, 2)}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{company.ticker}</h3>
                  <p className="text-sm text-gray-400">{company.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  <Calendar className="w-3 h-3 mr-1" />
                  Năm {selectedYear}
                </Badge>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              {REPORT_TYPES.map(type => {
                const Icon = type.icon
                const isActive = activeTab === type.id
                return (
                  <button
                    key={type.id}
                    onClick={() => setActiveTab(type.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                      isActive ? type.activeColor : "bg-white/5 text-gray-400 hover:bg-white/10"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {type.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {activeTab === 'balance_sheet' && renderBalanceSheet(currentData)}
            {activeTab === 'income_statement' && renderIncomeStatement(currentData)}
            {activeTab === 'cash_flow' && renderCashFlow(currentData)}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-4 flex justify-end gap-3 bg-white/5">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Download className="w-4 h-4 mr-2" />
              Xuất PDF
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function FinancialReports() {
  const [companies, setCompanies] = useState([])
  const [expandedCompany, setExpandedCompany] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      const response = await api.get('/companies')
      setCompanies(Array.isArray(response) ? response : [])
    } catch (error) {
      console.error('Error fetching companies:', error)
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async (ticker) => {
    try {
      const [balanceSheets, incomeStatements, cashFlows] = await Promise.all([
        api.get(`/companies/${ticker}/balance-sheets`).catch(() => []),
        api.get(`/companies/${ticker}/income-statements`).catch(() => []),
        api.get(`/companies/${ticker}/cash-flows`).catch(() => []),
      ])

      return {
        balance_sheets: Array.isArray(balanceSheets) ? balanceSheets : [],
        income_statements: Array.isArray(incomeStatements) ? incomeStatements : [],
        cash_flows: Array.isArray(cashFlows) ? cashFlows : [],
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
      return {
        balance_sheets: [],
        income_statements: [],
        cash_flows: [],
      }
    }
  }

  const handleCompanyClick = async (ticker) => {
    if (expandedCompany === ticker) {
      setExpandedCompany(null)
    } else {
      setExpandedCompany(ticker)
      const reports = await fetchReports(ticker)
      setCompanies(prev => prev.map(c => 
        c.ticker === ticker ? { ...c, reports } : c
      ))
    }
  }

  // Khi bấm vào một năm bất kỳ -> mở modal hiện cả 3 loại báo cáo
  const handleOpenReport = (company, year) => {
    setSelectedCompany(company)
    setSelectedYear(year)
    setModalOpen(true)
  }

  // Lấy danh sách năm từ tất cả các báo cáo
  const getYearsList = (reports) => {
    const years = new Set()
    ;['balance_sheets', 'income_statements', 'cash_flows'].forEach(key => {
      reports?.[key]?.forEach(r => {
        const year = r.period_year || r.fiscal_year
        if (year) years.add(year)
      })
    })
    return Array.from(years).sort((a, b) => b - a)
  }

  const filteredCompanies = companies.filter(c => 
    c.ticker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-cyan-400" />
            Báo cáo tài chính
          </h1>
          <p className="text-gray-400 mt-1">
            Xem chi tiết báo cáo tài chính của các công ty niêm yết
          </p>
        </div>
      </div>

      {/* Search */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Tìm kiếm mã cổ phiếu hoặc tên công ty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/20 text-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Companies List */}
      <div className="space-y-3">
        {filteredCompanies.map((company) => {
          const isExpanded = expandedCompany === company.ticker
          const reports = company.reports || {}
          const yearsList = getYearsList(reports)

          return (
            <Card key={company.ticker} className="bg-white/5 border-white/10 overflow-hidden">
              <button
                onClick={() => handleCompanyClick(company.ticker)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold">{company.ticker?.slice(0, 2)}</span>
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white">{company.ticker}</h3>
                    <p className="text-sm text-gray-400">{company.name}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-gray-400">
                    {company.industry || 'N/A'}
                  </Badge>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10 overflow-hidden"
                  >
                    <div className="p-6 bg-white/5">
                      <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                        Chọn năm báo cáo
                      </h4>
                      
                      {yearsList.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {yearsList.map(year => (
                            <button
                              key={year}
                              onClick={() => handleOpenReport(company, year)}
                              className="px-4 py-2 bg-white/10 hover:bg-cyan-500/30 border border-white/10 hover:border-cyan-500/50 rounded-lg text-white font-medium transition-all flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4" />
                              {year}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">Đang tải dữ liệu...</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )
        })}

        {filteredCompanies.length === 0 && (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Không tìm thấy công ty phù hợp</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Report Modal - hiển thị cả 3 loại báo cáo với tabs */}
      <ReportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        company={selectedCompany}
        reports={selectedCompany?.reports}
        selectedYear={selectedYear}
      />
    </div>
  )
}
