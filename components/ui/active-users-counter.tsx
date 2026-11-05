"use client"
import { useState, useEffect, useRef } from "react"
import { Users } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"

interface ActiveUsersCounterProps {
  className?: string
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
}

interface Visitor {
  sessionId: string
  lastSeen: number
  userAgent?: string
  ip?: string
  userId?: string | null
  userName?: string | null
  role?: string | null
  roleLabel?: string | null
}

export function ActiveUsersCounter({ className = "" }: ActiveUsersCounterProps) {
  const [activeCount, setActiveCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { user } = useAuth()

  const updateActivity = async () => {
    if (!user?.id || !user?.name) {
      setIsLoading(false)
      return
    }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (sessionIdRef.current) headers["x-session-id"] = sessionIdRef.current

      const response = await fetch("/api/active-users", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          role: user.role || "",
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setActiveCount(data.count)
        setSessionId(data.sessionId)
        sessionIdRef.current = data.sessionId
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }

  const fetchActiveUsers = async () => {
    try {
      const response = await fetch("/api/active-users")
      if (response.ok) {
        const data = await response.json()
        setActiveCount(data.count)
        setVisitors((data.visitors || []).filter((v: Visitor) => Boolean(v.userName)))
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }

  const removeActivity = async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      await fetch("/api/active-users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-session-id": sid },
      })
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void updateActivity()
    const activityInterval = setInterval(() => void updateActivity(), 30000)
    const countInterval = setInterval(() => void fetchActiveUsers(), 10000)
    return () => {
      clearInterval(activityInterval)
      clearInterval(countInterval)
      void removeActivity()
    }
  }, [user?.id, user?.name, user?.role])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void updateActivity()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  function openPanel() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    void fetchActiveUsers()
    setOpen(true)
  }

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 160)
  }

  function formatTimeAgo(timestamp: number) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    return `${Math.floor(minutes / 60)}h`
  }

  if (isLoading) {
    return (
      <div className={cn("inline-flex items-center justify-center h-7 w-7 rounded-full", className)}>
        <Users className="h-[15px] w-[15px] text-[#86868b] animate-pulse" strokeWidth={1.75} />
      </div>
    )
  }

  return (
    <div
      className="relative"
      ref={rootRef}
      onMouseEnter={openPanel}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={cn(
          "relative inline-flex items-center justify-center h-7 w-7 shrink-0 rounded-full text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors cursor-pointer",
          className,
        )}
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label="Active users"
        title="Online"
      >
        <Users className="h-[15px] w-[15px]" strokeWidth={1.75} />
        {activeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#34c759] px-0.5 text-[9px] font-semibold text-white tabular-nums">
            {activeCount > 9 ? "9+" : activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-[240px] overflow-hidden rounded-[14px] border border-black/[0.08] bg-white/95 shadow-[0_12px_40px_rgba(0,0,0,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-[hsl(var(--card))]/95">
          <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
            <p className="text-[12px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              Online
            </p>
            <span className="text-[11px] font-semibold tabular-nums text-[#86868b]">{visitors.length}</span>
          </div>

          <div className="max-h-[280px] overflow-y-auto px-1.5 pb-2">
            {visitors.length === 0 ? (
              <p className="px-2 py-6 text-center text-[11px] text-[#86868b]">Nobody online</p>
            ) : (
              <div className="space-y-0.5">
                {visitors.map((visitor) => {
                  const initials = (visitor.userName || "?")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                  return (
                    <div
                      key={visitor.sessionId}
                      className="flex items-center gap-2.5 rounded-[10px] px-2 py-2 hover:bg-black/[0.04] dark:hover:bg-white/5"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-[9px] font-semibold text-white">
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold truncate text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                          {visitor.userName}
                        </p>
                        <p className="text-[10px] text-[#86868b] truncate">
                          {visitor.roleLabel || "User"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-[#aeaeb2]">
                        {formatTimeAgo(visitor.lastSeen)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
