import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Database,
  Eye,
  FileText,
  Layers,
  Search,
  Wallet,
  TrendingUp,
  DollarSign,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '../components/ui'
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
    name: 'Can doi ke toan',
    icon: Wallet,
    gradient: 'from-blue-500 to-indigo-500',
    description: 'Hien thi day du tat ca cot CDKT theo tung quy',
  },
  {
    id: 'income_statement',
    name: 'Ket qua kinh doanh',
    icon: TrendingUp,
    gradient: 'from-indigo-500 to-purple-500',
    description: 'Hien thi day du tat ca cot KQKD theo tung quy',
  },
  {
    id: 'cash_flow',
    name: 'Luu chuyen tien te',
    icon: DollarSign,
    gradient: 'from-blue-500 to-purple-600',
    description: 'Hien thi day du tat ca cot LCTT theo tung quy',
  },
]

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

const formatPeriodLabel = (report) => {
  const year = report?.period_year ?? report?.fiscal_year
  const quarter = report?.period_quarter ?? report?.quarter

  if (quarter !== null && quarter !== undefined && `${quarter}` !== '' && Number(quarter) > 0) {
    return `Q${quarter}/${year ?? '-'}`
  }

  if (year !== null && year !== undefined && `${year}` !== '') {
    return `${year}`
  }

  return report?.period_label || '-'
}

const humanizeFieldName = (field) =>
  String(field)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()

const collectStatementFields = (reports) => {
  const fields = new Set()

  reports.forEach((record) => {
    Object.keys(record || {}).forEach((key) => {
      if (!META_KEYS.has(key)) {
        fields.add(key)
      }
    })
  })

  return Array.from(fields).sort((a, b) => a.localeCompare(b))
}

