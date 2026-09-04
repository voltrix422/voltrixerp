"use client"

import { useEffect, useState } from "react"
import { BellRing, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  desktopNotificationPermission,
  requestDesktopNotificationPermission,
  unlockNotificationAudio,
} from "@/lib/notification-alerts"

const DISMISS_KEY = "voltrix-desktop-alerts-dismissed"

export function NotificationAlertSetup() {
  const { user } = useAuth()
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!user?.id) return

    function unlock() {
      unlockNotificationAudio()
    }

    document.addEventListener("pointerdown", unlock, { once: true })
    document.addEventListener("keydown", unlock, { once: true })

    const permission = desktopNotificationPermission()
    const dismissed =
      typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1"
    if (permission === "default" && !dismissed) {
      setShowBanner(true)
    }

    return () => {
      document.removeEventListener("pointerdown", unlock)
      document.removeEventListener("keydown", unlock)
    }
  }, [user?.id])

  if (!user || !showBanner) return null

  async function enableAlerts() {
    unlockNotificationAudio()
    await requestDesktopNotificationPermission()
    setShowBanner(false)
  }

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // ignore
    }
    setShowBanner(false)
  }

  return (
    <div className="fixed bottom-4 left-4 z-[100] w-[min(100vw-2rem,360px)]">
      <div className="relative rounded-xl border bg-[hsl(var(--card))] shadow-lg p-3 pr-9">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-full bg-[#1faca6]/15 text-[#0d6b67] flex items-center justify-center shrink-0">
            <BellRing className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Hear new notifications</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Allow alerts so a sound and desktop popup still appear when this tab is open in the background.
            </p>
            <button
              type="button"
              onClick={() => void enableAlerts()}
              className="mt-2 h-8 rounded-md bg-[#1a9f9a] px-3 text-xs font-medium text-white hover:bg-[#158a85]"
            >
              Enable alerts
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
