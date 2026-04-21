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
  Moon,
  Sun,
  Scale,
  FileText,
} from 'lucide-react'
import { cn } from '../utils/helpers'
import NotificationsPanel from './NotificationsPanel'
import SearchModal from './SearchModal'
import { marketApi } from '../services/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Screener', href: '/screener', icon: Search },
  { name: 'Compare', href: '/compare', icon: Scale },
  { name: 'Reports', href: '/reports', icon: FileText },
]

const pageTitles = {
  '/': 'Dashboard',
  '/screener': 'Screener',
  '/compare': 'Comparison',
  '/reports': 'Reports',
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [marketStatus, setMarketStatus] = useState(null)
  const location = useLocation()

  const currentPageTitle = useMemo(() => {
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname]
    }

    if (location.pathname.startsWith('/company/')) {
      return 'Company Detail'
    }

    return 'Dashboard'
  }, [location.pathname])

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
    <div className="min-h-screen bg-[#06070b] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(163,230,53,0.06),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.07),transparent_30%),radial-gradient(circle_at_60%_100%,rgba(148,163,184,0.07),transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.02)_0%,transparent_35%,transparent_65%,rgba(255,255,255,0.02)_100%)]" />
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed bottom-4 left-4 top-4 z-50 w-24 rounded-3xl border border-white/10 bg-black/45 p-3 backdrop-blur-2xl transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-[120%] lg:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col items-center justify-between">
          <div className="w-full space-y-6">
            <div className="flex items-center justify-center">
              <NavLink to="/" className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime-400/20 text-lime-300">
                <TrendingUp className="h-6 w-6" />
              </NavLink>
            </div>

            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'group flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[10px] font-medium transition-all',
                      isActive
                        ? 'border-lime-300/35 bg-lime-300/10 text-lime-200'
                        : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-200'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="tracking-wide">{item.name}</span>
                  </NavLink>
                )
              })}
            </nav>
          </div>

          <div className="w-full space-y-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex w-full flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-[10px] text-slate-300 transition-colors hover:bg-white/10"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              Theme
            </button>

            <button
              className="flex w-full flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-[10px] text-slate-300 transition-colors hover:bg-white/10"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-32">
        <header className="sticky top-0 z-30 px-4 pt-4 lg:px-6">
          <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-4 backdrop-blur-xl lg:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg border border-white/15 p-2 text-slate-300 hover:bg-white/10 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Financial App</p>
                <p className="text-sm font-semibold text-slate-100">{currentPageTitle}</p>
              </div>
            </div>

            <button
              onClick={() => setSearchOpen(true)}
              className="hidden min-w-[320px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:border-white/25 hover:bg-white/[0.08] md:flex"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1">Search ticker...</span>
              <kbd className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-slate-500">Ctrl K</kbd>
            </button>

            <div className="flex items-center gap-2.5">
              {marketStatus && (
                <div
                  className={cn(
                    'hidden items-center gap-2 rounded-full border px-2.5 py-1 text-xs sm:flex',
                    marketStatus.is_open
                      ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                      : 'border-slate-400/25 bg-white/[0.03] text-slate-400'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      marketStatus.is_open ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                    )}
                  />
                  {marketStatus.message}
                </div>
              )}

              <button
                onClick={() => setNotificationsOpen(true)}
                className="relative rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-lime-400" />
              </button>

              <button
                onClick={() => setSidebarOpen((value) => !value)}
                className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 pb-6 pt-4 lg:px-6">
          <div className="mx-auto max-w-[1500px]">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
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
