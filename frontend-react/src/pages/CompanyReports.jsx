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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
        Khong co du lieu cho bao cao nay.
      </div>
    )
  }

  if (!fields.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
        Da co ky bao cao nhung khong tim thay cot du lieu de hien thi.
      </div>
    )
  }

  return (
    <div className="max-h-[64vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-max text-sm">
        <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm">
          <tr>
            <th className="sticky left-0 z-40 min-w-[320px] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-700">
              Chi tieu
            </th>
            {reports.map((report, index) => (
              <th
                key={`${formatPeriodLabel(report)}-${index}`}
                className="min-w-[150px] border-l border-slate-200 px-4 py-3 text-right font-semibold text-slate-700"
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
                'border-t border-slate-100 transition-colors hover:bg-primary-50',
                rowIndex % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'
              )}
            >
              <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 group-hover:bg-primary-50">
                <p className="font-semibold text-slate-900">{humanizeFieldName(field)}</p>
                <p className="text-xs text-slate-500">{field}</p>
              </td>
              {reports.map((report, index) => (
                <td
                  key={`${field}-${index}`}
                  className="border-l border-slate-100 px-4 py-3 text-right font-mono text-slate-700"
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
          className="relative flex max-h-[92vh] w-full max-w-[98vw] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="relative flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 p-3 shadow-lg shadow-primary-500/20">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{reportConfig?.name || 'Bao cao chi tiet'}</h3>
                <p className="mt-1 text-sm text-slate-600">{ticker} • Bang day du cot du lieu theo tung ky bao cao</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-6 py-3">
            <Badge className="border-primary-200 bg-primary-50 text-primary-700">{reportRows.length} ky bao cao</Badge>
            <Badge className="border-slate-200 bg-slate-50 text-slate-700">{fields.length} cot tong</Badge>
            <Badge className="border-slate-200 bg-white text-slate-600">{filteredFields.length} cot dang hien thi</Badge>

            <div className="ml-auto w-full max-w-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <Input
                  value={fieldQuery}
                  onChange={(event) => setFieldQuery(event.target.value)}
                  placeholder="Tim nhanh chi tieu theo ten cot..."
                  className="border-slate-200 bg-white pl-9 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="relative overflow-y-auto p-6">
            <DynamicStatementTable reports={reportRows} fields={filteredFields} />
          </div>

          <div className="relative flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <p className="text-xs text-slate-500">
              Sticky header va sticky cot chi tieu da duoc bat cho bang rong va dai.
            </p>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
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
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-cyan-500/25 border-t-blue-600" />
          <p className="text-slate-600">Dang tai du lieu bao cao...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white backdrop-blur-xl p-5">
        <Link
          to="/"
          className="relative inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Dashboard
        </Link>

        <Card className="relative mt-4 border-slate-200 bg-white p-0 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-2xl font-bold text-white shadow-lg shadow-sm">
                {ticker?.slice(0, 2)}
              </div>
              <div>
                <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
                  <FileText className="h-7 w-7 text-primary-700" />
                  {ticker}
                </h1>
                <p className="mt-1 text-slate-600">{company?.company_name || company?.name || 'Dang tai ten cong ty...'}</p>
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
              className="overflow-hidden border-slate-200 bg-white backdrop-blur-sm"
            >
              <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-600" />

              <CardHeader className="pb-2">
                <CardTitle className="flex items-start gap-3 text-slate-900">
                  <div className="rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 p-2.5">
                    <Icon className="h-5 w-5 text-slate-900" />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold leading-6">{report.name}</p>
                    <p className="mt-1 text-xs font-normal text-slate-600">{report.description}</p>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {report.rowCount > 0 ? (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Ky moi nhat</span>
                        <span className="font-semibold text-slate-900">{report.latestPeriod}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-primary-200 bg-primary-500/5 p-2.5">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Calendar className="h-3.5 w-3.5" />
                          So ky
                        </div>
                        <p className="mt-1 text-lg font-bold text-slate-900">{report.rowCount}</p>
                      </div>
                      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Database className="h-3.5 w-3.5" />
                          So cot DB
                        </div>
                        <p className="mt-1 text-lg font-bold text-slate-900">{report.fieldCount}</p>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleViewReport(report.id)}
                      className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg transition-all hover:brightness-110"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Xem toan bo cot
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                    <Layers className="mx-auto mb-2 h-9 w-9 text-slate-500" />
                    <p className="text-sm text-slate-600">Chua co du lieu statement nay</p>
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
