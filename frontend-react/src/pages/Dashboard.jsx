import { motion } from 'framer-motion'
import { useContext, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  LineChart,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { AuthContext } from '../contexts/AuthContext'
import { WatchlistContext } from '../contexts/WatchlistContext'
import { ProtectedActionLink } from '../components/AuthRequired'
import { advancedScreenerApi, analysisApi, companiesApi, marketApi } from '../services/api'
import { cn } from '../utils/helpers'

const MARKET_REFRESH_MS = 120000

const OPPORTUNITY_TABS = [
  {
    id: 'valuation',
    label: 'Định giá hấp dẫn',
    params: { max_pe: 15, max_pb: 1.8, min_roe: 8, min_f_score: 0, sort_by: 'pe_ratio', sort_order: 'asc', limit: 6 },
  },
  {
    id: 'recovery',
    label: 'Lợi nhuận phục hồi',
    params: { min_profit_growth: 20, min_f_score: 0, sort_by: 'profit_growth', sort_order: 'desc', limit: 6 },
  },
  {
    id: 'cashflow',
    label: 'Dòng tiền cải thiện',
    params: { min_current_ratio: 1, min_f_score: 7, sort_by: 'f_score', sort_order: 'desc', limit: 6 },
  },
  {
    id: 'forgotten',
    label: 'Bị thị trường bỏ quên',
    params: { max_pe: 12, max_pb: 1.2, min_roe: 5, min_f_score: 0, sort_by: 'pb_ratio', sort_order: 'asc', limit: 6 },
  },
]

const HEALTH_FILTERS = {
  sort_by: 'health_score',
  sort_order: 'desc',
  limit: 80,
}

const levelLabel = {
  critical: 'Nghiêm trọng',
  warning: 'Cao',
  info: 'Trung bình',
}

const levelClass = {
  critical: 'border-red-300/25 bg-red-500/10 text-red-200',
  warning: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  info: 'border-sky-300/25 bg-sky-400/10 text-sky-200',
}

const formatCompactNumber = (value) => {
  const number = Number(value || 0)
  if (number >= 1e15) return `${(number / 1e15).toFixed(2)} triệu tỷ`
  if (number >= 1e12) return `${(number / 1e12).toFixed(2)} nghìn tỷ`
  if (number >= 1e9) return `${(number / 1e9).toFixed(0)} tỷ`
  return number.toLocaleString('vi-VN')
}

const getResults = (response) => {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.results)) return response.results
  return []
}

const formatIndexValue = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Đang cập nhật'
  return number.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

