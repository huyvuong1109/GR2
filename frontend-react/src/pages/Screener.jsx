import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Search,
  Filter,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  X,
  ChevronDown,
  RotateCcw,
  Download,
  Bookmark,
  Star,
  Eye,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Badge, SkeletonTable } from '../components/ui'
import { formatCurrency, formatPercent, formatRatio } from '../utils/formatters'
import { cn } from '../utils/helpers'

// Mock data - sẽ thay bằng API
const mockStocks = [
  { id: 1, ticker: 'VNM', name: 'Công ty CP Sữa Việt Nam', industry: 'Thực phẩm', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 2, ticker: 'FPT', name: 'FPT Corporation', industry: 'Công nghệ', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 3, ticker: 'VIC', name: 'Tập đoàn Vingroup', industry: 'Bất động sản', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 4, ticker: 'VHM', name: 'Vinhomes', industry: 'Bất động sản', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 5, ticker: 'HPG', name: 'Tập đoàn Hòa Phát', industry: 'Thép', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 6, ticker: 'MSN', name: 'Masan Group', industry: 'Đa ngành', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 7, ticker: 'MWG', name: 'Thế Giới Di Động', industry: 'Bán lẻ', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 8, ticker: 'VCB', name: 'Vietcombank', industry: 'Ngân hàng', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 9, ticker: 'TCB', name: 'Techcombank', industry: 'Ngân hàng', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 10, ticker: 'ACB', name: 'ACB', industry: 'Ngân hàng', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 11, ticker: 'REE', name: 'Cơ điện lạnh REE', industry: 'Công nghiệp', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
  { id: 12, ticker: 'PNJ', name: 'Vàng bạc đá quý Phú Nhuận', industry: 'Bán lẻ', exchange: 'HOSE', price: 0, change: 0, marketCap: 0, pe: 0, pb: 0, roe: 0, roa: 0, de: 0, dividendYield: 0, revenueGrowth: 0, profitGrowth: 0 },
]

const industries = [
  { value: '', label: 'Tất cả ngành' },
  { value: 'Ngân hàng', label: 'Ngân hàng' },
  { value: 'Bất động sản', label: 'Bất động sản' },
  { value: 'Thực phẩm', label: 'Thực phẩm' },
  { value: 'Công nghệ', label: 'Công nghệ' },
  { value: 'Thép', label: 'Thép' },
  { value: 'Bán lẻ', label: 'Bán lẻ' },
  { value: 'Công nghiệp', label: 'Công nghiệp' },
  { value: 'Đa ngành', label: 'Đa ngành' },
]

const presetFilters = [
  { id: 'value', name: 'Co phieu gia tri', desc: 'P/E < 15, P/B < 1.5, ROE > 15%', filters: { peMax: 15, pbMax: 1.5, roeMin: 15 } },
  { id: 'growth', name: 'Co phieu tang truong', desc: 'Doanh thu va loi nhuan > 20%', filters: { revenueGrowthMin: 20, profitGrowthMin: 20 } },
  { id: 'dividend', name: 'Co phieu co tuc', desc: 'Co tuc > 5%, D/E < 1', filters: { dividendYieldMin: 5, deMax: 1 } },
  { id: 'quality', name: 'Co phieu chat luong', desc: 'ROE > 20%, D/E < 0.5', filters: { roeMin: 20, deMax: 0.5 } },
]

const initialFilters = {
  search: '',
  industry: '',
  peMin: '',
  peMax: '',
  pbMin: '',
  pbMax: '',
  roeMin: '',
  roeMax: '',
  deMin: '',
  deMax: '',
  dividendYieldMin: '',
  revenueGrowthMin: '',
  profitGrowthMin: '',
}

export default function Screener() {
  const [filters, setFilters] = useState(initialFilters)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: 'marketCap', direction: 'desc' })
  const [selectedStocks, setSelectedStocks] = useState([])
  const [loading, setLoading] = useState(false)

  // Filter và sort stocks
  const filteredStocks = useMemo(() => {
    let result = [...mockStocks]

    // Text search
    if (filters.search) {
      const search = filters.search.toLowerCase()
      result = result.filter(s => 
        s.ticker.toLowerCase().includes(search) ||
        s.name.toLowerCase().includes(search)
      )
    }

    // Industry filter
    if (filters.industry) {
      result = result.filter(s => s.industry === filters.industry)
    }

    // Numeric filters
    if (filters.peMin) result = result.filter(s => s.pe >= Number(filters.peMin))
    if (filters.peMax) result = result.filter(s => s.pe <= Number(filters.peMax))
    if (filters.pbMin) result = result.filter(s => s.pb >= Number(filters.pbMin))
    if (filters.pbMax) result = result.filter(s => s.pb <= Number(filters.pbMax))
    if (filters.roeMin) result = result.filter(s => s.roe >= Number(filters.roeMin))
    if (filters.roeMax) result = result.filter(s => s.roe <= Number(filters.roeMax))
    if (filters.deMin) result = result.filter(s => s.de >= Number(filters.deMin))
    if (filters.deMax) result = result.filter(s => s.de <= Number(filters.deMax))
    if (filters.dividendYieldMin) result = result.filter(s => s.dividendYield >= Number(filters.dividendYieldMin))
    if (filters.revenueGrowthMin) result = result.filter(s => s.revenueGrowth >= Number(filters.revenueGrowthMin))
    if (filters.profitGrowthMin) result = result.filter(s => s.profitGrowth >= Number(filters.profitGrowthMin))

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? 0
      const bVal = b[sortConfig.key] ?? 0
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
    })

    return result
  }, [filters, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }))
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const applyPreset = (preset) => {
    setFilters({
      ...initialFilters,
      ...Object.entries(preset.filters).reduce((acc, [key, val]) => {
        acc[key] = String(val)
        return acc
      }, {})
    })
    setShowAdvanced(true)
  }

  const resetFilters = () => {
    setFilters(initialFilters)
  }

  const toggleSelectStock = (ticker) => {
    setSelectedStocks(prev => 
      prev.includes(ticker) 
        ? prev.filter(t => t !== ticker)
        : [...prev, ticker]
    )
  }

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null
    return sortConfig.direction === 'asc' 
      ? <TrendingUp className="w-3 h-3 ml-1" />
      : <TrendingDown className="w-3 h-3 ml-1" />
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">
            Sàng lọc cổ phiếu
          </h1>
          <p className="text-slate-600 mt-1">
            Tìm kiếm cổ phiếu theo các tiêu chí đầu tư giá trị
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="info">{filteredStocks.length} kết quả</Badge>
          {selectedStocks.length > 0 && (
            <Badge variant="primary">{selectedStocks.length} đã chọn</Badge>
          )}
        </div>
      </div>

      {/* Preset Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {presetFilters.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            className="glass-card-hover p-4 text-left group"
          >
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-warning-400" />
              <span className="font-semibold text-slate-900 group-hover:text-primary-400 transition-colors">
                {preset.name}
              </span>
            </div>
            <p className="text-xs text-slate-600">{preset.desc}</p>
          </button>
        ))}
      </div>

      {/* Search and Basic Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <Input
                placeholder="Tìm mã CK hoặc tên công ty..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            {/* Industry */}
            <div className="w-full lg:w-64">
              <Select
                options={industries}
                value={filters.industry}
                onChange={(val) => handleFilterChange('industry', val)}
                placeholder="Chọn ngành..."
              />
            </div>

            {/* Toggle Advanced */}
            <Button
              variant="secondary"
              onClick={() => setShowAdvanced(!showAdvanced)}
              leftIcon={<SlidersHorizontal className="w-4 h-4" />}
            >
              Bộ lọc nâng cao
              <ChevronDown className={cn(
                "w-4 h-4 ml-1 transition-transform",
                showAdvanced && "rotate-180"
              )} />
            </Button>

            {/* Reset */}
            <Button
              variant="ghost"
              onClick={resetFilters}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Dat lai
            </Button>
          </div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-6 mt-6 border-t border-dark-700">
                  <Input
                    label="P/E tối thiểu"
                    type="number"
                    value={filters.peMin}
                    onChange={(e) => handleFilterChange('peMin', e.target.value)}
                    placeholder="0"
                  />
                  <Input
                    label="P/E tối đa"
                    type="number"
                    value={filters.peMax}
                    onChange={(e) => handleFilterChange('peMax', e.target.value)}
                    placeholder="50"
                  />
                  <Input
                    label="P/B tối thiểu"
                    type="number"
                    value={filters.pbMin}
                    onChange={(e) => handleFilterChange('pbMin', e.target.value)}
                    placeholder="0"
                  />
                  <Input
                    label="P/B tối đa"
                    type="number"
                    value={filters.pbMax}
                    onChange={(e) => handleFilterChange('pbMax', e.target.value)}
                    placeholder="10"
                  />
                  <Input
                    label="ROE tối thiểu (%)"
                    type="number"
                    value={filters.roeMin}
                    onChange={(e) => handleFilterChange('roeMin', e.target.value)}
                    placeholder="0"
                  />
                  <Input
                    label="D/E tối đa"
                    type="number"
                    value={filters.deMax}
                    onChange={(e) => handleFilterChange('deMax', e.target.value)}
                    placeholder="2"
                  />
                  <Input
                    label="Cổ tức tối thiểu (%)"
                    type="number"
                    value={filters.dividendYieldMin}
                    onChange={(e) => handleFilterChange('dividendYieldMin', e.target.value)}
                    placeholder="0"
                  />
                  <Input
                    label="Tăng trưởng DT (%)"
                    type="number"
                    value={filters.revenueGrowthMin}
                    onChange={(e) => handleFilterChange('revenueGrowthMin', e.target.value)}
                    placeholder="0"
                  />
                  <Input
                    label="Tăng trưởng LN (%)"
                    type="number"
                    value={filters.profitGrowthMin}
                    onChange={(e) => handleFilterChange('profitGrowthMin', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <SkeletonTable rows={10} columns={10} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        className="rounded border-dark-600 bg-white"
                        checked={selectedStocks.length === filteredStocks.length}
                        onChange={() => {
                          if (selectedStocks.length === filteredStocks.length) {
                            setSelectedStocks([])
                          } else {
                            setSelectedStocks(filteredStocks.map(s => s.ticker))
                          }
                        }}
                      />
                    </th>
                    <th>Mã CK</th>
                    <th>Công ty</th>
                    <th>Ngành</th>
                    <th 
                      className="text-right cursor-pointer hover:text-primary-400"
                      onClick={() => handleSort('price')}
                    >
                      <span className="inline-flex items-center">
                        Giá
                        <SortIcon column="price" />
                      </span>
                    </th>
                    <th 
                      className="text-right cursor-pointer hover:text-primary-400"
                      onClick={() => handleSort('change')}
                    >
                      <span className="inline-flex items-center">
                        %
                        <SortIcon column="change" />
                      </span>
                    </th>
                    <th 
                      className="text-right cursor-pointer hover:text-primary-400"
                      onClick={() => handleSort('marketCap')}
                    >
                      <span className="inline-flex items-center">
                        Vốn hóa
                        <SortIcon column="marketCap" />
                      </span>
                    </th>
                    <th 
                      className="text-right cursor-pointer hover:text-primary-400"
                      onClick={() => handleSort('pe')}
                    >
                      <span className="inline-flex items-center">
                        P/E
                        <SortIcon column="pe" />
                      </span>
                    </th>
                    <th 
                      className="text-right cursor-pointer hover:text-primary-400"
                      onClick={() => handleSort('pb')}
                    >
                      <span className="inline-flex items-center">
                        P/B
                        <SortIcon column="pb" />
                      </span>
                    </th>
                    <th 
                      className="text-right cursor-pointer hover:text-primary-400"
                      onClick={() => handleSort('roe')}
                    >
                      <span className="inline-flex items-center">
                        ROE
                        <SortIcon column="roe" />
                      </span>
                    </th>
                    <th 
                      className="text-right cursor-pointer hover:text-primary-400"
                      onClick={() => handleSort('de')}
                    >
                      <span className="inline-flex items-center">
                        D/E
                        <SortIcon column="de" />
                      </span>
                    </th>
                    <th 
                      className="text-right cursor-pointer hover:text-primary-400"
                      onClick={() => handleSort('dividendYield')}
                    >
                      <span className="inline-flex items-center">
                        Cổ tức
                        <SortIcon column="dividendYield" />
                      </span>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map((stock) => (
                    <tr key={stock.ticker} className="group">
                      <td>
                        <input
                          type="checkbox"
                          className="rounded border-dark-600 bg-white"
                          checked={selectedStocks.includes(stock.ticker)}
                          onChange={() => toggleSelectStock(stock.ticker)}
                        />
                      </td>
                      <td>
                        <Link 
                          to={`/company/${stock.ticker}`}
                          className="flex items-center gap-3 group/link"
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary-400">
                              {stock.ticker.slice(0, 2)}
                            </span>
                          </div>
                          <span className="font-semibold text-slate-900 group-hover/link:text-primary-400 transition-colors">
                            {stock.ticker}
                          </span>
                        </Link>
                      </td>
                      <td className="text-slate-500 max-w-[200px] truncate">
                        {stock.name}
                      </td>
                      <td>
                        <Badge variant="default" size="sm">{stock.industry}</Badge>
                      </td>
                      <td className="text-right font-mono font-medium text-slate-900">
                        {stock.price.toLocaleString('vi-VN')}
                      </td>
                      <td className="text-right">
                        <span className={cn(
                          'inline-flex items-center gap-1 font-medium',
                          stock.change > 0 ? 'text-success-400' : stock.change < 0 ? 'text-danger-400' : 'text-slate-600'
                        )}>
                          {stock.change > 0 ? '+' : ''}{formatPercent(stock.change)}
                        </span>
                      </td>
                      <td className="text-right text-slate-500">
                        {formatCurrency(stock.marketCap)}
                      </td>
                      <td className="text-right font-mono">
                        <span className={cn(
                          stock.pe <= 15 ? 'text-success-400' : stock.pe <= 25 ? 'text-warning-400' : 'text-danger-400'
                        )}>
                          {formatRatio(stock.pe)}
                        </span>
                      </td>
                      <td className="text-right font-mono">
                        <span className={cn(
                          stock.pb <= 1.5 ? 'text-success-400' : stock.pb <= 3 ? 'text-warning-400' : 'text-danger-400'
                        )}>
                          {formatRatio(stock.pb)}
                        </span>
                      </td>
                      <td className="text-right">
                        <Badge 
                          variant={stock.roe >= 20 ? 'success' : stock.roe >= 15 ? 'warning' : 'danger'}
                          size="sm"
                        >
                          {formatPercent(stock.roe)}
                        </Badge>
                      </td>
                      <td className="text-right font-mono">
                        <span className={cn(
                          stock.de <= 0.5 ? 'text-success-400' : stock.de <= 1 ? 'text-warning-400' : 'text-danger-400'
                        )}>
                          {formatRatio(stock.de)}
                        </span>
                      </td>
                      <td className="text-right font-mono text-slate-500">
                        {formatPercent(stock.dividendYield)}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-slate-900">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-warning-400">
                            <Bookmark className="w-4 h-4" />
                          </button>
                          <Link 
                            to={`/company/${stock.ticker}`}
                            className="p-2 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-primary-400"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredStocks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-dark-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Không tìm thấy kết quả
              </h3>
              <p className="text-slate-600 max-w-md">
                Thu dieu chinh cac tieu chi loc hoac su dung bo loc mau co san
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={resetFilters}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                Dat lai bo loc
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Bar */}
      {selectedStocks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-4 px-6 py-4 bg-white/95 backdrop-blur-xl border border-dark-600 rounded-2xl shadow-2xl">
            <span className="text-sm text-slate-500">
              Đã chọn <span className="font-semibold text-slate-900">{selectedStocks.length}</span> cổ phiếu
            </span>
            <div className="w-px h-6 bg-dark-600" />
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
              Xuất Excel
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Eye className="w-4 h-4" />}>
              So sánh
            </Button>
            <button
              onClick={() => setSelectedStocks([])}
              className="p-2 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
