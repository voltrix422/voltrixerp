"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { notifyMessagesChanged } from "@/components/layout/use-unread-messages"
import { Button } from "@/components/ui/button"
import { Check, CheckCheck, MessageSquare, Send, Search, Users } from "lucide-react"

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
  seen?: boolean
}

type ConversationSummary = {
  partnerId: string
  text: string
  createdAt: string
  unreadCount: number
  senderName?: string
  partnerName?: string
}

type SidebarTab = "chats" | "people"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function formatTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" })
}

function ReadTicks({ seen }: { seen?: boolean }) {
  if (seen) {
    return <CheckCheck className="h-3.5 w-3.5 inline-block ml-1 text-sky-200" aria-label="Seen" />
  }
  return <Check className="h-3.5 w-3.5 inline-block ml-1 text-white/70" aria-label="Sent" />
}

export function MessagesManager() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const withParam = String(searchParams.get("with") || "").trim()
  const [users, setUsers] = useState<ErpUserRow[]>([])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState("")
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chats")
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch("/api/db/users")
        const data = (await res.json()) as ErpUserRow[]
        setUsers(
          Array.isArray(data)
            ? data.map(u => ({
                id: String(u.id || ""),
                name: String(u.name || "User"),
                email: String(u.email || ""),
              }))
            : [],
        )
      } finally {
        setLoadingUsers(false)
      }
    }
    void loadUsers()
  }, [])

  useEffect(() => {
    if (withParam) {
      setSelectedUserId(withParam)
      setSidebarTab("chats")
    }
  }, [withParam])

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

  const otherUsers = useMemo(
    () => users.filter(u => u.id && u.id !== user?.id),
    [users, user?.id],
  )

  const userById = useMemo(() => {
    const map = new Map<string, ErpUserRow>()
    for (const u of otherUsers) map.set(u.id, u)
    return map
  }, [otherUsers])

  const q = search.trim().toLowerCase()

  const chatRows = useMemo(() => {
    return conversations
      .map(conv => ({
        user: userById.get(conv.partnerId) || {
          id: conv.partnerId,
          name: "User",
          email: "",
        },
        conv,
      }))
      .filter(({ user: u, conv }) => {
        if (!q) return true
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          conv.text.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => new Date(b.conv.createdAt).getTime() - new Date(a.conv.createdAt).getTime())
  }, [conversations, userById, q])

  const peopleRows = useMemo(() => {
    return otherUsers
      .filter(u =>
        !q
          ? true
          : u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [otherUsers, q])

  const selectedUser =
    otherUsers.find(u => u.id === selectedUserId) ||
    (selectedUserId
      ? { id: selectedUserId, name: "User", email: "" }
      : null)

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0)

  async function loadMessages(opts?: { silent?: boolean }) {
    if (!user?.id || !selectedUserId) return
    if (!opts?.silent) setLoadingMessages(true)
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
      notifyMessagesChanged()
      await loadConversations()
    } finally {
      if (!opts?.silent) setLoadingMessages(false)
    }
  }

  useEffect(() => {
    if (!selectedUserId) {
      setMessages([])
      return
    }
    void loadMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedUserId])

  useEffect(() => {
    if (!user?.id || !selectedUserId) return
    const timer = setInterval(() => {
      void loadMessages({ silent: true })
    }, 4000)
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
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, selectedUserId, loadingMessages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id || !selectedUser || !text.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/db/messages", {
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to send")
      }
      setText("")
      setSidebarTab("chats")
      notifyMessagesChanged()
      await loadMessages({ silent: true })
      await loadConversations()
    } finally {
      setSending(false)
    }
  }

  function openChat(userId: string) {
    setSelectedUserId(userId)
    setSidebarTab("chats")
  }

  if (!user) return null

  return (
    <div className="rounded-xl border bg-[hsl(var(--card))] h-[calc(100vh-10rem)] min-h-[420px] overflow-hidden shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] h-full">
        <div className="border-r bg-[hsl(var(--muted))]/10 flex flex-col min-h-0">
          <div className="p-3 border-b space-y-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Messages</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  Chat with ERP users
                </p>
              </div>
              {totalUnread > 0 && (
                <span className="h-5 min-w-5 rounded-full bg-[#1faca6] px-1.5 text-[10px] text-white flex items-center justify-center font-semibold">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <div className="flex rounded-md border p-0.5 bg-[hsl(var(--background))]">
              <button
                type="button"
                onClick={() => setSidebarTab("chats")}
                className={`flex-1 inline-flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  sidebarTab === "chats"
                    ? "bg-[#1faca6]/15 text-[#0d6b67]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                <MessageSquare className="h-3 w-3" />
                Chats
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("people")}
                className={`flex-1 inline-flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  sidebarTab === "people"
                    ? "bg-[#1faca6]/15 text-[#0d6b67]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                <Users className="h-3 w-3" />
                People
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={sidebarTab === "chats" ? "Search chats..." : "Search people..."}
                className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-1 min-h-0">
            {loadingUsers ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-2 py-3">Loading...</p>
            ) : sidebarTab === "chats" ? (
              chatRows.length === 0 ? (
                <div className="px-2 py-6 text-center">
                  <MessageSquare className="h-7 w-7 mx-auto mb-2 opacity-30" />
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No chats yet</p>
                  <button
                    type="button"
                    onClick={() => setSidebarTab("people")}
                    className="mt-2 text-[11px] text-[#0d6b67] underline cursor-pointer"
                  >
                    Start a conversation
                  </button>
                </div>
              ) : (
                chatRows.map(({ user: u, conv }) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openChat(u.id)}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                      selectedUserId === u.id
                        ? "border-[#1faca6]/50 bg-[#1faca6]/10"
                        : "bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]/30"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="h-8 w-8 rounded-full bg-[#1faca6]/20 text-[#0d6b67] text-[10px] font-bold flex items-center justify-center shrink-0">
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold truncate">{u.name}</p>
                          <span className="text-[9px] text-[hsl(var(--muted-foreground))] shrink-0">
                            {formatTime(conv.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                            {conv.text}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="h-4 min-w-4 rounded-full bg-[#1faca6] px-1 text-[10px] text-white flex items-center justify-center shrink-0">
                              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )
            ) : peopleRows.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] px-2 py-3">No users found.</p>
            ) : (
              peopleRows.map(u => {
                const conv = conversations.find(c => c.partnerId === u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openChat(u.id)}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                      selectedUserId === u.id
                        ? "border-[#1faca6]/50 bg-[#1faca6]/10"
                        : "bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-[hsl(var(--muted))]/50 text-[hsl(var(--muted-foreground))] text-[10px] font-bold flex items-center justify-center shrink-0">
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{u.name}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                          {conv ? "Continue chat" : u.email || "Start chat"}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex flex-col h-full min-h-0 bg-[hsl(var(--background))]">
          <div className="h-14 border-b px-4 flex items-center shrink-0 bg-[hsl(var(--card))]">
            {selectedUser ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-full bg-[#1faca6]/20 text-[#0d6b67] text-xs font-bold flex items-center justify-center shrink-0">
                  {initials(selectedUser.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedUser.name}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                    {selectedUser.email || "ERP user"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Select someone to start chatting
              </p>
            )}
          </div>

          <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-2.5 min-h-0">
            {!selectedUser ? (
              <div className="h-full flex items-center justify-center text-center text-[hsl(var(--muted-foreground))]">
                <div>
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-35" />
                  <p className="text-sm font-medium">User-to-user messages</p>
                  <p className="text-xs mt-1 max-w-[220px] mx-auto">
                    Open <span className="font-medium">People</span> to start a chat, or pick an existing chat on the left.
                  </p>
                </div>
              </div>
            ) : loadingMessages && messages.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading chat...</p>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    Say hello to {selectedUser.name.split(" ")[0]}
                  </p>
                </div>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] shadow-sm ${
                      m.mine
                        ? "bg-[#1faca6] text-white rounded-br-md"
                        : "bg-[hsl(var(--card))] border text-[hsl(var(--foreground))] rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-snug">{m.text}</p>
                    <p
                      className={`mt-1 text-[10px] flex items-center ${
                        m.mine ? "text-white/75 justify-end" : "text-[hsl(var(--muted-foreground))]"
                      }`}
                    >
                      <span>
                        {new Date(m.createdAt).toLocaleString("en-PK", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      {m.mine && <ReadTicks seen={!!m.seen} />}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={sendMessage}
            className="border-t p-3 flex items-center gap-2 shrink-0 bg-[hsl(var(--card))]"
          >
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={!selectedUser || sending}
              placeholder={selectedUser ? `Message ${selectedUser.name.split(" ")[0]}…` : "Select a person first"}
              className="flex-1 h-10 rounded-full border bg-[hsl(var(--background))] px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6] disabled:opacity-60"
            />
            <Button
              type="submit"
              size="sm"
              className="h-10 w-10 rounded-full p-0 bg-[#1faca6] hover:bg-[#17857f] text-white cursor-pointer"
              disabled={!selectedUser || !text.trim() || sending}
              title="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
