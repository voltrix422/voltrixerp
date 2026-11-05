"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications"
import {
  announceIncomingAlerts,
  requestDesktopNotificationPermission,
  unlockNotificationAudio,
} from "@/lib/notification-alerts"
import { NavTooltip } from "@/components/ui/nav-tooltip"
import { cn } from "@/lib/utils"

const TYPE_DOT: Record<string, string> = {
  info: "bg-[#007aff]",
  warning: "bg-[#ff9f0a]",
  success: "bg-[#34c759]",
  error: "bg-[#ff3b30]",
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
  const seenIdsRef = useRef<Set<string>>(new Set())
  const primedRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!user?.id) return
    const [list, count] = await Promise.all([
      fetchNotifications(user.id),
      fetchUnreadCount(user.id),
    ])
    void fetch("/api/db/todos/remind", { method: "POST" }).catch(() => {})
    const incoming = list.filter((n) => !n.read && !seenIdsRef.current.has(n.id))
    if (!primedRef.current) {
      primedRef.current = true
    } else if (incoming.length > 0) {
      announceIncomingAlerts(
        incoming.map((n) => ({
          title: n.title,
          body: n.message,
          link: n.link,
          tag: `erp-${n.id}`,
        })),
      )
      if (incoming.some((n) => String(n.link || "").includes("/todos"))) {
        window.dispatchEvent(new Event("voltrix-todos-refresh"))
      }
    }
    for (const n of list) seenIdsRef.current.add(n.id)
    if (seenIdsRef.current.size > 400) {
      seenIdsRef.current = new Set(list.map((n) => n.id))
    }
    setItems(list)
    setUnread(count)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    primedRef.current = false
    seenIdsRef.current = new Set()
    void refresh()
    const interval = setInterval(() => void refresh(), 8000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [user?.id, refresh])

  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return
    const nav = navigator as Navigator & {
      setAppBadge?: (count: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (unread > 0) void nav.setAppBadge?.(unread)
    else void nav.clearAppBadge?.()
  }, [unread])

  useEffect(() => {
    if (typeof document === "undefined") return
    const base = document.title.replace(/^\(\d+\)\s/, "")
    document.title = unread > 0 ? `(${unread}) ${base}` : base
  }, [unread])

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
    if (n.link && n.link.startsWith("/")) {
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
      <NavTooltip label="Notifications">
        <button
          type="button"
          onClick={() => {
            unlockNotificationAudio()
            void requestDesktopNotificationPermission()
            setOpen(v => !v)
          }}
          className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors cursor-pointer"
          aria-label={`${unread} unread notifications`}
          title="Notifications"
        >
          <Bell className="h-[15px] w-[15px]" strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#ff3b30] px-0.5 text-[9px] font-semibold text-white tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </NavTooltip>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-[340px] overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 shadow-[0_12px_40px_rgba(0,0,0,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-[hsl(var(--card))]/95">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
            <p className="text-[13px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              Notifications
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-[#007aff] hover:bg-black/[0.07] dark:bg-white/10 dark:hover:bg-white/15 cursor-pointer transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[min(420px,70vh)] overflow-y-auto px-2 pb-2">
            {loading && (
              <p className="px-2 py-10 text-center text-[12px] text-[#86868b]">Loading…</p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-2 py-10 text-center text-[12px] text-[#86868b]">
                No notifications yet
              </p>
            )}
            {!loading && items.length > 0 && (
              <div className="space-y-0.5">
                {items.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClick(n)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors cursor-pointer",
                      !n.read
                        ? "bg-[#007aff]/[0.06] hover:bg-[#007aff]/[0.1]"
                        : "hover:bg-black/[0.04] dark:hover:bg-white/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        TYPE_DOT[n.type] || TYPE_DOT.info,
                        n.read && "opacity-40",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-[12px] leading-snug tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]",
                            !n.read ? "font-semibold" : "font-medium",
                          )}
                        >
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[10px] tabular-nums text-[#86868b] pt-0.5">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      {n.message && (
                        <p className="mt-0.5 text-[11px] leading-snug text-[#6e6e73] dark:text-[hsl(var(--muted-foreground))] line-clamp-2">
                          {n.message}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
