import { cn } from '../../utils/helpers'

export function Badge({ children, variant = 'default', size = 'md', className, ...props }) {
  const variants = {
    default: 'bg-dark-700 text-dark-200 border-dark-600',
    success: 'badge-success',
    danger: 'badge-danger',
    warning: 'badge-warning',
    info: 'badge-info',
    primary: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
    secondary: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-lg border',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export default Badge
