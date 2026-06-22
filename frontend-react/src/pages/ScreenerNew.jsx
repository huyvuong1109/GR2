import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Filter,
  RotateCcw,
  X,
  Eye,
  AlertTriangle,
  Scale,
  RefreshCw,
  SlidersHorizontal,
  ArrowUpRight,
  Calendar,
} from 'lucide-react'
import { Button, Badge, Select, SkeletonTable } from '../components/ui'
import { cn } from '../utils/helpers'
import api from '../services/api'
import DynamicScreenerPanel from '../components/screener/DynamicScreenerPanel'
import StarButton from '../components/StarButton'
import ResultDetailModal from '../components/screener/ResultDetailModal'

const LOCAL_SAVED_FILTERS_KEY = 'dynamic_screener_saved_filters'

const initialFilters = {
  search: '',
  ticker_group: '',
  min_pe: '',
  max_pe: '',
  min_pb: '',
  max_pb: '',
  min_roe: '',
  max_roa: '',
  min_revenue_growth: '',
  min_profit_growth: '',
  min_f_score: '',
  period_year: '',
  period_quarter: '',
}

const ratioTone = {
  good: 'text-emerald-300',
  ok: 'text-sky-300',
  mid: 'text-amber-300',
  weak: 'text-orange-300',
  bad: 'text-red-300',
}

function HealthScoreBadge({ score }) {
  if (score === null || score === undefined) return <span className="text-slate-500">-</span>
  const tone = score >= 8 ? 'badge-success' : score >= 6 ? 'badge-info' : score >= 4 ? 'badge-warning' : 'badge-danger'
  return <span className={cn('badge', tone)}>{score}/9</span>
}

function RatioValue({ value, type }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return <span className="text-slate-500">-</span>
  const number = Number(value)
  let colorClass = 'text-slate-200'

  if (type === 'pe') colorClass = number < 10 ? ratioTone.good : number < 15 ? ratioTone.ok : number < 25 ? ratioTone.mid : ratioTone.bad
  if (type === 'pb') colorClass = number < 1 ? ratioTone.good : number < 2 ? ratioTone.ok : number < 3 ? ratioTone.mid : ratioTone.bad
  if (['roe', 'roa', 'margin'].includes(type)) colorClass = number >= 20 ? ratioTone.good : number >= 15 ? ratioTone.ok : number >= 10 ? ratioTone.mid : number > 0 ? ratioTone.weak : ratioTone.bad
  if (type === 'de') colorClass = number < 0.5 ? ratioTone.good : number < 1 ? ratioTone.ok : number < 2 ? ratioTone.mid : ratioTone.bad
  if (type === 'growth') colorClass = number >= 20 ? ratioTone.good : number >= 10 ? ratioTone.ok : number >= 0 ? ratioTone.mid : ratioTone.bad

  return <span className={cn('font-mono font-bold', colorClass)}>{number.toFixed(1)}</span>
}

