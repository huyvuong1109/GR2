import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Activity,
  Building2,
  FileText,
  Landmark,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../services/api'
import StarButton from '../components/StarButton'
import { cn } from '../utils/helpers'

const CHART_COLORS = ['#4f7cff', '#12d783', '#f5d90a', '#d92bd6', '#e33652', '#f2b26b', '#24c7db']

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

const toSafeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const valueOrZero = (value) => Number(value || 0)

const formatVnd = (value) => {
  const number = toSafeNumber(value)
  if (number === null) return 'Chưa có dữ liệu'
  return `${number.toLocaleString('vi-VN')} VND`
}

const formatCompact = (value) => {
  const number = Number(value || 0)
  const abs = Math.abs(number)
  if (abs >= 1e12) return `${(number / 1e12).toFixed(1)} nghìn tỷ`
  if (abs >= 1e9) return `${(number / 1e9).toFixed(0)} tỷ`
  if (abs >= 1e6) return `${(number / 1e6).toFixed(0)} triệu`
  return number.toLocaleString('vi-VN')
}

const formatMarketCap = (value) => {
  const number = toSafeNumber(value)
  if (number === null) return 'Chưa có dữ liệu'
  if (number >= 1e12) return `${(number / 1e12).toFixed(2)} nghìn tỷ VND`
  if (number >= 1e9) return `${(number / 1e9).toFixed(2)} tỷ VND`
  if (number >= 1e6) return `${(number / 1e6).toFixed(2)} triệu VND`
  return `${number.toLocaleString('vi-VN')} VND`
}

const formatShares = (value) => {
  const number = toSafeNumber(value)
  if (number === null) return 'Chưa có dữ liệu'
  if (number >= 1e9) return `${(number / 1e9).toFixed(2)} tỷ cp`
  if (number >= 1e6) return `${(number / 1e6).toFixed(2)} triệu cp`
  return `${number.toLocaleString('vi-VN')} cp`
}

const periodLabel = (record) => {
  if (!record) return '-'
  if (record.period_label) return record.period_label
  const quarter = record.period_quarter ?? record.quarter
  const year = record.period_year ?? record.fiscal_year
  return quarter ? `Q${quarter}/${year}` : `${year || '-'}`
}

const sortByPeriodAsc = (records) =>
  [...records].sort((a, b) => {
    const ay = Number(a.period_year ?? a.fiscal_year ?? 0)
    const by = Number(b.period_year ?? b.fiscal_year ?? 0)
    const aq = Number(a.period_quarter ?? a.quarter ?? 0)
    const bq = Number(b.period_quarter ?? b.quarter ?? 0)
    return ay === by ? aq - bq : ay - by
  })

const levelClass = {
  critical: 'border-red-300/25 bg-red-500/10 text-red-200',
  warning: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  info: 'border-sky-300/25 bg-sky-400/10 text-sky-200',
}

