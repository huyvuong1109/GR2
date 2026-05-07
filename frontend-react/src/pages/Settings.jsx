import React, { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { WatchlistContext } from '../contexts/WatchlistContext'

export default function Settings(){
  const { user, logout } = useContext(AuthContext)
  const { items: watchlist, removeTicker } = useContext(WatchlistContext)

  if (!user) return <div className="p-4">Vui lòng đăng nhập</div>

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 backdrop-blur-xl">
        <h2 className="text-2xl font-bold text-slate-900">Cài đặt</h2>
        <p className="mt-1 text-sm text-slate-600">Quản lý tài khoản, danh sách theo dõi và phiên đăng nhập.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 backdrop-blur-xl">
            <h3 className="text-sm font-semibold text-slate-700">Thông tin tài khoản</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{user.email}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Username</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{user.username}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Danh sách theo dõi</h3>
              <span className="rounded-full border border-primary-300 bg-primary-50 px-2.5 py-1 text-xs text-slate-900">
                {watchlist.length} mã
              </span>
            </div>

            {watchlist.length > 0 ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {watchlist.map((item) => (
                  <li key={item.ticker} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="font-semibold text-primary-700">{item.ticker}</span>
                    <button
                      onClick={() => removeTicker(item.ticker)}
                      className="text-xs font-semibold text-danger-600 transition-colors hover:text-danger-700"
                    >
                      Xóa
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Không có cổ phiếu trong danh sách theo dõi.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 backdrop-blur-xl">
            <h3 className="text-sm font-semibold text-slate-700">Phiên đăng nhập</h3>
            <p className="mt-2 text-sm text-slate-600">Đăng xuất khỏi thiết bị hiện tại.</p>
            <button
              onClick={logout}
              className="mt-4 w-full rounded-2xl border border-danger-200 bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700 transition-colors hover:bg-danger-100"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
