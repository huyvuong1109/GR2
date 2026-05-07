import React, { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { WatchlistContext } from '../contexts/WatchlistContext'

export default function StarButton({ ticker }){
  const { user } = useContext(AuthContext)
  const { isInWatchlist, toggleTicker } = useContext(WatchlistContext)
  const saved = isInWatchlist(ticker)

  const toggle = async ()=>{
    if (!user) return alert('Vui lòng đăng nhập')
    try{
      await toggleTicker(ticker)
    }catch(e){
      console.error(e)
    }
  }

  return (
    <button
      onClick={toggle}
      className="text-xl"
      title={saved ? 'Bỏ khỏi danh sách theo dõi' : 'Thêm vào danh sách theo dõi'}
      aria-label={saved ? 'Bỏ theo dõi' : 'Theo dõi'}
    >
      {saved ? '★' : '☆'}
    </button>
  )
}
