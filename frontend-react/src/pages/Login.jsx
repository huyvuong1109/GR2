import React, { useState, useContext } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Mail, Lock, AlertCircle, Eye, EyeOff, Loader, ArrowRight, LineChart } from 'lucide-react'
import { AuthContext } from '../contexts/AuthContext'

export default function Login() {
  const { login } = useContext(AuthContext)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/'

  const validateForm = () => {
    const errors = {}
    if (!identifier.trim()) errors.identifier = 'Email hoặc tên đăng nhập không được để trống'
    if (!password.trim()) errors.password = 'Mật khẩu không được để trống'
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!validateForm()) return

    setLoading(true)
    try {
      await login(identifier, password)
      navigate(redirectTo, { replace: true })
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Đăng nhập thất bại. Kiểm tra lại email/username và mật khẩu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app-radial px-5 py-12 text-slate-100">
      <div className="absolute inset-0 opacity-45">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(11,15,16,0.95)_0%,rgba(16,20,21,0.76)_48%,rgba(16,20,21,0.96)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(190,198,224,0.18),transparent_55%)]" />
      </div>

      <section className="glass-card relative z-10 w-full max-w-[480px] overflow-hidden p-8 md:p-10">
        <div className="pointer-events-none absolute -left-20 -top-20 h-44 w-44 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="relative text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] shadow-inner">
            <LineChart className="h-8 w-8 text-emerald-300" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-100">Chào mừng quay lại</h1>
          <p className="mt-2 text-base text-slate-400">Đăng nhập để truy cập phân tích chuyên sâu.</p>
        </div>

        {error && (
          <div className="alert-danger mt-8 flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-bold">Đăng nhập thất bại</p>
              <p className="mt-1 text-sm text-red-200/80">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="relative mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-300">
              Email hoặc tên đăng nhập
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value)
                  if (validationErrors.identifier) setValidationErrors({ ...validationErrors, identifier: null })
                }}
                placeholder="name@domain.com hoặc username"
                className="input-primary py-3 pl-12 pr-4"
              />
            </div>
            {validationErrors.identifier && <p className="mt-2 text-sm text-red-300">{validationErrors.identifier}</p>}
          </div>

          <div>
            <div className="mb-2">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-300">Mật khẩu</label>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (validationErrors.password) setValidationErrors({ ...validationErrors, password: null })
                }}
                placeholder="••••••••"
                className="input-primary py-3 pl-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-200"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {validationErrors.password && <p className="mt-2 text-sm text-red-300">{validationErrors.password}</p>}
          </div>

          <label className="flex cursor-pointer items-center gap-3 pt-1 text-sm text-slate-400">
            <input type="checkbox" className="h-4 w-4 rounded border-white/20 bg-black/30 text-emerald-400 focus:ring-emerald-400/30" />
            Ghi nhớ đăng nhập
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-4 text-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                Đăng nhập
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-white/10 pt-6 text-center text-sm text-slate-400">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-bold text-slate-100 transition hover:text-emerald-300">
            Đăng ký ngay
          </Link>
        </div>
      </section>
    </main>
  )
}
