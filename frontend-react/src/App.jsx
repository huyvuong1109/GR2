import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Screener = lazy(() => import('./pages/ScreenerNew'))
const CompanyAnalysis = lazy(() => import('./pages/CompanyAnalysisSimple'))
const Comparison = lazy(() => import('./pages/Comparison'))
const FinancialReports = lazy(() => import('./pages/FinancialReports'))
const CompanyReports = lazy(() => import('./pages/CompanyReports'))
const NotFound = lazy(() => import('./pages/NotFound'))

function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#06070b]" />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="screener" element={<Screener />} />
          <Route path="company/:ticker" element={<CompanyAnalysis />} />
          <Route path="company/:ticker/reports" element={<CompanyReports />} />
          <Route path="compare" element={<Comparison />} />
          <Route path="reports" element={<FinancialReports />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
