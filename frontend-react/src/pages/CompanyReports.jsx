import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  FileText,
  Calendar,
  Building2,
  TrendingUp,
  DollarSign,
  Wallet,
  Download,
  Eye,
  X,
  ChevronRight,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui'
import { formatCurrency } from '../utils/formatters'
import { cn } from '../utils/helpers'
import api from '../services/api'

// Report type configurations
const REPORT_TYPES = [
  { 
    id: 'balance_sheet', 
    name: 'Cân đối kế toán', 
    icon: Wallet, 
    color: 'from-blue-500 to-cyan-600',
    description: 'Tài sản, nợ phải trả và vốn chủ sở hữu'
  },
  { 
    id: 'income_statement', 
    name: 'Kết quả hoạt động kinh doanh', 
    icon: TrendingUp, 
    color: 'from-green-500 to-emerald-600',
    description: 'Doanh thu, chi phí và lợi nhuận'
  },
  { 
    id: 'cash_flow', 
    name: 'Lưu chuyển tiền tệ', 
    icon: DollarSign, 
    color: 'from-purple-500 to-pink-600',
    description: 'Dòng tiền từ hoạt động kinh doanh, đầu tư và tài chính'
  },
]

// Modal hiển thị 3 bảng báo cáo chi tiết
const ReportDetailModal = ({ isOpen, onClose, reports, type, ticker }) => {
  if (!isOpen || !reports) return null

  const reportConfig = REPORT_TYPES.find(r => r.id === type)
  const Icon = reportConfig?.icon || FileText

  const renderBalanceSheetTable = (data) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left p-3 text-gray-400 font-medium">Kỳ báo cáo</th>
            {data.slice(0, 5).map((r, i) => (
              <th key={i} className="text-right p-3 text-white font-medium">
                {r.fiscal_year || r.quarter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* TÀI SẢN */}
          <tr className="bg-blue-500/10">
            <td colSpan={6} className="p-2 font-semibold text-blue-400">TÀI SẢN</td>
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-300 font-medium">Tổng tài sản</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-white font-bold">
                {formatCurrency(r.total_assets)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Tài sản ngắn hạn</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-gray-300">
                {formatCurrency(r.current_assets)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-10">+ Tiền và tương đương</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-gray-300">
                {formatCurrency(r.cash)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Tài sản dài hạn</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-gray-300">
                {formatCurrency(r.long_term_assets)}
              </td>
            ))}
          </tr>

          {/* NỢ PHẢI TRẢ */}
          <tr className="bg-red-500/10">
            <td colSpan={6} className="p-2 font-semibold text-red-400">NỢ PHẢI TRẢ</td>
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-300 font-medium">Tổng nợ phải trả</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-white font-bold">
                {formatCurrency(r.total_liabilities)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Nợ ngắn hạn</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-gray-300">
                {formatCurrency(r.current_liabilities)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Nợ dài hạn</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-gray-300">
                {formatCurrency(r.long_term_liabilities)}
              </td>
            ))}
          </tr>

          {/* VỐN CHỦ SỞ HỮU */}
          <tr className="bg-green-500/10">
            <td colSpan={6} className="p-2 font-semibold text-green-400">VỐN CHỦ SỞ HỮU</td>
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-300 font-medium">Tổng vốn chủ sở hữu</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-white font-bold">
                {formatCurrency(r.shareholders_equity || r.total_equity)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Vốn điều lệ</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-gray-300">
                {formatCurrency(r.charter_capital)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Lợi nhuận chưa phân phối</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-gray-300">
                {formatCurrency(r.retained_earnings)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )

  const renderIncomeStatementTable = (data) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left p-3 text-gray-400 font-medium">Kỳ báo cáo</th>
            {data.slice(0, 5).map((r, i) => (
              <th key={i} className="text-right p-3 text-white font-medium">
                {r.fiscal_year || r.quarter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* DOANH THU */}
          <tr className="bg-cyan-500/10">
            <td colSpan={6} className="p-2 font-semibold text-cyan-400">DOANH THU</td>
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-300 font-medium">Doanh thu thuần</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-white font-bold">
                {formatCurrency(r.revenue || r.net_revenue)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Giá vốn hàng bán</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-red-300">
                ({formatCurrency(r.cost_of_revenue)})
              </td>
            ))}
          </tr>

          {/* LỢI NHUẬN */}
          <tr className="bg-green-500/10">
            <td colSpan={6} className="p-2 font-semibold text-green-400">LỢI NHUẬN</td>
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-300 font-medium">Lợi nhuận gộp</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-green-400 font-bold">
                {formatCurrency(r.gross_profit)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Chi phí bán hàng</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-red-300">
                ({formatCurrency(r.selling_expenses)})
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Chi phí quản lý</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-red-300">
                ({formatCurrency(r.admin_expenses)})
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-300 font-medium">Lợi nhuận hoạt động</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-green-400 font-bold">
                {formatCurrency(r.operating_income)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">+ Thu nhập tài chính</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-green-300">
                {formatCurrency(r.financial_income)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Chi phí tài chính</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-red-300">
                ({formatCurrency(r.financial_expenses)})
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-300 font-medium">Lợi nhuận trước thuế</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-green-400 font-bold">
                {formatCurrency(r.profit_before_tax)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Thuế TNDN</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-red-300">
                ({formatCurrency(r.income_tax)})
              </td>
            ))}
          </tr>
          <tr className="border-t-2 border-green-500/30 bg-green-500/10">
            <td className="p-3 text-white font-bold">LỢI NHUẬN SAU THUẾ</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-green-400 font-bold text-lg">
                {formatCurrency(r.net_income || r.profit)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )

  const renderCashFlowTable = (data) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left p-3 text-gray-400 font-medium">Kỳ báo cáo</th>
            {data.slice(0, 5).map((r, i) => (
              <th key={i} className="text-right p-3 text-white font-medium">
                {r.fiscal_year || r.quarter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* HOẠT ĐỘNG KINH DOANH */}
          <tr className="bg-cyan-500/10">
            <td colSpan={6} className="p-2 font-semibold text-cyan-400">HOẠT ĐỘNG KINH DOANH</td>
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-300 font-medium">Lưu chuyển tiền từ HĐKD</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className={cn(
                "p-3 text-right font-mono font-bold",
                (r.operating_cash_flow || 0) > 0 ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(r.operating_cash_flow)}
              </td>
            ))}
          </tr>

          {/* HOẠT ĐỘNG ĐẦU TƯ */}
          <tr className="bg-blue-500/10">
            <td colSpan={6} className="p-2 font-semibold text-blue-400">HOẠT ĐỘNG ĐẦU TƯ</td>
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-300 font-medium">Lưu chuyển tiền từ đầu tư</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className={cn(
                "p-3 text-right font-mono font-bold",
                (r.investing_cash_flow || 0) > 0 ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(r.investing_cash_flow)}
              </td>
            ))}
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-400 pl-6">- Mua sắm TSCĐ</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className="p-3 text-right font-mono text-red-300">
                ({formatCurrency(r.capex)})
              </td>
            ))}
          </tr>

          {/* HOẠT ĐỘNG TÀI CHÍNH */}
          <tr className="bg-purple-500/10">
            <td colSpan={6} className="p-2 font-semibold text-purple-400">HOẠT ĐỘNG TÀI CHÍNH</td>
          </tr>
          <tr className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 text-gray-300 font-medium">Lưu chuyển tiền từ tài chính</td>
            {data.slice(0, 5).map((r, i) => (
              <td key={i} className={cn(
                "p-3 text-right font-mono font-bold",
                (r.financing_cash_flow || 0) > 0 ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(r.financing_cash_flow)}
              </td>
            ))}
          </tr>

          {/* TỔNG HỢP */}
          <tr className="border-t-2 border-white/20 bg-white/5">
            <td className="p-3 text-white font-bold">Tăng/Giảm tiền thuần</td>
            {data.slice(0, 5).map((r, i) => {
              const net = (r.operating_cash_flow || 0) + (r.investing_cash_flow || 0) + (r.financing_cash_flow || 0)
              return (
                <td key={i} className={cn(
                  "p-3 text-right font-mono font-bold text-lg",
                  net > 0 ? "text-green-400" : "text-red-400"
                )}>
                  {formatCurrency(net)}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )

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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 border border-white/10 rounded-xl max-w-7xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className={cn(
            "border-b border-white/10 p-6 flex items-center justify-between",
            `bg-gradient-to-r ${reportConfig?.color}/10`
          )}>
            <div className="flex items-center gap-3">
              <div className={cn("p-3 rounded-lg bg-gradient-to-br", reportConfig?.color)}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{reportConfig?.name}</h3>
                <p className="text-sm text-gray-400">{ticker} - So sánh theo năm</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {type === 'balance_sheet' && renderBalanceSheetTable(reports)}
            {type === 'income_statement' && renderIncomeStatementTable(reports)}
            {type === 'cash_flow' && renderCashFlowTable(reports)}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-4 flex justify-end gap-3 bg-white/5">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Download className="w-4 h-4 mr-2" />
              Xuất Excel
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function CompanyReports() {
  const { ticker } = useParams()
  const [company, setCompany] = useState(null)
  const [reports, setReports] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedReportType, setSelectedReportType] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (ticker) {
      fetchData()
    }
  }, [ticker])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [companyRes, balanceSheets, incomeStatements, cashFlows] = await Promise.all([
        api.get(`/companies/${ticker}`).catch(() => null),
        api.get(`/companies/${ticker}/balance-sheets`).catch(() => ({ data: [] })),
        api.get(`/companies/${ticker}/income-statements`).catch(() => ({ data: [] })),
        api.get(`/companies/${ticker}/cash-flows`).catch(() => ({ data: [] })),
      ])

      if (companyRes) {
        setCompany(companyRes.data || companyRes)
      }

      setReports({
        balance_sheet: balanceSheets.data || [],
        income_statement: incomeStatements.data || [],
        cash_flow: cashFlows.data || [],
      })
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewReport = (reportType) => {
    setSelectedReportType(reportType)
    setModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Đang tải dữ liệu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại Dashboard
      </Link>

      {/* Company Header */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{ticker?.slice(0, 2)}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <FileText className="w-7 h-7 text-cyan-400" />
                {ticker}
              </h1>
              <p className="text-gray-400">{company?.company_name || company?.name || 'Đang tải...'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {REPORT_TYPES.map((reportType) => {
          const Icon = reportType.icon
          const reportData = reports[reportType.id] || []
          const latestReport = reportData[0]

          return (
            <Card key={reportType.id} className="bg-white/5 border-white/10 overflow-hidden group hover:border-cyan-500/50 transition-all">
              <div className={cn("h-2 bg-gradient-to-r", reportType.color)} />
              
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <div className={cn("p-3 rounded-lg bg-gradient-to-br", reportType.color)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">{reportType.name}</h3>
                    <p className="text-xs text-gray-500 font-normal">{reportType.description}</p>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {reportData.length > 0 ? (
                  <>
                    {/* Latest Report Info */}
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Báo cáo mới nhất:</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                        <span className="font-medium text-white">
                          {latestReport?.fiscal_year || latestReport?.quarter}
                        </span>
                      </div>
                    </div>

                    {/* Available Reports Count */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Số báo cáo:</span>
                      <Badge className="bg-cyan-500/20 text-cyan-400">
                        {reportData.length} kỳ
                      </Badge>
                    </div>

                    {/* View Button */}
                    <Button
                      onClick={() => handleViewReport(reportType.id)}
                      className={cn(
                        "w-full bg-gradient-to-r group-hover:shadow-lg transition-all",
                        reportType.color
                      )}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Xem chi tiết
                      <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Chưa có dữ liệu</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Report Detail Modal */}
      <ReportDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        reports={reports[selectedReportType]}
        type={selectedReportType}
        ticker={ticker}
      />
    </div>
  )
}
