import numeral from 'numeral'

// ==================== Number Formatting ====================

/**
 * Format large numbers with Vietnamese notation (tỷ, triệu)
 */
export const formatCurrency = (value, compact = true) => {
  if (value === null || value === undefined) return '-'
  
  if (compact) {
    const absValue = Math.abs(value)
    if (absValue >= 1e12) {
      return `${numeral(value / 1e12).format('0,0.0')} nghìn tỷ`
    } else if (absValue >= 1e9) {
      return `${numeral(value / 1e9).format('0,0.0')} tỷ`
    } else if (absValue >= 1e6) {
      return `${numeral(value / 1e6).format('0,0.0')} triệu`
    }
  }
  return numeral(value).format('0,0')
}

/**
 * Format full number with thousand separators (VND)
 * Displays complete number without abbreviation
 */
export const formatFullCurrency = (value) => {
  if (value === null || value === undefined) return '-'
  return numeral(value).format('0,0') + ' VND'
}

/**
 * Format number with K, M, B notation (English)
 */
export const formatCompact = (value) => {
  if (value === null || value === undefined) return '-'
  
  const absValue = Math.abs(value)
  if (absValue >= 1e12) return numeral(value / 1e12).format('0.0') + 'T'
  if (absValue >= 1e9) return numeral(value / 1e9).format('0.0') + 'B'
  if (absValue >= 1e6) return numeral(value / 1e6).format('0.0') + 'M'
  if (absValue >= 1e3) return numeral(value / 1e3).format('0.0') + 'K'
  return numeral(value).format('0,0')
}

/**
 * Format percentage
 */
export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined) return '-'
  return `${numeral(value).format(`0,0.${'0'.repeat(decimals)}`)}%`
}

/**
 * Format ratio (e.g., P/E, P/B)
 */
export const formatRatio = (value, decimals = 2) => {
  if (value === null || value === undefined) return '-'
  return numeral(value).format(`0,0.${'0'.repeat(decimals)}`)
}

/**
 * Format price (VND)
 */
export const formatPrice = (value) => {
  if (value === null || value === undefined) return '-'
  return numeral(value).format('0,0') + ' đ'
}

/**
 * Format number with sign prefix
 */
export const formatWithSign = (value, formatter = formatPercent) => {
  if (value === null || value === undefined) return '-'
  const prefix = value > 0 ? '+' : ''
  return prefix + formatter(value)
}

// ==================== Color Utilities ====================

/**
 * Get color class based on value (positive/negative)
 */
export const getValueColor = (value) => {
  if (value === null || value === undefined) return 'text-dark-400'
  if (value > 0) return 'text-success-400'
  if (value < 0) return 'text-danger-400'
  return 'text-dark-300'
}

/**
 * Get color for ratio (with thresholds)
 */
export const getRatioColor = (value, { good, warning } = { good: 15, warning: 10 }) => {
  if (value === null || value === undefined) return 'text-dark-400'
  if (value >= good) return 'text-success-400'
  if (value >= warning) return 'text-warning-400'
  return 'text-danger-400'
}

/**
 * Get badge variant based on value
 */
export const getValueBadge = (value, thresholds = { high: 20, medium: 10 }) => {
  if (value >= thresholds.high) return 'badge-success'
  if (value >= thresholds.medium) return 'badge-warning'
  return 'badge-danger'
}

// ==================== Chart Colors ====================

export const chartColors = {
  primary: '#0ea5e9',
  secondary: '#d946ef',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#06b6d4',
  
  // For multi-series charts
  series: [
    '#0ea5e9', '#d946ef', '#22c55e', '#f59e0b', '#ef4444',
    '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  ],
  
  // Gradient pairs
  gradients: {
    blue: ['#0ea5e9', '#0284c7'],
    purple: ['#d946ef', '#a21caf'],
    green: ['#22c55e', '#16a34a'],
    red: ['#ef4444', '#dc2626'],
    orange: ['#f59e0b', '#d97706'],
  },
}

// ==================== Date Utilities ====================

/**
 * Format date to Vietnamese locale
 */
export const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * Format date with time
 */
export const formatDateTime = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Get relative time (e.g., "2 giờ trước")
 */
export const getRelativeTime = (date) => {
  if (!date) return '-'
  
  const now = new Date()
  const target = new Date(date)
  const diff = now - target
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (hours < 24) return `${hours} giờ trước`
  if (days < 7) return `${days} ngày trước`
  
  return formatDate(date)
}

// ==================== Validation Utilities ====================

/**
 * Check if value is within acceptable range
 */
export const isInRange = (value, min, max) => {
  if (value === null || value === undefined) return false
  return value >= min && value <= max
}

/**
 * Classify stock by market cap
 */
export const getMarketCapClass = (marketCap) => {
  if (!marketCap) return 'N/A'
  if (marketCap >= 1e13) return 'Large Cap'    // > 10,000 tỷ
  if (marketCap >= 1e12) return 'Mid Cap'       // 1,000 - 10,000 tỷ
  if (marketCap >= 1e11) return 'Small Cap'     // 100 - 1,000 tỷ
  return 'Micro Cap'
}

// ==================== Array Utilities ====================

/**
 * Calculate growth rate between two periods
 */
export const calculateGrowth = (current, previous) => {
  if (!previous || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 */
export const calculateCAGR = (beginValue, endValue, years) => {
  if (!beginValue || beginValue <= 0 || !endValue || endValue <= 0 || years <= 0) return null
  return (Math.pow(endValue / beginValue, 1 / years) - 1) * 100
}

/**
 * Sort array by multiple fields
 */
export const sortByFields = (array, fields) => {
  return [...array].sort((a, b) => {
    for (const { field, order = 'asc' } of fields) {
      const aVal = a[field] ?? 0
      const bVal = b[field] ?? 0
      if (aVal !== bVal) {
        return order === 'asc' ? aVal - bVal : bVal - aVal
      }
    }
    return 0
  })
}

export default {
  formatCurrency,
  formatCompact,
  formatPercent,
  formatRatio,
  formatPrice,
  formatWithSign,
  getValueColor,
  getRatioColor,
  chartColors,
  formatDate,
  calculateGrowth,
  calculateCAGR,
}