const formatPercentChange = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Chưa có dữ liệu'
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}% hôm nay`
}

const marketAssessment = (overview) => {
  const changePercent = Number(overview?.vn_index_change_percent ?? overview?.vnIndexChangePercent)
  const change = Number(overview?.vn_index_change ?? overview?.vnIndexChange)

  if (!Number.isFinite(changePercent)) return 'Chưa có đủ dữ liệu VN-Index để đánh giá trạng thái thị trường.'
  if (changePercent >= 1) return 'Thị trường đang đi lên rõ rệt, lực tăng trong phiên khá tích cực.'
  if (changePercent >= 0.25) return 'Thị trường đang tăng nhẹ và có dấu hiệu hồi phục.'
  if (changePercent > -0.25) return 'Thị trường đang đi ngang, trạng thái cân bằng và chưa có xu hướng rõ.'
  if (changePercent > -1) return 'Thị trường đang giảm nhẹ, áp lực bán xuất hiện nhưng chưa quá mạnh.'
  return `Thị trường đang giảm mạnh${Number.isFinite(change) ? `, VN-Index mất ${Math.abs(change).toFixed(2)} điểm` : ''}.`
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function scoreValuation(company) {
  const pe = Number(company.pe_ratio || 0)
  const pb = Number(company.pb_ratio || 0)
  let score = 0
  if (pe > 0) score += pe <= 12 ? 22 : pe <= 18 ? 14 : pe <= 25 ? 6 : 0
  if (pb > 0) score += pb <= 1.2 ? 18 : pb <= 2 ? 11 : pb <= 3 ? 5 : 0
  return score
}

function scoreHealth(company) {
  const roe = Number(company.roe || 0)
  const roa = Number(company.roa || 0)
  const fScore = Number(company.f_score || 0)
  const debtToEquity = Number(company.debt_to_equity || 0)
  return clamp(roe * 0.9 + roa * 1.2 + fScore * 5 - Math.max(debtToEquity - 1, 0) * 6, 0, 45)
}

function scoreImprovement(company) {
  const revenueGrowth = Number(company.revenue_growth || 0)
  const profitGrowth = Number(company.profit_growth || 0)
  return clamp(revenueGrowth * 0.25 + profitGrowth * 0.35, 0, 35)
}

function scoreRiskPenalty(company) {
  const debtToEquity = Number(company.debt_to_equity || 0)
  const pe = Number(company.pe_ratio || 0)
  const profitGrowth = Number(company.profit_growth || 0)
  let penalty = 0
  if (debtToEquity > 2) penalty += 14
  if (pe > 25) penalty += 8
  if (profitGrowth < 0) penalty += 8
  return penalty
}

function opportunityScore(company) {
  return Math.round(clamp(scoreHealth(company) + scoreValuation(company) + scoreImprovement(company) - scoreRiskPenalty(company), 0, 100))
}

function healthScore(company) {
  if (company.health_score !== null && company.health_score !== undefined) {
    const score = Number(company.health_score)
    return Number.isFinite(score) ? Number(score.toFixed(1)) : 0
  }
  return Math.round(clamp(scoreHealth(company) + Math.min(Number(company.gross_margin || 0) * 0.25, 12) + Math.min(Number(company.profit_growth || 0) * 0.2, 18), 0, 100))
}

function valuationLabel(company) {
  const pe = Number(company.pe_ratio || 0)
  const pb = Number(company.pb_ratio || 0)
  if (pe > 0 && pe <= 12 && pb > 0 && pb <= 1.5) return 'rẻ'
  if (pe > 0 && pe <= 20) return 'hợp lý'
  if (pe > 20) return 'cao'
  return 'chưa đủ dữ liệu'
}

function thesisFor(company) {
  const reasons = []
  if (Number(company.roe || 0) >= 15) reasons.push('ROE cao')
  if (Number(company.roa || 0) >= 5) reasons.push('ROA tốt')
  if (Number(company.f_score || 0) >= 7) reasons.push(`F-Score ${company.f_score}/9`)
  if (Number(company.debt_to_equity || 0) > 0 && Number(company.debt_to_equity || 0) <= 1.5) reasons.push('nợ vay thấp')
  if (Number(company.profit_growth || 0) > 20) reasons.push('lợi nhuận phục hồi')
  if (Number(company.revenue_growth || 0) > 10) reasons.push('doanh thu tăng trưởng')
  return reasons.slice(0, 3).join(', ') || 'Chưa đủ dữ liệu luận điểm nổi bật'
}

function riskFor(company) {
  if (Number(company.debt_to_equity || 0) > 2) return 'Đòn bẩy tài chính cần theo dõi'
  if (Number(company.pe_ratio || 0) > 25) return 'Định giá cao so với ngưỡng hệ thống'
  if (Number(company.profit_growth || 0) < 0) return 'Lợi nhuận đang suy giảm'
  return 'Chưa có rủi ro nổi bật từ bộ lọc'
}

export default function Dashboard() {
  const { user } = useContext(AuthContext)
  const { items: watchlistItems } = useContext(WatchlistContext)
  const userName = user?.username || 'Nhà đầu tư'
  const [activeTab, setActiveTab] = useState(OPPORTUNITY_TABS[0].id)
  const [marketOverview, setMarketOverview] = useState(null)
  const [healthyCompanies, setHealthyCompanies] = useState([])
  const [opportunities, setOpportunities] = useState([])
  const [riskAlerts, setRiskAlerts] = useState([])
  const [watchlistCompanies, setWatchlistCompanies] = useState([])
  const [showAllRisks, setShowAllRisks] = useState(false)
  const [loadingMarket, setLoadingMarket] = useState(false)
  const [loadingHealthy, setLoadingHealthy] = useState(false)
  const [loadingOpportunities, setLoadingOpportunities] = useState(false)
  const [loadingRisks, setLoadingRisks] = useState(false)
  const [loadingWatchlist, setLoadingWatchlist] = useState(false)

  const activeConfig = useMemo(
    () => OPPORTUNITY_TABS.find((tab) => tab.id === activeTab) || OPPORTUNITY_TABS[0],
    [activeTab]
  )

  const watchlistTickers = useMemo(
    () => watchlistItems.map((item) => item.ticker).filter(Boolean).slice(0, 12),
    [watchlistItems]
  )

  const vnIndexValue = marketOverview?.vn_index ?? marketOverview?.vnIndex
  const vnIndexChangePercent = marketOverview?.vn_index_change_percent ?? marketOverview?.vnIndexChangePercent
  const marketStatusText = marketOverview?.market_status_message ?? marketOverview?.status_message ?? 'Đang cập nhật'
  const marketUpdatedAt = marketOverview?.last_update_time || marketOverview?.last_update || '--'

  useEffect(() => {
    let cancelled = false

    const loadMarketOverview = async () => {
      setLoadingMarket(true)
      try {
        const overview = await marketApi.getOverview()
        if (!cancelled) setMarketOverview(overview || null)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load market overview', error)
          setMarketOverview(null)
        }
      } finally {
        if (!cancelled) setLoadingMarket(false)
      }
    }

    loadMarketOverview()
    const intervalId = window.setInterval(loadMarketOverview, MARKET_REFRESH_MS)
    window.addEventListener('focus', loadMarketOverview)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', loadMarketOverview)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadHealthyCompanies = async () => {
      setLoadingHealthy(true)
      try {
        const response = await advancedScreenerApi.screen(HEALTH_FILTERS)
        const ranked = getResults(response)
          .map((company) => ({ ...company, computed_health_score: healthScore(company) }))
          .filter((company) => company.computed_health_score > 0)
          .sort((a, b) => b.computed_health_score - a.computed_health_score)
          .slice(0, 6)
        if (!cancelled) setHealthyCompanies(ranked)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load healthy companies', error)
          setHealthyCompanies([])
        }
      } finally {
        if (!cancelled) setLoadingHealthy(false)
      }
    }

    loadHealthyCompanies()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadWatchlistCompanies = async () => {
      if (!watchlistTickers.length) {
        setWatchlistCompanies([])
        return
      }

      setLoadingWatchlist(true)
      try {
        const companies = await companiesApi.getBatch(watchlistTickers)
        if (!cancelled) setWatchlistCompanies(Array.isArray(companies) ? companies : [])
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load watchlist companies', error)
          setWatchlistCompanies([])
        }
      } finally {
        if (!cancelled) setLoadingWatchlist(false)
      }
    }

    loadWatchlistCompanies()
    return () => {
      cancelled = true
    }
  }, [watchlistTickers])

  useEffect(() => {
    let cancelled = false

    const loadOpportunities = async () => {
      setLoadingOpportunities(true)
      try {
        const response = await advancedScreenerApi.screen(activeConfig.params)
        const sorted = getResults(response)
          .map((company) => ({ ...company, opportunity_score: opportunityScore(company) }))
          .sort((a, b) => b.opportunity_score - a.opportunity_score)
          .slice(0, 8)
        if (!cancelled) setOpportunities(sorted)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load opportunities', error)
          setOpportunities([])
        }
      } finally {
        if (!cancelled) setLoadingOpportunities(false)
      }
    }

    loadOpportunities()
    return () => {
      cancelled = true
    }
  }, [activeConfig])

  useEffect(() => {
    let cancelled = false

    const loadRiskAlerts = async () => {
      setLoadingRisks(true)
      try {
        let tickers = watchlistTickers
        if (!tickers.length) {
          const companies = await companiesApi.getAll()
          tickers = (Array.isArray(companies) ? companies : []).map((company) => company.ticker).filter(Boolean).slice(0, 12)
        }

        const responses = await Promise.all(
          tickers.map((ticker) =>
            analysisApi.getWarnings(ticker).catch(() => ({
              ticker,
              company_name: ticker,
              warnings: [],
            }))
          )
        )

        const alerts = responses.flatMap((response) =>
          (response?.warnings || []).map((warning) => ({
            ...warning,
            ticker: response.ticker,
            company_name: response.company_name,
          }))
        )

        const ordered = alerts.sort((a, b) => {
          const weight = { critical: 3, warning: 2, info: 1 }
          return (weight[b.level] || 0) - (weight[a.level] || 0)
        })

        if (!cancelled) setRiskAlerts(ordered.slice(0, 6))
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load risk alerts', error)
          setRiskAlerts([])
        }
      } finally {
        if (!cancelled) setLoadingRisks(false)
      }
    }

    loadRiskAlerts()
    return () => {
      cancelled = true
    }
  }, [watchlistTickers])

  return (
    <div className="space-y-8">
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-5xl">
          <h1 className="text-3xl font-black leading-tight text-slate-100 md:text-4xl">Bảng điều khiển tài chính</h1>
          <p className="mt-3 max-w-4xl text-base leading-7 text-slate-400">
            Chào {userName}. Dashboard ưu tiên trạng thái thị trường, cơ hội đáng nghiên cứu và các rủi ro tài chính cần chú ý.
          </p>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {loadingMarket ? 'Đang cập nhật thị trường...' : 'Tự cập nhật mỗi 2 phút'}
        </p>
      </motion.section>

      <MarketOverviewCard
        loading={loadingMarket}
        vnIndex={formatIndexValue(vnIndexValue)}
        change={formatPercentChange(vnIndexChangePercent)}
        status={marketStatusText}
        updatedAt={marketUpdatedAt}
        assessment={marketAssessment(marketOverview)}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="space-y-6 xl:col-span-8">
          <OpportunitySection
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            opportunities={opportunities}
            loading={loadingOpportunities}
          />
          <WatchlistSection
            items={watchlistCompanies}
            rawItems={watchlistItems}
            loading={loadingWatchlist}
          />
        </section>

        <aside className="space-y-6 xl:col-span-4">
          <HealthySection companies={healthyCompanies} loading={loadingHealthy} />
          <RiskSection
            alerts={riskAlerts}
            loading={loadingRisks}
            usesWatchlist={watchlistTickers.length > 0}
            showAll={showAllRisks}
            onToggleShowAll={() => setShowAllRisks((value) => !value)}
          />
        </aside>
      </div>

    </div>
  )
}

function MarketOverviewCard({ loading, vnIndex, change, status, updatedAt, assessment }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden p-6 md:p-7"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Tổng quan thị trường</p>
          <h2 className="mt-2 text-xl font-black text-slate-100 md:text-2xl">Góc nhìn cơ bản dựa trên dữ liệu thị trường</h2>
        </div>
        <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-400">
          {loading ? 'Đang cập nhật...' : `Cập nhật: ${updatedAt}`}
        </div>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">VN-Index</p>
          <p className="mt-2 text-3xl font-black text-slate-100">{vnIndex}</p>
          <p className={cn('mt-1 text-sm font-bold', String(change).startsWith('-') ? 'text-red-300' : 'text-emerald-300')}>{change}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Trạng thái thị trường</p>
          <p className="mt-2 text-lg font-black text-slate-100">{status}</p>
          <p className="mt-2 text-sm text-slate-500">Theo giờ giao dịch Việt Nam</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4">
        <p className="text-sm font-black text-emerald-300">Đánh giá nhanh</p>
        <p className="mt-2 max-w-5xl text-sm leading-7 text-slate-200">{assessment}</p>
      </div>
    </motion.section>
  )
}

function WatchlistSection({ items, rawItems, loading }) {
  const fallbackItems = useMemo(
    () =>
      rawItems
        .map((item) => ({ ticker: item.ticker, name: item.ticker }))
        .filter((item) => item.ticker && !items.some((company) => company.ticker === item.ticker)),
    [items, rawItems]
  )
  const visibleItems = [...items, ...fallbackItems].slice(0, 12)

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Star className="mt-0.5 h-5 w-5 text-emerald-300" />
            <div>
              <h2 className="section-title">Watchlist của bạn</h2>
              <p className="section-subtitle">Theo dõi nhanh các mã đã lưu trong danh mục quan tâm.</p>
            </div>
          </div>
          <ProtectedActionLink to="/settings" className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-sm">
            Quản lý
            <ArrowUpRight className="h-4 w-4" />
          </ProtectedActionLink>
        </div>
      </div>

      <div className="panel-body">
        {loading && <div className="alert-info text-sm">Đang tải watchlist...</div>}
        {!loading && visibleItems.length === 0 && (
          <div className="alert-info text-sm">Chưa có mã nào trong watchlist. Bấm biểu tượng sao ở bảng lọc hoặc trang chi tiết để thêm mã.</div>
        )}
        {!loading && visibleItems.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleItems.map((company) => (
              <ProtectedActionLink
                key={company.ticker}
                to={`/company/${company.ticker}`}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-300/25 hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-lg font-black text-emerald-300">{company.ticker}</p>
                    <p className="mt-1 truncate text-sm text-slate-400">{company.name || company.ticker}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 flex-none text-slate-500" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-bold uppercase tracking-widest text-slate-500">Giá</p>
                    <p className="mt-1 font-mono font-black text-slate-100">
                      {company.current_price || company.price ? Number(company.current_price || company.price).toLocaleString('vi-VN') : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold uppercase tracking-widest text-slate-500">Vốn hóa</p>
                    <p className="mt-1 font-mono font-black text-slate-100">
                      {company.market_cap ? formatCompactNumber(company.market_cap) : '-'}
                    </p>
                  </div>
                </div>
              </ProtectedActionLink>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function OpportunitySection({ activeTab, setActiveTab, opportunities, loading }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-emerald-300" />
              <h2 className="section-title">Cơ hội đầu tư nổi bật</h2>
            </div>
            <p className="section-subtitle">
              {opportunities.length} mã đáng nghiên cứu theo bộ tiêu chí hiện tại. Bấm vào chi tiết mã để xem phân tích đầy đủ.
            </p>
          </div>
          <ProtectedActionLink to="/screener" className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-sm">
            Mở bộ lọc
            <ArrowUpRight className="h-4 w-4" />
          </ProtectedActionLink>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {OPPORTUNITY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-black transition',
                activeTab === tab.id
                  ? 'border-emerald-300/35 bg-emerald-400/12 text-emerald-300'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-body">
        {loading && <div className="alert-info text-sm">Đang tải cơ hội đầu tư...</div>}
        {!loading && opportunities.length === 0 && (
          <div className="alert-info text-sm">0 mã phù hợp với bộ tiêu chí hiện tại.</div>
        )}
        {!loading && opportunities.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {opportunities.map((company) => (
              <OpportunityRow key={company.ticker} company={company} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function OpportunityRow({ company }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-300/25 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-lg font-black text-slate-100">{company.ticker}</h3>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] font-bold text-slate-300">
              {valuationLabel(company)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-slate-400">{company.name}</p>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm leading-6 text-slate-300">
        {thesisFor(company)}
      </div>
      <p className="mt-2 text-xs text-slate-500">Rủi ro: {riskFor(company)}</p>
      <ProtectedActionLink to={`/company/${company.ticker}`} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-emerald-300 hover:text-emerald-200">
        Xem chi tiết mã
        <ArrowUpRight className="h-3.5 w-3.5" />
      </ProtectedActionLink>
    </div>
  )
}

function HealthySection({ companies, loading }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
          <div>
            <h2 className="section-title">Top doanh nghiệp đáng chú ý</h2>
            <p className="section-subtitle">Điểm = F-Score 40% + định giá 20% + tăng trưởng 20% + rủi ro 20%.</p>
          </div>
        </div>
      </div>
      <div className="panel-body">
        {loading && <div className="alert-info text-sm">Đang xếp hạng doanh nghiệp...</div>}
        {!loading && companies.length === 0 && <div className="alert-info text-sm">0 doanh nghiệp đủ dữ liệu để xếp hạng đáng chú ý.</div>}
        {!loading && companies.length > 0 && (
          <div className="space-y-3">
            {companies.slice(0, 5).map((company, index) => (
              <HealthyRow key={company.ticker} company={company} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function HealthyRow({ company, index }) {
  const score = company.computed_health_score ?? healthScore(company)
  return (
    <ProtectedActionLink to={`/company/${company.ticker}`} className="block rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-emerald-300/25 hover:bg-white/[0.06]">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/10 text-xs font-black text-emerald-300">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-sm font-black text-slate-100">{company.ticker}</p>
            <p className="text-sm font-black text-emerald-300">{score}/100</p>
          </div>
          <p className="truncate text-xs text-slate-500">{company.name}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">Lý do: {thesisFor(company)}</p>
        </div>
      </div>
    </ProtectedActionLink>
  )
}

function RiskSection({ alerts, loading, usesWatchlist, showAll, onToggleShowAll }) {
  const visibleAlerts = showAll ? alerts : alerts.slice(0, 3)
  return (
    <section className="panel border-red-200/20">
      <div className="panel-header">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />
          <div>
            <h2 className="section-title">Cảnh báo tài chính</h2>
            <p className="section-subtitle">
              Mã nào đang có vấn đề? {usesWatchlist ? 'Ưu tiên các mã trong watchlist.' : 'Đang quét nhóm mã đầu tiên có trong dữ liệu.'}
            </p>
          </div>
        </div>
      </div>
      <div className="panel-body">
        {loading && <div className="alert-info text-sm">Đang kiểm tra cảnh báo...</div>}
        {!loading && alerts.length === 0 && <div className="alert-info text-sm">0 cảnh báo tài chính được phát hiện.</div>}
        {!loading && alerts.length > 0 && (
          <>
            <div className="space-y-3">
              {visibleAlerts.map((alert, index) => (
                <RiskAlert key={`${alert.ticker}-${alert.type}-${index}`} alert={alert} />
              ))}
            </div>
            {alerts.length > 3 && (
              <button type="button" onClick={onToggleShowAll} className="btn-outline mt-4 w-full px-3 py-2 text-sm">
                {showAll ? 'Thu gọn cảnh báo' : `Xem thêm ${alerts.length - 3} cảnh báo`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function RiskAlert({ alert }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-black text-slate-100">{alert.ticker}</p>
          <p className="mt-1 text-sm font-bold text-slate-200">{alert.title || 'Cảnh báo tài chính'}</p>
        </div>
        <span className={cn('rounded-full border px-2.5 py-1 text-xs font-black', levelClass[alert.level] || levelClass.info)}>
          {levelLabel[alert.level] || 'Theo dõi'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{alert.message || 'Cần kiểm tra chi tiết báo cáo tài chính.'}</p>
      {alert.recommendation && <p className="mt-2 text-xs leading-5 text-slate-500">{alert.recommendation}</p>}
      <ProtectedActionLink to={`/company/${alert.ticker}`} className="mt-3 inline-flex items-center gap-2 text-xs font-black text-red-200 hover:text-red-100">
        Kiểm tra chi tiết
        <ArrowUpRight className="h-3.5 w-3.5" />
      </ProtectedActionLink>
    </div>
  )
}
