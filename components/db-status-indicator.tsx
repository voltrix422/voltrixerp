"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
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
      
      const queryPromise = supabase.from("erp_users").select("count", { count: "exact", head: true })
      
      const { error } = await Promise.race([queryPromise, timeoutPromise]) as any
      
      setIsConnected(!error)
      setLastChecked(new Date())
    } catch {
      setIsConnected(false)
      setLastChecked(new Date())
    }
  }

  if (isConnected === null) return null

  return (
    <div 
      className="relative flex items-center gap-1.5 cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={checkConnection}
      title="Click to check connection"
    >
      {isConnected ? (
        <Wifi className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-red-500" />
      )}
      
      {showTooltip && (
        <div className="absolute right-0 top-6 z-50 whitespace-nowrap rounded-md bg-[hsl(var(--popover))] px-3 py-2 text-[10px] text-[hsl(var(--popover-foreground))] shadow-lg border">
          <div className="font-semibold mb-1">
            {isConnected ? "✓ Connected" : "✗ Disconnected"}
          </div>
          <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
            {lastChecked && `Last checked: ${lastChecked.toLocaleTimeString()}`}
          </div>
          <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5">
            Click to check now
          </div>
        </div>
      )}
    </div>
  )
}
