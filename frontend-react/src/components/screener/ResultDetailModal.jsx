import React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../utils/helpers'

export default function ResultDetailModal({ isOpen, onClose, stock, periodInfo, activeMethodId }) {
  if (!isOpen || !stock) return null

  // Determine the headers based on periodInfo
  let currentHeader = 'Kỳ hiện tại'
  let prevHeader = 'Kỳ trước'
  if (periodInfo?.year) {
    if (periodInfo.type === 'quarter' && periodInfo.quarter) {
      currentHeader = `Q${periodInfo.quarter} ${periodInfo.year}`
      prevHeader = `Q${periodInfo.quarter} ${periodInfo.year - 1}`
    } else {
      currentHeader = `Năm ${periodInfo.year}`
      prevHeader = `Năm ${periodInfo.year - 1}`
    }
  }

  const formatBillion = (val) => {
    if (val === null || val === undefined) return '-'
    return (val / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
  }

  const formatPercent = (val) => {
    if (val === null || val === undefined) return '-'
    return `${val.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
  }

  const formatNumber = (val) => {
    if (val === null || val === undefined) return '-'
    return val.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
  }

  const getTableTitle = () => {
    if (activeMethodId === 'method_value') return 'BỘ LỌC VALUE INVESTING'
    if (activeMethodId === 'method_canslim') return 'BỘ LỌC CANSLIM'
    if (activeMethodId === 'method_quality') return 'BỘ LỌC QUALITY COMPOUNDER'
    return 'BỘ LỌC TĂNG TRƯỞNG (SEPA)'
  }

  const renderValueRows = () => (
    <>
      <tr className="bg-emerald-900/10 border-t border-emerald-500/20">
        <td className="px-4 py-3 font-bold text-emerald-400">Chỉ số P/E (Lần)</td>
        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
          {formatNumber(stock.pe_ratio)}
        </td>
      </tr>
      <tr className="bg-emerald-900/10 border-t border-white/5">
        <td className="px-4 py-3 font-bold text-emerald-400">Chỉ số P/B (Lần)</td>
        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
          {formatNumber(stock.pb_ratio)}
        </td>
      </tr>
      <tr className="bg-emerald-900/10 border-t border-white/5 border-b border-emerald-500/20">
        <td className="px-4 py-3 font-bold text-emerald-400">ROE (%)</td>
        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
          {formatPercent(stock.roe)}
        </td>
      </tr>
    </>
  )

  const renderCanslimRows = () => (
    <>
      <tr className="bg-emerald-900/10 border-t border-emerald-500/20">
        <td className="px-4 py-3 font-bold text-emerald-400">Tốc độ Tăng Doanh thu</td>
        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
          {formatPercent(stock.revenue_growth)}
        </td>
      </tr>
      <tr className="bg-emerald-900/10 border-t border-white/5">
        <td className="px-4 py-3 font-bold text-emerald-400">Tốc độ Tăng LNST</td>
        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
          {formatPercent(stock.profit_growth)}
        </td>
      </tr>
      <tr className="bg-emerald-900/10 border-t border-white/5 border-b border-emerald-500/20">
        <td className="px-4 py-3 font-bold text-emerald-400">ROE (%)</td>
        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
          {formatPercent(stock.roe)}
        </td>
      </tr>
    </>
  )

  const renderQualityRows = () => (
    <>
      <tr className="bg-emerald-900/10 border-t border-emerald-500/20">
        <td className="px-4 py-3 font-bold text-emerald-400">Piotroski F-Score (Điểm)</td>
        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
          {formatNumber(stock.f_score)}
        </td>
      </tr>
      <tr className="bg-emerald-900/10 border-t border-white/5">
        <td className="px-4 py-3 font-bold text-emerald-400">ROE (%)</td>
        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
          {formatPercent(stock.roe)}
        </td>
      </tr>
      <tr className="bg-emerald-900/10 border-t border-white/5">
        <td className="px-4 py-3 font-bold text-emerald-400">Nợ / Vốn chủ sở hữu (Lần)</td>
        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
          {formatNumber(stock.de_ratio)}
        </td>
      </tr>
      <tr className="bg-emerald-900/10 border-t border-white/5 border-b border-emerald-500/20">
        <td className="px-4 py-3 font-bold text-emerald-400">Thanh khoản ngắn hạn (Lần)</td>
        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
          {formatNumber(stock.current_ratio)}
        </td>
      </tr>
    </>
  )

  const renderSepaRows = () => (
    <>
      {/* Absolute Values */}
      <tr className="hover:bg-white/[0.02]">
        <td className="px-4 py-3 font-semibold text-sky-200 bg-sky-900/10">Lãi cơ bản trên cổ phiếu (EPS)</td>
        <td className="px-4 py-3 text-right font-mono text-slate-200">{formatNumber(stock.lm_eps)}</td>
        <td className="px-4 py-3 text-right font-mono text-slate-200">{formatNumber(stock.pm_eps)}</td>
      </tr>
      <tr className="hover:bg-white/[0.02]">
        <td className="px-4 py-3 font-semibold text-sky-200 bg-sky-900/10">Doanh thu thuần (Tỷ)</td>
        <td className="px-4 py-3 text-right font-mono text-slate-200">{formatBillion(stock.lm_revenue)}</td>
        <td className="px-4 py-3 text-right font-mono text-slate-200">{formatBillion(stock.pm_revenue)}</td>
      </tr>
      <tr className="hover:bg-white/[0.02]">
        <td className="px-4 py-3 font-semibold text-sky-200 bg-sky-900/10">Lợi nhuận gộp (Tỷ)</td>
        <td className="px-4 py-3 text-right font-mono text-slate-200">{formatBillion(stock.lm_gross_profit)}</td>
        <td className="px-4 py-3 text-right font-mono text-slate-200">{formatBillion(stock.pm_gross_profit)}</td>
      </tr>
      <tr className="hover:bg-white/[0.02]">
        <td className="px-4 py-3 font-semibold text-sky-200 bg-sky-900/10">Lợi nhuận sau thuế (Tỷ)</td>
        <td className="px-4 py-3 text-right font-mono text-slate-200">{formatBillion(stock.lm_net_profit)}</td>
        <td className="px-4 py-3 text-right font-mono text-slate-200">{formatBillion(stock.pm_net_profit)}</td>
      </tr>
      
      {/* Empty Row for spacing */}
      <tr><td colSpan={3} className="h-4 bg-transparent border-0"></td></tr>

      {/* Percentages */}
      <tr className="bg-emerald-900/10 border-t border-emerald-500/20">
        <td className="px-4 py-3 font-bold text-emerald-400">Tốc độ Tăng trưởng EPS</td>
        <td colSpan={2} className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
          {formatPercent(stock.eps_growth)}
        </td>
      </tr>
      <tr className="bg-emerald-900/10 border-t border-white/5">
        <td className="px-4 py-3 font-bold text-emerald-400">Tốc độ Tăng Doanh thu</td>
        <td colSpan={2} className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
          {formatPercent(stock.revenue_growth)}
        </td>
      </tr>
      <tr className="bg-emerald-900/10 border-t border-white/5">
        <td className="px-4 py-3 font-bold text-emerald-400">Tốc độ Tăng LNST</td>
        <td colSpan={2} className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
          {formatPercent(stock.profit_growth)}
        </td>
      </tr>
      <tr className="bg-emerald-900/10 border-t border-white/5 border-b border-emerald-500/20">
        <td className="px-4 py-3 font-bold text-emerald-400">Sự thay đổi BLNG (YoY)</td>
        <td colSpan={2} className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
          {formatPercent(stock.gross_margin_growth)}
        </td>
      </tr>
    </>
  )

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-800/50 p-4">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-black text-emerald-400">{stock.ticker}</h3>
              <span className="text-sm font-semibold text-slate-300">{stock.name}</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-800/80 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <tr>
                    <th className="border-b border-white/5 px-4 py-3 bg-amber-500/10 text-amber-300">{getTableTitle()}</th>
                    <th className="border-b border-white/5 px-4 py-3 text-right bg-blue-500/10 text-blue-300">{currentHeader}</th>
                    {activeMethodId === 'method_sepa' && (
                      <th className="border-b border-white/5 px-4 py-3 text-right bg-blue-500/10 text-blue-300">{prevHeader}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeMethodId === 'method_value' ? renderValueRows() :
                   activeMethodId === 'method_canslim' ? renderCanslimRows() :
                   activeMethodId === 'method_quality' ? renderQualityRows() :
                   renderSepaRows()}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
