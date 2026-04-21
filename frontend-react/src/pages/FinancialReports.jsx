import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Search,
  TrendingUp,
  Wallet,
  DollarSign,
  X,
} from 'lucide-react'
import { Badge, Card, CardContent, Input } from '../components/ui'
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
  {
    id: 'balance_sheet',
    key: 'balance_sheets',
    name: 'Can doi ke toan',
    icon: Wallet,
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    id: 'income_statement',
    key: 'income_statements',
    name: 'Ket qua kinh doanh',
    icon: TrendingUp,
    gradient: 'from-indigo-500 to-purple-500',
  },
  {
    id: 'cash_flow',
    key: 'cash_flows',
    name: 'Luu chuyen tien te',
    icon: DollarSign,
    gradient: 'from-blue-500 to-purple-600',
  },
]

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

const periodYear = (record) => record?.period_year ?? record?.fiscal_year ?? null
const periodQuarter = (record) => record?.period_quarter ?? record?.quarter ?? null

const periodKey = (record) => `${periodYear(record) ?? 'na'}-${periodQuarter(record) ?? 0}`

const formatPeriodLabel = (record) => {
  const year = periodYear(record)
  const quarter = periodQuarter(record)

  if (quarter !== null && quarter !== undefined && `${quarter}` !== '' && Number(quarter) > 0) {
    return `Q${quarter}/${year ?? '-'}`
  }

  if (year !== null && year !== undefined && `${year}` !== '') {
    return `${year}`
  }

  return record?.period_label || 'Ky khong xac dinh'
}

const collectFields = (record) =>
  Object.keys(record || {})
    .filter((key) => !META_KEYS.has(key))
    .sort((a, b) => a.localeCompare(b))

const collectFieldCountFromReports = (reportSet) => {
  const fields = new Set()

  ;['balance_sheets', 'income_statements', 'cash_flows'].forEach((key) => {
    toArray(reportSet?.[key]).forEach((record) => {
      Object.keys(record || {}).forEach((field) => {
        if (!META_KEYS.has(field)) {
          fields.add(field)
        }
      })
    })
  })

  return fields.size
}

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()

const humanizeFieldName = (field) =>
  String(field)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '-'

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
      if (year > 0) {
        yearSet.add(year)
      }
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
        const label = quarter > 0 ? `Q${quarter}` : 'Ca nam'
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
  if (!periodSelection) {
    return reportList[0] || null
  }
  return (
    reportList.find(
      (record) =>
        Number(periodYear(record) || 0) === Number(periodSelection.year || 0) &&
        Number(periodQuarter(record) || 0) === Number(periodSelection.quarter || 0)
    ) || null
  )
}

