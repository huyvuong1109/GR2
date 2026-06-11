import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, Check, Trash2, ExternalLink, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { notificationsApi } from '../services/api'
import { tokenStore } from '../services/auth'
import { cn } from '../utils/helpers'

export default function NotificationsPanel({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [socketToken, setSocketToken] = useState(null)
  const panelRef = useRef(null)
  const wsRef = useRef(null)

  const extractNotifications = (payload) => {
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.notifications)) return payload.notifications
    return []
  }

  const normalizeNotification = (notification) => {
    let data = notification.data
    if (typeof data === 'string' && data) {
      try {
        data = JSON.parse(data)
      } catch {
        data = notification.data
      }
    }

    return {
      ...notification,
      data,
      ticker: notification.ticker || data?.ticker,
    }
  }

  useEffect(() => {
    if (isOpen) {
      setSocketToken(tokenStore.getAccess())
      fetchNotifications()
    }
  }, [isOpen, filter])

  useEffect(() => {
    const token = socketToken
    if (!isOpen || !token) {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      return
    }

    const baseUrl = import.meta.env.VITE_AUTH_API_URL || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin)
    const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws/notifications?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'init' && Array.isArray(payload.notifications)) {
          setNotifications(payload.notifications.map(normalizeNotification))
          return
        }
        if (payload.type === 'notification' && payload.notification) {
          setNotifications((prev) => [normalizeNotification(payload.notification), ...prev])
          return
        }
        if (payload.type === 'read' && payload.id) {
          setNotifications((prev) => prev.map((item) => item.id === payload.id ? { ...item, is_read: true } : item))
          return
        }
        if (payload.type === 'delete' && payload.id) {
          setNotifications((prev) => prev.filter((item) => item.id !== payload.id))
        }
      } catch (error) {
        console.error('Invalid WS payload', error)
      }
    }

    ws.onerror = () => ws.close()

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [isOpen, socketToken])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) onClose()
    }

    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const fetchNotifications = async () => {
    const hasSession = tokenStore.getAccess() || tokenStore.getRefresh()
    if (!hasSession) {
      setNotifications([])
      setFetchError('Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại để xem thông báo.')
      return
    }

    try {
      setLoading(true)
      setFetchError(null)
      const data = await notificationsApi.getAll(filter === 'unread')
      const items = extractNotifications(data)
      setNotifications(items.map(normalizeNotification))
      setSocketToken(tokenStore.getAccess())
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      const message = error.response?.status === 401
        ? 'Phiên đăng nhập đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.'
        : 'Không thể tải thông báo. Kiểm tra backend hoặc kết nối mạng rồi thử lại.'
      setFetchError(message)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id)
      setNotifications((prev) => prev.map((item) => item.id === id ? { ...item, is_read: true } : item))
      toast.success('Đã đánh dấu đã đọc')
    } catch {
      toast.error('Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id) => {
    try {
      await notificationsApi.delete(id)
      setNotifications((prev) => prev.filter((item) => item.id !== id))
      toast.success('Đã xóa thông báo')
    } catch {
      toast.error('Có lỗi xảy ra')
    }
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.aside
            ref={panelRef}
            initial={{ opacity: 0, x: 32, y: -6 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 32, y: -6 }}
            transition={{ duration: 0.18 }}
            className="fixed right-4 top-16 z-50 flex max-h-[calc(100vh-5rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101415]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-400/10">
                  <Bell className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-100">Thông báo</h2>
                  <p className="text-xs text-slate-500">{unreadCount} chưa đọc</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost p-2"
                aria-label="Đóng thông báo"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-2 border-b border-white/10 p-3">
              <Tab active={filter === 'all'} onClick={() => setFilter('all')}>
                Tất cả
              </Tab>
              <Tab active={filter === 'unread'} onClick={() => setFilter('unread')}>
                Chưa đọc ({unreadCount})
              </Tab>
            </div>

            <div className="min-h-[260px] flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                </div>
              ) : fetchError ? (
                <div className="flex h-64 flex-col items-center justify-center px-6 text-center text-amber-200">
                  <AlertTriangle className="mb-3 h-12 w-12 opacity-80" />
                  <p className="text-sm font-bold">Không thể tải thông báo</p>
                  <p className="mt-2 text-xs leading-5 text-amber-100/70">{fetchError}</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center px-6 text-center text-slate-500">
                  <Bell className="mb-3 h-12 w-12 opacity-45" />
                  <p className="text-sm">Không có thông báo nào</p>
                </div>
              ) : (
                <div className="space-y-3 p-3">
                  <AnimatePresence>
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClose={onClose}
                        onMarkAsRead={handleMarkAsRead}
                        onDelete={handleDelete}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg px-3 py-2 text-sm font-bold transition',
        active
          ? 'border border-emerald-300/25 bg-emerald-400/10 text-emerald-300'
          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
      )}
    >
      {children}
    </button>
  )
}

function NotificationItem({ notification, onClose, onMarkAsRead, onDelete }) {
  const Icon = getNotificationIcon(notification.type)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30 }}
      className={cn(
        'relative rounded-xl border p-4',
        getNotificationColor(notification.type),
        !notification.is_read && 'shadow-[0_0_0_1px_rgba(78,222,163,0.18)]'
      )}
    >
      {!notification.is_read && (
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(78,222,163,0.75)]" />
      )}

      <div className="flex gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/[0.06]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="pr-4 text-sm font-black text-slate-100">{notification.title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{notification.message}</p>

          {notification.ticker && (
            <Link
              to={`/company/${notification.ticker}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-mono font-black text-emerald-300 hover:text-emerald-200"
              onClick={onClose}
            >
              {notification.ticker}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}

          <p className="mt-2 text-[11px] text-slate-600">
            {new Date(notification.created_at).toLocaleString('vi-VN')}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
        {!notification.is_read && (
          <button
            type="button"
            onClick={() => onMarkAsRead(notification.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-emerald-300"
          >
            <Check className="h-3 w-3" />
            Đã đọc
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(notification.id)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-400/15"
        >
          <Trash2 className="h-3 w-3" />
          Xóa
        </button>
      </div>
    </motion.div>
  )
}

function getNotificationIcon(type) {
  const icons = {
    success: CheckCircle,
    warning: AlertTriangle,
    info: Info,
    danger: XCircle,
  }
  return icons[type] || Info
}

function getNotificationColor(type) {
  const colors = {
    success: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-300',
    warning: 'border-amber-300/20 bg-amber-400/10 text-amber-300',
    info: 'border-sky-300/20 bg-sky-400/10 text-sky-300',
    danger: 'border-red-300/20 bg-red-400/10 text-red-300',
  }
  return colors[type] || colors.info
}
