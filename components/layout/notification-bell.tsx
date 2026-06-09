"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, ExternalLink } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications"
import { cn } from "@/lib/utils"

const TYPE_DOT: Record<string, string> = {
  info: "bg-blue-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  error: "bg-red-500",
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function NotificationBell() {
  const { user } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    if (!user?.id) return
    const [list, count] = await Promise.all([
      fetchNotifications(user.id),
      fetchUnreadCount(user.id),
    ])
    setItems(list)
    setUnread(count)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [user?.id, refresh])

  useEffect(() => {
    if (open && user?.id) {
      setLoading(true)
      refresh().finally(() => setLoading(false))
    }
  }, [open, user?.id, refresh])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function handleClick(n: AppNotification) {
    if (!n.read) {
      await markNotificationRead(n.id)
      setItems(prev => prev.map(i => (i.id === n.id ? { ...i, read: true } : i)))
      setUnread(c => Math.max(0, c - 1))
    }
    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  async function handleMarkAll() {
    if (!user?.id) return
    await markAllNotificationsRead(user.id)
    setItems(prev => prev.map(i => ({ ...i, read: true })))
    setUnread(0)
  }

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer"
        aria-label={`${unread} unread notifications`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border bg-[hsl(var(--card))] shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-xs font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="px-3 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">Loading...</p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">No notifications yet</p>
            )}
            {!loading && items.map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className={cn(
                  "flex w-full items-start gap-2 border-b px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--accent))] cursor-pointer last:border-b-0",
                  !n.read && "bg-[hsl(var(--accent))]/40",
                )}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TYPE_DOT[n.type] || TYPE_DOT.info)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-snug">{n.title}</p>
                  {n.message && (
                    <p className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))] line-clamp-2">{n.message}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{timeAgo(n.createdAt)}</span>
                    {n.link && <ExternalLink className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))]" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
