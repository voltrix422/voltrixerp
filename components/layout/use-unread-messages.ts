"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"

export type ChatConversation = {
  partnerId: string
  partnerName?: string
  senderName?: string
  text: string
  createdAt: string
  unreadCount: number
}

export function useUnreadMessages(pollMs = 8000) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/db/messages?userId=${encodeURIComponent(user.id)}`)
      if (!res.ok) return
      const data = (await res.json()) as ChatConversation[]
      if (!Array.isArray(data)) return
      setConversations(data)
      setUnread(data.reduce((s, c) => s + (Number(c.unreadCount) || 0), 0))
    } catch {
      /* ignore */
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setConversations([])
      setUnread(0)
      return
    }
    void refresh()
    const interval = setInterval(() => void refresh(), pollMs)
    function onChanged() {
      void refresh()
    }
    window.addEventListener("erp-messages-changed", onChanged)
    return () => {
      clearInterval(interval)
      window.removeEventListener("erp-messages-changed", onChanged)
    }
  }, [user?.id, refresh, pollMs])

  return { conversations, unread, refresh, userId: user?.id }
}

export function notifyMessagesChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("erp-messages-changed"))
}
