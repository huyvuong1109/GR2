import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Search,
  LineChart,
  Calculator,
  Menu,
  X,
  TrendingUp,
  Bell,
  Settings,
  Moon,
  Sun,
  ChevronDown,
  Sparkles,
  Scale,
  FileText,
} from 'lucide-react'
import { cn } from '../utils/helpers'
import NotificationsPanel from './NotificationsPanel'
import SearchModal from './SearchModal'
import { marketApi } from '../services/api'

const navigation = [
  { name: 'Tổng quan', href: '/', icon: LayoutDashboard },
  { name: 'Sàng lọc', href: '/screener', icon: Search },
  { name: 'So sánh', href: '/compare', icon: Scale },
  { name: 'Báo cáo TC', href: '/reports', icon: FileText },
  { name: 'Định giá', href: '/valuation', icon: Calculator },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage first, default to true (dark mode)
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [marketStatus, setMarketStatus] = useState(null)
  const location = useLocation()

  // Apply theme to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  // Fetch market status
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
    // Refresh every minute
    const interval = setInterval(fetchMarketStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  // Keyboard shortcut for search (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-success-500/5 rounded-full blur-3xl" />
      </div>

      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-dark-950/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 bg-dark-900/90 backdrop-blur-xl border-r border-dark-800/50 transform transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-dark-800/50">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-success-500 rounded-full border-2 border-dark-900" />
            </div>
            <div>
              <h1 className="font-display font-bold text-white">FinAnalytics</h1>
              <p className="text-xs text-dark-400">Value Investing</p>
            </div>
          </NavLink>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <p className="px-4 mb-4 text-xs font-semibold text-dark-500 uppercase tracking-wider">
            Menu chính
          </p>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'nav-link group',
                  isActive && 'active'
                )}
              >
                <item.icon className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-primary-400' : 'text-dark-500 group-hover:text-dark-300'
                )} />
                <span>{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute right-4 w-1.5 h-1.5 bg-primary-500 rounded-full"
                  />
                )}
              </NavLink>
            )
          })}

          {/* Pro badge section */}
          <div className="mt-8 mx-2 p-4 bg-gradient-to-br from-primary-500/20 to-accent-500/20 rounded-2xl border border-primary-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary-400" />
              <span className="text-sm font-semibold text-white">Pro Features</span>
            </div>
            <p className="text-xs text-dark-300 mb-3">
              Truy cập đầy đủ công cụ phân tích chuyên sâu
            </p>
            <button className="w-full btn-primary text-sm py-2">
              Nâng cấp Pro
            </button>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-dark-800/50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-semibold">
              U
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">User</p>
              <p className="text-xs text-dark-400">Free plan</p>
            </div>
            <button className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-700">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top header */}
        <header className="sticky top-0 z-30 h-20 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
          <div className="flex items-center justify-between h-full px-6">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800"
              >
                <Menu className="w-6 h-6" />
              </button>
              
              {/* Search bar */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-dark-800/50 border border-dark-700/50 rounded-xl w-80 hover:border-primary-500/50 transition-all text-left"
              >
                <Search className="w-4 h-4 text-dark-400" />
                <span className="flex-1 text-sm text-dark-400">
                  Tìm mã cổ phiếu... (VNM, FPT, VIC)
                </span>
                <kbd className="hidden lg:inline-flex px-2 py-1 text-xs text-dark-500 bg-dark-700 rounded">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Market status badge */}
              {marketStatus && (
                <div className={cn(
                  "hidden sm:flex items-center gap-2 px-3 py-1.5 border rounded-full",
                  marketStatus.is_open 
                    ? "bg-success-500/10 border-success-500/20" 
                    : "bg-dark-800/50 border-dark-700"
                )}>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    marketStatus.is_open ? "bg-success-500 animate-pulse" : "bg-dark-600"
                  )} />
                  <span className={cn(
                    "text-xs font-medium",
                    marketStatus.is_open ? "text-success-400" : "text-dark-400"
                  )}>
                    {marketStatus.message}
                  </span>
                </div>
              )}

              {/* Notifications */}
              <button 
                onClick={() => setNotificationsOpen(true)}
                className="relative p-2.5 text-dark-400 hover:text-white rounded-xl hover:bg-dark-800 transition-colors"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full" />
              </button>

              {/* Theme toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 text-dark-400 hover:text-white rounded-xl hover:bg-dark-800 transition-colors"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Profile dropdown */}
              <button className="flex items-center gap-2 p-2 rounded-xl hover:bg-dark-800 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500" />
                <ChevronDown className="w-4 h-4 text-dark-400" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-5rem)] p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Notifications Panel */}
      <NotificationsPanel 
        isOpen={notificationsOpen} 
        onClose={() => setNotificationsOpen(false)} 
      />

      {/* Search Modal */}
      <SearchModal 
        isOpen={searchOpen} 
        onClose={() => setSearchOpen(false)} 
      />
    </div>
  )
}
