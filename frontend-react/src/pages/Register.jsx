import React, { useState, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, User, AlertCircle, CheckCircle, Eye, EyeOff, Loader, LineChart } from 'lucide-react'
import { AuthContext } from '../contexts/AuthContext'

export default function Register() {
  const { register } = useContext(AuthContext)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const navigate = useNavigate()

  const validateForm = () => {
    const errors = {}
    if (!email.trim()) errors.email = 'Email không được để trống'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email không hợp lệ'

    if (!username.trim()) errors.username = 'Tên đăng nhập không được để trống'
    else if (username.length < 3) errors.username = 'Tên đăng nhập phải ít nhất 3 ký tự'
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) errors.username = 'Tên đăng nhập chỉ chứa chữ, số và dấu gạch dưới'

    if (!password.trim()) errors.password = 'Mật khẩu không được để trống'
    else if (password.length < 6) errors.password = 'Mật khẩu phải ít nhất 6 ký tự'

    if (!confirmPassword.trim()) errors.confirmPassword = 'Xác nhận mật khẩu không được để trống'
    else if (password !== confirmPassword) errors.confirmPassword = 'Mật khẩu xác nhận không khớp'

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (!validateForm()) return

    setLoading(true)
    try {
      await register({ email, username, password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 1500)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const clearError = (field) => {
    if (validationErrors[field]) setValidationErrors({ ...validationErrors, [field]: null })
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app-radial px-5 py-10 text-slate-100">
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />

      <section className="glass-card relative z-10 w-full max-w-[480px] p-8 md:p-10">
        <div className="text-center">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] shadow-inner">
            <LineChart className="h-7 w-7 text-emerald-300" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-100">Tạo tài khoản mới</h1>
          <p className="mt-2 text-base text-slate-400">Bắt đầu hành trình đầu tư giá trị.</p>
        </div>

        {success && (
          <div className="alert-success mt-8 flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-bold">Đăng ký thành công</p>
              <p className="mt-1 text-sm text-emerald-100/80">Đang chuyển hướng đến trang đăng nhập...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="alert-danger mt-8 flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-bold">Có lỗi xảy ra</p>
              <p className="mt-1 text-sm text-red-200/80">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field
            label="Email"
            icon={<Mail className="h-5 w-5" />}
            type="email"
            value={email}
            placeholder="name@example.com"
            error={validationErrors.email}
            onChange={(value) => {
              setEmail(value)
              clearError('email')
            }}
          />

          <Field
            label="Tên đăng nhập"
            icon={<User className="h-5 w-5" />}
            value={username}
            placeholder="username_123"
            error={validationErrors.username}
            onChange={(value) => {
              setUsername(value)
              clearError('username')
            }}
          />

          <PasswordField
            label="Mật khẩu"
            value={password}
            show={showPassword}
            setShow={setShowPassword}
            error={validationErrors.password}
            onChange={(value) => {
              setPassword(value)
              clearError('password')
            }}
          />

          <PasswordField
            label="Xác nhận mật khẩu"
            value={confirmPassword}
            show={showConfirm}
            setShow={setShowConfirm}
            error={validationErrors.confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value)
              clearError('confirmPassword')
            }}
          />

          <label className="flex cursor-pointer items-start gap-3 pt-1 text-xs leading-5 text-slate-400">
            <input required type="checkbox" className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-emerald-400 focus:ring-emerald-400/30" />
            <span>
              Tôi đồng ý với <a href="#" className="text-emerald-300 hover:text-emerald-200">Điều khoản dịch vụ</a> và{' '}
              <a href="#" className="text-emerald-300 hover:text-emerald-200">Chính sách bảo mật</a>.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || success}
            className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                Đang xử lý...
              </>
            ) : success ? (
              <>
                <CheckCircle className="h-5 w-5" />
                Thành công
              </>
            ) : (
              'Đăng ký tài khoản'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-400">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-bold text-slate-100 transition hover:text-emerald-300">
            Đăng nhập ngay
          </Link>
        </div>
      </section>
    </main>
  )
}

function Field({ label, icon, value, onChange, error, type = 'text', placeholder }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">{label}</label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">{icon}</div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-primary py-3 pl-12 pr-4"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  )
}

function PasswordField({ label, value, onChange, show, setShow, error }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">{label}</label>
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="input-primary py-3 pl-12 pr-12"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-200"
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  )
}
