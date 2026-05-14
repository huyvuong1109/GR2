import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Settings as SettingsIcon, Star, UserRound, X } from 'lucide-react'
import { AuthContext } from '../contexts/AuthContext'
import { WatchlistContext } from '../contexts/WatchlistContext'

export default function Settings() {
  const { user, logout } = useContext(AuthContext)
  const { items: watchlist, loading, removeTicker } = useContext(WatchlistContext)

  if (!user) {
    return (
      <div className="alert-info text-sm">
        Vui lòng đăng nhập để quản lý cài đặt tài khoản.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="glass-card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-300">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-100">Cài đặt</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Quản lý thông tin tài khoản, danh sách theo dõi và phiên đăng nhập hiện tại.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="panel xl:col-span-8">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <UserRound className="h-5 w-5 text-emerald-300" />
              <div>
                <h2 className="section-title">Thông tin tài khoản</h2>
                <p className="section-subtitle">Thông tin dùng cho phiên làm việc hiện tại.</p>
              </div>
            </div>
          </div>

          <div className="panel-body grid gap-4 sm:grid-cols-2">
            <AccountField label="Email" value={user.email} />
            <AccountField label="Tên người dùng" value={user.username} />
          </div>
        </section>

        <section className="panel xl:col-span-4">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <LogOut className="h-5 w-5 text-red-300" />
              <div>
                <h2 className="section-title">Phiên đăng nhập</h2>
                <p className="section-subtitle">Thoát khỏi thiết bị hiện tại.</p>
              </div>
            </div>
          </div>

          <div className="panel-body">
            <button
              type="button"
              onClick={logout}
              className="w-full rounded-lg border border-red-300/25 bg-red-500/10 px-4 py-2.5 text-sm font-black text-red-200 transition hover:border-red-300/45 hover:bg-red-500/16"
            >
              Đăng xuất
            </button>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Star className="mt-0.5 h-5 w-5 text-emerald-300" />
              <div>
                <h2 className="section-title">Danh sách theo dõi</h2>
                <p className="section-subtitle">Các mã đang được ưu tiên theo dõi trên dashboard.</p>
              </div>
            </div>
            <span className="badge badge-success">{watchlist.length} mã</span>
          </div>
        </div>

        <div className="panel-body">
          {loading && <div className="alert-info text-sm">Đang tải danh sách theo dõi...</div>}

          {!loading && watchlist.length === 0 && (
            <div className="alert-info text-sm">
              Chưa có mã nào trong watchlist. Bạn có thể thêm mã từ trang bộ lọc hoặc trang chi tiết doanh nghiệp.
            </div>
          )}

          {!loading && watchlist.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {watchlist.map((item) => (
                <div
                  key={item.ticker}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:border-emerald-300/25 hover:bg-white/[0.06]"
                >
                  <Link to={`/company/${item.ticker}`} className="font-mono text-base font-black text-slate-100 hover:text-emerald-300">
                    {item.ticker}
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeTicker(item.ticker)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-red-300/35 hover:bg-red-500/10 hover:text-red-200"
                    aria-label={`Xóa ${item.ticker} khỏi watchlist`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function AccountField({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 truncate text-sm font-bold text-slate-100">{value || '-'}</p>
    </div>
  )
}
