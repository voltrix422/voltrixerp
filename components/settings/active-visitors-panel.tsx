"use client"
import { useState, useEffect } from "react"
import { Users, Wifi, WifiOff, RefreshCw, Trash2, Globe, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Visitor {
  sessionId: string
  lastSeen: number
  userAgent?: string
  ip?: string
}

export function ActiveVisitorsPanel() {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)

  const fetchVisitors = async () => {
    try {
      const res = await fetch('/api/active-users')
      if (res.ok) {
        const data = await res.json()
        setVisitors(data.visitors || [])
        setIsOnline(data.active)
      } else {
        setIsOnline(false)
      }
    } catch (error) {
      console.error('Failed to fetch visitors:', error)
      setIsOnline(false)
    } finally {
      setLoading(false)
    }
  }

  const removeVisitor = async (sessionId: string) => {
    try {
      await fetch('/api/active-users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
      })
      fetchVisitors()
    } catch (error) {
      console.error('Failed to remove visitor:', error)
    }
  }

  useEffect(() => {
    fetchVisitors()
    const interval = setInterval(fetchVisitors, 10000)
    return () => clearInterval(interval)
  }, [])

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
    // Simple browser detection
    if (ua.includes("Chrome")) return "Chrome"
    if (ua.includes("Firefox")) return "Firefox"
    if (ua.includes("Safari")) return "Safari"
    if (ua.includes("Edge")) return "Edge"
    return "Other"
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading visitors...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            <Users className="h-5 w-5 text-[hsl(var(--foreground))]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Active Visitors</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {visitors.length} visitor{visitors.length !== 1 ? 's' : ''} online
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={fetchVisitors}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {visitors.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Users className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No active visitors</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[hsl(var(--muted))]/40 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Browser</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Last Seen</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[hsl(var(--muted-foreground))]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visitors.map((visitor) => (
                <tr key={visitor.sessionId} className="hover:bg-[hsl(var(--muted))]/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      <span className="font-mono text-xs">{visitor.ip || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--foreground))]">
                    {formatUserAgent(visitor.userAgent)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(visitor.lastSeen)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeVisitor(visitor.sessionId)}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Visitors are automatically removed after 5 minutes of inactivity.
      </p>
    </div>
  )
}
