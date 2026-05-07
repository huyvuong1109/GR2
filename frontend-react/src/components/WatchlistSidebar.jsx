import React, { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { WatchlistContext } from '../contexts/WatchlistContext'
import { Link } from 'react-router-dom'

export default function WatchlistSidebar(){
  const { user } = useContext(AuthContext)
  const { items, removeTicker } = useContext(WatchlistContext)

  if (!user) return null

  return (
    <div className="w-48 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
      <h3 className="font-semibold text-slate-900 mb-4">Danh sách theo dõi</h3>
      <ul className="space-y-3">
        {items.map(it => (
          <li key={it.ticker} className="flex justify-between items-center group">
            <Link to={`/company/${it.ticker}`} className="text-sm font-medium text-slate-700 hover:text-primary-600 transition-colors">
              {it.ticker}
            </Link>
            <button onClick={() => removeTicker(it.ticker)} className="text-xs text-danger-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-danger-700">
              Xóa
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-slate-500">Chưa có mã nào</li>}
      </ul>
    </div>
  )
}
