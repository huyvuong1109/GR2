import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, TrendingUp, Clock, ArrowRight } from 'lucide-react'
import { companiesApi } from '../services/api'
import { cn } from '../utils/helpers'
import { Link, useNavigate } from 'react-router-dom'
import { formatCurrency } from '../utils/formatters'
import toast from 'react-hot-toast'

export default function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState([])
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      // Load recent searches from localStorage
      const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
      setRecentSearches(recent)
    } else {
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  useEffect(() => {
    // Search with debounce
    if (query.trim().length > 0) {
      const timeoutId = setTimeout(() => {
        handleSearch(query)
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setResults([])
    }
  }, [query])

  const handleSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return

    try {
      setLoading(true)
      const data = await companiesApi.search(searchQuery)
      setResults(data.results || [])
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Lỗi tìm kiếm')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCompany = (company) => {
    // Save to recent searches
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    const newRecent = [
      company,
      ...recent.filter(c => c.ticker !== company.ticker)
    ].slice(0, 5) // Keep only 5 recent searches
    
    localStorage.setItem('recentSearches', JSON.stringify(newRecent))
    
    // Navigate to company page
    navigate(`/company/${company.ticker}`)
    onClose()
  }

  const clearRecentSearches = () => {
    localStorage.removeItem('recentSearches')
    setRecentSearches([])
    toast.success('Đã xóa lịch sử tìm kiếm')
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
      // Ctrl/Cmd + K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (!isOpen) {
          // Trigger from parent
        }
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Search Modal */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-2xl bg-dark-900 rounded-2xl border border-dark-800 shadow-2xl overflow-hidden"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 p-4 border-b border-dark-800">
                <Search className="w-5 h-5 text-dark-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm mã cổ phiếu hoặc tên công ty... (VNM, FPT, Vinamilk)"
                  className="flex-1 bg-transparent text-white placeholder-dark-400 focus:outline-none text-lg"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex px-2 py-1 text-xs text-dark-500 bg-dark-800 rounded">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
                  </div>
                ) : query.trim() === '' ? (
                  // Recent searches
                  recentSearches.length > 0 ? (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-dark-400 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Tìm kiếm gần đây
                        </h3>
                        <button
                          onClick={clearRecentSearches}
                          className="text-xs text-dark-500 hover:text-danger-400 transition-colors"
                        >
                          Xóa tất cả
                        </button>
                      </div>
                      <div className="space-y-2">
                        {recentSearches.map((company) => (
                          <button
                            key={company.ticker}
                            onClick={() => handleSelectCompany(company)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-dark-800 text-left transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary-400">
                                {company.ticker.slice(0, 2)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">
                                  {company.ticker}
                                </span>
                                <span className="text-xs text-dark-500">•</span>
                                <span className="text-sm text-dark-400 truncate">
                                  {company.name}
                                </span>
                              </div>
                              {company.market_cap && (
                                <p className="text-xs text-dark-500">
                                  {formatCurrency(company.market_cap)}
                                </p>
                              )}
                            </div>
                            <ArrowRight className="w-4 h-4 text-dark-600 group-hover:text-primary-400 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-dark-500">
                      <Search className="w-12 h-12 mb-3 opacity-50" />
                      <p className="text-sm">Nhập tên hoặc mã cổ phiếu để tìm kiếm</p>
                    </div>
                  )
                ) : results.length > 0 ? (
                  <div className="p-4 space-y-2">
                    <p className="text-xs text-dark-500 mb-3">
                      Tìm thấy {results.length} kết quả
                    </p>
                    {results.map((company) => (
                      <motion.button
                        key={company.ticker}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleSelectCompany(company)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-dark-800 text-left transition-colors group"
                      >
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-primary-400">
                            {company.ticker.slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white">
                              {company.ticker}
                            </span>
                            {company.industry && (
                              <>
                                <span className="text-xs text-dark-600">•</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-dark-800 text-dark-400">
                                  {company.industry}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-dark-400 truncate mb-1">
                            {company.name}
                          </p>
                          {company.market_cap && (
                            <p className="text-xs text-dark-500">
                              Vốn hóa: {formatCurrency(company.market_cap)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-success-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <ArrowRight className="w-5 h-5 text-dark-600 group-hover:text-primary-400 transition-colors" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-dark-500">
                    <Search className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">Không tìm thấy kết quả cho "{query}"</p>
                    <p className="text-xs text-dark-600 mt-1">
                      Thử tìm kiếm với mã CK hoặc tên khác
                    </p>
                  </div>
                )}
              </div>

              {/* Footer tips */}
              <div className="px-4 py-3 border-t border-dark-800 bg-dark-950/50">
                <div className="flex items-center justify-between text-xs text-dark-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-dark-800 rounded">↑↓</kbd>
                      Di chuyển
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-dark-800 rounded">Enter</kbd>
                      Chọn
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-dark-800 rounded">ESC</kbd>
                    Đóng
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
