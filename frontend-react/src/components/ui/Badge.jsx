import { cn } from '../../utils/helpers'

export function Badge({ children, variant = 'default', size = 'md', className, ...props }) {
  const variants = {
    default: 'badge-neutral',
    success: 'badge-success',
    danger: 'badge-danger',
    warning: 'badge-warning',
    info: 'badge-info',
    primary: 'bg-navy-100 text-navy-800 border-navy-300',
    secondary: 'bg-paper-200 text-paper-700 border-paper-300',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-md border',
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
