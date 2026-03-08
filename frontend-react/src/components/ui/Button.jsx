import { forwardRef } from 'react'
import { cn } from '../../utils/helpers'
import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'px-6 py-3 bg-danger-500 text-white font-semibold rounded-xl hover:bg-danger-600 active:scale-[0.98] transition-all duration-200',
  success: 'px-6 py-3 bg-success-500 text-white font-semibold rounded-xl hover:bg-success-600 active:scale-[0.98] transition-all duration-200',
  outline: 'px-6 py-3 bg-transparent border-2 border-primary-500 text-primary-400 font-semibold rounded-xl hover:bg-primary-500/10 active:scale-[0.98] transition-all duration-200',
}

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
  icon: 'p-2.5',
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
        (isLoading || disabled) && 'opacity-60 cursor-not-allowed',
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
