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
  { id: 1, ticker: 'VNM', name: 'Công ty CP Sữa Việt Nam', industry: 'Thực phẩm', exchange: 'HOSE', price: 82500, change: 3.2, marketCap: 164000000000000, pe: 18.5, pb: 4.2, roe: 28.4, roa: 18.2, de: 0.3, dividendYield: 3.8, revenueGrowth: 12.5, profitGrowth: 15.2 },
  { id: 2, ticker: 'FPT', name: 'FPT Corporation', industry: 'Công nghệ', exchange: 'HOSE', price: 121000, change: 2.8, marketCap: 132000000000000, pe: 22.3, pb: 5.1, roe: 24.1, roa: 12.5, de: 0.5, dividendYield: 2.1, revenueGrowth: 25.3, profitGrowth: 22.1 },
  { id: 3, ticker: 'VIC', name: 'Tập đoàn Vingroup', industry: 'Bất động sản', exchange: 'HOSE', price: 43200, change: -1.2, marketCap: 185000000000000, pe: 45.2, pb: 1.8, roe: 8.5, roa: 3.2, de: 1.8, dividendYield: 0, revenueGrowth: 18.5, profitGrowth: -5.2 },
  { id: 4, ticker: 'VHM', name: 'Vinhomes', industry: 'Bất động sản', exchange: 'HOSE', price: 38500, change: 1.5, marketCap: 167000000000000, pe: 12.8, pb: 2.1, roe: 15.2, roa: 8.5, de: 0.8, dividendYield: 1.5, revenueGrowth: 22.1, profitGrowth: 18.5 },
  { id: 5, ticker: 'HPG', name: 'Tập đoàn Hòa Phát', industry: 'Thép', exchange: 'HOSE', price: 25800, change: -0.8, marketCap: 116000000000000, pe: 8.5, pb: 1.2, roe: 12.8, roa: 8.1, de: 0.6, dividendYield: 2.5, revenueGrowth: -8.5, profitGrowth: -15.2 },
  { id: 6, ticker: 'MSN', name: 'Masan Group', industry: 'Đa ngành', exchange: 'HOSE', price: 67800, change: 2.1, marketCap: 78000000000000, pe: 35.2, pb: 2.8, roe: 18.5, roa: 5.2, de: 1.2, dividendYield: 0, revenueGrowth: 28.5, profitGrowth: 32.1 },
  { id: 7, ticker: 'MWG', name: 'Thế Giới Di Động', industry: 'Bán lẻ', exchange: 'HOSE', price: 52300, change: 1.8, marketCap: 76000000000000, pe: 15.2, pb: 3.5, roe: 22.5, roa: 10.2, de: 0.4, dividendYield: 1.8, revenueGrowth: 15.2, profitGrowth: 12.5 },
  { id: 8, ticker: 'VCB', name: 'Vietcombank', industry: 'Ngân hàng', exchange: 'HOSE', price: 92500, change: 0.5, marketCap: 432000000000000, pe: 14.2, pb: 3.2, roe: 25.2, roa: 1.8, de: 8.5, dividendYield: 1.2, revenueGrowth: 18.5, profitGrowth: 22.5 },
  { id: 9, ticker: 'TCB', name: 'Techcombank', industry: 'Ngân hàng', exchange: 'HOSE', price: 35200, change: 1.2, marketCap: 124000000000000, pe: 8.5, pb: 1.5, roe: 18.5, roa: 2.8, de: 6.2, dividendYield: 0, revenueGrowth: 25.2, profitGrowth: 28.5 },
  { id: 10, ticker: 'ACB', name: 'ACB', industry: 'Ngân hàng', exchange: 'HOSE', price: 24500, change: 0.8, marketCap: 92000000000000, pe: 7.2, pb: 1.8, roe: 24.5, roa: 2.5, de: 7.8, dividendYield: 0, revenueGrowth: 22.5, profitGrowth: 25.2 },
  { id: 11, ticker: 'REE', name: 'Cơ điện lạnh REE', industry: 'Công nghiệp', exchange: 'HOSE', price: 62500, change: -0.5, marketCap: 24000000000000, pe: 11.5, pb: 1.6, roe: 15.2, roa: 8.5, de: 0.5, dividendYield: 5.2, revenueGrowth: 8.5, profitGrowth: 12.2 },
  { id: 12, ticker: 'PNJ', name: 'Vàng bạc đá quý Phú Nhuận', industry: 'Bán lẻ', exchange: 'HOSE', price: 98500, change: 2.5, marketCap: 32000000000000, pe: 16.5, pb: 4.2, roe: 28.5, roa: 15.2, de: 0.3, dividendYield: 2.8, revenueGrowth: 18.5, profitGrowth: 22.5 },
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
  { id: 'value', name: 'Value Stocks', desc: 'P/E < 15, P/B < 1.5, ROE > 15%', filters: { peMax: 15, pbMax: 1.5, roeMin: 15 } },
  { id: 'growth', name: 'Growth Stocks', desc: 'Tăng trưởng > 20%', filters: { revenueGrowthMin: 20, profitGrowthMin: 20 } },
  { id: 'dividend', name: 'Dividend Stocks', desc: 'Cổ tức > 5%', filters: { dividendYieldMin: 5, deMax: 1 } },
  { id: 'quality', name: 'Quality Stocks', desc: 'ROE > 20%, D/E < 0.5', filters: { roeMin: 20, deMax: 0.5 } },
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
          <h1 className="text-3xl font-bold font-display text-white">
            Sàng lọc cổ phiếu
          </h1>
          <p className="text-dark-400 mt-1">
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
              <span className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                {preset.name}
              </span>
            </div>
            <p className="text-xs text-dark-400">{preset.desc}</p>
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
              Reset
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
                        className="rounded border-dark-600 bg-dark-800"
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
                          className="rounded border-dark-600 bg-dark-800"
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
                          <span className="font-semibold text-white group-hover/link:text-primary-400 transition-colors">
                            {stock.ticker}
                          </span>
                        </Link>
                      </td>
                      <td className="text-dark-300 max-w-[200px] truncate">
                        {stock.name}
                      </td>
                      <td>
                        <Badge variant="default" size="sm">{stock.industry}</Badge>
                      </td>
                      <td className="text-right font-mono font-medium text-white">
                        {stock.price.toLocaleString('vi-VN')}
                      </td>
                      <td className="text-right">
                        <span className={cn(
                          'inline-flex items-center gap-1 font-medium',
                          stock.change > 0 ? 'text-success-400' : stock.change < 0 ? 'text-danger-400' : 'text-dark-400'
                        )}>
                          {stock.change > 0 ? '+' : ''}{formatPercent(stock.change)}
                        </span>
                      </td>
                      <td className="text-right text-dark-300">
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
                      <td className="text-right font-mono text-dark-300">
                        {formatPercent(stock.dividendYield)}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-warning-400">
                            <Bookmark className="w-4 h-4" />
                          </button>
                          <Link 
                            to={`/company/${stock.ticker}`}
                            className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-primary-400"
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
              <div className="w-16 h-16 rounded-2xl bg-dark-800 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-dark-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Không tìm thấy kết quả
              </h3>
              <p className="text-dark-400 max-w-md">
                Thử điều chỉnh các tiêu chí lọc hoặc sử dụng preset có sẵn
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={resetFilters}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                Reset bộ lọc
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
          <div className="flex items-center gap-4 px-6 py-4 bg-dark-800/95 backdrop-blur-xl border border-dark-600 rounded-2xl shadow-2xl">
            <span className="text-sm text-dark-300">
              Đã chọn <span className="font-semibold text-white">{selectedStocks.length}</span> cổ phiếu
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
              className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
