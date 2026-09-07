"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  X,
  Search,
  Trash2,
  Ticket,
  Phone,
  Mail,
  Download,
  Wrench,
} from "lucide-react"
import { getTicketWorkflow, saveTicketWorkflow, type TicketWorkflow } from "@/lib/ticket-workflow"
import { generateTicketReportPDF } from "@/lib/generate-ticket-report"
import { AfterSaleItemPanel } from "@/components/tickets/after-sale-item-panel"

interface Ticket {
  id: string
  ticketNumber: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  subject: string
  description: string
  status: "open" | "in_progress" | "resolved" | "closed"
  priority: "low" | "medium" | "high" | "urgent"
  assignedTo?: string
  resolution?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
  createdBy?: string
}

const STATUS_LABELS: Record<Ticket["status"], string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
}

const STATUS_VARIANT: Record<Ticket["status"], "success" | "warning" | "info" | "destructive"> = {
  open: "info",
  in_progress: "warning",
  resolved: "success",
  closed: "destructive",
}

const PRIORITY_LABELS: Record<Ticket["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

const PRIORITY_VARIANT: Record<Ticket["priority"], "success" | "warning" | "info" | "destructive"> = {
  low: "success",
  medium: "info",
  high: "warning",
  urgent: "destructive",
}

const DIAGNOSIS_STAGES = [
  "Stage 1: Verify customer issue details and symptoms",
  "Stage 2: Check power/battery connections and basic health",
  "Stage 3: Run controller/BMS diagnostic checks",
  "Stage 4: Validate charging/discharging cycle behavior",
  "Stage 5: Perform final operational confirmation test",
]

export function TicketsManager() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewTicket, setViewTicket] = useState<Ticket | null>(null)
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("All")
  const [filterPriority, setFilterPriority] = useState("All")
  const [workflow, setWorkflow] = useState<TicketWorkflow | null>(null)
  const [savingWorkflow, setSavingWorkflow] = useState(false)
  const [detailTab, setDetailTab] = useState<"work" | "items">("work")

  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<Ticket["priority"]>("medium")

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/db/tickets")
        const ticketsData = await res.json()
        setTickets(Array.isArray(ticketsData) ? ticketsData : [])
      } catch (error) {
        console.error("Failed to load tickets:", error)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    async function loadWorkflow() {
      if (!viewTicket) {
        setWorkflow(null)
        return
      }
      const w = await getTicketWorkflow(viewTicket.id)
      setWorkflow(w)
      setDetailTab("work")
    }
    loadWorkflow()
  }, [viewTicket?.id])

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase()
    const matchSearch =
      !search ||
      t.ticketNumber.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      t.customerEmail.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q)
    const matchStatus = filterStatus === "All" || t.status === filterStatus
    const matchPriority = filterPriority === "All" || t.priority === filterPriority
    return matchSearch && matchStatus && matchPriority
  })

  function openEditForm(ticket: Ticket) {
    setEditingTicket(ticket)
    setCustomerName(ticket.customerName)
    setCustomerEmail(ticket.customerEmail)
    setCustomerPhone(ticket.customerPhone || "")
    setSubject(ticket.subject)
    setDescription(ticket.description)
    setPriority(ticket.priority)
    setShowForm(true)
    setViewTicket(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerName || !customerEmail || !subject || !description) return
    setSaving(true)

    try {
      if (editingTicket) {
        const res = await fetch("/api/db/tickets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingTicket.id,
            customerName,
            customerEmail,
            customerPhone,
            subject,
            description,
            priority,
            status: editingTicket.status,
            assignedTo: editingTicket.assignedTo,
            resolution: editingTicket.resolution,
          }),
        })
        if (!res.ok) throw new Error("Failed to update case")
        const updated = await res.json()
        setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      } else {
        const res = await fetch("/api/db/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName,
            customerEmail,
            customerPhone,
            subject,
            description,
            priority,
            createdBy: user?.name || "Unknown",
          }),
        })
        if (!res.ok) throw new Error("Failed to create case")
        const newTicket = await res.json()
        setTickets((prev) => [newTicket, ...prev])
      }
      resetForm()
    } catch (error) {
      console.error("Error saving ticket:", error)
      alert("Failed to save case. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setCustomerName("")
    setCustomerEmail("")
    setCustomerPhone("")
    setSubject("")
    setDescription("")
    setPriority("medium")
    setShowForm(false)
    setEditingTicket(null)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this after-sale case?")) return
    try {
      await fetch("/api/db/tickets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setTickets((prev) => prev.filter((t) => t.id !== id))
      if (viewTicket?.id === id) setViewTicket(null)
    } catch (error) {
      console.error("Failed to delete ticket:", error)
    }
  }

  async function handleStatusChange(ticket: Ticket, newStatus: Ticket["status"]) {
    try {
      const res = await fetch("/api/db/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticket.id,
          customerName: ticket.customerName,
          customerEmail: ticket.customerEmail,
          customerPhone: ticket.customerPhone,
          subject: ticket.subject,
          description: ticket.description,
          priority: ticket.priority,
          status: newStatus,
          assignedTo: ticket.assignedTo,
          resolution: ticket.resolution,
        }),
      })
      const updated = await res.json()
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      if (viewTicket?.id === updated.id) setViewTicket(updated)
    } catch (error) {
      console.error("Failed to update ticket status:", error)
    }
  }

  async function handleResolutionChange(ticket: Ticket, resolution: string) {
    try {
      const res = await fetch("/api/db/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticket.id,
          customerName: ticket.customerName,
          customerEmail: ticket.customerEmail,
          customerPhone: ticket.customerPhone,
          subject: ticket.subject,
          description: ticket.description,
          priority: ticket.priority,
          status: ticket.status,
          assignedTo: ticket.assignedTo,
          resolution,
        }),
      })
      const updated = await res.json()
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      if (viewTicket?.id === updated.id) setViewTicket(updated)
    } catch (error) {
      console.error("Failed to update ticket resolution:", error)
    }
  }

  async function saveWorkflowDraft(next: TicketWorkflow) {
    setSavingWorkflow(true)
    try {
      const ok = await saveTicketWorkflow(next)
      if (!ok) throw new Error("Failed to save workflow")
      setWorkflow(next)
    } catch (error) {
      console.error("Failed to save workflow:", error)
      alert("Failed to save workflow.")
    } finally {
      setSavingWorkflow(false)
    }
  }

  async function updateTicketStatus(ticket: Ticket, status: Ticket["status"]) {
    const res = await fetch("/api/db/tickets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: ticket.id,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        customerPhone: ticket.customerPhone,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        status,
        assignedTo: ticket.assignedTo,
        resolution: ticket.resolution,
      }),
    })
    if (!res.ok) throw new Error("Failed to update case status")
    const updated = await res.json()
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setViewTicket(updated)
    return updated as Ticket
  }

  async function closeTicketAndDownloadReport(ticket: Ticket, finalResolution: string) {
    const supportEngineerName = prompt("Enter support engineer name for report:", user?.name || "") || ""
    const updated = (await fetch("/api/db/tickets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: ticket.id,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        customerPhone: ticket.customerPhone,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        status: "closed",
        assignedTo: ticket.assignedTo,
        resolution: finalResolution,
      }),
    }).then((r) => r.json())) as Ticket

    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setViewTicket(updated)

    if (!workflow) return
    const blob = await generateTicketReportPDF({ ...updated, supportEngineerName }, workflow)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `After-Sale-Report-${updated.ticketNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const openCount = tickets.filter((t) => t.status === "open").length
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length
  const closedCount = tickets.filter((t) => t.status === "closed").length

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "N/A"
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Service cases</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Diagnose issues, escalate to ground staff, and close with a report.
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" /> New case
        </Button>
      </div>

      {tickets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Open", value: openCount, tone: "text-sky-700 dark:text-sky-300", status: "open" },
            {
              label: "In progress",
              value: inProgressCount,
              tone: "text-amber-700 dark:text-amber-300",
              status: "in_progress",
            },
            {
              label: "Resolved",
              value: resolvedCount,
              tone: "text-emerald-700 dark:text-emerald-300",
              status: "resolved",
            },
            {
              label: "Closed",
              value: closedCount,
              tone: "text-[hsl(var(--muted-foreground))]",
              status: "closed",
            },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setFilterStatus(s.status)}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-3 text-left hover:border-[#1a9f9a]/40 transition-colors"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {s.label}
              </p>
              <p className={`text-2xl font-semibold tabular-nums mt-0.5 ${s.tone}`}>{s.value}</p>
            </button>
          ))}
        </div>
      )}

      {tickets.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search case #, customer, subject…"
              className="w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-10 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a9f9a]"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
          >
            <option value="All">All status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
          >
            <option value="All">All priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          {(search || filterStatus !== "All" || filterPriority !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setFilterStatus("All")
                setFilterPriority("All")
              }}
              className="h-9 px-2.5 text-xs rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/10"
            >
              Clear
            </button>
          )}
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto">
            {filtered.length} of {tickets.length}
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[hsl(var(--border))] rounded-2xl bg-[hsl(var(--card))]">
          <div className="h-12 w-12 rounded-full bg-[#1a9f9a]/15 flex items-center justify-center mx-auto mb-3">
            <Wrench className="h-6 w-6 text-[#1a9f9a]" />
          </div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">No after-sale cases yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Create a case when a customer brings a battery or reports an issue.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-xs text-[hsl(var(--muted-foreground))] border border-dashed rounded-xl">
          No cases match your filters.
        </div>
      ) : (
        <div className="border border-[hsl(var(--border))] rounded-2xl overflow-hidden bg-[hsl(var(--card))]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/25">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Case
                  </th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setViewTicket(t)}
                    className="border-b border-[hsl(var(--border))] hover:bg-[#1a9f9a]/5 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3">
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{t.ticketNumber}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={PRIORITY_VARIANT[t.priority]} className="text-[9px] px-1.5 py-0">
                        {PRIORITY_LABELS[t.priority]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={STATUS_VARIANT[t.status]} className="text-[9px] px-1.5 py-0">
                        {STATUS_LABELS[t.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs text-[hsl(var(--foreground))]">{t.customerName}</p>
                      <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{t.customerEmail}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs text-[hsl(var(--foreground))] truncate max-w-[240px]">{t.subject}</p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{formatDate(t.createdAt)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(t.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={resetForm}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <div>
                <p className="text-base font-semibold">
                  {editingTicket ? "Edit case" : "New after-sale case"}
                </p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  Customer details and issue summary
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetForm}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Customer name *</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  placeholder="e.g. Danish Attock"
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Email *</label>
                  <input
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    required
                    type="email"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Phone</label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="03…"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Subject *</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  placeholder="e.g. BMS comm issue"
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Ticket["priority"])}
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="What is the customer reporting?"
                  className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1 h-10" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 bg-[#1a9f9a] hover:bg-[#158a85] text-white"
                  disabled={saving}
                >
                  {saving ? "Saving…" : editingTicket ? "Update case" : "Create case"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
          onClick={() => setViewTicket(null)}
        >
          <div
            className="w-full max-w-6xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[94vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-[hsl(var(--border))] shrink-0 bg-gradient-to-r from-[#1a9f9a]/10 to-transparent">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-[#1a9f9a]/15 flex items-center justify-center shrink-0">
                  <Ticket className="h-4 w-4 text-[#1a9f9a]" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold truncate">{viewTicket.ticketNumber}</p>
                    <Badge variant={PRIORITY_VARIANT[viewTicket.priority]} className="text-[9px] px-1.5 py-0">
                      {PRIORITY_LABELS[viewTicket.priority]}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[viewTicket.status]} className="text-[9px] px-1.5 py-0">
                      {STATUS_LABELS[viewTicket.status]}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                    {viewTicket.customerName} · {viewTicket.subject}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8" onClick={() => openEditForm(viewTicket)}>
                  Edit
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewTicket(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="flex gap-1 px-4 sm:px-5 pt-3 border-b border-[hsl(var(--border))] shrink-0">
              {(
                [
                  ["work", "Diagnosis & close"],
                  ["items", "Battery Item In / Out"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDetailTab(id)}
                  className={`px-3 py-2 text-xs font-medium relative ${
                    detailTab === id
                      ? "text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  {label}
                  {detailTab === id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-4 sm:p-5">
              {detailTab === "items" ? (
                <AfterSaleItemPanel
                  compact
                  actorName={user?.name || user?.email || "After Sale"}
                  tickets={tickets}
                  lockTicketId={viewTicket.id}
                  lockTicketNumber={viewTicket.ticketNumber}
                  lockCustomerName={viewTicket.customerName}
                  lockCustomerPhone={viewTicket.customerPhone}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-1 space-y-3">
                      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
                          Case overview
                        </p>
                        <p className="text-base font-bold">{viewTicket.subject}</p>
                        <p className="text-sm mt-2 whitespace-pre-wrap text-[hsl(var(--foreground))]/90">
                          {viewTicket.description}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                          Customer
                        </p>
                        <div className="flex items-center gap-2.5 text-sm">
                          <Mail className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                          <span className="truncate">{viewTicket.customerEmail}</span>
                        </div>
                        {viewTicket.customerPhone && (
                          <div className="flex items-center gap-2.5 text-sm">
                            <Phone className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                            <span>{viewTicket.customerPhone}</span>
                          </div>
                        )}
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] pt-1">
                          Created {formatDate(viewTicket.createdAt)}
                          {viewTicket.closedAt ? ` · Closed ${formatDate(viewTicket.closedAt)}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="xl:col-span-2 space-y-3">
                      <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2.5">
                          Status
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(["open", "in_progress", "resolved", "closed"] as const).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => handleStatusChange(viewTicket, status)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                                viewTicket.status === status
                                  ? "bg-[#1a9f9a] border-[#1a9f9a] text-white"
                                  : "bg-[hsl(var(--background))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/15"
                              }`}
                            >
                              {STATUS_LABELS[status]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {viewTicket.status !== "open" && (
                        <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
                            Resolution notes
                          </p>
                          <textarea
                            value={viewTicket.resolution || ""}
                            onChange={(e) => handleResolutionChange(viewTicket, e.target.value)}
                            rows={3}
                            placeholder="Add resolution notes…"
                            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a9f9a]"
                          />
                        </div>
                      )}

                      {workflow && (
                        <div className="rounded-xl border border-[hsl(var(--border))] p-4 space-y-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                            Diagnostic checklist
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {DIAGNOSIS_STAGES.map((stage) => {
                              const checked = workflow.diagnosisSteps.includes(stage)
                              return (
                                <label
                                  key={stage}
                                  className="flex items-start gap-2 text-xs rounded-lg border border-[hsl(var(--border))] p-2.5 cursor-pointer hover:bg-[hsl(var(--muted))]/10"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={checked}
                                    onChange={(e) => {
                                      const nextSteps = e.target.checked
                                        ? [...workflow.diagnosisSteps, stage]
                                        : workflow.diagnosisSteps.filter((s) => s !== stage)
                                      const next = { ...workflow, diagnosisSteps: nextSteps }
                                      setWorkflow(next)
                                      saveWorkflowDraft(next)
                                    }}
                                  />
                                  <span>{stage}</span>
                                </label>
                              )
                            })}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-medium mb-1">Findings</p>
                              <textarea
                                value={workflow.supportFindings}
                                onChange={(e) => setWorkflow({ ...workflow, supportFindings: e.target.value })}
                                onBlur={() => saveWorkflowDraft(workflow)}
                                rows={3}
                                placeholder="What was diagnosed?"
                                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs resize-none"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">Fix applied</p>
                              <textarea
                                value={workflow.supportFix}
                                onChange={(e) => setWorkflow({ ...workflow, supportFix: e.target.value })}
                                onBlur={() => saveWorkflowDraft(workflow)}
                                rows={3}
                                placeholder="What fix was applied?"
                                className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs resize-none"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={workflow.issueFound ? "default" : "outline"}
                              className={workflow.issueFound ? "bg-[#1a9f9a] hover:bg-[#158a85] text-white" : ""}
                              onClick={() => {
                                const next = { ...workflow, issueFound: !workflow.issueFound }
                                setWorkflow(next)
                                saveWorkflowDraft(next)
                              }}
                            >
                              {workflow.issueFound ? "Issue found ✓" : "Mark issue found"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={workflow.diagnosisSteps.length < 5}
                              onClick={async () => {
                                const next = { ...workflow, escalatedToGround: true }
                                await saveWorkflowDraft(next)
                                await updateTicketStatus(viewTicket, "in_progress")
                              }}
                            >
                              Escalate to ground staff
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {workflow && (
                    <div className="mt-4 rounded-xl border border-[hsl(var(--border))] p-4 space-y-3">
                      {workflow.escalatedToGround && (
                        <div className="rounded-lg border border-[hsl(var(--border))] p-3 space-y-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            Ground staff
                          </p>
                          <textarea
                            value={workflow.groundStaffNotes}
                            onChange={(e) => setWorkflow({ ...workflow, groundStaffNotes: e.target.value })}
                            onBlur={() => saveWorkflowDraft(workflow)}
                            rows={3}
                            placeholder="Ground staff findings / fix…"
                            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs resize-none"
                          />
                          <Button
                            size="sm"
                            variant={workflow.groundStaffFixed ? "default" : "outline"}
                            className={workflow.groundStaffFixed ? "bg-[#1a9f9a] hover:bg-[#158a85] text-white" : ""}
                            onClick={() => {
                              const next = { ...workflow, groundStaffFixed: !workflow.groundStaffFixed }
                              setWorkflow(next)
                              saveWorkflowDraft(next)
                            }}
                          >
                            {workflow.groundStaffFixed ? "Marked fixed by ground staff" : "Mark fixed by ground staff"}
                          </Button>
                          <textarea
                            value={workflow.supportFinalNotes}
                            onChange={(e) => setWorkflow({ ...workflow, supportFinalNotes: e.target.value })}
                            onBlur={() => saveWorkflowDraft(workflow)}
                            rows={2}
                            placeholder="Support final notes after ground fix…"
                            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs resize-none"
                          />
                        </div>
                      )}

                      <div className="rounded-lg border border-[hsl(var(--border))] p-3 space-y-3">
                        <label className="flex items-center gap-2 text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={workflow.warrantyClaimed}
                            onChange={(e) => {
                              const next = { ...workflow, warrantyClaimed: e.target.checked }
                              setWorkflow(next)
                              saveWorkflowDraft(next)
                            }}
                          />
                          Warranty claim (item returned and replacement issued)
                        </label>
                        {workflow.warrantyClaimed && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              value={workflow.returnedItem}
                              onChange={(e) => setWorkflow({ ...workflow, returnedItem: e.target.value })}
                              onBlur={() => saveWorkflowDraft(workflow)}
                              placeholder="Returned item"
                              className="h-9 rounded-lg border px-3 text-xs"
                            />
                            <input
                              value={workflow.replacementItem}
                              onChange={(e) => setWorkflow({ ...workflow, replacementItem: e.target.value })}
                              onBlur={() => saveWorkflowDraft(workflow)}
                              placeholder="Replacement item"
                              className="h-9 rounded-lg border px-3 text-xs"
                            />
                            <input
                              value={workflow.replacementInvoiceNumber}
                              onChange={(e) =>
                                setWorkflow({ ...workflow, replacementInvoiceNumber: e.target.value })
                              }
                              onBlur={() => saveWorkflowDraft(workflow)}
                              placeholder="New invoice number"
                              className="h-9 rounded-lg border px-3 text-xs"
                            />
                            <input
                              value={workflow.replacementDispatchNoteNumber}
                              onChange={(e) =>
                                setWorkflow({ ...workflow, replacementDispatchNoteNumber: e.target.value })
                              }
                              onBlur={() => saveWorkflowDraft(workflow)}
                              placeholder="New dispatch note number"
                              className="h-9 rounded-lg border px-3 text-xs"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="bg-[#1a9f9a] hover:bg-[#158a85] text-white"
                          disabled={!workflow.issueFound || !workflow.supportFix || savingWorkflow}
                          onClick={() => closeTicketAndDownloadReport(viewTicket, workflow.supportFix)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> Close case & download PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            !(workflow.escalatedToGround && workflow.groundStaffFixed && workflow.supportFinalNotes) ||
                            savingWorkflow
                          }
                          onClick={() => closeTicketAndDownloadReport(viewTicket, workflow.supportFinalNotes)}
                        >
                          Close after ground fix
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
