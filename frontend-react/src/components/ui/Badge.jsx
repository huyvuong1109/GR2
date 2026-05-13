import { cn } from '../../utils/helpers'

export function Badge({ children, variant = 'default', size = 'md', className, ...props }) {
  const variants = {
    default: 'badge-neutral',
    success: 'badge-success',
    danger: 'badge-danger',
    warning: 'badge-warning',
    info: 'badge-info',
    primary: 'bg-emerald-400/10 text-emerald-300 border-emerald-300/25',
    secondary: 'bg-slate-400/10 text-slate-300 border-white/10',
    outline: 'bg-transparent text-slate-300 border-white/10',
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
