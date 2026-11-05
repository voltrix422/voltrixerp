"use client"
import { useEffect, useState } from "react"
// DB health via /api/health (Prisma)
import { Wifi, WifiOff } from "lucide-react"

export function DBStatusIndicator() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [])

  async function checkConnection() {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("timeout")), 5000)
      )
      
      const healthPromise = fetch("/api/health").then(r => r.ok)
      
      const ok = await Promise.race([healthPromise, timeoutPromise]) as boolean
      
      setIsConnected(ok)
      setLastChecked(new Date())
    } catch {
      setIsConnected(false)
      setLastChecked(new Date())
    }
  }

  if (isConnected === null) return null

  return (
    <button
      type="button"
      className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={checkConnection}
      title="Click to check connection"
      aria-label={isConnected ? "Database connected" : "Database disconnected"}
    >
      {isConnected ? (
        <Wifi className="h-[15px] w-[15px] text-[#34c759]" strokeWidth={1.75} />
      ) : (
        <WifiOff className="h-[15px] w-[15px] text-[#ff3b30]" strokeWidth={1.75} />
      )}

      {showTooltip && (
        <div className="absolute right-0 top-8 z-50 whitespace-nowrap rounded-[10px] bg-[#1d1d1f] px-3 py-2 text-[10px] text-white shadow-lg">
          <div className="font-semibold mb-1">
            {isConnected ? "Connected" : "Disconnected"}
          </div>
          <div className="text-[9px] text-white/70">
            {lastChecked && `Last checked: ${lastChecked.toLocaleTimeString()}`}
          </div>
          <div className="text-[9px] text-white/70 mt-0.5">
            Click to check now
          </div>
        </div>
      )}
    </button>
  )
}
