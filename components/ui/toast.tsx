"use client"
import { createContext, useContext, useState, useCallback, useEffect } from "react"
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react"

type ToastType = "success" | "error" | "info" | "warning"

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextType {
  toast: (opts: Omit<Toast, "id">) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />,
  error:   <XCircle className="h-4 w-4 text-red-500 shrink-0" />,
  info:    <Info className="h-4 w-4 text-blue-500 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
}

const borders: Record<ToastType, string> = {
  success: "border-l-emerald-500",
  error:   "border-l-red-500",
  info:    "border-l-blue-500",
  warning: "border-l-amber-500",
}

function ToastItem({ t, onRemove }: { t: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Animate in
    const show = setTimeout(() => setVisible(true), 10)
    // Start fade out before removal
    const hide = setTimeout(() => setVisible(false), (t.duration ?? 4000) - 300)
    const remove = setTimeout(() => onRemove(t.id), t.duration ?? 4000)
    return () => { clearTimeout(show); clearTimeout(hide); clearTimeout(remove) }
  }, [t.id, t.duration, onRemove])

  return (
    <div
      className={`flex items-start gap-3 w-80 rounded-lg border border-l-4 bg-[hsl(var(--card))] shadow-lg px-4 py-3 transition-all duration-300 ${borders[t.type]} ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className="mt-0.5">{icons[t.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-none">{t.title}</p>
        {t.message && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">{t.message}</p>}
      </div>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onRemove(t.id), 300) }}
        className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mt-0.5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((opts: Omit<Toast, "id">) => {
    const id = Date.now().toString() + Math.random()
    setToasts(prev => [...prev, { ...opts, id }])
  }, [])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast stack — bottom right */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
