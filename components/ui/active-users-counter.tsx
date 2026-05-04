"use client"
import { useState, useEffect } from "react"
import { Users, Activity, Wifi, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ActiveUsersCounterProps {
  className?: string
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
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
      const response = await fetch('/api/active-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setActiveCount(data.count)
        setSessionId(data.sessionId)
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

  // Fetch current active users count
  const fetchActiveUsers = async () => {
    try {
      const response = await fetch('/api/active-users')
      if (response.ok) {
        const data = await response.json()
        setActiveCount(data.count)
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

  // Remove user from active list on unmount
  const removeActivity = async () => {
    if (sessionId) {
      try {
        await fetch('/api/active-users', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
          },
        })
      } catch (error) {
        console.error('Failed to remove activity:', error)
      }
    }
  }

  useEffect(() => {
    // Initial registration
    updateActivity()

    // Update activity every 30 seconds
    const activityInterval = setInterval(updateActivity, 30000)

    // Fetch count every 10 seconds for more responsive updates
    const countInterval = setInterval(fetchActiveUsers, 10000)

    // Cleanup on unmount
    return () => {
      clearInterval(activityInterval)
      clearInterval(countInterval)
      removeActivity()
    }
  }, [sessionId])

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

  return (
    <div className={`inline-flex items-center rounded-full border bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]/10 transition-colors ${config.containerClass} ${className}`}>
      <div className="flex items-center gap-1.5">
        {isOnline ? (
          <Wifi className={`${config.iconClass} text-green-500`} />
        ) : (
          <WifiOff className={`${config.iconClass} text-red-500`} />
        )}
        <Users className={`${config.iconClass} text-[hsl(var(--foreground))]`} />
        <Badge 
          variant={activeCount > 0 ? "default" : "secondary"} 
          className={config.badgeClass}
        >
          {activeCount}
        </Badge>
        {showLabel && (
          <span className="text-[hsl(var(--foreground))] font-medium">
            Active
          </span>
        )}
      </div>
    </div>
  )
}
