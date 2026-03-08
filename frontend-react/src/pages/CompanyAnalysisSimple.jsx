import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import api from '../services/api'

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
      console.log('Fetching company:', ticker)
      const data = await api.get(`/companies/${ticker}`)
      console.log('Company data:', data)
      setCompany(data)
    } catch (err) {
      console.error('Error:', err)
      setError(err.message || 'Lỗi không xác định')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-white text-xl">Đang tải dữ liệu cho {ticker}...</div>
        <div className="mt-4 animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-400 text-xl">Lỗi: {error}</div>
        <Link to="/screener" className="mt-4 inline-flex items-center text-blue-400 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Link>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="p-8">
        <div className="text-yellow-400 text-xl">Không tìm thấy công ty: {ticker}</div>
        <Link to="/screener" className="mt-4 inline-flex items-center text-blue-400 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <Link to="/screener" className="inline-flex items-center text-gray-400 hover:text-white">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại sàng lọc
      </Link>
      
      <div className="bg-gray-800 rounded-xl p-6">
        <h1 className="text-3xl font-bold text-white mb-2">{company.ticker}</h1>
        <p className="text-xl text-gray-300">{company.name}</p>
        
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Ngành</div>
            <div className="text-white font-medium">{company.industry || 'N/A'}</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Giá hiện tại</div>
            <div className="text-white font-medium">{company.current_price?.toLocaleString()} VNĐ</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Vốn hóa</div>
            <div className="text-white font-medium">{(company.market_cap / 1e12)?.toFixed(2)} nghìn tỷ</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-sm">KLCP lưu hành</div>
            <div className="text-white font-medium">{(company.shares_outstanding / 1e6)?.toFixed(0)} triệu</div>
          </div>
        </div>
      </div>
    </div>
  )
}
