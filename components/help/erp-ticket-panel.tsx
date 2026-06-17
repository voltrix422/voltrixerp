"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Ticket } from "lucide-react"

type TicketStatus = "open" | "in_progress" | "resolved" | "closed"
type TicketPriority = "low" | "medium" | "high" | "urgent"

type TicketRow = {
  id: string
  ticketNumber: string
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  createdAt: string
  createdBy?: string
  customerEmail?: string
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
}

const STATUS_VARIANT: Record<TicketStatus, "success" | "warning" | "info" | "destructive"> = {
  open: "info",
  in_progress: "warning",
  resolved: "success",
  closed: "destructive",
}

export function ErpTicketPanel() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TicketPriority>("medium")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function loadTickets() {
    try {
      setLoading(true)
      const res = await fetch("/api/db/tickets")
      const data = (await res.json()) as TicketRow[]
      setTickets(Array.isArray(data) ? data : [])
    } catch {
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTickets()
  }, [])

  const myTickets = useMemo(() => {
    if (!user) return []
    const email = user.email.toLowerCase()
    const name = user.name.toLowerCase()
    return tickets
      .filter(
        (t) =>
          (t.customerEmail || "").toLowerCase() === email ||
          (t.createdBy || "").toLowerCase() === name,
      )
      .slice(0, 8)
  }, [tickets, user])

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!subject.trim() || !description.trim()) return
    setSaving(true)
    setMessage("")
    setError("")
    try {
      const res = await fetch("/api/db/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: user.name,
          customerEmail: user.email,
          customerPhone: "",
          subject: subject.trim(),
          description: description.trim(),
          priority,
          createdBy: user.name,
        }),
      })
      if (!res.ok) throw new Error("Failed to create ticket")
      setSubject("")
      setDescription("")
      setPriority("medium")
      setMessage("Ticket created. Admin can now review it.")
      await loadTickets()
    } catch {
      setError("Could not create ticket. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-[hsl(var(--card))]">
        <div className="px-5 py-4 border-b">
          <p className="text-sm font-semibold">Open ERP Support Ticket</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
            Report ERP issues here. Admin will see and manage your ticket.
          </p>
        </div>
        <form onSubmit={handleCreateTicket} className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Subject *</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Briefly describe the issue"
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Details *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Explain what happened, where, and any error text."
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6] resize-none"
              required
            />
          </div>
          {message && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {message}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
          <Button
            type="submit"
            size="sm"
            className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white"
            disabled={saving || !subject.trim() || !description.trim()}
          >
            {saving ? "Submitting..." : "Submit Ticket"}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border bg-[hsl(var(--card))]">
        <div className="px-5 py-4 border-b">
          <p className="text-sm font-semibold">My Recent Tickets</p>
        </div>
        <div className="p-4">
          {loading ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading...</p>
          ) : myTickets.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-[hsl(var(--muted-foreground))]">
              <Ticket className="h-5 w-5 mx-auto mb-2 opacity-50" />
              No tickets yet.
            </div>
          ) : (
            <div className="space-y-2">
              {myTickets.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border bg-[hsl(var(--background))] px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{t.ticketNumber} - {t.subject}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {new Date(t.createdAt).toLocaleDateString("en-PK")}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[t.status]} className="text-[10px] px-2 py-0.5 shrink-0">
                    {STATUS_LABELS[t.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

