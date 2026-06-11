import React, { useContext, useState } from 'react'
import { Star } from 'lucide-react'
import { AuthContext } from '../contexts/AuthContext'
import { WatchlistContext } from '../contexts/WatchlistContext'
import { showAuthRequiredToast } from './AuthRequired'

export default function StarButton({ ticker }) {
  const { user } = useContext(AuthContext)
  const { isInWatchlist, toggleTicker } = useContext(WatchlistContext)
  const [pending, setPending] = useState(false)
  const saved = isInWatchlist(ticker)

  const toggle = async (event) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (pending) return
    if (!user) {
      showAuthRequiredToast()
      return
    }

    setPending(true)
    try {
      await toggleTicker(ticker)
    } catch (e) {
      console.error(e)
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-emerald-300/35 hover:bg-emerald-400/10 hover:text-emerald-300 disabled:cursor-wait disabled:opacity-60"
      title={saved ? 'Bỏ khỏi watchlist' : 'Thêm vào watchlist'}
      aria-label={saved ? `Bỏ ${ticker} khỏi watchlist` : `Thêm ${ticker} vào watchlist`}
    >
      <Star className={saved ? 'h-4 w-4 fill-emerald-300 text-emerald-300' : 'h-4 w-4'} />
    </button>
  )
}
