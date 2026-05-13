import axios from 'axios'

// Use one backend origin for both financial data and authenticated user APIs.
const API_ORIGIN = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '')
const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : '/api'
const USER_API_BASE_URL = (import.meta.env.VITE_AUTH_API_URL || API_ORIGIN || '').replace(/\/$/, '')
const getAuthToken = () => window.sessionStorage.getItem('auth_token')

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

const userApi = axios.create({
  baseURL: USER_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

userApi.interceptors.request.use(
  (config) => {
    const token = getAuthToken()
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

userApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'Có lỗi xảy ra'
    console.error('User API Error:', message)
    return Promise.reject(error)
  }
)

// ==================== Companies API ====================
export const companiesApi = {
  getAll: () => api.get('/companies'),
  getByTicker: (ticker) => api.get(`/companies/${ticker}`),
  getFinancials: (ticker) => api.get(`/companies/${ticker}/financials`),
  getBatch: (tickers) => api.get('/companies/batch', { params: { tickers: tickers.join(',') } }),
  search: (query) => api.get(`/companies/search`, { params: { q: query } }),
  getTickerGroups: (limit = 4) => api.get('/ticker-groups', { params: { limit } }),
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

// ==================== Market Overview API ====================
export const marketApi = {
  getOverview: () => api.get('/market/overview'),
  getStatus: () => api.get('/market/status'),
  getTopGainers: () => api.get('/market/top-gainers'),
  getTopLosers: () => api.get('/market/top-losers'),
  getSectorPerformance: () => api.get('/market/sectors'),
}

export const priceHistoryApi = {
  getForTickers: (tickers, limit = 7) => api.get('/price-history', { params: { tickers: tickers.join(','), limit } }),
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
  getAll: (unreadOnly = false) => 
    userApi.get('/api/notifications', { params: { unread_only: unreadOnly } }),
  
  markAsRead: (id) => 
    userApi.post('/api/notifications/mark-read', { id }),
  
  delete: (id) => 
    userApi.delete(`/api/notifications/${id}`),
}

export const watchlistApi = {
  getAll: () => userApi.get('/api/watchlist'),
  add: (ticker) => userApi.post('/api/watchlist/add', { ticker }),
  remove: (ticker) => userApi.delete('/api/watchlist/remove', { data: { ticker } }),
}

export const userApiService = {
  me: () => userApi.get('/api/user/me'),
  updateMe: (payload) => userApi.put('/api/user/me', payload),
}

export default api
