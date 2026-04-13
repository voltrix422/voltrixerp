"use client"
import { CheckCircle2, X } from "lucide-react"
import { useEffect } from "react"

interface SuccessNotificationProps {
  isOpen: boolean
  title: string
  message: string
  onClose: () => void
  autoClose?: boolean
  autoCloseDelay?: number
}

export function SuccessNotification({
  isOpen,
  title,
  message,
  onClose,
  autoClose = true,
  autoCloseDelay = 3000
}: SuccessNotificationProps) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose()
      }, autoCloseDelay)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Success Card */}
        <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 shadow-2xl overflow-hidden">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-6 w-6 rounded-full bg-white/80 dark:bg-black/40 hover:bg-white dark:hover:bg-black/60 flex items-center justify-center transition-colors z-10"
          >
            <X className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Content */}
          <div className="p-6 text-center">
            {/* Success Icon with Animation */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-green-400 dark:bg-green-600 rounded-full animate-ping opacity-20" />
                <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 dark:from-green-600 dark:to-emerald-700 flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="h-9 w-9 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-green-900 dark:text-green-100 mb-2">
              {title}
            </h3>

            {/* Message */}
            <p className="text-sm text-green-700 dark:text-green-300 leading-relaxed">
              {message}
            </p>

            {/* Progress Bar */}
            {autoClose && (
              <div className="mt-4 h-1 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 dark:from-green-600 dark:to-emerald-600 rounded-full animate-progress"
                  style={{
                    animation: `progress ${autoCloseDelay}ms linear forwards`
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-progress {
          animation: progress ${autoCloseDelay}ms linear forwards;
        }
      `}</style>
    </div>
  )
}
