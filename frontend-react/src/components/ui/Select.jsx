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
        <label className="block text-sm font-semibold text-slate-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-left transition-all',
            'focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60',
            isOpen && 'ring-2 ring-emerald-400/20 border-emerald-300/60',
            error && 'border-red-300/60',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className={cn(
            'block truncate',
            selectedOption ? 'text-slate-100' : 'text-slate-500'
          )}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className={cn(
            'w-4 h-4 text-slate-500 transition-transform',
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
              className="absolute z-[100] w-full mt-2 bg-[#191c1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
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
                      'w-full flex items-center justify-between px-4 py-2.5 text-left text-slate-300 transition-colors',
                      'hover:bg-white/5',
                      option.value === value && 'bg-emerald-400/10 text-emerald-300'
                    )}
                  >
                    <span className="text-sm">{option.label}</span>
                    {option.value === value && (
                      <Check className="w-4 h-4 text-emerald-300" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-300">{error}</p>
      )}
    </div>
  )
}
