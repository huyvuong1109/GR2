import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { Eye, X } from 'lucide-react'
import { AuthContext } from '../contexts/AuthContext'
import { WatchlistContext } from '../contexts/WatchlistContext'

export default function WatchlistSidebar() {
  const { user } = useContext(AuthContext)
  const { items, removeTicker } = useContext(WatchlistContext)

  if (!user) return null

  return (
    <aside className="glass-card sticky top-20 w-72 self-start overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-emerald-300" />
          <h3 className="text-sm font-black text-slate-100">Danh sách theo dõi</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">{items.length} mã đang theo dõi</p>
      </div>

      <div className="p-4">
        {items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-6 text-slate-400">
            Chưa có mã nào trong danh sách theo dõi.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.ticker}
                className="group flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 transition hover:border-emerald-300/25 hover:bg-white/[0.06]"
              >
                <Link
                  to={`/company/${item.ticker}`}
                  className="min-w-0 flex-1 truncate font-mono text-sm font-black text-emerald-300 hover:text-emerald-200"
                >
                  {item.ticker}
                </Link>
                <button
                  type="button"
                  onClick={() => removeTicker(item.ticker)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 opacity-70 transition hover:bg-red-400/10 hover:text-red-300 group-hover:opacity-100"
                  aria-label={`Xóa ${item.ticker}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
