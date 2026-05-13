import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Clock, Search, TrendingUp, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { companiesApi } from '../services/api'
import { formatCurrency } from '../utils/formatters'

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
      setRecentSearches(JSON.parse(localStorage.getItem('recentSearches') || '[]'))
    } else {
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return undefined
    }

    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true)
        const data = await companiesApi.search(query)
        setResults(data.results || [])
      } catch (error) {
        console.error('Search error:', error)
        toast.error('Lỗi tìm kiếm')
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSelectCompany = (company) => {
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    const nextRecent = [company, ...recent.filter((item) => item.ticker !== company.ticker)].slice(0, 5)
    localStorage.setItem('recentSearches', JSON.stringify(nextRecent))
    navigate(`/company/${company.ticker}`)
    onClose()
  }

  const clearRecentSearches = () => {
    localStorage.removeItem('recentSearches')
    setRecentSearches([])
    toast.success('Đã xóa lịch sử tìm kiếm')
  }

  const list = query.trim() ? results : recentSearches

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.18 }}
              className="glass-card w-full max-w-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
                <Search className="h-5 w-5 flex-none text-emerald-300" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm mã cổ phiếu hoặc tên công ty..."
                  className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="btn-ghost p-2"
                    aria-label="Xóa từ khóa"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={onClose} className="btn-ghost p-2" aria-label="Đóng tìm kiếm">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[28rem] overflow-y-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-r-transparent" />
                  </div>
                ) : !query.trim() && recentSearches.length === 0 ? (
                  <EmptySearchState text="Nhập tên hoặc mã cổ phiếu để tìm kiếm." />
                ) : query.trim() && results.length === 0 ? (
                  <EmptySearchState text={`Không tìm thấy kết quả cho "${query}".`} />
                ) : (
                  <div className="space-y-3">
                    {!query.trim() && (
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                          <Clock className="h-4 w-4" />
                          Tìm kiếm gần đây
                        </div>
                        <button type="button" onClick={clearRecentSearches} className="text-xs font-bold text-slate-500 hover:text-emerald-300">
                          Xóa tất cả
                        </button>
                      </div>
                    )}
                    {query.trim() && <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Tìm thấy {results.length} kết quả</p>}
                    {list.map((company) => (
                      <SearchResult key={company.ticker} company={company} onSelect={handleSelectCompany} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

function EmptySearchState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/12 bg-white/[0.025] px-6 py-12 text-center">
      <Search className="mb-3 h-11 w-11 text-slate-600" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  )
}

function SearchResult({ company, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(company)}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-emerald-300/25 hover:bg-white/[0.06]"
    >
      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-sm font-black text-emerald-300">
        {company.ticker?.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-sm font-black text-slate-100">{company.ticker}</span>
          {company.industry && <span className="truncate rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">{company.industry}</span>}
        </div>
        <p className="mt-1 truncate text-sm text-slate-400">{company.name}</p>
        {company.market_cap && <p className="mt-1 text-xs text-slate-500">Vốn hóa: {formatCurrency(company.market_cap)}</p>}
      </div>
      <div className="flex items-center gap-2 text-slate-500 transition group-hover:text-emerald-300">
        <TrendingUp className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
        <ArrowRight className="h-5 w-5" />
      </div>
    </button>
  )
}
