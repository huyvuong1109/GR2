import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Database,
  DollarSign,
  FileText,
  Search,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { formatCurrency } from '../utils/formatters'
import { cn } from '../utils/helpers'
import api from '../services/api'

const META_KEYS = new Set([
  'id',
  'ticker',
  'company_type',
  'period_type',
  'period_year',
  'period_quarter',
  'fiscal_year',
  'quarter',
  'period_label',
])

const REPORT_TYPES = [
  { id: 'balance_sheet', key: 'balance_sheets', name: 'Cân đối kế toán', icon: Wallet },
  { id: 'income_statement', key: 'income_statements', name: 'Kết quả kinh doanh', icon: TrendingUp },
  { id: 'cash_flow', key: 'cash_flows', name: 'Lưu chuyển tiền tệ', icon: DollarSign },
]

const FIELD_LABELS = {
  total_assets: 'Tổng tài sản',
  current_assets: 'Tài sản ngắn hạn',
  non_current_assets: 'Tài sản dài hạn',
  cash: 'Tiền và tương đương tiền',
  short_term_investments: 'Đầu tư tài chính ngắn hạn',
  accounts_receivable: 'Các khoản phải thu',
  inventories: 'Hàng tồn kho',
  total_liabilities: 'Tổng nợ phải trả',
  current_liabilities: 'Nợ ngắn hạn',
  non_current_liabilities: 'Nợ dài hạn',
  long_term_liabilities: 'Nợ dài hạn',
  short_term_debt: 'Vay ngắn hạn',
  long_term_debt: 'Vay dài hạn',
  total_equity: 'Vốn chủ sở hữu',
  shareholders_equity: 'Vốn chủ sở hữu',
  charter_capital: 'Vốn điều lệ',
  retained_earnings: 'Lợi nhuận sau thuế chưa phân phối',
  revenue: 'Doanh thu',
  net_revenue: 'Doanh thu thuần',
  cost_of_revenue: 'Giá vốn hàng bán',
  cost_of_goods_sold: 'Giá vốn hàng bán',
  gross_profit: 'Lợi nhuận gộp',
  selling_expenses: 'Chi phí bán hàng',
  admin_expenses: 'Chi phí quản lý doanh nghiệp',
  operating_income: 'Lợi nhuận từ hoạt động kinh doanh',
  financial_income: 'Doanh thu tài chính',
  financial_expenses: 'Chi phí tài chính',
  profit_before_tax: 'Lợi nhuận trước thuế',
  income_tax: 'Chi phí thuế thu nhập doanh nghiệp',
  net_income: 'Lợi nhuận sau thuế',
  profit: 'Lợi nhuận sau thuế',
  net_profit_to_shareholders: 'Lợi nhuận sau thuế của cổ đông công ty mẹ',
  operating_cash_flow: 'Lưu chuyển tiền thuần từ hoạt động kinh doanh',
  investing_cash_flow: 'Lưu chuyển tiền thuần từ hoạt động đầu tư',
  financing_cash_flow: 'Lưu chuyển tiền thuần từ hoạt động tài chính',
  capex: 'Chi mua sắm tài sản cố định',
  dividends_paid: 'Cổ tức đã trả',
  ending_cash: 'Tiền và tương đương tiền cuối kỳ',
  net_change_in_cash: 'Lưu chuyển tiền thuần trong kỳ',
}

const TOKEN_LABELS = {
  tong: 'tổng',
  tai: 'tài',
  san: 'sản',
  ngan: 'ngắn',
  dai: 'dài',
  han: 'hạn',
  tien: 'tiền',
  va: 'và',
  tuong: 'tương',
  duong: 'đương',
  dau: 'đầu',
  tu: 'tư',
  chinh: 'chính',
  phai: 'phải',
  thu: 'thu',
  khach: 'khách',
  hang: 'hàng',
  hang_ton_kho: 'hàng tồn kho',
  no: 'nợ',
  tra: 'trả',
  von: 'vốn',
  chu: 'chủ',
  so: 'sở',
  huu: 'hữu',
  loi: 'lợi',
  nhuan: 'nhuận',
  sau: 'sau',
  thue: 'thuế',
  chua: 'chưa',
  phan: 'phân',
  phoi: 'phối',
  doanh: 'doanh',
  gia: 'giá',
  ban: 'bán',
  chi: 'chi',
  phi: 'phí',
  quan: 'quản',
  ly: 'lý',
  hoat: 'hoạt',
  dong: 'động',
  kinh: 'kinh',
  co: 'cổ',
  tuc: 'tức',
  da: 'đã',
  cuoi: 'cuối',
  ky: 'kỳ',
  lctt: 'LCTT',
  hdkd: 'HĐKD',
  hddt: 'HĐĐT',
  hdtc: 'HĐTC',
  tndn: 'TNDN',
  nhnn: 'NHNN',
}

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

