import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, Check, Trash2, ExternalLink } from 'lucide-react'
import { notificationsApi } from '../services/api'
import { cn } from '../utils/helpers'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function NotificationsPanel({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' or 'unread'
  const panelRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, filter])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const data = await notificationsApi.getAll(filter === 'unread')
      setNotifications(data.notifications || [])
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      toast.error('Không thể tải thông báo')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      toast.success('Đã đánh dấu đã đọc')
    } catch (error) {
      toast.error('Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id) => {
    try {
      await notificationsApi.delete(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      toast.success('Đã xóa thông báo')
    } catch (error) {
      toast.error('Có lỗi xảy ra')
    }
  }

  const getNotificationIcon = (type) => {
    const icons = {
      success: '✅',
      warning: '⚠️',
      info: 'ℹ️',
      danger: '❌',
    }
    return icons[type] || 'ℹ️'
  }

  const getNotificationColor = (type) => {
    const colors = {
      success: 'from-success-500/20 to-success-600/20 border-success-500/30',
      warning: 'from-warning-500/20 to-warning-600/20 border-warning-500/30',
      info: 'from-primary-500/20 to-primary-600/20 border-primary-500/30',
      danger: 'from-danger-500/20 to-danger-600/20 border-danger-500/30',
    }
    return colors[type] || colors.info
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-dark-950/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full sm:w-96 bg-dark-900 border-l border-dark-800 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Thông báo</h2>
                  <p className="text-xs text-dark-400">
                    {unreadCount} chưa đọc
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 p-4 border-b border-dark-800">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  filter === 'all'
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-dark-400 hover:text-white hover:bg-dark-800'
                )}
              >
                Tất cả
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  filter === 'unread'
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-dark-400 hover:text-white hover:bg-dark-800'
                )}
              >
                Chưa đọc ({unreadCount})
              </button>
            </div>

            {/* Notifications list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-dark-500">
                  <Bell className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">Không có thông báo nào</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <AnimatePresence>
                    {notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        className={cn(
                          'relative p-4 rounded-xl border bg-gradient-to-br backdrop-blur-sm',
                          getNotificationColor(notification.type),
                          !notification.is_read && 'ring-2 ring-primary-500/20'
                        )}
                      >
                        {/* Unread indicator */}
                        {!notification.is_read && (
                          <div className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full" />
                        )}

                        {/* Content */}
                        <div className="flex gap-3">
                          <div className="text-2xl flex-shrink-0">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="font-semibold text-white text-sm">
                                {notification.title}
                              </h3>
                            </div>
                            <p className="text-xs text-dark-300 mb-2">
                              {notification.message}
                            </p>
                            
                            {/* Ticker link */}
                            {notification.ticker && (
                              <Link
                                to={`/company/${notification.ticker}`}
                                className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
                                onClick={onClose}
                              >
                                <span className="font-mono font-semibold">
                                  {notification.ticker}
                                </span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                            
                            {/* Timestamp */}
                            <p className="text-xs text-dark-500 mt-2">
                              {new Date(notification.timestamp).toLocaleString('vi-VN')}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dark-700">
                          {!notification.is_read && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              Đánh dấu đã đọc
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(notification.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-danger-500/20 hover:bg-danger-500/30 text-danger-400 transition-colors ml-auto"
                          >
                            <Trash2 className="w-3 h-3" />
                            Xóa
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
