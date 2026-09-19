"use client"

import { useEffect, useState } from "react"
import { BellRing, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { unlockNotificationAudio } from "@/lib/notification-alerts"
import { subscribeUserToPush } from "@/lib/push-client"

const READY_KEY = "voltrix-phone-alerts-ready"

export function NotificationAlertSetup() {
  const { user } = useAuth()
  const [showBanner, setShowBanner] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    if (!user?.id) return

    function unlock() {
      unlockNotificationAudio()
    }

    document.addEventListener("pointerdown", unlock, { once: true })
    document.addEventListener("keydown", unlock, { once: true })

    const alreadyReady =
      typeof window !== "undefined" && window.localStorage.getItem(READY_KEY) === user.id
    if (alreadyReady) {
      void subscribeUserToPush(user.id)
    } else {
      setShowBanner(true)
    }

    return () => {
      document.removeEventListener("pointerdown", unlock)
      document.removeEventListener("keydown", unlock)
    }
  }, [user?.id])

  if (!user || !showBanner) return null

  async function enableAlerts() {
    if (!user?.id) return
    setBusy(true)
    unlockNotificationAudio()
    const result = await subscribeUserToPush(user.id)
    setStatus(result.message)
    if (result.ok) {
      try {
        localStorage.setItem(READY_KEY, user.id)
      } catch {
        // ignore
      }
      window.setTimeout(() => setShowBanner(false), 1200)
    }
    setBusy(false)
  }

  return (
    <div className="fixed bottom-4 left-4 z-[120] w-[min(100vw-2rem,360px)]">
      <div className="relative rounded-xl border bg-[hsl(var(--card))] shadow-lg p-3 pr-9">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-full bg-[#1faca6]/15 text-[#0d6b67] flex items-center justify-center shrink-0">
            <BellRing className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Turn on lock-screen alerts</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {status || "Tap Allow so this login gets notifications even when the ERP app is closed."}
            </p>
            <button
              type="button"
              onClick={() => void enableAlerts()}
              disabled={busy}
              className="mt-2 h-8 rounded-md bg-[#1a9f9a] px-3 text-xs font-medium text-white hover:bg-[#158a85] disabled:opacity-60"
            >
              {busy ? "Enabling..." : "Enable phone alerts"}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowBanner(false)}
          className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
