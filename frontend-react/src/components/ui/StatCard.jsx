import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import { cn } from '../../utils/helpers'
import { formatCurrency, formatPercent, getValueColor } from '../../utils/formatters'

export default function StatCard({
  title,
  value,
  change,
  changeLabel = 'so với kỳ trước',
  icon: Icon,
  iconColor = 'primary',
  format = 'number',
  className,
  tooltip,
}) {
  const formatValue = (val) => {
    if (val === null || val === undefined) return '-'
    switch (format) {
      case 'currency':
        return formatCurrency(val)
      case 'percent':
        return formatPercent(val)
      case 'ratio':
        return val.toFixed(2)
      default:
        return val.toLocaleString('vi-VN')
    }
  }

  const iconColors = {
    primary: 'from-primary-500 to-primary-600',
    success: 'from-success-500 to-success-600',
    danger: 'from-danger-500 to-danger-600',
    warning: 'from-warning-500 to-warning-600',
    accent: 'from-accent-500 to-accent-600',
  }

  const getTrendIcon = () => {
    if (change === null || change === undefined) return null
    if (change > 0) return <TrendingUp className="w-3 h-3" />
    if (change < 0) return <TrendingDown className="w-3 h-3" />
    return <Minus className="w-3 h-3" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('stat-card group', className)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-dark-400">{title}</span>
          {tooltip && (
            <div className="relative">
              <Info className="w-4 h-4 text-dark-500 cursor-help" />
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center',
            iconColors[iconColor]
          )}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-3xl font-bold text-white font-display">
          {formatValue(value)}
        </p>
        
        {change !== undefined && (
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold',
              change > 0 ? 'bg-success-500/20 text-success-400' :
              change < 0 ? 'bg-danger-500/20 text-danger-400' :
              'bg-dark-700 text-dark-400'
            )}>
              {getTrendIcon()}
              {formatPercent(Math.abs(change))}
            </span>
            <span className="text-xs text-dark-500">{changeLabel}</span>
          </div>
        )}
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className={cn(
          'absolute inset-0 rounded-2xl',
          iconColor === 'success' && 'bg-success-500/5',
          iconColor === 'danger' && 'bg-danger-500/5',
          iconColor === 'primary' && 'bg-primary-500/5',
          iconColor === 'warning' && 'bg-warning-500/5',
          iconColor === 'accent' && 'bg-accent-500/5',
        )} />
      </div>
    </motion.div>
  )
}