export default function CompanyAnalysisSimple() {
  const { ticker } = useParams()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState(null)
  const [healthData, setHealthData] = useState(null)
  const [financials, setFinancials] = useState({ balanceSheets: [], incomeStatements: [], cashFlows: [] })
  const [error, setError] = useState(null)

  useEffect(() => {
    if (ticker) fetchData()
  }, [ticker])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [companyData, health, balanceSheets, incomeStatements, cashFlows] = await Promise.all([
        api.get(`/companies/${ticker}`),
        api.get(`/analysis/${ticker}/health-score`).catch(() => null),
        api.get(`/companies/${ticker}/balance-sheets`).catch(() => []),
        api.get(`/companies/${ticker}/income-statements`).catch(() => []),
        api.get(`/companies/${ticker}/cash-flows`).catch(() => []),
      ])

      setCompany(companyData)
      setHealthData(health)
      setFinancials({
        balanceSheets: toArray(balanceSheets),
        incomeStatements: toArray(incomeStatements),
        cashFlows: toArray(cashFlows),
      })
    } catch (err) {
      console.error('Error fetching company:', err)
      setError(err.message || 'Lỗi không xác định')
    } finally {
      setLoading(false)
    }
  }

  const financialChartData = useMemo(() => buildFinancialChartData(financials), [financials])

  if (loading) {
    return (
      <div className="glass-card p-8">
        <div className="text-xl font-bold text-slate-100">Đang tải dữ liệu cho {ticker}...</div>
        <div className="mt-6 animate-pulse space-y-4">
          <div className="h-9 w-1/3 rounded bg-white/10" />
          <div className="h-4 w-1/2 rounded bg-white/10" />
          <div className="h-4 w-1/4 rounded bg-white/10" />
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="glass-card p-8">
        <div className="text-xl font-bold text-red-300">
          {error ? `Lỗi: ${error}` : `Không tìm thấy công ty: ${ticker}`}
        </div>
        <Link to="/screener" className="mt-5 inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200">
          <ArrowLeft className="h-4 w-4" />
          Quay lại bộ lọc
        </Link>
      </div>
    )
  }

  const displayTicker = String(company.ticker || ticker || '').toUpperCase() || 'N/A'
  const displayName = company.name || `Công ty ${displayTicker}`
  const displayDescription = company.description || 'Chưa có thông tin mô tả doanh nghiệp.'
  const displayIndustry = company.industry || 'Chưa có thông tin'
  const displayPrice = formatVnd(company.current_price ?? company.price)
  const displayMarketCap = formatMarketCap(company.market_cap)
  const displaySharesOutstanding = formatShares(company.shares_outstanding)
  const displayOfficers = Array.isArray(company.officers) ? company.officers : []

  return (
    <div className="space-y-8">
      <Link to="/screener" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-emerald-300">
        <ArrowLeft className="h-4 w-4" />
        Quay lại sàng lọc
      </Link>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-2xl font-black text-emerald-300">
                  {displayTicker.slice(0, 2)}
                </div>
                <div>
                  <h1 className="text-5xl font-black tracking-tight text-slate-100">{displayTicker}</h1>
                  <p className="mt-1 text-xl font-semibold text-slate-400">{displayName}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 border-b border-white/10 pb-1">
                {[
                  { id: 'overview', label: 'Tổng quan' },
                  { id: 'financials', label: 'Tài chính' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'px-1 pb-3 text-sm font-black transition',
                      activeTab === tab.id ? 'border-b-2 border-emerald-300 text-emerald-300' : 'text-slate-500 hover:text-slate-200'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="text-sm font-bold text-slate-300">Theo dõi</span>
              <StarButton ticker={displayTicker} />
            </div>
          </div>
        </div>

        {activeTab === 'overview' ? (
          <OverviewTab
            description={displayDescription}
            industry={displayIndustry}
            price={displayPrice}
            marketCap={displayMarketCap}
            shares={displaySharesOutstanding}
            officers={displayOfficers}
            healthData={healthData}
          />
        ) : (
          <FinancialTab chartData={financialChartData} />
        )}
      </section>
    </div>
  )
}

function OverviewTab({ description, industry, price, marketCap, shares, officers, healthData }) {
  const health = healthData?.health_score || null
  const warnings = Array.isArray(healthData?.warnings) ? healthData.warnings : []
  const score = health?.total_score ?? 0
  const interpretation = health?.interpretation?.label || 'Chưa đủ dữ liệu'
  const breakdown = health?.breakdown || {}

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <p className="max-w-5xl text-base leading-8 text-slate-400">{description}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Building2 className="h-5 w-5" />} label="Ngành" value={industry} />
          <Metric icon={<Wallet className="h-5 w-5" />} label="Giá hiện tại" value={price} />
          <Metric icon={<Landmark className="h-5 w-5" />} label="Vốn hóa" value={marketCap} />
          <Metric icon={<Activity className="h-5 w-5" />} label="KLCP lưu hành" value={shares} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="panel xl:col-span-7">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-emerald-300" />
              <div>
                <h2 className="section-title">Đánh giá sức khỏe & rủi ro</h2>
                <p className="section-subtitle">Tổng hợp từ F-Score, định giá, tăng trưởng và cảnh báo tài chính.</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="grid gap-4 md:grid-cols-3">
              <ScoreCard title="Sức khỏe tổng hợp" value={`${score}/100`} detail={interpretation} tone="emerald" />
              <ScoreCard title="F-Score" value={`${breakdown.f_score?.value ?? 0}/9`} detail={`${breakdown.f_score?.points ?? 0}/40 điểm`} tone="slate" />
              <ScoreCard title="Rủi ro" value={`${warnings.length} cảnh báo`} detail={`${breakdown.risk?.points ?? 0}/20 điểm`} tone={warnings.length > 0 ? 'amber' : 'emerald'} />
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="font-bold text-slate-100">Cảnh báo cụ thể</h3>
              {warnings.length === 0 ? (
                <p className="mt-2 text-sm leading-7 text-slate-400">Chưa phát hiện cảnh báo tài chính nổi bật từ dữ liệu hiện có.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {warnings.slice(0, 4).map((warning, index) => (
                    <RiskLine key={`${warning.type}-${index}`} warning={warning} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel xl:col-span-5">
          <div className="panel-header">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-emerald-300" />
                <div>
                  <h2 className="section-title">Ban lãnh đạo</h2>
                  <p className="section-subtitle">{officers.length} người</p>
                </div>
              </div>
              <ShieldCheck className="h-5 w-5 text-slate-500" />
            </div>
          </div>

          <div className="panel-body">
            {officers.length === 0 ? (
              <div className="alert-info text-sm">Chưa có dữ liệu ban lãnh đạo.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-financial min-w-[460px]">
                  <thead>
                    <tr>
                      <th>Họ tên</th>
                      <th>Chức vụ</th>
                      <th>Bắt đầu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officers.map((officer, index) => (
                      <tr key={`${officer.name}-${officer.position || index}`}>
                        <td className="font-bold text-slate-100">{officer.name}</td>
                        <td>{officer.position || officer.position_en || '-'}</td>
                        <td>{officer.from_date || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function FinancialTab({ chartData }) {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel title="Doanh thu thuần & Lợi nhuận sau thuế">
          <StackedBarChart
            data={chartData.income}
            bars={[
              { key: 'revenue', name: 'Doanh thu thuần', color: '#24c7db' },
              { key: 'netIncome', name: 'Lợi nhuận sau thuế', color: '#12d783' },
            ]}
          />
        </ChartPanel>

        <ChartPanel title="Tài sản">
          <StackedBarChart
            data={chartData.assets}
            bars={[
              { key: 'cash', name: 'Tiền và tương đương tiền', color: '#24c7db' },
              { key: 'shortTermInvestments', name: 'Đầu tư tài chính ngắn hạn', color: '#12d783' },
              { key: 'receivables', name: 'Các khoản phải thu', color: '#d92bd6' },
              { key: 'inventories', name: 'Hàng tồn kho', color: '#f5d90a' },
              { key: 'otherAssets', name: 'Tài sản khác', color: '#e33652' },
            ]}
          />
        </ChartPanel>

        <ChartPanel title="Nguồn vốn">
          <StackedBarChart
            data={chartData.capital}
            bars={[
              { key: 'shortDebt', name: 'Vay và thuê tài chính ngắn hạn', color: '#4f7cff' },
              { key: 'longDebt', name: 'Vay và thuê tài chính dài hạn', color: '#f5d90a' },
              { key: 'otherLiabilities', name: 'Nợ phải trả khác', color: '#e33652' },
              { key: 'equity', name: 'Vốn chủ sở hữu', color: '#12d783' },
            ]}
          />
        </ChartPanel>
      </div>
    </div>
  )
}

function buildFinancialChartData({ balanceSheets, incomeStatements }) {
  const income = sortByPeriodAsc(incomeStatements).slice(-12).map((record) => ({
    period: periodLabel(record),
    revenue: valueOrZero(record.net_revenue ?? record.revenue),
    netIncome: valueOrZero(record.net_income ?? record.profit),
  }))

  const sortedBalance = sortByPeriodAsc(balanceSheets).slice(-12)
  const assets = sortedBalance.map((record) => {
    const cash = valueOrZero(record.cash)
    const shortTermInvestments = valueOrZero(record.short_term_investments)
    const receivables = valueOrZero(record.accounts_receivable)
    const inventories = valueOrZero(record.inventories)
    const totalAssets = valueOrZero(record.total_assets)
    const known = cash + shortTermInvestments + receivables + inventories
    return {
      period: periodLabel(record),
      cash,
      shortTermInvestments,
      receivables,
      inventories,
      otherAssets: Math.max(totalAssets - known, 0),
    }
  })

  const capital = sortedBalance.map((record) => {
    const shortDebt = valueOrZero(record.short_term_debt)
    const longDebt = valueOrZero(record.long_term_debt)
    const totalLiabilities = valueOrZero(record.total_liabilities)
    const equity = valueOrZero(record.total_equity ?? record.shareholders_equity)
    return {
      period: periodLabel(record),
      shortDebt,
      longDebt,
      otherLiabilities: Math.max(totalLiabilities - shortDebt - longDebt, 0),
      equity,
    }
  })

  return { income, assets, capital }
}

function StackedBarChart({ data, bars }) {
  if (!data.length) {
    return <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-slate-500">Chưa có dữ liệu biểu đồ.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="period" tick={{ fill: '#c6c6cd', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#c6c6cd', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(25, 28, 30, 0.96)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            color: '#e0e3e5',
          }}
          formatter={(value, name) => [formatCompact(value), name]}
        />
        <Legend wrapperStyle={{ color: '#c6c6cd', paddingTop: 12 }} />
        {bars.map((bar, index) => (
          <Bar key={bar.key} dataKey={bar.key} name={bar.name} stackId={bars.length > 2 ? 'total' : undefined} fill={bar.color || CHART_COLORS[index % CHART_COLORS.length]} radius={index === bars.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartPanel({ title, children }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="section-title">{title}</h2>
      </div>
      <div className="panel-body">{children}</div>
    </section>
  )
}

function Metric({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-emerald-300">
        {icon}
        <span className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <p className="mt-3 text-base font-bold text-slate-100">{value}</p>
    </div>
  )
}

function ScoreCard({ title, value, detail, tone }) {
  const tones = {
    emerald: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber-300/25 bg-amber-400/10 text-amber-300',
    slate: 'border-white/10 bg-white/[0.04] text-slate-300',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-black uppercase tracking-widest opacity-75">{title}</p>
      <p className="mt-3 text-xl font-black">{value}</p>
      {detail && <p className="mt-1 text-xs opacity-75">{detail}</p>}
    </div>
  )
}

function RiskLine({ warning }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold text-slate-100">{warning.title || 'Cảnh báo tài chính'}</p>
        <span className={cn('rounded-full border px-2.5 py-1 text-xs font-black', levelClass[warning.level] || levelClass.info)}>
          {warning.level === 'critical' ? 'Nghiêm trọng' : warning.level === 'warning' ? 'Cao' : 'Theo dõi'}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{warning.message}</p>
      {warning.recommendation && <p className="mt-1 text-xs leading-5 text-slate-500">{warning.recommendation}</p>}
    </div>
  )
}
