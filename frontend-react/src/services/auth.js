import axios from 'axios'

// Determine API base URL
const AUTH_BASE = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8001'

console.log('Auth API Base URL:', AUTH_BASE)

export const tokenStore = {
  getAccess: () => localStorage.getItem('auth_token'),
  setAccess: (t) => { if (t) localStorage.setItem('auth_token', t); else localStorage.removeItem('auth_token') },
  getRefresh: () => localStorage.getItem('refresh_token'),
  setRefresh: (t) => { if (t) localStorage.setItem('refresh_token', t); else localStorage.removeItem('refresh_token') },
  clear: () => { localStorage.removeItem('auth_token'); localStorage.removeItem('refresh_token') }
}

const client = axios.create({ 
  baseURL: AUTH_BASE, 
  headers: { 'Content-Type': 'application/json' }, 
  withCredentials: false 
})

// Add response interceptor to handle errors
client.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
    })
    return Promise.reject(error)
  }
)

export async function register(payload) {
  try {
    console.log('Registering with payload:', payload)
    const r = await client.post('/auth/register', payload)
    return r.data
  } catch (error) {
    console.error('Register error:', error)
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail)
    }
    if (!error.response && error.message === 'Network Error') {
      throw new Error(`Khong the ket noi toi server (${AUTH_BASE}). Hay chay backend tren port 8001`)
    }
    if (!error.response) {
      throw new Error(`Loi ket noi: ${error.message}. Kiem tra xem backend co chay khong?`)
    }
    throw new Error(error.message || 'Co loi xay ra')
  }
}

export async function login(identifier, password) {
  try {
    console.log('Logging in:', identifier)
    const r = await client.post('/auth/login', { username_or_email: identifier, password })
    // expected { access_token, refresh_token, user }
    if (r.data?.access_token) tokenStore.setAccess(r.data.access_token)
    if (r.data?.refresh_token) tokenStore.setRefresh(r.data.refresh_token)
    return r.data
  } catch (error) {
    console.error('Login error:', error)
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail)
    }
    if (!error.response) {
      throw new Error(`Loi ket noi: ${error.message}. Kiem tra xem backend co chay khong?`)
    }
    throw new Error(error.message || 'Dang nhap that bai')
  }
}

export async function refresh() {
  try {
    const token = tokenStore.getRefresh()
    if (!token) throw new Error('Khong co refresh token')
    const r = await client.post('/auth/refresh', { refresh_token: token })
    if (r.data?.access_token) tokenStore.setAccess(r.data.access_token)
    if (r.data?.refresh_token) tokenStore.setRefresh(r.data.refresh_token)
    return r.data
  } catch (error) {
    console.error('Refresh error:', error)
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail)
    }
    throw error
  }
}

export async function me() {
  try {
    const access = tokenStore.getAccess()
    const r = await client.get('/api/user/me', {
      headers: access ? { Authorization: `Bearer ${access}` } : undefined,
    })
    return r.data
  } catch (error) {
    console.error('Me error:', error)
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail)
    }
    throw error
  }
}

export async function logout() {
  try { await client.post('/auth/logout') } catch(e){}
  tokenStore.clear()
}

export default client