const periodYear = (record) => record?.period_year ?? record?.fiscal_year ?? null
const periodQuarter = (record) => record?.period_quarter ?? record?.quarter ?? null

const collectFields = (record) =>
  Object.keys(record || {})
    .filter((key) => !META_KEYS.has(key))
    .sort((a, b) => a.localeCompare(b))

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()

const humanizeFieldName = (field) =>
  FIELD_LABELS[field] ||
  String(field)
    .split('_')
    .filter(Boolean)
    .map((token) => TOKEN_LABELS[token] || token)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\p{Ll}/u, (char) => char.toUpperCase())

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '0'

  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatCurrency(value, false)
  }

  const parsed = Number(value)
  if (!Number.isNaN(parsed) && Number.isFinite(parsed) && `${value}`.trim() !== '') {
    return formatCurrency(parsed, false)
  }

  return String(value)
}

const getYearsList = (reports) => {
  const yearSet = new Set()

  ;['balance_sheets', 'income_statements', 'cash_flows'].forEach((key) => {
    toArray(reports?.[key]).forEach((record) => {
      const year = Number(periodYear(record) || 0)
      if (year > 0) yearSet.add(year)
    })
  })

  return Array.from(yearSet).sort((a, b) => b - a)
}

const getQuarterOptionsByYear = (reports, selectedYear) => {
  if (!selectedYear) return []

  const quarterMap = new Map()

  ;['balance_sheets', 'income_statements', 'cash_flows'].forEach((key) => {
    toArray(reports?.[key]).forEach((record) => {
      const year = Number(periodYear(record) || 0)
      if (year !== selectedYear) return

      const quarter = Number(periodQuarter(record) || 0)
      const keyValue = `${year}-${quarter}`

      if (!quarterMap.has(keyValue)) {
        const label = quarter > 0 ? `Q${quarter}` : 'Cả năm'
        quarterMap.set(keyValue, {
          key: keyValue,
          year,
          quarter,
          label,
          fullLabel: quarter > 0 ? `${label}/${year}` : `${year}`,
        })
      }
    })
  })

  return Array.from(quarterMap.values()).sort((a, b) => b.quarter - a.quarter)
}

const getRecordByPeriod = (reports, reportTypeKey, periodSelection) => {
  const reportList = toArray(reports?.[reportTypeKey])
  if (!periodSelection) return reportList[0] || null
  return (
    reportList.find(
      (record) =>
        Number(periodYear(record) || 0) === Number(periodSelection.year || 0) &&
        Number(periodQuarter(record) || 0) === Number(periodSelection.quarter || 0)
    ) || null
  )
}

