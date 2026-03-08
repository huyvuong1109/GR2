import { motion } from 'framer-motion'
import { cn } from '../../utils/helpers'

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('skeleton h-4', className)}
      {...props}
    />
  )
}

function SkeletonCard({ className }) {
  return (
    <div className={cn('glass-card p-6 space-y-4', className)}>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-10 w-2/3" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5, columns = 4, className }) {
  return (
    <div className={cn('glass-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex gap-4 p-4 bg-dark-800/50 border-b border-dark-700">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b border-dark-800 last:border-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

function SkeletonChart({ className }) {
  return (
    <div className={cn('glass-card p-6', className)}>
      <Skeleton className="h-6 w-1/4 mb-4" />
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="flex-1" 
            style={{ height: `${Math.random() * 60 + 40}%` }} 
          />
        ))}
      </div>
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonChart }
export default Skeleton