export default function Screener() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(initialFilters)
  const [sortConfig, setSortConfig] = useState({ key: 'market_cap', direction: 'desc' })
  const [selectedStocks, setSelectedStocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [stocks, setStocks] = useState([])
  const [error, setError] = useState(null)
  const [dynamicPayload, setDynamicPayload] = useState([])
  const [dynamicNotice, setDynamicNotice] = useState('')
  const [periodOptions, setPeriodOptions] = useState([])
  const [savedFilters, setSavedFilters] = useState([])
  const [loadedDynamicSnapshot, setLoadedDynamicSnapshot] = useState(null)
  const [priceWarning, setPriceWarning] = useState(null)
  const [isPastPeriod, setIsPastPeriod] = useState(false)
  const [detailModalStock, setDetailModalStock] = useState(null)
  const [activeMethodId, setActiveMethodId] = useState(null)

  const groupOptions = useMemo(() => {
    const industries = [...new Set(stocks.map((s) => s.industry).filter(Boolean))].sort()
    return [{ value: '', label: 'Tất cả ngành' }, ...industries.map((industry) => ({ value: industry, label: industry }))]
  }, [stocks])

  const yearOptions = useMemo(() => {
    const years = [...new Set(periodOptions.map((period) => period.year).filter(Boolean))].sort((a, b) => b - a)
    return [{ value: '', label: 'Mới nhất' }, ...years.map((year) => ({ value: String(year), label: `Năm ${year}` }))]
  }, [periodOptions])

  const quarterOptions = useMemo(() => {
    if (!filters.period_year) return [{ value: '', label: 'Kỳ mới nhất' }]
    const quarters = periodOptions
      .filter((period) => String(period.year) === String(filters.period_year))
      .map((period) => period.quarter)
      .filter((quarter) => Number(quarter) > 0)
      .sort((a, b) => b - a)

    return [
      { value: '', label: 'Cả năm / kỳ mới nhất' },
      ...quarters.map((quarter) => ({ value: String(quarter), label: `Quý ${quarter}` })),
    ]
  }, [periodOptions, filters.period_year])

  const selectedPeriodLabel = useMemo(() => {
    if (!filters.period_year) return 'Dữ liệu mới nhất'
    if (!filters.period_quarter) return `Năm ${filters.period_year}`
    return `Quý ${filters.period_quarter}/${filters.period_year}`
  }, [filters.period_year, filters.period_quarter])

  // Các filter phụ thuộc vào giá cổ phiếu
  const PRICE_DEPENDENT_FILTER_KEYS = ['min_pe', 'max_pe', 'min_pb', 'max_pb']

  const fetchStocks = async (filterParams = {}, activeDynamicPayload = []) => {
    setLoading(true)
    setError(null)
    setPriceWarning(null)
    try {
      const params = new URLSearchParams()
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) params.append(key, value)
      })
      if (activeDynamicPayload.length > 0) params.append('dynamic_filters', JSON.stringify(activeDynamicPayload))
      params.append('sort_by', sortConfig.key)
      params.append('sort_order', sortConfig.direction)
      params.append('limit', '2000')

      const response = await api.get(`/screener/advanced?${params.toString()}`)
      setStocks(response.results || [])
      setIsPastPeriod(response.is_past_period || false)
      if (response.price_warning) setPriceWarning(response.price_warning)
    } catch (err) {
      console.error('Error fetching stocks:', err)
      setError('Không thể tải dữ liệu. Vui lòng thử lại.')
      try {
        const response = await api.get('/companies')
        setStocks(Array.isArray(response) ? response : [])
      } catch {
        setStocks([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStocks()
    fetchPeriodOptions()
    fetchSavedFilters()
  }, [])

  const readLocalSavedFilters = () => {
    try {
      const raw = localStorage.getItem(LOCAL_SAVED_FILTERS_KEY)
      const items = raw ? JSON.parse(raw) : []
      return Array.isArray(items) ? items : []
    } catch {
      return []
    }
  }

  const writeLocalSavedFilters = (items) => {
    localStorage.setItem(LOCAL_SAVED_FILTERS_KEY, JSON.stringify(items))
  }

  const fetchSavedFilters = async () => {
    try {
      const response = await api.get('/user/saved-filters/')
      setSavedFilters(Array.isArray(response) ? response : [])
    } catch {
      setSavedFilters(readLocalSavedFilters())
    }
  }

  const fetchPeriodOptions = async () => {
    try {
      const response = await api.get('/screener/periods')
      setPeriodOptions(Array.isArray(response?.periods) ? response.periods : [])
    } catch (err) {
      console.warn('Không thể tải danh sách kỳ lọc:', err)
      setPeriodOptions([])
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'period_year' ? { period_quarter: '' } : {}),
    }))
  }

  const buildApiFiltersFromQuickInputs = () => {
    const apiFilters = {}
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && key !== 'search' && key !== 'ticker_group') apiFilters[key] = value
    })
    return apiFilters
  }

  const applyFilters = () => fetchStocks(buildApiFiltersFromQuickInputs(), dynamicPayload)

  const resetFilters = () => {
    setFilters(initialFilters)
    setDynamicPayload([])
    setDynamicNotice('')
    setLoadedDynamicSnapshot(null)
    setPriceWarning(null)
    setIsPastPeriod(false)
    fetchStocks()
  }

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  const filteredStocks = useMemo(() => {
    const result = stocks.filter((stock) => {
      if (filters.ticker_group && stock.industry !== filters.ticker_group) return false
      if (!filters.search) return true
      const search = filters.search.toLowerCase()
      return stock.ticker?.toLowerCase().includes(search) || stock.name?.toLowerCase().includes(search)
    })

    result.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? 0
      const bVal = b[sortConfig.key] ?? 0
      if (aVal === bVal) return 0
      return sortConfig.direction === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })

    return result
  }, [stocks, filters.search, filters.ticker_group, sortConfig])

  const handleCompare = () => {
    if (selectedStocks.length >= 2) navigate(`/compare?tickers=${selectedStocks.join(',')}`)
  }

  const toggleStockSelection = (ticker) => {
    setSelectedStocks((prev) =>
      prev.includes(ticker)
        ? prev.filter((item) => item !== ticker)
        : prev.length < 5 ? [...prev, ticker] : prev
    )
  }

  const pushDynamicPayloadToApi = async (payload, queryParams) => {
    if (!payload || payload.length === 0) return
    try {
      await api.post('/screener', { dynamic_filters: payload, mapped_filters: queryParams })
    } catch (postError) {
      console.warn('Dynamic payload endpoint chưa xử lý đầy đủ:', postError)
    }
  }

  const handleDynamicApply = async ({ payload, queryParams, selectedMethodId }) => {
    setDynamicPayload(payload)
    setActiveMethodId(selectedMethodId)
    setDynamicNotice(`Đã tạo payload ${payload.length} điều kiện và gửi API lọc.`)
    const mergedFilters = { ...buildApiFiltersFromQuickInputs(), ...queryParams }
    await pushDynamicPayloadToApi(payload, queryParams)
    fetchStocks(mergedFilters, payload)
  }

  const buildSavedFilterName = (snapshot) => {
    const base = snapshot.selectedMethodLabel || 'Bộ lọc cổ phiếu'
    return `${base} - ${selectedPeriodLabel} - ${new Date().toLocaleString('vi-VN', { hour12: false })}`
  }

  const handleDynamicSave = async (snapshotData) => {
    const { payload } = snapshotData
    const snapshot = {
      ...snapshotData,
      quickFilters: buildApiFiltersFromQuickInputs(),
      savedAt: new Date().toISOString(),
    }
    const name = snapshotData.name?.trim() || buildSavedFilterName(snapshot)

    setDynamicPayload(payload)

    try {
      const saved = await api.post('/user/saved-filters/', {
        name,
        conditions: JSON.stringify(snapshot),
      })
      setSavedFilters((prev) => [saved, ...prev])
      setDynamicNotice(`Đã lưu bộ lọc "${name}".`)
    } catch {
      const fallbackSaved = {
        id: `local-${Date.now()}`,
        name,
        conditions: JSON.stringify(snapshot),
        created_at: new Date().toISOString(),
        local: true,
      }
      const nextSavedFilters = [fallbackSaved, ...readLocalSavedFilters()]
      writeLocalSavedFilters(nextSavedFilters)
      setSavedFilters(nextSavedFilters)
      setDynamicNotice('Đã lưu bộ lọc vào trình duyệt vì chưa lưu được lên tài khoản.')
    }
  }

  const parseSavedFilter = (savedFilter) => {
    try {
      return JSON.parse(savedFilter.conditions || '{}')
    } catch {
      return null
    }
  }

  const applySavedFilter = (savedFilter) => {
    const snapshot = parseSavedFilter(savedFilter)
    if (!snapshot) {
      setDynamicNotice('Không đọc được bộ lọc đã lưu.')
      return
    }

    const quickFilters = snapshot.quickFilters || {}
    setFilters((prev) => ({ ...prev, ...quickFilters }))
    setDynamicPayload(snapshot.payload || [])
    setActiveMethodId(snapshot.selectedMethodId || null)
    setLoadedDynamicSnapshot({ ...snapshot, name: savedFilter.name, loadedAt: Date.now() })
    fetchStocks({ ...quickFilters, ...(snapshot.queryParams || {}) }, snapshot.payload || [])
    setDynamicNotice(`Đã áp dụng bộ lọc "${savedFilter.name}".`)
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-100 sm:text-4xl md:text-5xl">Bộ lọc cổ phiếu</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Lọc các doanh nghiệp theo chất lượng vốn, tăng trưởng, định giá và rủi ro tài chính.
          </p>
        </div>

        {selectedStocks.length >= 2 && (
          <button type="button" onClick={handleCompare} className="btn-primary flex w-full items-center justify-center gap-2 px-5 py-3 sm:w-auto">
            <Scale className="h-4 w-4" />
            So sánh ({selectedStocks.length})
          </button>
        )}
      </section>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_150px_150px_auto_auto] lg:items-end">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Tìm kiếm</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Mã CK hoặc tên công ty..."
                  className="input-primary py-3 pl-11 pr-4"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Ngành</label>
              <Select
                value={filters.ticker_group}
                onChange={(e) => handleFilterChange('ticker_group', e.target.value)}
                options={groupOptions}
                placeholder="Tất cả ngành"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                Năm
              </label>
              <Select
                value={filters.period_year}
                onChange={(e) => handleFilterChange('period_year', e.target.value)}
                options={yearOptions}
                placeholder="Mới nhất"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Quý</label>
              <Select
                value={filters.period_quarter}
                onChange={(e) => handleFilterChange('period_quarter', e.target.value)}
                options={quarterOptions}
                placeholder="Kỳ mới nhất"
                disabled={!filters.period_year}
              />
            </div>

            <button type="button" onClick={applyFilters} className="btn-primary flex items-center justify-center gap-2 px-5 py-3">
              <Filter className="h-4 w-4" />
              Lọc
            </button>

            <button type="button" onClick={resetFilters} className="btn-outline flex items-center justify-center gap-2 px-5 py-3">
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        <div className="p-5">
          <DynamicScreenerPanel loadedSnapshot={loadedDynamicSnapshot} onApplyFilters={handleDynamicApply} onSaveFilters={handleDynamicSave} />
          {dynamicNotice && <p className="mt-3 text-xs font-bold text-emerald-300">{dynamicNotice}</p>}
          <p className="mt-2 text-xs font-bold text-slate-500">Kỳ lọc đang dùng: {selectedPeriodLabel}</p>
          {savedFilters.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Bộ lọc đã lưu</p>
              <div className="flex flex-wrap gap-2">
                {savedFilters.slice(0, 8).map((savedFilter) => (
                  <button
                    key={savedFilter.id}
                    type="button"
                    onClick={() => applySavedFilter(savedFilter)}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-slate-300 transition-colors hover:border-emerald-300/30 hover:text-emerald-200"
                  >
                    {savedFilter.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Banner cảnh báo giá kỳ quá khứ */}
      {priceWarning && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-bold text-amber-300">Cảnh báo: Bộ lọc giá không chính xác với kỳ quá khứ</p>
            <p className="mt-1 text-xs text-amber-200/70">{priceWarning}</p>
            <p className="mt-1 text-xs text-amber-200/50">Các chỉ tiêu khác (ROE, ROA, F-Score, tăng trưởng...) vẫn chính xác vì không phụ thuộc vào giá cổ phiếu.</p>
          </div>
        </motion.div>
      )}

      {/* Banner thông tin kỳ quá khứ (không có cảnh báo giá) */}
      {isPastPeriod && !priceWarning && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-sky-400/20 bg-sky-400/5 px-5 py-3"
        >
          <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-400" />
          <p className="text-xs text-sky-300">
            Đang xem dữ liệu tài chính của kỳ <span className="font-bold">{selectedPeriodLabel}</span>.
            Cột <span className="font-bold">Giá</span>, <span className="font-bold">P/E</span> và <span className="font-bold">P/B</span> sẽ hiển thị
            giá lịch sử tại kỳ đó nếu có trong hệ thống, ngược lại sẽ hiển thị dấu &ldquo;-&rdquo;.
          </p>
        </motion.div>
      )}

      <section className="panel">
        <div className="panel-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="h-5 w-5 text-emerald-300" />
              <h2 className="section-title">Kết quả lọc</h2>
              <span className="text-sm font-bold text-slate-500">({filteredStocks.length} cổ phiếu)</span>
            </div>
            <p className="section-subtitle">Click tiêu đề cột để sắp xếp, chọn tối đa 5 mã để so sánh.</p>
          </div>

          {selectedStocks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span>Đã chọn: {selectedStocks.join(', ')}</span>
              <button
                type="button"
                onClick={() => setSelectedStocks([])}
                className="btn-ghost p-2 text-red-300"
                aria-label="Xóa lựa chọn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="p-0">
          {loading ? (
            <SkeletonTable rows={10} cols={12} />
          ) : error ? (
            <div className="p-10 text-center text-red-300">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 opacity-70" />
              <p>{error}</p>
              <Button onClick={() => fetchStocks()} className="mt-4" variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Thử lại
              </Button>
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <Search className="mx-auto mb-4 h-12 w-12 opacity-60" />
              <p>Không tìm thấy cổ phiếu phù hợp với tiêu chí.</p>
              <Button onClick={resetFilters} className="mt-4" variant="outline">Reset bộ lọc</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-financial min-w-[1320px] table-fixed">
                <colgroup>
                  <col className="w-[3%]" />
                  <col className="w-[20%]" />
                  <col className="w-[11%]" />
                  <col className="w-[9%]" />
                  <col className="w-[8%]" />
                  <col className="w-[9%]" />
                  <col className="w-[6%]" />
                  <col className="w-[6%]" />
                  <col className="w-[6%]" />
                  <col className="w-[6%]" />
                  <col className="w-[7%]" />
                  <col className="w-[6%]" />
                  <col className="w-[3%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        onChange={(e) => setSelectedStocks(e.target.checked ? filteredStocks.slice(0, 5).map((s) => s.ticker) : [])}
                        checked={selectedStocks.length > 0}
                        className="rounded border-white/20 bg-black/30 text-emerald-400"
                      />
                    </th>
                    <SortHead label="Mã CK" sortKey="ticker" sortConfig={sortConfig} onSort={handleSort} />
                    <th className="px-2 text-center text-[11px] leading-4">Thêm vào watchlist</th>
                    <th className="px-2 text-center">Ngành</th>
                    <SortHead
                      label={isPastPeriod ? 'Giá (N/A)' : 'Giá hiện tại'}
                      sortKey="price"
                      align="center"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortHead label="Vốn hóa" sortKey="market_cap" align="right" sortConfig={sortConfig} onSort={handleSort} />
                    <SortHead
                      label={isPastPeriod ? 'P/E (N/A)' : 'P/E'}
                      sortKey="pe_ratio"
                      align="center"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortHead
                      label={isPastPeriod ? 'P/B (N/A)' : 'P/B'}
                      sortKey="pb_ratio"
                      align="center"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortHead label="ROE" sortKey="roe" align="center" sortConfig={sortConfig} onSort={handleSort} />

                    <SortHead label="TT DT" sortKey="revenue_growth" align="center" sortConfig={sortConfig} onSort={handleSort} />
                    <th className="text-center">F-Score</th>
                    <th className="text-center">Xem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map((stock, idx) => (
                    <motion.tr
                      key={stock.ticker}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.01, 0.2) }}
                      className={cn(selectedStocks.includes(stock.ticker) && 'bg-emerald-400/[0.06]')}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedStocks.includes(stock.ticker)}
                          onChange={() => toggleStockSelection(stock.ticker)}
                          className="rounded border-white/20 bg-black/30 text-emerald-400"
                        />
                      </td>
                      <td>
                        <Link to={`/company/${stock.ticker}`} className="group flex items-center gap-2">
                          <span className="font-black text-emerald-300 group-hover:text-emerald-200">{stock.ticker}</span>
                          <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                        <p className="max-w-[220px] truncate text-xs text-slate-500">{stock.name}</p>
                      </td>
                      <td className="px-2 text-center"><StarButton ticker={stock.ticker} /></td>
                      <td className="px-2 text-center">
                        <Badge variant="outline" className="max-w-full truncate text-center">
                          {stock.industry || 'N/A'}
                        </Badge>
                      </td>
                      <td className="text-center font-mono text-slate-100">{stock.price ? `${stock.price.toLocaleString('vi-VN')}₫` : '-'}</td>
                      <td className="text-right font-mono text-slate-100">{stock.market_cap ? `${(stock.market_cap / 1e9).toFixed(0)}B` : '-'}</td>
                      <td className="text-center"><RatioValue value={stock.pe_ratio} type="pe" /></td>
                      <td className="text-center"><RatioValue value={stock.pb_ratio} type="pb" /></td>
                      <td className="text-center"><RatioValue value={stock.roe} type="roe" />%</td>

                      <td className="text-center"><RatioValue value={stock.revenue_growth} type="growth" />%</td>
                      <td className="text-center"><HealthScoreBadge score={stock.f_score} /></td>
                      <td className="text-center flex items-center justify-center gap-1">
                        <button 
                          onClick={() => setDetailModalStock(stock)} 
                          className="btn-ghost rounded-md p-1.5 hover:bg-emerald-500/20 text-emerald-400 transition-colors" 
                          title="Chi tiết so sánh YoY"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </button>
                        <Link to={`/company/${stock.ticker}`} className="btn-ghost rounded-md p-1.5 hover:bg-white/10 transition-colors" title="Hồ sơ công ty">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="glass-card p-5">
        <h4 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-300">Chú thích màu sắc</h4>
        <div className="flex flex-wrap gap-5 text-sm text-slate-400">
          <Legend color="text-emerald-300" text="Tốt / Rẻ" />
          <Legend color="text-sky-300" text="Khá" />
          <Legend color="text-amber-300" text="Trung bình" />
          <Legend color="text-orange-300" text="Cần xem xét" />
          <Legend color="text-red-300" text="Rủi ro / Đắt" />
        </div>
      </section>

      <ResultDetailModal 
        isOpen={!!detailModalStock}
        onClose={() => setDetailModalStock(null)}
        stock={detailModalStock}
        activeMethodId={activeMethodId}
        periodInfo={{
          year: filters.period_year,
          quarter: filters.period_quarter,
          type: filters.period_quarter ? 'quarter' : 'year'
        }}
      />
    </div>
  )
}

function SortHead({ label, sortKey, sortConfig, onSort, align = 'left' }) {
  const active = sortConfig.key === sortKey
  const arrow = active ? (sortConfig.direction === 'desc' ? '↓' : '↑') : ''
  return (
    <th
      className={cn('cursor-pointer hover:text-emerald-300', align === 'right' && 'text-right', align === 'center' && 'text-center')}
      onClick={() => onSort(sortKey)}
    >
      {label} {arrow}
    </th>
  )
}

function Legend({ color, text }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('text-lg leading-none', color)}>■</span>
      <span>{text}</span>
    </div>
  )
}
