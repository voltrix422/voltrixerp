"use client"
import { useEffect, useState } from "react"
import { Wifi, WifiOff } from "lucide-react"
import { NavTooltip } from "@/components/ui/nav-tooltip"

export function DBStatusIndicator() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [])

  async function checkConnection() {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000),
      )
      const healthPromise = fetch("/api/health").then((r) => r.ok)
      const ok = (await Promise.race([healthPromise, timeoutPromise])) as boolean
      setIsConnected(ok)
    } catch {
      setIsConnected(false)
    }
  }

  if (isConnected === null) return null

  const label = isConnected ? "Database online" : "Database offline"

  return (
    <NavTooltip label={label}>
      <button
        type="button"
        className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors cursor-pointer"
        onClick={() => void checkConnection()}
        title={label}
        aria-label={label}
      >
        {isConnected ? (
          <Wifi className="h-[15px] w-[15px] text-[#34c759]" strokeWidth={1.75} />
        ) : (
          <WifiOff className="h-[15px] w-[15px] text-[#ff3b30]" strokeWidth={1.75} />
        )}
      </button>
    </NavTooltip>
  )
}
