"use client"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Info, AlertCircle } from "lucide-react"

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: "danger" | "warning" | "info"
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "danger"
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!isOpen || !mounted) return null

  const variantConfig = {
    danger: {
      icon: AlertCircle,
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
      button: "bg-red-600 hover:bg-red-700 text-white"
    },
    warning: {
      icon: AlertTriangle,
      iconBg: "bg-yellow-100 dark:bg-yellow-900/30",
      iconColor: "text-yellow-600 dark:text-yellow-400",
      button: "bg-yellow-600 hover:bg-yellow-700 text-white"
    },
    info: {
      icon: Info,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      button: "bg-blue-600 hover:bg-blue-700 text-white"
    }
  }

  const config = variantConfig[variant]
  const Icon = config.icon

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-[hsl(var(--card))] shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center pt-8 pb-4 px-6">
          <div className={`h-16 w-16 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}>
            <Icon className={`h-8 w-8 ${config.iconColor}`} strokeWidth={2.5} />
          </div>
          <h3 className="text-lg font-bold text-center">{title}</h3>
        </div>

        <div className="px-6 pb-6">
          <p className="text-sm text-center text-[hsl(var(--muted-foreground))] leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex items-center gap-3 px-6 pb-6">
          <Button
            size="sm"
            variant="outline"
            className="h-10 text-sm flex-1 font-medium cursor-pointer"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            size="sm"
            className={`h-10 text-sm flex-1 font-medium ${config.button} cursor-pointer`}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