const DynamicRecordTable = ({ record, metricQuery }) => {
  if (!record) {
    return (
      <div className="rounded-xl border border-blue-500/20 bg-slate-950/55 p-8 text-center text-blue-200/70">
        Khong tim thay du lieu cho ky nay.
      </div>
    )
  }

  const fields = collectFields(record)
  const keyword = normalizeText(metricQuery)
  const visibleFields =
    keyword === ''
      ? fields
      : fields.filter((field) => {
          const byName = normalizeText(field)
          const byLabel = normalizeText(humanizeFieldName(field))
          return byName.includes(keyword) || byLabel.includes(keyword)
        })

  if (!visibleFields.length) {
    return (
      <div className="rounded-xl border border-blue-500/20 bg-slate-950/55 p-8 text-center text-blue-200/70">
        Khong co cot phu hop voi tu khoa tim kiem.
      </div>
    )
  }

  return (
    <div className="max-h-[60vh] overflow-auto rounded-xl border border-blue-500/25 bg-slate-950/55">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-blue-500/20 bg-gradient-to-r from-slate-900 via-blue-950/70 to-purple-950/70">
            <th className="w-[45%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-blue-200">Chi tieu</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-blue-200">Gia tri</th>
          </tr>
        </thead>
        <tbody>
          {visibleFields.map((field, index) => (
            <tr
              key={field}
              className={cn('border-t border-white/5 transition-colors hover:bg-blue-500/[0.05]', index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent')}
            >
              <td className="px-4 py-3 align-top">
                <p className="font-semibold text-blue-50">{humanizeFieldName(field)}</p>
                <p className="text-xs text-blue-300/55">{field}</p>
              </td>
              <td className="px-4 py-3 text-right font-mono text-blue-100">{formatValue(record[field])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ReportModal = ({
  isOpen,
  onClose,
  company,
  reports,
  selectedYear,
  selectedPeriod,
  periodOptions,
  onSelectPeriod,
}) => {
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
  const activeFieldCount = activeRecord ? collectFields(activeRecord).length : 0

  const selectedPeriodLabel =
    selectedPeriod && Number(selectedPeriod.quarter || 0) > 0
      ? `Q${selectedPeriod.quarter}/${selectedPeriod.year}`
      : `${selectedPeriod?.year || selectedYear || '-'}`

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2 }}
          onClick={(event) => event.stopPropagation()}
          className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-blue-500/30 bg-slate-950"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative border-b border-blue-500/20 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-blue-50">{company.ticker}</h3>
                <p className="mt-1 text-sm text-blue-200/70">{company.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  {selectedPeriodLabel}
                </Badge>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-blue-500/20 p-2 text-blue-200 transition-colors hover:bg-blue-500/15"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {REPORT_TYPES.map((type) => {
                const Icon = type.icon
                const isActive = activeTab === type.id

                return (
                  <button
                    key={type.id}
                    onClick={() => setActiveTab(type.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all',
                      isActive
                        ? `border-blue-400/40 bg-gradient-to-r ${type.gradient} text-white shadow-lg shadow-blue-500/25`
                        : 'border-blue-500/20 bg-slate-900/60 text-blue-200/80 hover:bg-blue-500/10'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {type.name}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-blue-500/15 pt-3">
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
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                      isActivePeriod
                        ? 'border-blue-400/45 bg-blue-500/20 text-blue-50'
                        : 'border-blue-500/25 bg-slate-900/60 text-blue-200/80 hover:bg-blue-500/10'
                    )}
                  >
                    {periodOption.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-2 border-b border-blue-500/15 px-6 py-3">
            <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-200">{activeFieldCount} cot du lieu</Badge>
            <Badge className="border-indigo-500/30 bg-indigo-500/10 text-indigo-200">Ky da chon theo nam -&gt; quy</Badge>

            <div className="ml-auto w-full max-w-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200/50" />
                <Input
                  value={metricQuery}
                  onChange={(event) => setMetricQuery(event.target.value)}
                  placeholder="Tim nhanh chi tieu..."
                  className="border-blue-500/25 bg-slate-900/70 pl-9 text-blue-50 placeholder:text-blue-200/40"
                />
              </div>
            </div>
          </div>

          <div className="relative overflow-y-auto p-6">
            <DynamicRecordTable record={activeRecord} metricQuery={metricQuery} />
          </div>

          <div className="relative border-t border-blue-500/20 bg-slate-900/65 px-6 py-4 text-xs text-blue-200/60">
            Bao cao hien thi toan bo cot cua ky duoc chon theo quy trinh: ma cong ty -&gt; nam -&gt; quy.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
    if (targetCompany?.reports) {
      return
    }

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

  const handleSelectPeriodInModal = (period) => {
    setSelectedPeriod(period)
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
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/25 bg-slate-950 p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />
        <div className="pointer-events-none absolute -left-16 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-52 w-52 rounded-full bg-purple-500/20 blur-3xl" />

        <h1 className="relative flex items-center gap-3 text-3xl font-bold text-blue-50">
          <FileText className="h-8 w-8 text-blue-300" />
          Bao cao tai chinh
        </h1>
          <p className="relative mt-2 text-blue-200/70">
            Luong moi: Bam ma cong ty -&gt; chon nam bao cao -&gt; chon quy bao cao -&gt; xem full cot du lieu.
          </p>
      </div>

      <Card className="border-blue-500/20 bg-slate-900/65">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-200/55" />
            <Input
              placeholder="Tim ma co phieu hoac ten cong ty..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="border-blue-500/20 bg-slate-950/55 pl-10 text-blue-50 placeholder:text-blue-200/40"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading && (
          <Card className="border-blue-500/20 bg-slate-900/65">
            <CardContent className="p-8 text-center text-blue-200/70">Dang tai danh sach cong ty...</CardContent>
          </Card>
        )}

        {!loading &&
          filteredCompanies.map((company) => {
            const isExpanded = expandedCompany === company.ticker
            const reports = company.reports || {}
            const years = getYearsList(reports)
            const fieldCount = collectFieldCountFromReports(reports)
            const highlightedYear = selectedYearByTicker[company.ticker] || null

            return (
              <Card
                key={company.ticker}
                className="overflow-hidden border-blue-500/20 bg-gradient-to-br from-slate-950/85 via-blue-950/20 to-purple-950/20"
              >
                <button
                  onClick={() => handleCompanyClick(company.ticker)}
                  className="w-full px-4 py-4 transition-colors hover:bg-blue-500/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-left">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 font-bold text-white shadow-lg shadow-blue-500/25">
                        {company.ticker?.slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-blue-50">{company.ticker}</h3>
                        <p className="text-sm text-blue-200/65">{company.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">{years.length || 0} nam</Badge>
                      <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-200">{fieldCount || 0} cot</Badge>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-blue-200/70" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-blue-200/70" />
                      )}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-blue-500/15"
                    >
                      <div className="space-y-3 bg-slate-900/50 p-5">
                        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-100">
                          <Calendar className="h-4 w-4 text-blue-300" />
                          Chon nam bao cao
                        </p>

                        {years.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {years.map((year) => (
                              <button
                                key={`${company.ticker}-${year}`}
                                onClick={() => handleOpenYear(company, year)}
                                className={cn(
                                  'rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                                  highlightedYear === year
                                    ? 'border-blue-400/45 bg-gradient-to-r from-blue-500/25 to-purple-500/25 text-blue-50'
                                    : 'border-blue-500/25 bg-slate-950/60 text-blue-200/80 hover:bg-blue-500/10'
                                )}
                              >
                                Nam {year}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-blue-200/55">Chua co du lieu nam cho cong ty nay.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )
          })}

        {!loading && filteredCompanies.length === 0 && (
          <Card className="border-blue-500/20 bg-slate-900/65">
            <CardContent className="p-12 text-center">
              <Database className="mx-auto mb-4 h-14 w-14 text-blue-300/40" />
              <p className="text-blue-200/70">Khong tim thay cong ty phu hop.</p>
            </CardContent>
          </Card>
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
        onSelectPeriod={handleSelectPeriodInModal}
      />
    </div>
  )
}