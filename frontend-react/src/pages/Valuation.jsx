import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Target,
  Info,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Sparkles,
  BarChart3,
  PieChart,
  Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Badge, StatCard } from '../components/ui'
import { formatCurrency, formatPercent, formatRatio, calculateGrahamValue, calculateMarginOfSafety } from '../utils/formatters'
import { cn } from '../utils/helpers'
import api from '../services/api'

export default function Valuation() {
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [method, setMethod] = useState('graham')
  const [loading, setLoading] = useState(false)
  const [companyData, setCompanyData] = useState(null)
  
  // Graham method inputs
  const [grahamInputs, setGrahamInputs] = useState({
    eps: '',
    bvps: '',
    growthRate: '10',
    aaa_yield: '4.4',
    marginOfSafety: '25',
  })
  
  // DCF method inputs
  const [dcfInputs, setDcfInputs] = useState({
    fcf: '',
    growthRate: '10',
    terminalGrowth: '3',
    discountRate: '12',
    years: '10',
    sharesOutstanding: '',
    marginOfSafety: '25',
  })

  // Load companies list on mount
  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      const data = await api.get('/companies')
      const companyList = (data || []).map(c => ({
        value: c.ticker,
        label: `${c.ticker} - ${c.name}`
      }))
      setCompanies(companyList)
      if (companyList.length > 0) {
        setSelectedCompany(companyList[0].value)
        loadCompanyData(companyList[0].value)
      }
    } catch (err) {
      console.error('Error loading companies:', err)
    }
  }

  // Load company data from API
  const loadCompanyData = async (ticker) => {
    if (!ticker) return
    
    setLoading(true)
    try {
      const data = await api.get(`/valuation/${ticker}`)
      setCompanyData(data)
      
      // Update Graham inputs
      setGrahamInputs(prev => ({
        ...prev,
        eps: String(Math.round(data.eps || 0)),
        bvps: String(Math.round(data.bvps || 0)),
        growthRate: String(Math.round(data.avg_growth_rate || 10)),
      }))
      
      // Update DCF inputs
      setDcfInputs(prev => ({
        ...prev,
        fcf: String(Math.abs(data.fcf || 0)),
        growthRate: String(Math.round(data.avg_growth_rate || 10)),
        sharesOutstanding: String(data.shares_outstanding || 0),
      }))
    } catch (err) {
      console.error('Error loading company data:', err)
    } finally {
      setLoading(false)
    }
    setSelectedCompany(ticker)
  }

  // Handle company selection change
  const handleCompanyChange = (e) => {
    const ticker = e.target.value
    loadCompanyData(ticker)
  }

  // Graham valuation calculation
  const calculateGraham = () => {
    const eps = parseFloat(grahamInputs.eps) || 0
    const bvps = parseFloat(grahamInputs.bvps) || 0
    const g = parseFloat(grahamInputs.growthRate) || 0
    const y = parseFloat(grahamInputs.aaa_yield) || 4.4
    const mos = parseFloat(grahamInputs.marginOfSafety) || 25

    if (eps <= 0 || bvps <= 0) return null

    // Original Graham formula: √(22.5 × EPS × BVPS)
    const grahamNumber = Math.sqrt(22.5 * eps * bvps)
    
    // Modified Graham with growth: EPS × (8.5 + 2g) × 4.4/Y
    const grahamGrowth = eps * (8.5 + 2 * g) * (4.4 / y)
    
    const currentPrice = companyData?.current_price || 0
    const marginGraham = ((grahamNumber - currentPrice) / grahamNumber) * 100
    const marginGrowth = ((grahamGrowth - currentPrice) / grahamGrowth) * 100

    return {
      grahamNumber,
      grahamGrowth,
      currentPrice,
      marginGraham,
      marginGrowth,
      buyPrice: grahamNumber * (1 - mos / 100),
      buyPriceGrowth: grahamGrowth * (1 - mos / 100),
    }
  }

  // DCF valuation calculation
  const calculateDCF = () => {
    const fcf = parseFloat(dcfInputs.fcf) || 0
    const g = parseFloat(dcfInputs.growthRate) / 100 || 0.1
    const tg = parseFloat(dcfInputs.terminalGrowth) / 100 || 0.03
    const r = parseFloat(dcfInputs.discountRate) / 100 || 0.12
    const years = parseInt(dcfInputs.years) || 10
    const shares = parseFloat(dcfInputs.sharesOutstanding) || 1
    const mos = parseFloat(dcfInputs.marginOfSafety) || 25

    if (fcf <= 0 || shares <= 0) return null

    // Project FCF for each year
    let presentValue = 0
    let projectedFCF = []
    
    for (let i = 1; i <= years; i++) {
      const futureFCF = fcf * Math.pow(1 + g, i)
      const pv = futureFCF / Math.pow(1 + r, i)
      presentValue += pv
      projectedFCF.push({ year: i, fcf: futureFCF, pv })
    }

    // Terminal value
    const terminalFCF = fcf * Math.pow(1 + g, years) * (1 + tg)
    const terminalValue = terminalFCF / (r - tg)
    const terminalPV = terminalValue / Math.pow(1 + r, years)
    
    const totalValue = presentValue + terminalPV
    const intrinsicValue = totalValue / shares
    const currentPrice = companyData?.current_price || 0
    const margin = ((intrinsicValue - currentPrice) / intrinsicValue) * 100

    return {
      presentValue,
      terminalValue,
      terminalPV,
      totalValue,
      intrinsicValue,
      currentPrice,
      margin,
      buyPrice: intrinsicValue * (1 - mos / 100),
      projectedFCF,
    }
  }

  const grahamResult = method === 'graham' ? calculateGraham() : null
  const dcfResult = method === 'dcf' ? calculateDCF() : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-white flex items-center gap-3">
            <Calculator className="w-8 h-8 text-primary-400" />
            Công cụ Định giá
          </h1>
          <p className="text-dark-400 mt-1">
            Định giá cổ phiếu theo phương pháp Value Investing
          </p>
        </div>
      </div>

      {/* Method Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setMethod('graham')}
          className={cn(
            'glass-card p-6 text-left transition-all',
            method === 'graham' 
              ? 'border-primary-500/50 bg-primary-500/10' 
              : 'hover:bg-dark-800/50'
          )}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              method === 'graham' ? 'bg-primary-500' : 'bg-dark-700'
            )}>
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Công thức Graham</h3>
              <p className="text-xs text-dark-400">Benjamin Graham Number</p>
            </div>
          </div>
          <p className="text-sm text-dark-400">
            Phương pháp định giá cổ điển dựa trên EPS và Book Value
          </p>
        </button>

        <button
          onClick={() => setMethod('dcf')}
          className={cn(
            'glass-card p-6 text-left transition-all',
            method === 'dcf' 
              ? 'border-primary-500/50 bg-primary-500/10' 
              : 'hover:bg-dark-800/50'
          )}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              method === 'dcf' ? 'bg-primary-500' : 'bg-dark-700'
            )}>
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">DCF Model</h3>
              <p className="text-xs text-dark-400">Discounted Cash Flow</p>
            </div>
          </div>
          <p className="text-sm text-dark-400">
            Định giá dựa trên dòng tiền tự do chiết khấu về hiện tại
          </p>
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Thông số đầu vào
              {loading && <Loader2 className="w-4 h-4 animate-spin text-primary-400" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company Selection */}
            <Select
              label="Chọn công ty"
              options={companies}
              value={selectedCompany}
              onChange={handleCompanyChange}
            />

            {method === 'graham' ? (
              <>
                <Input
                  label="EPS (VNĐ)"
                  type="number"
                  value={grahamInputs.eps}
                  onChange={(e) => setGrahamInputs(prev => ({ ...prev, eps: e.target.value }))}
                  placeholder="4460"
                  hint="Lợi nhuận trên cổ phiếu"
                />
                <Input
                  label="BVPS (VNĐ)"
                  type="number"
                  value={grahamInputs.bvps}
                  onChange={(e) => setGrahamInputs(prev => ({ ...prev, bvps: e.target.value }))}
                  placeholder="19640"
                  hint="Giá trị sổ sách/CP"
                />
                <Input
                  label="Tăng trưởng dự kiến (%)"
                  type="number"
                  value={grahamInputs.growthRate}
                  onChange={(e) => setGrahamInputs(prev => ({ ...prev, growthRate: e.target.value }))}
                  placeholder="8"
                  hint="Tốc độ tăng trưởng EPS"
                />
                <Input
                  label="AAA Bond Yield (%)"
                  type="number"
                  value={grahamInputs.aaa_yield}
                  onChange={(e) => setGrahamInputs(prev => ({ ...prev, aaa_yield: e.target.value }))}
                  placeholder="4.4"
                  hint="Lãi suất trái phiếu AAA"
                />
                <Input
                  label="Margin of Safety (%)"
                  type="number"
                  value={grahamInputs.marginOfSafety}
                  onChange={(e) => setGrahamInputs(prev => ({ ...prev, marginOfSafety: e.target.value }))}
                  placeholder="25"
                  hint="Biên an toàn mong muốn"
                />
              </>
            ) : (
              <>
                <Input
                  label="Free Cash Flow (VNĐ)"
                  type="number"
                  value={dcfInputs.fcf}
                  onChange={(e) => setDcfInputs(prev => ({ ...prev, fcf: e.target.value }))}
                  placeholder="8900000000000"
                  hint="Dòng tiền tự do năm gần nhất"
                />
                <Input
                  label="Tăng trưởng giai đoạn 1 (%)"
                  type="number"
                  value={dcfInputs.growthRate}
                  onChange={(e) => setDcfInputs(prev => ({ ...prev, growthRate: e.target.value }))}
                  placeholder="10"
                  hint="Tốc độ tăng trưởng FCF"
                />
                <Input
                  label="Terminal Growth (%)"
                  type="number"
                  value={dcfInputs.terminalGrowth}
                  onChange={(e) => setDcfInputs(prev => ({ ...prev, terminalGrowth: e.target.value }))}
                  placeholder="3"
                  hint="Tăng trưởng vĩnh viễn"
                />
                <Input
                  label="Discount Rate (%)"
                  type="number"
                  value={dcfInputs.discountRate}
                  onChange={(e) => setDcfInputs(prev => ({ ...prev, discountRate: e.target.value }))}
                  placeholder="12"
                  hint="Tỷ suất chiết khấu (WACC)"
                />
                <Input
                  label="Số năm dự phóng"
                  type="number"
                  value={dcfInputs.years}
                  onChange={(e) => setDcfInputs(prev => ({ ...prev, years: e.target.value }))}
                  placeholder="10"
                />
                <Input
                  label="Số CP lưu hành"
                  type="number"
                  value={dcfInputs.sharesOutstanding}
                  onChange={(e) => setDcfInputs(prev => ({ ...prev, sharesOutstanding: e.target.value }))}
                  placeholder="2000000000"
                />
                <Input
                  label="Margin of Safety (%)"
                  type="number"
                  value={dcfInputs.marginOfSafety}
                  onChange={(e) => setDcfInputs(prev => ({ ...prev, marginOfSafety: e.target.value }))}
                  placeholder="25"
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-warning-400" />
              Kết quả định giá
            </CardTitle>
          </CardHeader>
          <CardContent>
            {method === 'graham' && grahamResult ? (
              <div className="space-y-6">
                {/* Price Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-700">
                    <p className="text-sm text-dark-400 mb-1">Giá hiện tại</p>
                    <p className="text-2xl font-bold text-white font-mono">
                      {grahamResult.currentPrice.toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/30">
                    <p className="text-sm text-dark-400 mb-1">Graham Number</p>
                    <p className="text-2xl font-bold text-primary-400 font-mono">
                      {Math.round(grahamResult.grahamNumber).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-success-500/10 border border-success-500/30">
                    <p className="text-sm text-dark-400 mb-1">Graham + Growth</p>
                    <p className="text-2xl font-bold text-success-400 font-mono">
                      {Math.round(grahamResult.grahamGrowth).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>

                {/* Margin Analysis */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={cn(
                    'p-4 rounded-xl border',
                    grahamResult.marginGraham > 0 
                      ? 'bg-success-500/10 border-success-500/30' 
                      : 'bg-danger-500/10 border-danger-500/30'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {grahamResult.marginGraham > 0 ? (
                        <CheckCircle className="w-5 h-5 text-success-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-danger-400" />
                      )}
                      <span className="font-semibold text-white">Biên an toàn (Graham)</span>
                    </div>
                    <p className={cn(
                      'text-3xl font-bold font-mono',
                      grahamResult.marginGraham > 0 ? 'text-success-400' : 'text-danger-400'
                    )}>
                      {formatPercent(grahamResult.marginGraham)}
                    </p>
                    <p className="text-sm text-dark-400 mt-2">
                      {grahamResult.marginGraham > 25 
                        ? '✅ Cơ hội mua tốt với biên an toàn cao'
                        : grahamResult.marginGraham > 0 
                          ? '⚠️ Còn biên an toàn nhưng không cao'
                          : '❌ Đang overvalued so với Graham Number'}
                    </p>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl border',
                    grahamResult.marginGrowth > 0 
                      ? 'bg-success-500/10 border-success-500/30' 
                      : 'bg-danger-500/10 border-danger-500/30'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {grahamResult.marginGrowth > 0 ? (
                        <CheckCircle className="w-5 h-5 text-success-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-danger-400" />
                      )}
                      <span className="font-semibold text-white">Biên an toàn (Growth)</span>
                    </div>
                    <p className={cn(
                      'text-3xl font-bold font-mono',
                      grahamResult.marginGrowth > 0 ? 'text-success-400' : 'text-danger-400'
                    )}>
                      {formatPercent(grahamResult.marginGrowth)}
                    </p>
                    <p className="text-sm text-dark-400 mt-2">
                      {grahamResult.marginGrowth > 25 
                        ? '✅ Định giá hấp dẫn với tăng trưởng'
                        : grahamResult.marginGrowth > 0 
                          ? '⚠️ Cân nhắc tăng trưởng thực tế'
                          : '❌ Đang overvalued theo mô hình'}
                    </p>
                  </div>
                </div>

                {/* Buy Price */}
                <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-700">
                  <h4 className="font-semibold text-white mb-3">Giá mua khuyến nghị</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-dark-400">Graham Number - MoS {grahamInputs.marginOfSafety}%</p>
                      <p className="text-xl font-bold text-primary-400 font-mono">
                        {Math.round(grahamResult.buyPrice).toLocaleString('vi-VN')} VNĐ
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-dark-400">Growth Model - MoS {grahamInputs.marginOfSafety}%</p>
                      <p className="text-xl font-bold text-success-400 font-mono">
                        {Math.round(grahamResult.buyPriceGrowth).toLocaleString('vi-VN')} VNĐ
                      </p>
                    </div>
                  </div>
                </div>

                {/* Formula Explanation */}
                <div className="p-4 rounded-xl bg-dark-800/30 border border-dark-700">
                  <div className="flex items-start gap-2 mb-2">
                    <Info className="w-5 h-5 text-primary-400 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-white">Công thức sử dụng</h4>
                      <div className="text-sm text-dark-400 space-y-1 mt-2">
                        <p><strong>Graham Number:</strong> √(22.5 × EPS × BVPS)</p>
                        <p><strong>Graham Growth:</strong> EPS × (8.5 + 2g) × (4.4/Y)</p>
                        <p className="text-xs">Trong đó: g = tỷ lệ tăng trưởng, Y = lãi suất trái phiếu AAA</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : method === 'dcf' && dcfResult ? (
              <div className="space-y-6">
                {/* Value Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-700">
                    <p className="text-sm text-dark-400 mb-1">PV of FCF</p>
                    <p className="text-xl font-bold text-white font-mono">
                      {formatCurrency(dcfResult.presentValue)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-700">
                    <p className="text-sm text-dark-400 mb-1">PV Terminal</p>
                    <p className="text-xl font-bold text-white font-mono">
                      {formatCurrency(dcfResult.terminalPV)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/30">
                    <p className="text-sm text-dark-400 mb-1">Total Value</p>
                    <p className="text-xl font-bold text-primary-400 font-mono">
                      {formatCurrency(dcfResult.totalValue)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-success-500/10 border border-success-500/30">
                    <p className="text-sm text-dark-400 mb-1">Intrinsic Value/CP</p>
                    <p className="text-xl font-bold text-success-400 font-mono">
                      {Math.round(dcfResult.intrinsicValue).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>

                {/* Price vs Value */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-700">
                    <p className="text-sm text-dark-400 mb-2">So sánh giá</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-dark-500">Giá hiện tại</p>
                        <p className="text-2xl font-bold text-white font-mono">
                          {dcfResult.currentPrice.toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <ArrowRight className="w-6 h-6 text-dark-500 mx-4" />
                      <div>
                        <p className="text-xs text-dark-500">Giá trị nội tại</p>
                        <p className="text-2xl font-bold text-success-400 font-mono">
                          {Math.round(dcfResult.intrinsicValue).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl border',
                    dcfResult.margin > 0 
                      ? 'bg-success-500/10 border-success-500/30' 
                      : 'bg-danger-500/10 border-danger-500/30'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {dcfResult.margin > 0 ? (
                        <CheckCircle className="w-5 h-5 text-success-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-danger-400" />
                      )}
                      <span className="font-semibold text-white">Biên an toàn DCF</span>
                    </div>
                    <p className={cn(
                      'text-3xl font-bold font-mono',
                      dcfResult.margin > 0 ? 'text-success-400' : 'text-danger-400'
                    )}>
                      {formatPercent(dcfResult.margin)}
                    </p>
                  </div>
                </div>

                {/* Buy Price Recommendation */}
                <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/30">
                  <h4 className="font-semibold text-white mb-2">Giá mua khuyến nghị (MoS {dcfInputs.marginOfSafety}%)</h4>
                  <p className="text-3xl font-bold text-primary-400 font-mono">
                    {Math.round(dcfResult.buyPrice).toLocaleString('vi-VN')} VNĐ
                  </p>
                  <p className="text-sm text-dark-400 mt-2">
                    {dcfResult.currentPrice <= dcfResult.buyPrice 
                      ? '✅ Giá hiện tại nằm trong vùng mua an toàn'
                      : `❌ Cần chờ giá giảm ${formatPercent((dcfResult.currentPrice - dcfResult.buyPrice) / dcfResult.currentPrice * 100)} nữa`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-dark-800 flex items-center justify-center mb-4">
                  <Calculator className="w-8 h-8 text-dark-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Nhập thông số để tính toán
                </h3>
                <p className="text-dark-400 max-w-md">
                  Chọn một công ty và điền các thông số cần thiết để xem kết quả định giá
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary-400" />
            Lưu ý khi định giá
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Margin of Safety',
                desc: 'Luôn mua với biên an toàn tối thiểu 25-30% để bảo vệ khỏi sai sót trong dự báo',
                icon: Shield,
              },
              {
                title: 'Kiểm tra nhiều phương pháp',
                desc: 'Sử dụng đồng thời Graham và DCF để có cái nhìn toàn diện về giá trị',
                icon: PieChart,
              },
              {
                title: 'Dữ liệu đầu vào chính xác',
                desc: 'Kết quả định giá phụ thuộc lớn vào chất lượng dữ liệu EPS, FCF đầu vào',
                icon: Target,
              },
            ].map((tip, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-dark-800/30 border border-dark-700">
                <div className="flex items-center gap-2 mb-2">
                  <tip.icon className="w-5 h-5 text-primary-400" />
                  <h4 className="font-semibold text-white">{tip.title}</h4>
                </div>
                <p className="text-sm text-dark-400">{tip.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Shield icon
function Shield(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
    </svg>
  )
}
