import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Screener from './pages/ScreenerNew'
import CompanyAnalysis from './pages/CompanyAnalysisSimple'
import Comparison from './pages/Comparison'
import FinancialReports from './pages/FinancialReports'
import CompanyReports from './pages/CompanyReports'
import Valuation from './pages/Valuation'
import NotFound from './pages/NotFound'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="screener" element={<Screener />} />
        <Route path="company/:ticker" element={<CompanyAnalysis />} />
        <Route path="company/:ticker/reports" element={<CompanyReports />} />
        <Route path="compare" element={<Comparison />} />
        <Route path="reports" element={<FinancialReports />} />
        <Route path="valuation" element={<Valuation />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
