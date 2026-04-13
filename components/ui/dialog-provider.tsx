"use client"
import { createContext, useContext, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Info, CheckCircle, XCircle, X } from "lucide-react"

type DialogType = "confirm" | "alert" | "success" | "error"

interface DialogOptions {
  type?: DialogType
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

interface DialogContextType {
  confirm: (opts: DialogOptions) => Promise<boolean>
  alert: (opts: Omit<DialogOptions, "cancelLabel">) => Promise<void>
}

const DialogContext = createContext<DialogContextType>({
  confirm: async () => false,
  alert: async () => {},
})

export function useDialog() {
  return useContext(DialogContext)
}

interface ActiveDialog extends DialogOptions {
  resolve: (val: boolean) => void
}

const icons: Record<DialogType, React.ReactNode> = {
  confirm: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  alert:   <Info className="h-5 w-5 text-blue-500" />,
  success: <CheckCircle className="h-5 w-5 text-emerald-500" />,
  error:   <XCircle className="h-5 w-5 text-red-500" />,
}

const confirmBtnClass: Record<DialogType, string> = {
  confirm: "bg-red-600 hover:bg-red-700 text-white",
  alert:   "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white",
  error:   "bg-red-600 hover:bg-red-700 text-white",
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<ActiveDialog | null>(null)

  const confirm = useCallback((opts: DialogOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setDialog({ ...opts, type: opts.type ?? "confirm", resolve })
    })
  }, [])

  const alert = useCallback((opts: Omit<DialogOptions, "cancelLabel">): Promise<void> => {
    return new Promise(resolve => {
      setDialog({
        ...opts,
        type: opts.type ?? "alert",
        resolve: () => resolve(),
      })
    })
  }, [])

  function handleConfirm() {
    dialog?.resolve(true)
    setDialog(null)
  }

  function handleCancel() {
    dialog?.resolve(false)
    setDialog(null)
  }

  const type = dialog?.type ?? "confirm"
  const isConfirm = type === "confirm"

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={handleCancel}>
          <div className="w-full max-w-sm rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{icons[type]}</div>
                <div>
                  <p className="text-sm font-semibold">{dialog.title}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">
                    {dialog.message}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-[hsl(var(--muted))]/20">
              {isConfirm && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleCancel}
                >
                  {dialog.cancelLabel ?? "Cancel"}
                </Button>
              )}
              <Button
                size="sm"
                className={`h-8 text-xs ${confirmBtnClass[type]}`}
                onClick={handleConfirm}
              >
                {dialog.confirmLabel ?? (isConfirm ? "Confirm" : "OK")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}
