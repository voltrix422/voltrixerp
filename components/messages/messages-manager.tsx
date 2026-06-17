"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { MessageSquare, Send } from "lucide-react"

type ErpUserRow = {
  id: string
  name: string
  email: string
}

type ChatMessage = {
  id: string
  text: string
  senderId: string
  recipientId: string
  createdAt: string
  mine: boolean
}

type ConversationSummary = {
  partnerId: string
  text: string
  createdAt: string
  unreadCount: number
}

export function MessagesManager() {
  const { user } = useAuth()
  const [users, setUsers] = useState<ErpUserRow[]>([])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState("")
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch("/api/db/users")
        const data = (await res.json()) as ErpUserRow[]
        setUsers(Array.isArray(data) ? data : [])
      } finally {
        setLoadingUsers(false)
      }
    }
    void loadUsers()
  }, [])

  async function loadConversations() {
    if (!user?.id) return
    const params = new URLSearchParams({ userId: user.id })
    const res = await fetch(`/api/db/messages?${params.toString()}`)
    const data = (await res.json()) as ConversationSummary[]
    setConversations(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    void loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const contacts = useMemo(() => {
    const currentId = user?.id
    const q = search.trim().toLowerCase()
    return users
      .filter((u) => u.id !== currentId)
      .filter((u) =>
        !q
          ? true
          : u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q),
      )
  }, [users, user?.id, search])

  const contactRows = useMemo(() => {
    const convMap = new Map(conversations.map((c) => [c.partnerId, c]))
    return contacts
      .map((u) => ({ user: u, conv: convMap.get(u.id) || null }))
      .sort((a, b) => {
        const at = a.conv ? new Date(a.conv.createdAt).getTime() : 0
        const bt = b.conv ? new Date(b.conv.createdAt).getTime() : 0
        return bt - at
      })
  }, [contacts, conversations])

  const selectedUser = users.find((u) => u.id === selectedUserId) || null

  async function loadMessages() {
    if (!user?.id || !selectedUserId) return
    setLoadingMessages(true)
    try {
      const params = new URLSearchParams({ userId: user.id, partnerId: selectedUserId })
      const res = await fetch(`/api/db/messages?${params.toString()}`)
      const data = (await res.json()) as ChatMessage[]
      setMessages(Array.isArray(data) ? data : [])
      await fetch("/api/db/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, partnerId: selectedUserId }),
      })
      await loadConversations()
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    void loadMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedUserId])

  useEffect(() => {
    if (!user?.id || !selectedUserId) return
    const timer = setInterval(() => {
      void loadMessages()
    }, 5000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedUserId])

  useEffect(() => {
    const timer = setInterval(() => {
      void loadConversations()
    }, 5000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!selectedUserId && contactRows.length > 0) {
      setSelectedUserId(contactRows[0].user.id)
    }
  }, [contactRows, selectedUserId])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, selectedUserId, loadingMessages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id || !selectedUser || !text.trim()) return
    setSending(true)
    try {
      await fetch("/api/db/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: user.id,
          senderName: user.name,
          recipientId: selectedUser.id,
          recipientName: selectedUser.name,
          text: text.trim(),
        }),
      })
      setText("")
      await loadMessages()
      await loadConversations()
    } finally {
      setSending(false)
    }
  }

  if (!user) return null

  return (
    <div className="rounded-xl border bg-[hsl(var(--card))] h-[calc(100vh-11rem)] overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] h-full">
        <div className="border-r bg-[hsl(var(--muted))]/15 flex flex-col">
          <div className="p-3 border-b">
            <p className="text-sm font-semibold">Messages</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
              Use user ID, name, or email to find people.
            </p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="mt-2 w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]"
            />
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {loadingUsers ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-2 py-3">Loading users...</p>
            ) : contactRows.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-2 py-3">No users found.</p>
            ) : (
              contactRows.map(({ user: u, conv }) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    selectedUserId === u.id
                      ? "border-[#1faca6]/50 bg-[#1faca6]/10"
                      : "bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{u.name}</p>
                    {conv && conv.unreadCount > 0 && (
                      <span className="h-4 min-w-4 rounded-full bg-[#1faca6] px-1 text-[10px] text-white flex items-center justify-center">
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{u.email}</p>
                  <p className="text-[10px] text-[#0d6b67] truncate">ID: {u.id}</p>
                  {conv && (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate mt-1">{conv.text}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col h-full">
          <div className="h-12 border-b px-4 flex items-center justify-between">
            {selectedUser ? (
              <div>
                <p className="text-sm font-semibold">{selectedUser.name}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{selectedUser.email}</p>
              </div>
            ) : (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Select a user to start chat.</p>
            )}
          </div>

          <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-2 bg-[hsl(var(--background))]">
            {!selectedUser ? (
              <div className="h-full flex items-center justify-center text-center text-[hsl(var(--muted-foreground))]">
                <div>
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Choose a user from the left.</p>
                </div>
              </div>
            ) : loadingMessages ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading chat...</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">No messages yet.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                      m.mine
                        ? "bg-[#1faca6] text-white"
                        : "bg-[hsl(var(--muted))]/40 text-[hsl(var(--foreground))]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`mt-1 text-[10px] ${m.mine ? "text-white/80" : "text-[hsl(var(--muted-foreground))]"}`}>
                      {new Date(m.createdAt).toLocaleString("en-PK", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={sendMessage} className="border-t p-3 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!selectedUser}
              placeholder={selectedUser ? "Type a message..." : "Select a user first"}
              className="flex-1 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6] disabled:opacity-60"
            />
            <Button
              type="submit"
              size="sm"
              className="h-9 bg-[#1faca6] hover:bg-[#17857f] text-white"
              disabled={!selectedUser || !text.trim() || sending}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

