import { motion } from 'framer-motion'
import { cn } from '../../utils/helpers'

export function Card({ children, className, hover = false, ...props }) {
  const Component = hover ? motion.div : 'div'
  
  return (
    <Component
      className={cn(
        'glass-card p-6',
        hover && 'glass-card-hover cursor-pointer',
        className
      )}
      whileHover={hover ? { scale: 1.02 } : undefined}
      whileTap={hover ? { scale: 0.98 } : undefined}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3 className={cn('text-lg font-semibold text-white', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ children, className, ...props }) {
  return (
    <p className={cn('text-sm text-dark-400 mt-1', className)} {...props}>
      {children}
    </p>
  )
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className, ...props }) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-dark-700/50', className)} {...props}>
      {children}
    </div>
  )
}

export default Card
