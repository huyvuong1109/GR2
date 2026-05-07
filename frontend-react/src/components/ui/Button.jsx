import { forwardRef } from 'react'
import { cn } from '../../utils/helpers'
import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  success: 'btn-success',
  ghost: 'btn-ghost',
  danger: 'px-5 py-2.5 bg-red-700 text-slate-900 font-medium rounded-lg hover:bg-red-800 active:bg-red-900 transition-colors duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
  outline: 'px-5 py-2.5 bg-transparent border border-navy-300 text-navy-700 font-medium rounded-lg hover:bg-navy-50 hover:border-navy-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-6 py-3 text-lg',
  icon: 'p-2',
}

const Button = forwardRef(({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        variants[variant],
        size !== 'md' && sizes[size],
        'inline-flex items-center justify-center gap-2',
        (isLoading || disabled) && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
