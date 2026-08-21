"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck, MessageSquare } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { notifyMessagesChanged, useUnreadMessages } from "@/components/layout/use-unread-messages"
import { cn } from "@/lib/utils"

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

function displayName(c: { partnerName?: string; senderName?: string }) {
  return (c.partnerName || c.senderName || "User").trim() || "User"
}

export function UnreadMessagesBadge({ className }: { className?: string }) {
  const { unread } = useUnreadMessages()
  if (unread <= 0) return null
  return (
    <span
      className={cn(
        "ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1faca6] px-1 text-[9px] font-bold text-white",
        className,
      )}
    >
      {unread > 9 ? "9+" : unread}
    </span>
  )
}

export function MessagesIcon() {
  const { user } = useAuth()
  const router = useRouter()
  const { conversations, unread, refresh } = useUnreadMessages()
  const [open, setOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const unreadItems = conversations.filter(c => (c.unreadCount || 0) > 0)
  const items = unreadItems.length > 0 ? unreadItems : conversations.slice(0, 8)

  async function openChat(partnerId: string) {
    setOpen(false)
    router.push(`/messages?with=${encodeURIComponent(partnerId)}`)
  }

  async function handleMarkAll() {
    if (!user?.id) return
    setMarking(true)
    try {
      await fetch("/api/db/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, all: true }),
      })
      notifyMessagesChanged()
      await refresh()
    } finally {
      setMarking(false)
    }
  }

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer"
        aria-label={unread > 0 ? `${unread} unread messages` : "Messages"}
        title="Messages"
      >
        <MessageSquare className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1faca6] px-0.5 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border bg-[hsl(var(--card))] shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-xs font-semibold">Messages</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAll()}
                  disabled={marking}
                  className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  router.push("/messages")
                }}
                className="text-[10px] font-medium text-[#0d6b67] hover:underline cursor-pointer"
              >
                Open inbox
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                No messages yet
              </p>
            )}
            {items.map(c => {
              const name = displayName(c)
              const hasUnread = (c.unreadCount || 0) > 0
              return (
                <button
                  key={c.partnerId}
                  type="button"
                  onClick={() => void openChat(c.partnerId)}
                  className={cn(
                    "flex w-full items-start gap-2 border-b px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--accent))] cursor-pointer last:border-b-0",
                    hasUnread && "bg-[hsl(var(--accent))]/40",
                  )}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1faca6]/15 text-[10px] font-semibold text-[#0d6b67]">
                    {name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium leading-snug truncate">{name}</p>
                      {hasUnread && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1faca6] px-1 text-[9px] font-bold text-white">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                    {c.text && (
                      <p className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))] line-clamp-2">
                        {c.text}
                      </p>
                    )}
                    <span className="mt-1 block text-[9px] text-[hsl(var(--muted-foreground))]">
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
