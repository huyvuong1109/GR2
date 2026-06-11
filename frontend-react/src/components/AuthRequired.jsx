import { useContext, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, LogIn, UserPlus, X } from 'lucide-react'
import { AuthContext } from '../contexts/AuthContext'

const AUTH_REQUIRED_EVENT = 'finanalytics:auth-required'

export const AUTH_REQUIRED_MESSAGE = 'Hãy đăng nhập để sử dụng chức năng này. Nếu chưa có tài khoản, hãy đăng kí tài khoản.'

export function showAuthRequiredModal(detail = {}) {
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, { detail }))
}

export function showAuthRequiredToast(detail = {}) {
  showAuthRequiredModal(detail)
}

export function AuthRequiredModalHost() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(null)

  useEffect(() => {
    const handleOpen = (event) => {
      setFrom(event.detail?.from || location)
      setOpen(true)
    }

    window.addEventListener(AUTH_REQUIRED_EVENT, handleOpen)
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleOpen)
  }, [location])

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const close = () => setOpen(false)
  const state = { from: from || location }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex min-h-dvh items-center justify-center px-4 py-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={close}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-required-title"
            className="glass-card relative w-full max-w-md overflow-hidden p-6 text-center shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:p-7"
          >
            <button
              type="button"
              onClick={close}
              className="btn-ghost absolute right-3 top-3 p-2"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-300 shadow-lg shadow-emerald-900/20">
              <Lock className="h-8 w-8" />
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-widest text-emerald-300">Tính năng thành viên</p>
            <h2 id="auth-required-title" className="mt-2 text-2xl font-black text-slate-100">
              Cần đăng nhập
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-400">
              {AUTH_REQUIRED_MESSAGE}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                to="/login"
                state={state}
                onClick={close}
                className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3"
              >
                <LogIn className="h-4 w-4" />
                Đăng nhập
              </Link>
              <Link
                to="/register"
                state={state}
                onClick={close}
                className="btn-outline inline-flex items-center justify-center gap-2 px-4 py-3"
              >
                <UserPlus className="h-4 w-4" />
                Đăng kí
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function AuthRequiredRoute({ children }) {
  const { user, loading } = useContext(AuthContext)
  const location = useLocation()

  if (loading) return null
  if (user) return children

  return (
    <section className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center px-2 py-10">
      <div className="glass-card w-full p-6 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-slate-100">Cần đăng nhập</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-400">{AUTH_REQUIRED_MESSAGE}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/login" state={{ from: location }} className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3">
            <LogIn className="h-4 w-4" />
            Đăng nhập
          </Link>
          <Link to="/register" state={{ from: location }} className="btn-outline inline-flex items-center justify-center gap-2 px-4 py-3">
            <UserPlus className="h-4 w-4" />
            Đăng kí tài khoản
          </Link>
        </div>
      </div>
    </section>
  )
}

export function ProtectedActionLink({ children, to, onClick, ...props }) {
  const { user } = useContext(AuthContext)
  const location = useLocation()

  const handleClick = (event) => {
    if (!user) {
      event.preventDefault()
      showAuthRequiredModal({ from: { ...location, pathname: to } })
      return
    }
    onClick?.(event)
  }

  return (
    <Link to={to} state={user ? undefined : { from: location }} onClick={handleClick} {...props}>
      {children}
    </Link>
  )
}

export default AuthRequiredRoute