const formatCellValue = (value) => {
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

const DynamicStatementTable = ({ reports, fields }) => {
  if (!reports.length) {
    return (
      <div className="rounded-2xl border border-blue-500/20 bg-slate-950/50 p-8 text-center text-blue-100/70">
        Khong co du lieu cho bao cao nay.
      </div>
    )
  }

  if (!fields.length) {
    return (
      <div className="rounded-2xl border border-blue-500/20 bg-slate-950/50 p-8 text-center text-blue-100/70">
        Da co ky bao cao nhung khong tim thay cot du lieu de hien thi.
      </div>
    )
  }

  return (
    <div className="max-h-[64vh] overflow-auto rounded-2xl border border-blue-500/25 bg-slate-950/50 shadow-inner shadow-blue-950/30">
      <table className="w-full min-w-max text-sm">
        <thead className="sticky top-0 z-30 bg-gradient-to-r from-slate-900 via-blue-950/85 to-purple-950/85">
          <tr>
            <th className="sticky left-0 z-40 min-w-[320px] border-r border-blue-500/30 bg-slate-900/95 px-4 py-3 text-left font-semibold uppercase tracking-wide text-blue-200">
              Chi tieu
            </th>
            {reports.map((report, index) => (
              <th
                key={`${formatPeriodLabel(report)}-${index}`}
                className="min-w-[150px] border-l border-white/5 px-4 py-3 text-right font-semibold text-blue-100"
              >
                {formatPeriodLabel(report)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((field, rowIndex) => (
            <tr
              key={field}
              className={cn(
                'border-t border-white/5 transition-colors hover:bg-blue-500/[0.05]',
                rowIndex % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'
              )}
            >
              <td className="sticky left-0 z-10 border-r border-blue-500/20 bg-slate-950/95 px-4 py-3">
                <p className="font-semibold text-blue-50">{humanizeFieldName(field)}</p>
                <p className="text-xs text-blue-300/60">{field}</p>
              </td>
              {reports.map((report, index) => (
                <td
                  key={`${field}-${index}`}
                  className="border-l border-white/5 px-4 py-3 text-right font-mono text-blue-50/90"
                >
                  {formatCellValue(report?.[field])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ReportDetailModal = ({ isOpen, onClose, reports, type, ticker }) => {
  const [fieldQuery, setFieldQuery] = useState('')
  const reportConfig = REPORT_TYPES.find((item) => item.id === type)
  const reportRows = toArray(reports)
  const fields = collectStatementFields(reportRows)
  const Icon = reportConfig?.icon || FileText

  useEffect(() => {
    if (isOpen) {
      setFieldQuery('')
    }
  }, [isOpen, type, ticker])

  const filteredFields = useMemo(() => {
    const keyword = normalizeText(fieldQuery)
    if (!keyword) return fields

    return fields.filter((field) => {
      const fieldName = normalizeText(field)
      const fieldLabel = normalizeText(humanizeFieldName(field))
      return fieldName.includes(keyword) || fieldLabel.includes(keyword)
    })
  }, [fields, fieldQuery])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2 }}
          onClick={(event) => event.stopPropagation()}
          className="relative flex max-h-[92vh] w-full max-w-[98vw] flex-col overflow-hidden rounded-2xl border border-blue-500/30 bg-slate-950"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative flex items-start justify-between border-b border-blue-500/20 bg-gradient-to-r from-slate-950 via-blue-950/35 to-purple-950/40 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className={cn('rounded-xl bg-gradient-to-br p-3 shadow-lg shadow-blue-500/20', reportConfig?.gradient)}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-blue-50">{reportConfig?.name || 'Bao cao chi tiet'}</h3>
                <p className="mt-1 text-sm text-blue-200/70">{ticker} • Bang day du cot du lieu theo tung ky bao cao</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-blue-500/20 p-2 text-blue-200 transition-colors hover:bg-blue-500/15"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex flex-wrap items-center gap-2 border-b border-blue-500/15 bg-slate-950/80 px-6 py-3">
            <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">{reportRows.length} ky bao cao</Badge>
            <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-200">{fields.length} cot tong</Badge>
            <Badge className="border-indigo-500/30 bg-indigo-500/10 text-indigo-200">{filteredFields.length} cot dang hien thi</Badge>

            <div className="ml-auto w-full max-w-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200/50" />
                <Input
                  value={fieldQuery}
                  onChange={(event) => setFieldQuery(event.target.value)}
                  placeholder="Tim nhanh chi tieu theo ten cot..."
                  className="border-blue-500/25 bg-slate-900/70 pl-9 text-blue-50 placeholder:text-blue-200/45"
                />
              </div>
            </div>
          </div>

          <div className="relative overflow-y-auto p-6">
            <DynamicStatementTable reports={reportRows} fields={filteredFields} />
          </div>

          <div className="relative flex items-center justify-between border-t border-blue-500/20 bg-slate-900/70 px-6 py-4">
            <p className="text-xs text-blue-200/65">
              Sticky header va sticky cot chi tieu da duoc bat cho bang rong va dai.
            </p>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-blue-500/35 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20"
            >
              Dong
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
  const [reports, setReports] = useState({
    balance_sheet: [],
    income_statement: [],
    cash_flow: [],
  })
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
        api.get(`/companies/${ticker}/balance-sheets`).catch(() => []),
        api.get(`/companies/${ticker}/income-statements`).catch(() => []),
        api.get(`/companies/${ticker}/cash-flows`).catch(() => []),
      ])

      const companyPayload = companyRes?.data || companyRes || null
      if (companyPayload) {
        setCompany(companyPayload)
      }

      setReports({
        balance_sheet: toArray(balanceSheets),
        income_statement: toArray(incomeStatements),
        cash_flow: toArray(cashFlows),
      })
    } catch (error) {
      console.error('Error fetching company reports:', error)
      setReports({
        balance_sheet: [],
        income_statement: [],
        cash_flow: [],
      })
    } finally {
      setLoading(false)
    }
  }

  const reportStats = useMemo(
    () =>
      REPORT_TYPES.map((reportType) => {
        const rows = reports[reportType.id] || []
        const fields = collectStatementFields(rows)

        return {
          ...reportType,
          rowCount: rows.length,
          fieldCount: fields.length,
          latestPeriod: rows[0] ? formatPeriodLabel(rows[0]) : '-',
        }
      }),
    [reports]
  )

  const handleViewReport = (reportType) => {
    setSelectedReportType(reportType)
    setModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-blue-500/25 border-t-purple-500" />
          <p className="text-blue-200/70">Dang tai du lieu bao cao...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/25 bg-slate-950 p-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />
        <div className="pointer-events-none absolute -left-14 -top-14 h-40 w-40 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-purple-500/25 blur-3xl" />

        <Link
          to="/"
          className="relative inline-flex items-center gap-2 rounded-lg border border-blue-500/25 bg-slate-900/70 px-3 py-2 text-sm text-blue-100 transition-colors hover:bg-blue-500/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lai Dashboard
        </Link>

        <Card className="relative mt-4 border-blue-500/20 bg-slate-900/60 p-0">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
                {ticker?.slice(0, 2)}
              </div>
              <div>
                <h1 className="flex items-center gap-3 text-2xl font-bold text-blue-50">
                  <FileText className="h-7 w-7 text-blue-300" />
                  {ticker}
                </h1>
                <p className="mt-1 text-blue-200/70">{company?.company_name || company?.name || 'Dang tai ten cong ty...'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {reportStats.map((report) => {
          const Icon = report.icon

          return (
            <Card
              key={report.id}
              className="overflow-hidden border-blue-500/20 bg-gradient-to-br from-slate-950/90 via-blue-950/20 to-purple-950/20"
            >
              <div className={cn('h-1.5 bg-gradient-to-r', report.gradient)} />

              <CardHeader className="pb-2">
                <CardTitle className="flex items-start gap-3 text-blue-50">
                  <div className={cn('rounded-lg bg-gradient-to-br p-2.5', report.gradient)}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold leading-6">{report.name}</p>
                    <p className="mt-1 text-xs font-normal text-blue-200/70">{report.description}</p>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {report.rowCount > 0 ? (
                  <>
                    <div className="rounded-xl border border-blue-500/15 bg-slate-900/60 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-200/70">Ky moi nhat</span>
                        <span className="font-semibold text-blue-50">{report.latestPeriod}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-blue-500/15 bg-blue-500/10 p-2.5">
                        <div className="flex items-center gap-2 text-xs text-blue-200/70">
                          <Calendar className="h-3.5 w-3.5" />
                          So ky
                        </div>
                        <p className="mt-1 text-lg font-bold text-blue-50">{report.rowCount}</p>
                      </div>
                      <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-2.5">
                        <div className="flex items-center gap-2 text-xs text-purple-200/80">
                          <Database className="h-3.5 w-3.5" />
                          So cot DB
                        </div>
                        <p className="mt-1 text-lg font-bold text-purple-100">{report.fieldCount}</p>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleViewReport(report.id)}
                      className={cn(
                        'w-full bg-gradient-to-r text-white shadow-lg transition-all hover:brightness-110',
                        report.gradient
                      )}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Xem toan bo cot
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div className="rounded-xl border border-blue-500/15 bg-slate-900/55 p-6 text-center">
                    <Layers className="mx-auto mb-2 h-9 w-9 text-blue-300/50" />
                    <p className="text-sm text-blue-200/60">Chua co du lieu statement nay</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

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
