import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Screener = lazy(() => import('./pages/ScreenerNew'))
const CompanyAnalysis = lazy(() => import('./pages/CompanyAnalysisSimple'))
const Comparison = lazy(() => import('./pages/Comparison'))
const FinancialReports = lazy(() => import('./pages/FinancialReports'))
const CompanyReports = lazy(() => import('./pages/CompanyReports'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Settings = lazy(() => import('./pages/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-app-radial">
          <div className="text-center">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-emerald-300 border-r-transparent" />
            <p className="mt-4 text-sm font-medium text-slate-400">Đang tải...</p>
          </div>
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="screener" element={<ProtectedRoute><Screener /></ProtectedRoute>} />
          <Route path="company/:ticker" element={<ProtectedRoute><CompanyAnalysis /></ProtectedRoute>} />
          <Route path="company/:ticker/reports" element={<ProtectedRoute><CompanyReports /></ProtectedRoute>} />
          <Route path="compare" element={<ProtectedRoute><Comparison /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute><FinancialReports /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
