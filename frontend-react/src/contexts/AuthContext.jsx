import React, { createContext, useState, useEffect } from 'react'
import * as authService from '../services/auth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const token = authService.tokenStore.getAccess()
      if (token) {
        try {
          const r = await authService.me()
          setUser(r)
        } catch (e) {
          // try refresh
          try {
            await authService.refresh()
            const r2 = await authService.me()
            setUser(r2)
          } catch (e) {
            authService.tokenStore.clear()
            setUser(null)
          }
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const register = async (payload) => {
    return authService.register(payload)
  }

  const login = async (identifier, password) => {
    const res = await authService.login(identifier, password)
    if (res.user) setUser(res.user)
    return res
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
