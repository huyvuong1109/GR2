import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../utils/helpers'

export default function Select({
  options = [],
  value,
  onChange,
  placeholder = 'Chọn...',
  label,
  error,
  className,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn('w-full', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-dark-200 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3 bg-dark-800/50 border border-dark-600 rounded-xl text-left transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500',
            isOpen && 'ring-2 ring-primary-500/50 border-primary-500',
            error && 'border-danger-500',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className={cn(
            'block truncate',
            selectedOption ? 'text-white' : 'text-dark-400'
          )}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className={cn(
            'w-4 h-4 text-dark-400 transition-transform',
            isOpen && 'rotate-180'
          )} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute z-[100] w-full mt-2 bg-dark-800 border border-dark-600 rounded-xl shadow-xl overflow-hidden"
            >
              <div className="max-h-60 overflow-auto py-2">
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      // Create event-like object for compatibility
                      const syntheticEvent = {
                        target: { value: option.value }
                      }
                      onChange(syntheticEvent)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors',
                      'hover:bg-dark-700',
                      option.value === value && 'bg-primary-500/10 text-primary-400'
                    )}
                  >
                    <span className="text-sm">{option.label}</span>
                    {option.value === value && (
                      <Check className="w-4 h-4 text-primary-400" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {error && (
        <p className="mt-2 text-sm text-danger-400">{error}</p>
      )}
    </div>
  )
}
