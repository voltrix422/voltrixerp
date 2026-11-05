"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck, MessageSquare } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { notifyMessagesChanged, useUnreadMessages } from "@/components/layout/use-unread-messages"
import { NavTooltip } from "@/components/ui/nav-tooltip"
import { cn } from "@/lib/utils"

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function displayName(c: { partnerName?: string; senderName?: string }) {
  return (c.partnerName || c.senderName || "User").trim() || "User"
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function UnreadMessagesBadge({ className }: { className?: string }) {
  const { unread } = useUnreadMessages()
  if (unread <= 0) return null
  return (
    <span
      className={cn(
        "ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1d1d1f] px-1 text-[9px] font-semibold text-white dark:bg-white dark:text-[#1d1d1f]",
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

  const unreadItems = conversations.filter((c) => (c.unreadCount || 0) > 0)
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
      <NavTooltip label="Messages">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors cursor-pointer"
          aria-label={unread > 0 ? `${unread} unread messages` : "Messages"}
          title="Messages"
        >
          <MessageSquare className="h-[15px] w-[15px]" strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#0071e3] px-0.5 text-[9px] font-semibold text-white tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </NavTooltip>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-[280px] overflow-hidden rounded-[14px] border border-black/[0.08] bg-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-[hsl(var(--card))]/80">
          <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
            <p className="text-[12px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              Messages
            </p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAll()}
                  disabled={marking}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" strokeWidth={1.75} />
                  Read all
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  router.push("/messages")
                }}
                className="text-[10px] font-semibold text-[#0071e3] hover:opacity-80 transition-opacity cursor-pointer"
              >
                Inbox
              </button>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto px-1.5 pb-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/8">
                  <MessageSquare className="h-4 w-4 text-[#aeaeb2]" strokeWidth={1.75} />
                </span>
                <p className="text-[12px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                  No messages
                </p>
                <p className="mt-1 text-[11px] text-[#86868b] max-w-[180px]">
                  Conversations with your team will show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {items.map((c) => {
                  const name = displayName(c)
                  const hasUnread = (c.unreadCount || 0) > 0
                  return (
                    <button
                      key={c.partnerId}
                      type="button"
                      onClick={() => void openChat(c.partnerId)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors cursor-pointer",
                        hasUnread
                          ? "bg-black/[0.04] dark:bg-white/8"
                          : "hover:bg-black/[0.04] dark:hover:bg-white/5",
                      )}
                    >
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d2d2d7] text-[10px] font-semibold text-[#1d1d1f] dark:bg-white/15 dark:text-white">
                        {initials(name)}
                        {hasUnread && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#0071e3]" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              "text-[12px] truncate text-[#1d1d1f] dark:text-[hsl(var(--foreground))]",
                              hasUnread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {name}
                          </p>
                          <span className="shrink-0 text-[10px] tabular-nums text-[#aeaeb2]">
                            {timeAgo(c.createdAt)}
                          </span>
                        </div>
                        {c.text && (
                          <p className="mt-0.5 text-[11px] text-[#86868b] truncate">{c.text}</p>
                        )}
                      </div>
                    </button>
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
