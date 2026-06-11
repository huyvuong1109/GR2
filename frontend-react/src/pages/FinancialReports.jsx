import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
  nhom: 'nhóm',
  tra: 'trả',
  von: 'vốn',
  chu: 'chủ',
  so: 'sở',
  huu: 'hữu',
  loi: 'lợi',
  nhuan: 'nhuận',
  sau: 'sau',
  truoc: 'trước',
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
  vay: 'vay',
  gui: 'gửi',
  giay: 'giấy',
  to: 'tờ',
  du: 'dự',
  phong: 'phòng',
  nghiep: 'nghiệp',
  vu: 'vụ',
  thuan: 'thuần',
  lai: 'lãi',
  gop: 'gộp',
  khau: 'khấu',
  hao: 'hao',
  ccdv: 'cung cấp dịch vụ',
  cddv: 'cung cấp dịch vụ',
  dn: 'doanh nghiệp',
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

const toSafeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const valueOrZero = (value) => toSafeNumber(value) ?? 0

const pickNumber = (record, fields, fallback = 0) => {
  for (const field of fields) {
    const number = toSafeNumber(record?.[field])
    if (number !== null) return number
  }
  return fallback
}

const sumFields = (record, fields) =>
  fields.reduce((total, field) => total + valueOrZero(record?.[field]), 0)

const periodSortValue = (record) => {
  const year = Number(periodYear(record) || 0)
  const quarter = Number(periodQuarter(record) || 0)
  return year * 10 + quarter
}

const sortByPeriodAsc = (records) => [...toArray(records)].sort((a, b) => periodSortValue(a) - periodSortValue(b))

const getPeriodLabel = (record) => {
  if (!record) return '-'
  if (record.period_label) return record.period_label
  const year = periodYear(record)
  const quarter = Number(periodQuarter(record) || 0)
  return quarter > 0 ? `Q${quarter}/${year}` : `${year || '-'}`
}

const formatBillions = (value) => {
  const number = Number(value || 0)
  return `${number.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tỷ`
}

