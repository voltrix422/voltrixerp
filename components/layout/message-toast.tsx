"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { notifyMessagesChanged } from "@/components/layout/use-unread-messages"

type ConversationSummary = {
  partnerId: string
  text: string
  createdAt: string
  unreadCount: number
  senderName?: string
  partnerName?: string
}

type ToastItem = {
  id: string
  partnerId: string
  name: string
  text: string
}

type ErpUserRow = { id: string; name: string }

export function MessageToastListener() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const knownUnreadRef = useRef<Map<string, number>>(new Map())
  const primedRef = useRef(false)
  const namesRef = useRef<Map<string, string>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/db/users")
        const data = (await res.json()) as ErpUserRow[]
        if (cancelled || !Array.isArray(data)) return
        const map = new Map<string, string>()
        for (const u of data) map.set(String(u.id), String(u.name || "User"))
        namesRef.current = map
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    // Don't toast while already on Messages — the chat UI handles it
    if (pathname?.startsWith("/messages")) return

    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`/api/db/messages?userId=${encodeURIComponent(user!.id)}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as ConversationSummary[]
        if (!Array.isArray(data) || cancelled) return

        const next = new Map<string, number>()
        for (const c of data) {
          const count = Number(c.unreadCount) || 0
          next.set(c.partnerId, count)
          const prev = knownUnreadRef.current.get(c.partnerId) || 0
          if (primedRef.current && count > prev) {
            notifyMessagesChanged()
            const name =
              (c.partnerName && c.partnerName.trim()) ||
              (c.senderName && c.senderName.trim()) ||
              namesRef.current.get(c.partnerId) ||
              "New message"
            const id = `${c.partnerId}-${c.createdAt}-${count}`
            setToasts(prevToasts => {
              if (prevToasts.some(t => t.partnerId === c.partnerId && t.text === c.text)) {
                return prevToasts
              }
              return [
                {
                  id,
                  partnerId: c.partnerId,
                  name,
                  text: c.text,
                },
                ...prevToasts,
              ].slice(0, 3)
            })
          }
        }
        knownUnreadRef.current = next
        primedRef.current = true
      } catch {
        /* ignore */
      }
    }

    void poll()
    const interval = setInterval(() => void poll(), 6000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user?.id, pathname])

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map(t =>
      setTimeout(() => dismiss(t.id), 8000),
    )
    return () => timers.forEach(clearTimeout)
  }, [toasts, dismiss])

  if (!user || toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(100vw-2rem,340px)] pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="relative pointer-events-auto rounded-xl border bg-[hsl(var(--card))] shadow-lg overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200"
        >
          <Link
            href={`/messages?with=${encodeURIComponent(t.partnerId)}`}
            onClick={() => dismiss(t.id)}
            className="flex gap-3 p-3 hover:bg-[hsl(var(--accent))]/40 transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-[#1faca6]/20 text-[#0d6b67] flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0d6b67]">
                New message
              </p>
              <p className="text-sm font-semibold truncate">{t.name}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mt-0.5">
                {t.text}
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