function DynamicRecordTable({ record, metricQuery }) {
  if (!record) {
    return <div className="alert-info text-center text-sm">Không tìm thấy dữ liệu cho kỳ này.</div>
  }

  const fields = collectFields(record)
  const keyword = normalizeText(metricQuery)
  const visibleFields =
    keyword === ''
      ? fields
      : fields.filter((field) => normalizeText(field).includes(keyword) || normalizeText(humanizeFieldName(field)).includes(keyword))

  if (!visibleFields.length) {
    return <div className="alert-info text-center text-sm">Không có khoản mục phù hợp với từ khóa tìm kiếm.</div>
  }

  return (
    <div className="max-h-[58vh] overflow-auto rounded-lg border border-white/10 bg-white/[0.035]">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-white/10 bg-[#191c1e]">
            <th className="w-[48%] px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">Khoản mục</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-black uppercase tracking-widest text-slate-400">Giá trị</th>
          </tr>
        </thead>
        <tbody>
          {visibleFields.map((field, index) => (
            <tr
              key={field}
              className={cn('border-t border-white/[0.06] transition-colors hover:bg-white/[0.06]', index % 2 === 0 ? 'bg-white/[0.025]' : 'bg-transparent')}
            >
              <td className="px-4 py-2.5 align-top">
                <p className="font-bold text-slate-100">{humanizeFieldName(field)}</p>
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-slate-100">{formatValue(record[field])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportModal({
  isOpen,
  onClose,
  company,
  reports,
  selectedYear,
  selectedPeriod,
  periodOptions,
  onSelectPeriod,
}) {
  const [activeTab, setActiveTab] = useState('balance_sheet')
  const [metricQuery, setMetricQuery] = useState('')

  useEffect(() => {
    if (isOpen) {
      setActiveTab('balance_sheet')
      setMetricQuery('')
    }
  }, [isOpen])

  if (!isOpen || !company) return null

  const activeReportType = REPORT_TYPES.find((type) => type.id === activeTab)
  const activeRecord = getRecordByPeriod(reports, activeReportType?.key, selectedPeriod)
  const selectedPeriodLabel =
    selectedPeriod && Number(selectedPeriod.quarter || 0) > 0
      ? `Q${selectedPeriod.quarter}/${selectedPeriod.year}`
      : `${selectedPeriod?.year || selectedYear || '-'}`

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
          onClick={(event) => event.stopPropagation()}
          className="glass-card relative flex max-h-[88dvh] w-full max-w-[min(94vw,1180px)] flex-col overflow-hidden"
        >
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-100">{company.ticker}</h3>
                <p className="mt-0.5 text-xs text-slate-400">{company.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-slate-300">
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  {selectedPeriodLabel}
                </span>
                <button type="button" onClick={onClose} className="btn-ghost p-2" aria-label="Đóng báo cáo">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {REPORT_TYPES.map((type) => {
                const Icon = type.icon
                const isActive = activeTab === type.id
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setActiveTab(type.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                      isActive
                        ? 'border-emerald-300/30 bg-emerald-400/12 text-emerald-300'
                        : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-emerald-300/25 hover:text-emerald-300'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {type.name}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
              {(periodOptions || []).map((periodOption) => {
                const isActivePeriod =
                  Number(selectedPeriod?.year || 0) === Number(periodOption.year || 0) &&
                  Number(selectedPeriod?.quarter || 0) === Number(periodOption.quarter || 0)

                return (
                  <button
                    key={`${periodOption.key}-${activeTab}`}
                    type="button"
                    onClick={() => onSelectPeriod(periodOption)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-bold transition-all',
                      isActivePeriod
                        ? 'border-emerald-300/30 bg-emerald-400/12 text-emerald-300'
                        : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {periodOption.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-b border-white/10 px-5 py-2.5">
            <div className="w-full max-w-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={metricQuery}
                  onChange={(event) => setMetricQuery(event.target.value)}
                  placeholder="Tìm nhanh khoản mục..."
                  className="input-primary h-9 pl-9 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="overflow-y-auto p-4">
            <DynamicRecordTable record={activeRecord} metricQuery={metricQuery} />
          </div>

          <div className="border-t border-white/10 bg-white/[0.025] px-5 py-3 text-[11px] text-slate-500">
            Báo cáo hiển thị theo mã công ty, năm báo cáo và kỳ báo cáo đã chọn.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

export default function FinancialReports() {
  const [companies, setCompanies] = useState([])
  const [expandedCompany, setExpandedCompany] = useState(null)
  const [selectedYearByTicker, setSelectedYearByTicker] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState(null)

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
        balance_sheets: toArray(balanceSheets),
        income_statements: toArray(incomeStatements),
        cash_flows: toArray(cashFlows),
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
      return
    }

    setExpandedCompany(ticker)

    const targetCompany = companies.find((item) => item.ticker === ticker)
    if (targetCompany?.reports) return

    const reports = await fetchReports(ticker)
    setCompanies((prev) => prev.map((company) => (company.ticker === ticker ? { ...company, reports } : company)))
  }

  const handleOpenYear = (company, year) => {
    const reports = company.reports || {}
    const periodOptions = getQuarterOptionsByYear(reports, year)
    const defaultPeriod = periodOptions[0] || { key: `${year}-0`, year, quarter: 0, label: `${year}`, fullLabel: `${year}` }

    setSelectedYearByTicker((prev) => ({
      ...prev,
      [company.ticker]: year,
    }))

    setSelectedCompany(company)
    setSelectedYear(year)
    setSelectedPeriod(defaultPeriod)
    setModalOpen(true)
  }

  const filteredCompanies = useMemo(
    () =>
      companies.filter(
        (company) =>
          company.ticker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          company.name?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [companies, searchQuery]
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-5xl">
          <h1 className="text-3xl font-black leading-tight text-slate-100 md:text-4xl">Báo cáo tài chính</h1>
          <p className="mt-3 max-w-4xl text-base leading-7 text-slate-400">
            Tra cứu báo cáo theo mã công ty, năm và kỳ để xem nhanh các khoản mục tài chính quan trọng.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-emerald-300" />
            <div>
              <h2 className="section-title">Chọn doanh nghiệp</h2>
              <p className="section-subtitle">Tìm mã cổ phiếu hoặc tên công ty để mở báo cáo hiện có.</p>
            </div>
          </div>
        </div>
        <div className="panel-body">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              placeholder="Tìm mã cổ phiếu hoặc tên công ty..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="input-primary h-12 pl-11 text-sm font-semibold"
            />
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {loading && (
          <div className="panel">
            <div className="panel-body text-center text-sm text-slate-400">Đang tải danh sách công ty...</div>
          </div>
        )}

        {!loading &&
          filteredCompanies.map((company) => {
            const isExpanded = expandedCompany === company.ticker
            const reports = company.reports || {}
            const years = getYearsList(reports)
            const highlightedYear = selectedYearByTicker[company.ticker] || null

            return (
              <div key={company.ticker} className="panel">
                <button
                  type="button"
                  onClick={() => handleCompanyClick(company.ticker)}
                  className="w-full px-5 py-4 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-4 text-left">
                      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 font-black text-emerald-300">
                        {company.ticker?.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-mono text-lg font-black text-slate-100">{company.ticker}</h3>
                        <p className="truncate text-sm text-slate-400">{company.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronRight className="h-5 w-5 text-slate-500" />}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/10"
                    >
                      <div className="space-y-3 bg-white/[0.025] p-5">
                        <p className="flex items-center gap-2 text-sm font-bold text-slate-200">
                          <Calendar className="h-4 w-4 text-emerald-300" />
                          Chọn năm báo cáo
                        </p>

                        {years.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {years.map((year) => (
                              <button
                                key={`${company.ticker}-${year}`}
                                type="button"
                                onClick={() => handleOpenYear(company, year)}
                                className={cn(
                                  'rounded-lg border px-3 py-2 text-sm font-bold transition-all',
                                  highlightedYear === year
                                    ? 'border-emerald-300/30 bg-emerald-400/12 text-emerald-300'
                                    : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-emerald-300/25 hover:text-slate-200'
                                )}
                              >
                                Năm {year}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">Chưa có dữ liệu năm cho công ty này.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

        {!loading && filteredCompanies.length === 0 && (
          <div className="panel">
            <div className="panel-body text-center">
              <Database className="mx-auto mb-4 h-14 w-14 text-slate-600" />
              <p className="text-sm text-slate-400">Không tìm thấy công ty phù hợp.</p>
            </div>
          </div>
        )}
      </div>

      <ReportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        company={selectedCompany}
        reports={selectedCompany?.reports}
        selectedYear={selectedYear}
        selectedPeriod={selectedPeriod}
        periodOptions={getQuarterOptionsByYear(selectedCompany?.reports, selectedYear)}
        onSelectPeriod={setSelectedPeriod}
      />
    </div>
  )
}
