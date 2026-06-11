import { useContext, useEffect, useMemo, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Search,
  Menu,
  X,
  TrendingUp,
  Bell,
  Scale,
  FileText,
} from 'lucide-react'
import { cn } from '../utils/helpers'
import { AuthContext } from '../contexts/AuthContext'
import NotificationsPanel from './NotificationsPanel'
import SearchModal from './SearchModal'
import { marketApi } from '../services/api'
import { showAuthRequiredToast } from './AuthRequired'

const navigation = [
  { name: 'Bảng điều khiển', href: '/', icon: LayoutDashboard },
  { name: 'Bộ lọc cổ phiếu', href: '/screener', icon: Search },
  { name: 'So sánh', href: '/compare', icon: Scale },
  { name: 'Báo cáo tài chính', href: '/reports', icon: FileText },
]

const pageTitles = {
  '/': 'Bảng điều khiển',
  '/screener': 'Bộ lọc cổ phiếu',
  '/compare': 'So sánh cổ phiếu',
  '/reports': 'Báo cáo tài chính',
  '/settings': 'Cài đặt',
}

export default function Layout() {
  const { user } = useContext(AuthContext)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [marketStatus, setMarketStatus] = useState(null)
  const location = useLocation()

  const currentPageTitle = useMemo(() => {
    if (pageTitles[location.pathname]) return pageTitles[location.pathname]
    if (location.pathname.startsWith('/company/')) return 'Phân tích chi tiết công ty'
    return 'Bảng điều khiển'
  }, [location.pathname])

  const displayName = user?.full_name || user?.username || user?.email || 'Người dùng'
  const displayInitial = displayName.trim().slice(0, 1).toUpperCase() || 'U'

  const requireAuthAction = (callback) => {
    if (!user) {
      showAuthRequiredToast()
      return
    }
    callback?.()
  }

  const handleProtectedNavClick = (event, href) => {
    if (href === '/') {
      setSidebarOpen(false)
      return
    }

    if (!user) {
      event.preventDefault()
      setSidebarOpen(false)
      showAuthRequiredToast({ from: { ...location, pathname: href } })
      return
    }

    setSidebarOpen(false)
  }

  useEffect(() => {
    const fetchMarketStatus = async () => {
      try {
        const data = await marketApi.getStatus()
        setMarketStatus(data)
      } catch (error) {
        console.error('Failed to fetch market status:', error)
      }
    }

    fetchMarketStatus()
    const interval = setInterval(fetchMarketStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        requireAuthAction(() => setSearchOpen(true))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [user])

  const statusText = marketStatus?.message || 'Đang cập nhật'

  return (
    <div className="app-compact min-h-screen bg-app-radial text-slate-100">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'group fixed left-0 top-0 z-50 h-full w-64 sidebar transition-all duration-300 lg:w-20 lg:translate-x-0 lg:hover:w-56',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col px-3 py-4">
          <div className="sidebar-header pb-4">
            <NavLink to="/" className="mx-auto flex min-h-12 w-12 items-center justify-center gap-0 overflow-hidden rounded-xl transition-all lg:group-hover:mx-0 lg:group-hover:w-full lg:group-hover:justify-start lg:group-hover:gap-2.5">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-300 shadow-lg shadow-emerald-900/20">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="min-w-0 transition-opacity lg:w-0 lg:opacity-0 lg:group-hover:w-auto lg:group-hover:opacity-100">
                <h1 className="truncate text-sm font-black tracking-tight text-slate-100">FinAnalytics</h1>
                <p className="truncate text-[9px] font-bold uppercase tracking-widest text-slate-500">Phân tích tài chính</p>
              </div>
            </NavLink>
          </div>

          <nav className="mt-4 flex-1 space-y-1.5">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === '/'}
                onClick={(event) => handleProtectedNavClick(event, item.href)}
                title={item.name}
                className={({ isActive }) => cn('nav-link mx-auto min-h-10 w-12 justify-center gap-0 overflow-hidden px-0 lg:group-hover:mx-0 lg:group-hover:w-full lg:group-hover:justify-start lg:group-hover:gap-2.5 lg:group-hover:px-3', isActive && 'active')}
              >
                <item.icon className="h-[18px] w-[18px] flex-none" />
                <span className="truncate whitespace-nowrap transition-opacity lg:w-0 lg:opacity-0 lg:group-hover:w-auto lg:group-hover:opacity-100">
                  {item.name}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/10 pt-4">
            <NavLink
              to="/settings"
              onClick={(event) => handleProtectedNavClick(event, '/settings')}
              title="Cài đặt tài khoản"
              className="mx-auto flex w-12 items-center justify-center gap-0 overflow-hidden rounded-xl px-0 py-2.5 text-left transition hover:bg-white/[0.06] lg:group-hover:mx-0 lg:group-hover:w-full lg:group-hover:justify-start lg:group-hover:gap-2.5 lg:group-hover:px-3"
            >
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-xs font-black text-emerald-300">
                {displayInitial}
              </div>
              <div className="min-w-0 transition-opacity lg:w-0 lg:opacity-0 lg:group-hover:w-auto lg:group-hover:opacity-100">
                <p className="truncate text-sm font-bold text-slate-100">{displayName}</p>
                <p className="truncate text-xs text-slate-500">Cài đặt tài khoản</p>
              </div>
            </NavLink>
          </div>
        </div>
      </aside>

      <div className="lg:pl-20">
        <header className="header sticky top-0 z-30">
          <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 sm:px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="btn-ghost p-2 lg:hidden"
                aria-label="Mở menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Nền tảng phân tích tài chính
                </p>
                <h2 className="truncate text-sm font-black text-slate-100 md:text-base">{currentPageTitle}</h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => requireAuthAction(() => setSearchOpen(true))}
              className="hidden w-[340px] items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-left text-sm text-slate-400 transition hover:border-emerald-300/35 hover:text-slate-200 md:flex"
            >
              <Search className="h-4 w-4 flex-none" />
              <span className="min-w-0 flex-1 truncate">Tìm mã cổ phiếu...</span>
              <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">Ctrl K</span>
            </button>

            <div className="flex min-w-0 items-center justify-end gap-2">
              <div
                className={cn(
                  'hidden h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold sm:flex',
                  marketStatus?.is_open
                    ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.04] text-slate-300'
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 flex-none rounded-full',
                    marketStatus?.is_open ? 'bg-emerald-300 shadow-[0_0_10px_rgba(78,222,163,0.8)]' : 'bg-slate-500'
                  )}
                />
                <span className="max-w-[180px] truncate">{statusText}</span>
              </div>

              <button
                type="button"
                onClick={() => requireAuthAction(() => setNotificationsOpen(true))}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-emerald-300/30 hover:text-emerald-300"
                aria-label="Thông báo"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-300 ring-2 ring-[#101415]" />
              </button>

              <button
                type="button"
                onClick={() => requireAuthAction(() => setSearchOpen(true))}
                className="btn-ghost p-2 md:hidden"
                aria-label="Tìm kiếm"
              >
                <Search className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="btn-ghost p-2 lg:hidden"
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-3 py-5 sm:px-4 md:px-6 md:py-6 2xl:px-8">
          <div className="mx-auto flex max-w-[1600px] items-start gap-6">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="min-w-0 flex-1"
            >
              <Outlet />
            </motion.div>
          </div>
        </main>
      </div>

      <NotificationsPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
