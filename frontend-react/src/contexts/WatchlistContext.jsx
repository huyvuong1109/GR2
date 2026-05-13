import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { watchlistApi } from '../services/api'
import { AuthContext } from './AuthContext'
import toast from 'react-hot-toast'

export const WatchlistContext = createContext(null)

export function WatchlistProvider({ children }) {
  const { user } = useContext(AuthContext)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!user) {
      setItems([])
      return
    }

    setLoading(true)
    try {
      const data = await watchlistApi.getAll()
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load watchlist', error)
      toast.error('Không thể tải danh mục quan tâm')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  const addTicker = useCallback(async (ticker) => {
    const normalized = String(ticker || '').toUpperCase().trim()
    if (!normalized || !user) return false

    try {
      const result = await watchlistApi.add(normalized)
      setItems((prev) => {
        if (prev.some((x) => x.ticker === normalized)) return prev
        return [{ ticker: normalized, added_at: new Date().toISOString() }, ...prev]
      })
      if (!result?.already_exists) {
        toast.success(`Đã thêm ${normalized} vào danh mục quan tâm`)
      }
      return true
    } catch (error) {
      console.error('Failed to add watchlist ticker', error)
      toast.error(`Không thể thêm ${normalized}`)
      throw error
    }
  }, [user])

  const removeTicker = useCallback(async (ticker) => {
    const normalized = String(ticker || '').toUpperCase().trim()
    if (!normalized || !user) return false

    try {
      await watchlistApi.remove(normalized)
      setItems((prev) => prev.filter((x) => x.ticker !== normalized))
      toast.success(`Đã xoá ${normalized} khỏi danh mục quan tâm`)
      return true
    } catch (error) {
      console.error('Failed to remove watchlist ticker', error)
      toast.error(`Không thể xoá ${normalized}`)
      throw error
    }
  }, [user])

  const toggleTicker = useCallback(async (ticker) => {
    const normalized = String(ticker || '').toUpperCase().trim()
    if (!normalized || !user) return false

    const exists = items.some((x) => x.ticker === normalized)
    if (exists) {
      await removeTicker(normalized)
      return false
    }

    await addTicker(normalized)
    return true
  }, [items, user, addTicker, removeTicker])

  const isInWatchlist = useCallback((ticker) => {
    const normalized = String(ticker || '').toUpperCase().trim()
    return items.some((x) => x.ticker === normalized)
  }, [items])

  const value = useMemo(() => ({
    items,
    loading,
    reload,
    addTicker,
    removeTicker,
    toggleTicker,
    isInWatchlist,
  }), [items, loading, reload, addTicker, removeTicker, toggleTicker, isInWatchlist])

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>
}
