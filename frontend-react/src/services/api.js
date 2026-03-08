import axios from 'axios'

// Use direct backend URL during development if proxy doesn't work
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:8000/api' : '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'Có lỗi xảy ra'
    console.error('API Error:', message)
    return Promise.reject(error)
  }
)

// ==================== Companies API ====================
export const companiesApi = {
  getAll: () => api.get('/companies'),
  getByTicker: (ticker) => api.get(`/companies/${ticker}`),
  getFinancials: (ticker) => api.get(`/companies/${ticker}/financials`),
  search: (query) => api.get(`/companies/search`, { params: { q: query } }),
}

// ==================== Financial Data API ====================
export const financialApi = {
  getBalanceSheet: (ticker, year) => 
    api.get(`/balance-sheet-structure/${ticker}`, { params: { year } }),
  
  getIncomeStatement: (ticker, year) => 
    api.get(`/financial-summary/${ticker}`, { params: { year } }),
  
  getCashFlow: (ticker, year) => 
    api.get(`/cash-flow/${ticker}`, { params: { year } }),
  
  getSummary: (ticker) => 
    api.get(`/financial-summary/${ticker}`),
  
  getHistorical: (ticker, years = 5) => 
    api.get(`/financial-summary/${ticker}`, { params: { years } }),
  
  getRatios: (ticker) => 
    api.get(`/financial-summary/${ticker}`),
}

// ==================== Comparison API ====================
export const comparisonApi = {
  compare: (tickers) => api.post('/compare', { tickers }),
  getComparison: (tickers) => api.get('/compare', { params: { tickers: tickers.join(',') } }),
}

// ==================== Screening API ====================
export const screeningApi = {
  advanced: (filters) => api.get('/screener/advanced', { params: filters }),
  screen: (filters) => api.post('/screener', filters),
  
  getPresets: () => api.get('/screening/presets'),
  
  // Quick screen with common criteria
  quickScreen: (criteria) => {
    const presetFilters = {
      'value': { pe_max: 15, pb_max: 1.5, roe_min: 15 },
      'growth': { revenue_growth_min: 20, profit_growth_min: 20 },
      'dividend': { dividend_yield_min: 5, de_max: 1 },
      'quality': { roe_min: 20, roic_min: 15, de_max: 0.5 },
    }
    return api.get('/screener/advanced', { params: presetFilters[criteria] || criteria })
  },
}

// ==================== Valuation API ====================
export const valuationApi = {
  graham: (ticker, params) => 
    api.post(`/valuation/graham`, { ticker, ...params }),
  
  dcf: (ticker, params) => 
    api.post(`/valuation/dcf`, { ticker, ...params }),
  
  comparables: (ticker) => 
    api.get(`/valuation/${ticker}/comparables`),
}

// ==================== Market Overview API ====================
export const marketApi = {
  getOverview: () => api.get('/market/overview'),
  getStatus: () => api.get('/market/status'),
  getTopGainers: () => api.get('/market/top-gainers'),
  getTopLosers: () => api.get('/market/top-losers'),
  getSectorPerformance: () => api.get('/market/sectors'),
}

// ==================== Analysis API ====================
export const analysisApi = {
  getRatios: (ticker) => api.get(`/analysis/${ticker}/ratios`),
  getFScore: (ticker) => api.get(`/analysis/${ticker}/f-score`),
  getHealthScore: (ticker) => api.get(`/analysis/${ticker}/health-score`),
  getWarnings: (ticker) => api.get(`/analysis/${ticker}/warnings`),
}

// ==================== Export API ====================
export const exportApi = {
  exportData: (ticker, format = 'json') => 
    api.get(`/export/${ticker}`, { params: { format } }),
  exportCSV: (ticker) => 
    api.get(`/export/${ticker}`, { params: { format: 'csv' }, responseType: 'blob' }),
}

// ==================== Advanced Screener API ====================
export const advancedScreenerApi = {
  screen: (params) => api.get('/screener/advanced', { params }),
}

// ==================== Notifications API ====================
export const notificationsApi = {
  getAll: (unreadOnly = false, limit = 20) => 
    api.get('/notifications', { params: { unread_only: unreadOnly, limit } }),
  
  markAsRead: (id) => 
    api.put(`/notifications/${id}/read`),
  
  delete: (id) => 
    api.delete(`/notifications/${id}`),
}

export default api