const formatPercentShort = (value) => {
  const number = Number(value || 0)
  return `${number.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
}

const toBillions = (value) => valueOrZero(value) / 1e9
const CHART_HEIGHT = 220
const WATERFALL_CHART_HEIGHT = 230

const asExpense = (value) => {
  const number = valueOrZero(value)
  return number > 0 ? -number : number
}

const normalizeCompanyType = (company, reports) => {
  const fromCompany = String(company?.company_type || '').toLowerCase()
  if (fromCompany) return fromCompany

  const fromReports = [...toArray(reports?.balance_sheets), ...toArray(reports?.income_statements)]
    .map((record) => String(record?.company_type || '').toLowerCase())
    .find(Boolean)

  return fromReports || 'corporate'
}

const latestRecordByYear = (records) => {
  const map = new Map()
  sortByPeriodAsc(records).forEach((record) => {
    const year = Number(periodYear(record) || 0)
    if (!year) return
    map.set(year, record)
  })
  return Array.from(map.values()).sort((a, b) => Number(periodYear(a) || 0) - Number(periodYear(b) || 0))
}

const yearlyIncomeRecords = (records) => {
  const byYear = new Map()

  sortByPeriodAsc(records).forEach((record) => {
    const year = Number(periodYear(record) || 0)
    if (!year) return

    if (!byYear.has(year)) {
      byYear.set(year, { year, quarterly: [], annual: null })
    }

    const group = byYear.get(year)
    const quarter = Number(periodQuarter(record) || 0)
    if (quarter > 0) {
      group.quarterly.push(record)
    } else {
      group.annual = record
    }
  })

  return Array.from(byYear.values())
    .sort((a, b) => a.year - b.year)
    .map((group) => {
      const sourceRecords = group.quarterly.length ? group.quarterly : group.annual ? [group.annual] : []
      const latest = sourceRecords[sourceRecords.length - 1] || {}
      const numericTotals = {}

      sourceRecords.forEach((record) => {
        collectFields(record).forEach((field) => {
          const number = toSafeNumber(record?.[field])
          if (number === null) return
          numericTotals[field] = (numericTotals[field] || 0) + number
        })
      })

      return {
        ...latest,
        ...numericTotals,
        period_year: group.year,
        fiscal_year: group.year,
        period_quarter: 0,
        quarter: 0,
        period_label: `${group.year}`,
        revenue: sourceRecords.reduce((total, item) => total + pickNumber(item, ['net_revenue', 'revenue', 'tong_thu_nhap_hoat_dong', 'thu_nhap_lai_va_tuong_tu']), 0),
        net_income: sourceRecords.reduce((total, item) => total + pickNumber(item, ['net_income', 'profit', 'net_profit_to_shareholders', 'loi_nhuan_sau_thue']), 0),
        profit_before_tax: sourceRecords.reduce((total, item) => total + pickNumber(item, ['profit_before_tax', 'loi_nhuan_truoc_thue']), 0),
        operating_income: sourceRecords.reduce((total, item) => total + pickNumber(item, ['operating_income', 'loi_nhuan_thuan_truoc_du_phong']), 0),
      }
    })
}

const getIncomeSeriesRecords = (reports, mode) => {
  const incomeRecords = toArray(reports?.income_statements)
  if (mode === 'year') return yearlyIncomeRecords(incomeRecords).slice(-5)
  return sortByPeriodAsc(incomeRecords).filter((record) => Number(periodQuarter(record) || 0) > 0).slice(-4)
}

const getBalanceSeriesRecords = (reports, mode) => {
  const balanceRecords = toArray(reports?.balance_sheets)
  if (mode === 'year') return latestRecordByYear(balanceRecords).slice(-5)
  return sortByPeriodAsc(balanceRecords).filter((record) => Number(periodQuarter(record) || 0) > 0).slice(-4)
}

const isBankReport = (reports) =>
  [...toArray(reports?.balance_sheets), ...toArray(reports?.income_statements)].some(
    (record) =>
      record?.company_type === 'bank' ||
      record?.cho_vay_khach_hang !== undefined ||
      record?.tien_gui_khach_hang !== undefined
  )

const buildPerformanceData = (reports, mode) =>
  getIncomeSeriesRecords(reports, mode).map((record) => {
    const revenue = pickNumber(record, ['net_revenue', 'revenue', 'tong_thu_nhap_hoat_dong', 'thu_nhap_lai_va_tuong_tu'])
    const netIncome = pickNumber(record, ['net_income', 'profit', 'net_profit_to_shareholders', 'loi_nhuan_sau_thue'])
    return {
      period: getPeriodLabel(record),
      revenue: toBillions(revenue),
      netIncome: toBillions(netIncome),
      netMargin: revenue ? (netIncome / Math.abs(revenue)) * 100 : null,
    }
  })

const buildCapitalData = (reports, mode, companyType) => {
  const bank = companyType === 'bank' || isBankReport(reports)
  const insurance = companyType === 'insurance'
  const data = getBalanceSeriesRecords(reports, mode).map((record) => {
    if (bank) {
      const loans = pickNumber(record, ['cho_vay_khach_hang', 'accounts_receivable'])
      const deposits = pickNumber(record, ['tien_gui_khach_hang']) + valueOrZero(record?.phat_hanh_giay_to_co_gia)
      return {
        period: getPeriodLabel(record),
        primary: toBillions(loans),
        secondary: toBillions(deposits),
        ratio: deposits ? (loans / Math.abs(deposits)) * 100 : null,
      }
    }

    if (insurance) {
      const reserve = pickNumber(record, ['du_phong_nghiep_vu', 'current_liabilities', 'total_liabilities', 'tong_no_phai_tra'])
      const equity = pickNumber(record, ['total_equity', 'shareholders_equity', 'tong_von_chu_so_huu'])
      return {
        period: getPeriodLabel(record),
        primary: toBillions(reserve),
        secondary: toBillions(equity),
        ratio: equity ? (reserve / Math.abs(equity)) * 100 : null,
      }
    }

    const debt = valueOrZero(record?.short_term_debt ?? record?.vay_ngan_han) + valueOrZero(record?.long_term_debt ?? record?.vay_dai_han)
    const equity = pickNumber(record, ['total_equity', 'shareholders_equity', 'tong_von_chu_so_huu'])
    return {
      period: getPeriodLabel(record),
      primary: toBillions(debt),
      secondary: toBillions(equity),
      ratio: equity ? (debt / Math.abs(equity)) * 100 : null,
    }
  })

  return {
    bank,
    insurance,
    data,
    primaryName: bank ? 'Cho vay khách hàng' : 'Tổng tài sản',
    secondaryName: bank ? 'Tiền gửi và GTCG' : 'Nợ phải trả',
    ratioName: bank ? 'LDR' : 'Nợ/VCSH',
    title: bank ? 'Cho vay và huy động' : 'Tài sản và Vốn chủ sở hữu',
    ...(insurance
      ? {
          primaryName: 'Dự phòng nghiệp vụ',
          secondaryName: 'Vốn chủ sở hữu',
          ratioName: 'Dự phòng nghiệp vụ/VCSH',
          title: 'Dự phòng nghiệp vụ và Vốn chủ sở hữu',
        }
      : {}),
    ...(!bank && !insurance
      ? {
          primaryName: 'Nợ vay',
          secondaryName: 'Vốn chủ sở hữu',
          ratioName: 'Nợ vay/VCSH',
          title: 'Tài sản và Vốn chủ sở hữu',
        }
      : {}),
  }
}

const hasAnySeriesValue = (data, keys) =>
  data.some((item) => keys.some((key) => Math.abs(Number(item?.[key] || 0)) > 0))

const buildFinancialPositionData = (reports, selectedPeriod, companyType) => {
  const record =
    getRecordByPeriod(reports, 'balance_sheets', selectedPeriod) ||
    sortByPeriodAsc(reports?.balance_sheets).at(-1) ||
    null

  if (!record) return []

  const totalLiabilities = pickNumber(record, ['total_liabilities', 'tong_no_phai_tra'])
  const currentAssets = pickNumber(record, ['current_assets', 'tong_tai_san_ngan_han'])
  const nonCurrentAssets = pickNumber(record, ['non_current_assets', 'tong_tai_san_dai_han'])
  const currentLiabilities =
    companyType === 'insurance'
      ? pickNumber(record, ['du_phong_nghiep_vu', 'current_liabilities', 'tong_no_ngan_han'], totalLiabilities)
      : pickNumber(record, ['current_liabilities', 'tong_no_ngan_han'])
  const nonCurrentLiabilities =
    companyType === 'insurance'
      ? Math.max(totalLiabilities - currentLiabilities, 0)
      : pickNumber(record, ['non_current_liabilities', 'long_term_liabilities', 'tong_no_dai_han'])

  return [
    {
      name: 'Ngắn hạn',
      assets: toBillions(currentAssets),
      liabilities: toBillions(currentLiabilities),
    },
    {
      name: 'Dài hạn',
      assets: toBillions(nonCurrentAssets),
      liabilities: toBillions(nonCurrentLiabilities),
    },
  ]
}

const buildSecuritiesAssetsData = (reports, mode) =>
  getBalanceSeriesRecords(reports, mode).map((record) => ({
    period: getPeriodLabel(record),
    fvtpl: toBillions(pickNumber(record, ['fvtpl'])),
    htm: toBillions(pickNumber(record, ['htm'])),
    afs: toBillions(pickNumber(record, ['afs'])),
    loans: toBillions(valueOrZero(record?.cho_vay_margin) + valueOrZero(record?.phai_thu_khach_hang)),
  }))

const buildWaterfallData = (record, companyType) => {
  if (!record) return []

  if (companyType === 'corporate') {
    const revenue = pickNumber(record, ['net_revenue', 'revenue', 'doanh_thu_thuan', 'doanh_thu_ban_hang_va_ccdv'])
    const cost = pickNumber(record, ['cost_of_revenue', 'cost_of_goods_sold', 'gia_von_hang_ban'])
    const grossProfit = pickNumber(record, ['gross_profit', 'loi_nhuan_gop'], revenue + valueOrZero(cost))
    const financialIncome = pickNumber(record, ['financial_income', 'doanh_thu_hoat_dong_tai_chinh'])
    const financialExpense = pickNumber(record, ['financial_expenses', 'chi_phi_tai_chinh'])
    const sellingAdmin = valueOrZero(record?.selling_expenses ?? record?.chi_phi_ban_hang) + valueOrZero(record?.admin_expenses ?? record?.chi_phi_quan_ly_dn)
    const otherProfit = pickNumber(record, ['loi_nhuan_khac'], valueOrZero(record?.thu_nhap_khac) + valueOrZero(record?.chi_phi_khac))
    const profitBeforeTax = pickNumber(record, ['profit_before_tax', 'loi_nhuan_truoc_thue'])
    const taxExpense = pickNumber(record, ['income_tax', 'chi_phi_thue_tndn'])
    const netIncome = pickNumber(record, ['net_income', 'profit', 'loi_nhuan_sau_thue'])
    const ownerProfit = pickNumber(record, ['net_profit_to_shareholders', 'loi_nhuan_cua_co_dong_ct_me'], netIncome)

    return [
      { name: 'Doanh thu thuần', value: toBillions(revenue), type: 'positive' },
      { name: 'Giá vốn hàng bán', value: toBillions(asExpense(cost)), type: 'negative' },
      { name: 'Lợi nhuận gộp', value: toBillions(grossProfit), type: 'total' },
      { name: 'LN HĐTC & liên kết', value: toBillions(financialIncome + valueOrZero(financialExpense)), type: financialIncome + valueOrZero(financialExpense) >= 0 ? 'positive' : 'negative' },
      { name: 'CP bán hàng & QLDN', value: toBillions(asExpense(sellingAdmin)), type: 'negative' },
      { name: 'LN khác', value: toBillions(otherProfit), type: otherProfit >= 0 ? 'positive' : 'negative' },
      { name: 'LNTT', value: toBillions(profitBeforeTax), type: 'total' },
      { name: 'Thuế TNDN', value: toBillions(asExpense(taxExpense)), type: 'negative' },
      { name: 'LNST', value: toBillions(netIncome), type: 'total' },
      { name: 'Lợi nhuận ròng', value: toBillions(ownerProfit), type: 'total' },
    ].filter((item) => item.value !== 0 || item.type === 'total')
  }

  if (companyType === 'insurance') {
    const revenue = pickNumber(record, ['net_revenue', 'revenue', 'doanh_thu_phi_bao_hiem_thuan', 'doanh_thu_phi_bao_hiem_goc'])
    const claims = pickNumber(record, ['cost_of_revenue', 'cost_of_goods_sold', 'chi_boi_thuong'])
    const grossProfit = pickNumber(record, ['gross_profit', 'operating_income', 'loi_nhuan_hoat_dong_bao_hiem'], revenue + valueOrZero(claims))
    const sellingAdmin = valueOrZero(record?.selling_expenses ?? record?.chi_phi_khai_thac) + valueOrZero(record?.admin_expenses ?? record?.chi_phi_quan_ly)
    const financialIncome = pickNumber(record, ['financial_income', 'doanh_thu_hoat_dong_tai_chinh'])
    const profitBeforeTax = pickNumber(record, ['profit_before_tax', 'loi_nhuan_truoc_thue'])
    const taxExpense = pickNumber(record, ['income_tax', 'chi_phi_thue_tndn'])
    const netIncome = pickNumber(record, ['net_income', 'profit', 'loi_nhuan_sau_thue'])
    const ownerProfit = pickNumber(record, ['net_profit_to_shareholders'], netIncome)
    const otherProfit = profitBeforeTax - grossProfit - valueOrZero(sellingAdmin) - financialIncome

    return [
      { name: 'DT thuần HĐKD BH', value: toBillions(revenue), type: 'positive' },
      { name: 'Tổng chi HĐKD BH', value: toBillions(asExpense(claims)), type: 'negative' },
      { name: 'LN gộp HĐKD BH', value: toBillions(grossProfit), type: 'total' },
      { name: 'CP bán hàng & QLDN', value: toBillions(asExpense(sellingAdmin)), type: 'negative' },
      { name: 'LN HĐTC', value: toBillions(financialIncome), type: financialIncome >= 0 ? 'positive' : 'negative' },
      { name: 'LN & các khoản khác', value: toBillions(otherProfit), type: otherProfit >= 0 ? 'positive' : 'negative' },
      { name: 'LNTT', value: toBillions(profitBeforeTax), type: 'total' },
      { name: 'Thuế TNDN', value: toBillions(asExpense(taxExpense)), type: 'negative' },
      { name: 'LNST', value: toBillions(netIncome), type: 'total' },
      { name: 'Lợi nhuận ròng', value: toBillions(ownerProfit), type: 'total' },
    ].filter((item) => item.value !== 0 || item.type === 'total')
  }

  if (companyType === 'securities') {
    const revenue = pickNumber(record, ['net_revenue', 'revenue', 'tong_doanh_thu_hoat_dong'])
    const operatingExpense = pickNumber(record, ['financial_expenses', 'admin_expenses', 'chi_phi_hoat_dong'])
    const financialIncome = pickNumber(record, ['financial_income'])
    const profitBeforeTax = pickNumber(record, ['profit_before_tax', 'loi_nhuan_truoc_thue'])
    const taxExpense = pickNumber(record, ['income_tax', 'chi_phi_thue_tndn'])
    const netIncome = pickNumber(record, ['net_income', 'profit', 'loi_nhuan_sau_thue'])
    const ownerProfit = pickNumber(record, ['net_profit_to_shareholders'], netIncome)
    const operatingResult = profitBeforeTax || revenue + valueOrZero(operatingExpense)

    return [
      { name: 'Doanh thu hoạt động', value: toBillions(revenue), type: 'positive' },
      { name: 'CP hoạt động', value: toBillions(asExpense(operatingExpense)), type: 'negative' },
      { name: 'DT/CP HĐTC', value: toBillions(financialIncome), type: financialIncome >= 0 ? 'positive' : 'negative' },
      { name: 'CP bán hàng & QLDN', value: 0, type: 'negative' },
      { name: 'Kết quả hoạt động', value: toBillions(operatingResult), type: 'total' },
      { name: 'LN khác', value: 0, type: 'positive' },
      { name: 'LNTT', value: toBillions(profitBeforeTax), type: 'total' },
      { name: 'Thuế TNDN', value: toBillions(asExpense(taxExpense)), type: 'negative' },
      { name: 'LNST', value: toBillions(netIncome), type: 'total' },
      { name: 'Lợi nhuận ròng', value: toBillions(ownerProfit), type: 'total' },
    ].filter((item) => item.value !== 0 || item.type === 'total')
  }

  const interestIncome = pickNumber(record, ['thu_nhap_lai_thuan', 'gross_profit', 'net_revenue', 'revenue'])
  const nonInterestIncome =
    sumFields(record, ['lai_thuan_tu_dich_vu', 'lai_thuan_ngoai_hoi', 'lai_thuan_chung_khoan', 'lai_thuan_mua_ban_chung_khoan_dau_tu', 'thu_nhap_khac']) ||
    pickNumber(record, ['financial_income'], null)
  const totalOperatingIncome = pickNumber(record, ['tong_thu_nhap_hoat_dong'], interestIncome + valueOrZero(nonInterestIncome))
  const operatingExpense = pickNumber(record, ['chi_phi_hoat_dong', 'admin_expenses', 'selling_expenses'], 0)
  const operatingProfit = pickNumber(record, ['operating_income', 'loi_nhuan_thuan_truoc_du_phong'], totalOperatingIncome + operatingExpense)
  const provisionExpense = pickNumber(record, ['chi_phi_du_phong_rui_ro', 'financial_expenses'], 0)
  const profitBeforeTax = pickNumber(record, ['profit_before_tax', 'loi_nhuan_truoc_thue'], operatingProfit + provisionExpense)
  const taxExpense = pickNumber(record, ['income_tax', 'chi_phi_thue_tndn'], 0)
  const netIncome = pickNumber(record, ['net_income', 'profit', 'loi_nhuan_sau_thue'], profitBeforeTax + taxExpense)
  const ownerProfit = pickNumber(record, ['net_profit_to_shareholders', 'loi_nhuan_cua_co_dong_ct_me'], netIncome)

  return [
    { name: 'Thu nhập lãi thuần', value: toBillions(interestIncome), type: 'positive' },
    { name: 'Thu nhập ngoài lãi', value: toBillions(valueOrZero(nonInterestIncome)), type: valueOrZero(nonInterestIncome) >= 0 ? 'positive' : 'negative' },
    { name: 'Tổng thu nhập hoạt động', value: toBillions(totalOperatingIncome), type: 'total' },
    { name: 'Chi phí hoạt động', value: toBillions(operatingExpense), type: 'negative' },
    { name: 'Lợi nhuận HĐKD', value: toBillions(operatingProfit), type: 'total' },
    { name: 'CP dự phòng/RRTD', value: toBillions(provisionExpense), type: 'negative' },
    { name: 'LNTT', value: toBillions(profitBeforeTax), type: 'total' },
    { name: 'Thuế TNDN', value: toBillions(taxExpense), type: 'negative' },
    { name: 'LNST', value: toBillions(netIncome), type: 'total' },
    { name: 'Lợi nhuận ròng', value: toBillions(ownerProfit), type: 'total' },
  ].filter((item) => item.value !== 0 || item.type === 'total')
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

function ChartEmptyState({ children = 'Chưa có đủ dữ liệu để vẽ biểu đồ.' }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] text-sm text-slate-500">
      <span className="max-w-md px-4 text-center leading-6">{children}</span>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-white/10 bg-[#191c1e]/95 p-3 shadow-xl backdrop-blur">
      <p className="mb-2 text-xs font-black text-slate-100">{label}</p>
      <div className="space-y-1.5">
        {payload
          .filter((entry) => entry.value !== null && entry.value !== undefined)
          .map((entry) => {
            const isRatio = String(entry.dataKey || '').toLowerCase().includes('ratio') || entry.name === 'Biên lợi nhuận ròng' || entry.name === 'LDR' || entry.name === 'Nợ/VCSH'
            return (
              <div key={`${entry.dataKey}-${entry.name}`} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-400">{entry.name}:</span>
                <span className="font-mono font-bold text-slate-100">{isRatio ? formatPercentShort(entry.value) : formatBillions(entry.value)}</span>
              </div>
            )
          })}
      </div>
    </div>
  )
}

function ChartModeToggle({ value, onChange }) {
  return (
    <div className="inline-grid grid-cols-2 overflow-hidden rounded-md border border-white/10 bg-white/[0.04] text-xs font-black">
      {[
        { id: 'year', label: 'Năm' },
        { id: 'quarter', label: 'Quý' },
      ].map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            'px-3 py-1.5 transition-colors',
            value === option.id ? 'bg-sky-300 text-slate-950' : 'text-slate-200 hover:bg-white/[0.08]'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
      <div className="flex min-h-[42px] items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <h4 className="text-sm font-black text-slate-100">{title}</h4>
      </div>
      <div className="p-2.5">{children}</div>
    </section>
  )
}

function PerformanceComparisonChart({ data }) {
  if (!data.length) return <ChartEmptyState />

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ComposedChart data={data} margin={{ top: 10, right: 6, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="period" tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="value" tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => value.toLocaleString('vi-VN')} />
        <YAxis yAxisId="ratio" orientation="right" tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} width={38} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ paddingTop: 4, color: '#c6c6cd', fontSize: 11 }} />
        <Bar yAxisId="value" dataKey="revenue" name="Doanh thu thuần" fill="#4f8df7" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="value" dataKey="netIncome" name="Lợi nhuận ròng" fill="#6ee7a8" radius={[3, 3, 0, 0]} />
        <Line yAxisId="ratio" type="monotone" dataKey="netMargin" name="Biên lợi nhuận ròng" stroke="#f5d90a" strokeWidth={2.2} dot={{ r: 3, fill: '#f5d90a' }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function IncomeWaterfallChart({ data }) {
  if (!data.length) return <ChartEmptyState />

  return (
    <ResponsiveContainer width="100%" height={WATERFALL_CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 10, right: 6, left: -8, bottom: 42 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis
          dataKey="name"
          interval={0}
          angle={-34}
          textAnchor="end"
          height={64}
          tick={{ fill: '#c6c6cd', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => value.toLocaleString('vi-VN')} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="value" name="Giá trị" radius={[3, 3, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.type === 'total' ? '#55729a' : entry.value >= 0 ? '#58b8aa' : '#d45f85'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function FundingComparisonChart({ funding }) {
  if (!funding.data.length) return <ChartEmptyState />

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ComposedChart data={funding.data} margin={{ top: 10, right: 6, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="period" tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="value" tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => value.toLocaleString('vi-VN')} />
        <YAxis yAxisId="ratio" orientation="right" tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} width={44} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ paddingTop: 4, color: '#c6c6cd', fontSize: 11 }} />
        <Bar yAxisId="value" dataKey="primary" name={funding.primaryName} fill="#40acd3" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="value" dataKey="secondary" name={funding.secondaryName} fill="#67dec0" radius={[3, 3, 0, 0]} />
        <Line yAxisId="ratio" type="monotone" dataKey="ratio" name={funding.ratioName} stroke="#f5d90a" strokeWidth={2.2} dot={{ r: 3, fill: '#f5d90a' }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function FinancialPositionChart({ data }) {
  if (!data.length || !hasAnySeriesValue(data, ['assets', 'liabilities'])) return <ChartEmptyState />

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 10, right: 6, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => value.toLocaleString('vi-VN')} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ paddingTop: 4, color: '#c6c6cd', fontSize: 11 }} />
        <Bar dataKey="assets" name="Tài sản" fill="#40acd3" radius={[3, 3, 0, 0]} />
        <Bar dataKey="liabilities" name="Nợ phải trả" fill="#67dec0" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function SecuritiesAssetsChart({ data }) {
  if (!data.length || !hasAnySeriesValue(data, ['fvtpl', 'htm', 'afs', 'loans'])) {
    return <ChartEmptyState>Chưa có dữ liệu FVTPL, HTM, AFS hoặc cho vay margin trong báo cáo đã map.</ChartEmptyState>
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 10, right: 6, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="period" tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#c6c6cd', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => value.toLocaleString('vi-VN')} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ paddingTop: 4, color: '#c6c6cd', fontSize: 11 }} />
        <Bar dataKey="fvtpl" name="Tài sản FVTPL" fill="#40acd3" radius={[3, 3, 0, 0]} />
        <Bar dataKey="htm" name="Tài sản HTM" fill="#67dec0" radius={[3, 3, 0, 0]} />
        <Bar dataKey="afs" name="Tài sản AFS" fill="#657190" radius={[3, 3, 0, 0]} />
        <Bar dataKey="loans" name="Các khoản cho vay" fill="#a6a9e8" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function FinancialChartDashboard({ company, reports, chartMode, onChartModeChange, selectedPeriod }) {
  const companyType = normalizeCompanyType(company, reports)
  const performanceData = useMemo(() => buildPerformanceData(reports, chartMode), [reports, chartMode])
  const capitalData = useMemo(() => buildCapitalData(reports, chartMode, companyType), [reports, chartMode, companyType])
  const positionData = useMemo(() => buildFinancialPositionData(reports, selectedPeriod, companyType), [reports, selectedPeriod, companyType])
  const securitiesAssetsData = useMemo(() => buildSecuritiesAssetsData(reports, chartMode), [reports, chartMode])
  const activeIncomeRecord = useMemo(() => {
    if (chartMode === 'year') {
      const yearlyRecords = yearlyIncomeRecords(reports?.income_statements)
      const targetYear = Number(selectedPeriod?.year || 0)
      return yearlyRecords.find((record) => Number(periodYear(record) || 0) === targetYear) || yearlyRecords.at(-1) || null
    }

    return getRecordByPeriod(reports, 'income_statements', selectedPeriod) || sortByPeriodAsc(reports?.income_statements).at(-1) || null
  }, [reports, selectedPeriod, chartMode])
  const waterfallData = useMemo(() => buildWaterfallData(activeIncomeRecord, companyType), [activeIncomeRecord, companyType])
  const titlePeriod = chartMode === 'year' ? selectedPeriod?.year || periodYear(activeIncomeRecord) || '-' : getPeriodLabel(activeIncomeRecord)
  const waterfallTitle = activeIncomeRecord ? `Kết quả kinh doanh (${titlePeriod})` : 'Kết quả kinh doanh'
  const positionTitle = activeIncomeRecord ? `Vị thế tài chính (${selectedPeriod?.year || periodYear(activeIncomeRecord) || '-'})` : 'Vị thế tài chính'
  const unitDescription =
    chartMode === 'year'
      ? 'Năm: cộng tổng các quý trong năm; bảng cân đối lấy cuối năm. Đơn vị: tỷ VND, tỷ lệ: %.'
      : 'Quý: 4 quý gần nhất. Đơn vị: tỷ VND/quý, tỷ lệ: %.'
  const fourthChart =
    companyType === 'bank' ? null : companyType === 'securities' ? (
      <ChartCard title="Tài sản tài chính và Các khoản cho vay">
        <SecuritiesAssetsChart data={securitiesAssetsData} />
      </ChartCard>
    ) : (
      <ChartCard title={positionTitle}>
        <FinancialPositionChart data={positionData} />
      </ChartCard>
    )

  return (
    <section className="mb-3 overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
      <div className="flex flex-col gap-2 border-b border-white/10 px-3 py-2.5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-4 w-4 text-emerald-300" />
          <div>
            <h3 className="text-sm font-black text-slate-100">Biểu đồ so sánh tăng trưởng</h3>
            <p className="text-xs text-slate-500">{unitDescription}</p>
          </div>
        </div>
        <ChartModeToggle value={chartMode} onChange={onChartModeChange} />
      </div>

      <div className="grid gap-3 p-3 xl:grid-cols-2">
        <ChartCard title="Hiệu suất">
          <PerformanceComparisonChart data={performanceData} />
        </ChartCard>
        <ChartCard title={waterfallTitle}>
          <IncomeWaterfallChart data={waterfallData} />
        </ChartCard>
        <ChartCard title={capitalData.title}>
          <FundingComparisonChart funding={capitalData} />
        </ChartCard>
        {fourthChart}
      </div>
    </section>
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
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.035]">
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
  const [chartMode, setChartMode] = useState('quarter')
  const [showCharts, setShowCharts] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setActiveTab('balance_sheet')
      setMetricQuery('')
      setChartMode('quarter')
      setShowCharts(false)
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
        className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-black/70 p-3 backdrop-blur-sm md:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
          onClick={(event) => event.stopPropagation()}
          className="glass-card relative flex max-h-[92dvh] w-full max-w-[min(96vw,1280px)] flex-col overflow-hidden"
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

            <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-wrap gap-2">
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

              <button
                type="button"
                onClick={() => setShowCharts((prev) => !prev)}
                className={cn(
                  'inline-flex flex-none items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-xs font-black transition-all sm:ml-auto',
                  showCharts
                    ? 'border-sky-300/40 bg-sky-300 text-slate-950'
                    : 'border-white/10 bg-white/[0.04] text-slate-200 hover:border-sky-300/35 hover:text-sky-200'
                )}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                {showCharts ? 'Ẩn biểu đồ' : 'Xem biểu đồ'}
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-white/10 px-5 py-3 md:grid-cols-[1fr_minmax(260px,380px)] md:items-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Khoản mục trong kỳ đã chọn</p>
            <div className="w-full">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={metricQuery}
                  onChange={(event) => setMetricQuery(event.target.value)}
                  placeholder="Tìm nhanh khoản mục..."
                  className="input-primary h-10 pl-9 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {showCharts && (
              <FinancialChartDashboard
                company={company}
                reports={reports}
                chartMode={chartMode}
                onChartModeChange={setChartMode}
                selectedPeriod={selectedPeriod}
              />
            )}
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
