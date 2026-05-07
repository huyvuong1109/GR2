import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import api from '../services/api'
import StarButton from '../components/StarButton'

const toSafeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const formatVnd = (value) => {
  const number = toSafeNumber(value)
  if (number === null) return 'Chưa có dữ liệu'
  return `${number.toLocaleString('vi-VN')} VND`
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

export default function CompanyAnalysisSimple() {
  const { ticker } = useParams()
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (ticker) {
      fetchData()
    }
  }, [ticker])

const fetchData = async () => {
  setLoading(true)
  setError(null)
  
  try {
    // Get company details from backend API
    const companyData = await api.get(`/companies/${ticker}`)
    setCompany(companyData)
  } catch (err) {
    console.error('Error fetching company:', err)
    setError(err.message || 'Lỗi không xác định')
  } finally {
    setLoading(false)
  }
}

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-slate-900 text-xl">Đang tải dữ liệu cho {ticker}...</div>
        <div className="mt-4 animate-pulse">
          <div className="h-8 bg-slate-50 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-slate-50 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-slate-50 rounded w-1/4"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-danger-600 text-xl">Lỗi: {error}</div>
        <Link to="/screener" className="mt-4 inline-flex items-center text-primary-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Link>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="p-8">
        <div className="text-warning-600 text-xl">Không tìm thấy công ty: {ticker}</div>
        <Link to="/screener" className="mt-4 inline-flex items-center text-primary-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Link>
      </div>
    )
  }

  const displayTicker = String(company.ticker || ticker || '').toUpperCase() || 'N/A'
  const displayName = company.name || `Công ty ${displayTicker}`
  const displayDescription = company.description || 'Chưa có thông tin'
  const displayIndustry = company.industry || 'Chưa có thông tin'
  const displayPrice = formatVnd(company.current_price ?? company.price)
  const displayMarketCap = formatMarketCap(company.market_cap)
  const displaySharesOutstanding = formatShares(company.shares_outstanding)

  return (
    <div className="p-8 space-y-6">
      <Link to="/screener" className="inline-flex items-center text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại sàng lọc
      </Link>
      
      <div className="bg-white rounded-xl p-6">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">{displayTicker}</h1>
          <div className="rounded-lg bg-primary-50 border border-primary-200 px-3 py-1 text-sm text-primary-700 hover:bg-primary-100 transition-colors">
            <span className="mr-2">Theo dõi</span>
            <StarButton ticker={displayTicker} />
          </div>
        </div>
        <p className="text-xl text-slate-600">{displayName}</p>
        
        <div className="mt-4 bg-slate-50 rounded-lg p-4">
          <div className="text-slate-600 text-sm leading-relaxed">{displayDescription}</div>
        </div>
        
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-slate-600 text-sm">Ngành</div>
            <div className="text-slate-900 font-medium">{displayIndustry}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-slate-600 text-sm">Giá hiện tại</div>
            <div className="text-slate-900 font-medium">{displayPrice}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-slate-600 text-sm">Vốn hóa</div>
            <div className="text-slate-900 font-medium">{displayMarketCap}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-slate-600 text-sm">KLCP lưu hành</div>
            <div className="text-slate-900 font-medium">{displaySharesOutstanding}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
