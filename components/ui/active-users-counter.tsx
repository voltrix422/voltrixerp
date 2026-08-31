"use client"
import { useState, useEffect, useRef } from "react"
import { Users, X, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"

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

export function ActiveUsersCounter({ 
  className = "", 
  showLabel = true,
  size = "sm"
}: ActiveUsersCounterProps) {
  const [activeCount, setActiveCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showVisitorsModal, setShowVisitorsModal] = useState(false)
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const { user } = useAuth()

  // Size configurations
  const sizeConfig = {
    sm: {
      containerClass: "h-7 px-2 gap-1.5 text-xs",
      iconClass: "h-3.5 w-3.5",
      badgeClass: "text-[10px] px-1 py-0"
    },
    md: {
      containerClass: "h-8 px-3 gap-2 text-sm",
      iconClass: "h-4 w-4",
      badgeClass: "text-xs px-1.5 py-0"
    },
    lg: {
      containerClass: "h-9 px-4 gap-2 text-base",
      iconClass: "h-5 w-5",
      badgeClass: "text-sm px-2 py-0.5"
    }
  }

  const config = sizeConfig[size]

  // Register/update user activity
  const updateActivity = async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (sessionIdRef.current) headers["x-session-id"] = sessionIdRef.current

      const response = await fetch("/api/active-users", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: user?.id || "",
          userName: user?.name || "",
          role: user?.role || "",
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        setActiveCount(data.count)
        setSessionId(data.sessionId)
        sessionIdRef.current = data.sessionId
        setIsOnline(true)
      } else {
        setIsOnline(false)
      }
    } catch (error) {
      console.error('Failed to update activity:', error)
      setIsOnline(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch current active users count and visitor list
  const fetchActiveUsers = async () => {
    try {
      const response = await fetch('/api/active-users')
      if (response.ok) {
        const data = await response.json()
        setActiveCount(data.count)
        setVisitors(data.visitors || [])
        setIsOnline(true)
      } else {
        setIsOnline(false)
      }
    } catch (error) {
      console.error('Failed to fetch active users:', error)
      setIsOnline(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Remove visitor
  const removeVisitor = async (visitorSessionId: string) => {
    try {
      await fetch('/api/active-users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': visitorSessionId,
        },
      })
      fetchActiveUsers()
    } catch (error) {
      console.error('Failed to remove visitor:', error)
    }
  }

  // Open visitors modal
  const openVisitorsModal = () => {
    fetchActiveUsers()
    setShowVisitorsModal(true)
  }

  // Remove user from active list on unmount
  const removeActivity = async () => {
    const sid = sessionIdRef.current
    if (sid) {
      try {
        await fetch('/api/active-users', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sid,
          },
        })
      } catch (error) {
        console.error('Failed to remove activity:', error)
      }
    }
  }

  useEffect(() => {
    updateActivity()

    const activityInterval = setInterval(updateActivity, 30000)
    const countInterval = setInterval(fetchActiveUsers, 10000)

    return () => {
      clearInterval(activityInterval)
      clearInterval(countInterval)
      removeActivity()
    }
    // Re-register when the ERP session user is known so the list shows the real name.
  }, [user?.id, user?.name, user?.role])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateActivity()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  if (isLoading) {
    return (
      <div className={`inline-flex items-center rounded-full border bg-[hsl(var(--background))] ${config.containerClass} ${className}`}>
        <div className="animate-pulse flex items-center gap-1.5">
          <Users className={config.iconClass} />
          <span className="text-[hsl(var(--muted-foreground))]">--</span>
        </div>
      </div>
    )
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  const formatUserAgent = (ua?: string) => {
    if (!ua) return "Unknown"
    if (ua.includes("Chrome")) return "Chrome"
    if (ua.includes("Firefox")) return "Firefox"
    if (ua.includes("Safari")) return "Safari"
    if (ua.includes("Edge")) return "Edge"
    return "Other"
  }

  return (
    <>
      <div 
        className={`inline-flex items-center rounded-full border bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]/10 transition-colors cursor-pointer ${config.containerClass} ${className}`}
        onClick={openVisitorsModal}
      >
        <div className="flex items-center gap-1.5">
          <Users className={`${config.iconClass} text-[hsl(var(--foreground))]`} />
          <Badge 
            variant="outline" 
            className={`${config.badgeClass} border-[hsl(var(--primary))] text-[hsl(var(--foreground))]`}
          >
            {activeCount}
          </Badge>
        </div>
      </div>

      {/* Visitors Modal */}
      {showVisitorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowVisitorsModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-[hsl(var(--foreground))]" />
                <p className="text-base font-semibold text-[hsl(var(--foreground))]">Active ERP users</p>
                <Badge variant="outline" className="text-xs">{visitors.length}</Badge>
              </div>
              <button onClick={() => setShowVisitorsModal(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {visitors.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-2" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No one is online in the ERP</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Except you (admin)</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visitors.map((visitor) => (
                    <div key={visitor.sessionId} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--foreground))] text-[hsl(var(--background))] text-[10px] font-semibold">
                            {(visitor.userName || "?")
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
                              {visitor.userName || "Unknown user"}
                            </p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                              {[visitor.roleLabel, formatUserAgent(visitor.userAgent)].filter(Boolean).join(" · ")}
                            </p>
                            {visitor.ip && visitor.ip !== "unknown" && (
                              <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] truncate">
                                {visitor.ip}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatTimeAgo(visitor.lastSeen)}</span>
                          <button
                            onClick={() => removeVisitor(visitor.sessionId)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove visitor"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-4 text-center">
                Auto-removed after 5 minutes of inactivity
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
