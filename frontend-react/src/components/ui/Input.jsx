import { forwardRef } from 'react'
import { cn } from '../../utils/helpers'

const Input = forwardRef(({
  className,
  type = 'text',
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-dark-200 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'input-primary',
            leftIcon && 'pl-12',
            rightIcon && 'pr-12',
            error && 'border-danger-500 focus:ring-danger-500/50 focus:border-danger-500',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-danger-400">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-2 text-sm text-dark-400">{hint}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
