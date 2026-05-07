import React, { useState, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, AlertCircle, Eye, EyeOff, Loader, ArrowRight } from 'lucide-react'
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

  const validateForm = () => {
    const errors = {}
    
    if (!identifier.trim()) {
      errors.identifier = 'Email hoặc tên đăng nhập không được để trống'
    }
    
    if (!password.trim()) {
      errors.password = 'Mật khẩu không được để trống'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    try {
      await login(identifier, password)
      navigate('/')
    } catch (e) {
      const errorMsg = e.response?.data?.detail || e.message || 'Đăng nhập thất bại. Kiểm tra lại email/username và mật khẩu'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-100 rounded-full blur-3xl opacity-50" />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 bg-white rounded-2xl blur-xl" />
        
        <div className="relative bg-white border border-slate-200 rounded-2xl p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 rounded-xl mb-4">
              <Lock className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Đăng nhập</h1>
            <p className="text-slate-600">Quay lại với tài khoản của bạn</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-danger-600 font-medium">Đăng nhập thất bại</p>
                <p className="text-danger-600/70 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {/* Identifier (Email or Username) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email hoặc tên đăng nhập</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value)
                    if (validationErrors.identifier) setValidationErrors({ ...validationErrors, identifier: null })
                  }}
                  placeholder="your@email.com hoặc username"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                />
              </div>
              {validationErrors.identifier && (
                <p className="text-danger-600 text-sm mt-1">{validationErrors.identifier}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Mật khẩu</label>
                <Link to="#" className="text-primary-600 hover:text-primary-700 text-xs font-medium transition-colors">
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (validationErrors.password) setValidationErrors({ ...validationErrors, password: null })
                  }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {validationErrors.password && (
                <p className="text-danger-600 text-sm mt-1">{validationErrors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Hoặc</span>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-600 text-sm">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium transition-colors">
              Đăng ký ngay
            </Link>
          </p>

          {/* Demo credentials hint */}
          <div className="mt-6 p-3 bg-primary-50 border border-primary-100 rounded-lg">
            <p className="text-xs text-primary-700">
              <span className="font-medium">HD dùng thử:</span> Hãy đăng ký tài khoản mới hoặc liên hệ bộ phận hỗ trợ
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
