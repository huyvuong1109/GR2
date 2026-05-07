import { useEffect, useMemo, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Search,
  Menu,
  X,
  TrendingUp,
  Bell,
  Settings,
  Scale,
  FileText,
} from 'lucide-react'
import { cn } from '../utils/helpers'
import NotificationsPanel from './NotificationsPanel'
import SearchModal from './SearchModal'
import WatchlistSidebar from './WatchlistSidebar'
import { marketApi } from '../services/api'

const navigation = [
  { name: 'Bảng điều khiển', href: '/', icon: LayoutDashboard },
  { name: 'Bộ lọc cổ phiếu', href: '/screener', icon: Search },
  { name: 'So sánh', href: '/compare', icon: Scale },
  { name: 'Báo cáo tài chính', href: '/reports', icon: FileText },
]

const pageTitles = {
  '/': 'Bảng điều khiển',
  '/screener': 'Bộ lọc cổ phiếu',
  '/compare': 'So sánh',
  '/reports': 'Báo cáo tài chính',
  '/settings': 'Cài đặt',
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [marketStatus, setMarketStatus] = useState(null)
  const location = useLocation()

  const currentPageTitle = useMemo(() => {
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname]
    }

    if (location.pathname.startsWith('/company/')) {
      return 'Chi tiết doanh nghiệp'
    }

    return 'Bảng điều khiển'
  }, [location.pathname])

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
        setSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 sidebar transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="sidebar-header">
            <NavLink to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-white shadow-lg shadow-primary-500/30">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-serif font-bold text-white">Value Invest</h1>
                <p className="text-xs text-slate-400">Đầu tư giá trị</p>
              </div>
            </NavLink>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'nav-link',
                    isActive && 'active'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Settings */}
          <div className="border-t border-slate-200 p-4">
            <NavLink
              to="/settings"
              className="nav-link"
            >
              <Settings className="h-5 w-5" />
              <span>Cài đặt</span>
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="header sticky top-0 z-30">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="btn-ghost lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                  Nền tảng phân tích tài chính
                </p>
                <h2 className="text-base font-serif font-bold text-white">
                  {currentPageTitle}
                </h2>
              </div>
            </div>

            {/* Search bar */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden min-w-[320px] items-center gap-3 rounded-xl border border-primary-700 bg-primary-800/50 px-4 py-2.5 text-left text-sm text-slate-300 transition-all hover:border-primary-500 hover:bg-primary-800 md:flex"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1">Tìm mã cổ phiếu...</span>
            </button>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              {/* Market status */}
              {marketStatus && (
                <div
                  className={cn(
                    'hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:flex',
                    marketStatus.is_open
                      ? 'border-success-500/30 bg-success-500/10 text-success-400'
                      : 'border-slate-700 bg-primary-800/50 text-slate-300'
                  )}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      marketStatus.is_open ? 'bg-success-500 animate-pulse' : 'bg-slate-400'
                    )}
                  />
                  {marketStatus.message}
                </div>
              )}

              {/* Notifications */}
              <button
                onClick={() => setNotificationsOpen(true)}
                className="relative btn-ghost"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger-500" />
              </button>

              {/* Mobile search */}
              <button
                onClick={() => setSearchOpen(true)}
                className="btn-ghost md:hidden"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-4 py-6 lg:px-6">
          <div className="mx-auto flex max-w-[1600px] gap-6">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="min-w-0 flex-1"
            >
              <Outlet />
            </motion.div>
            
            {/* Watchlist sidebar */}
            <div className="hidden xl:block">
              <WatchlistSidebar />
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      <NotificationsPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
