"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Search, Trash2, Ticket, Phone, Mail, Clock, CheckCircle, AlertCircle } from "lucide-react"

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
  const [showFilters, setShowFilters] = useState(false)

  // form
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<Ticket["priority"]>("medium")

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/db/tickets')
        const ticketsData = await res.json()
        setTickets(ticketsData)
      } catch (error) {
        console.error('Failed to load tickets:', error)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !search || 
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
        // Update existing ticket
        const res = await fetch('/api/db/tickets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
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
          })
        })
        if (!res.ok) throw new Error('Failed to update ticket')
        const updated = await res.json()
        setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
      } else {
        // Create new ticket
        const res = await fetch('/api/db/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName,
            customerEmail,
            customerPhone,
            subject,
            description,
            priority,
            createdBy: user?.name || "Unknown",
          })
        })
        if (!res.ok) throw new Error('Failed to create ticket')
        const newTicket = await res.json()
        setTickets(prev => [newTicket, ...prev])
      }
      resetForm()
    } catch (error) {
      console.error("Error saving ticket:", error)
      alert("Failed to save ticket. Please try again.")
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
    if (!confirm("Are you sure you want to delete this ticket?")) return
    try {
      await fetch('/api/db/tickets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      setTickets(prev => prev.filter(t => t.id !== id))
      if (viewTicket?.id === id) setViewTicket(null)
    } catch (error) {
      console.error('Failed to delete ticket:', error)
    }
  }

  async function handleStatusChange(ticket: Ticket, newStatus: Ticket["status"]) {
    try {
      const res = await fetch('/api/db/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
        })
      })
      const updated = await res.json()
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
      if (viewTicket?.id === updated.id) setViewTicket(updated)
    } catch (error) {
      console.error('Failed to update ticket status:', error)
    }
  }

  async function handleResolutionChange(ticket: Ticket, resolution: string) {
    try {
      const res = await fetch('/api/db/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
        })
      })
      const updated = await res.json()
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
      if (viewTicket?.id === updated.id) setViewTicket(updated)
    } catch (error) {
      console.error('Failed to update ticket resolution:', error)
    }
  }

  const openCount = tickets.filter(t => t.status === "open").length
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length
  const resolvedCount = tickets.filter(t => t.status === "resolved").length
  const closedCount = tickets.filter(t => t.status === "closed").length

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "N/A"
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-end">
        <Button size="sm" className="h-8 text-sm gap-2 bg-black hover:bg-neutral-800 text-white cursor-pointer" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> New Ticket
        </Button>
      </div>

      {/* Stats */}
      {tickets.length > 0 && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))]">
            <div className="p-3 text-center">
              <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Open</p>
              <p className="text-xl font-bold text-[hsl(var(--foreground))] mt-0.5">{openCount}</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">In Progress</p>
              <p className="text-xl font-bold text-[hsl(var(--foreground))] mt-0.5">{inProgressCount}</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Resolved</p>
              <p className="text-xl font-bold text-[hsl(var(--foreground))] mt-0.5">{resolvedCount}</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Closed</p>
              <p className="text-xl font-bold text-[hsl(var(--foreground))] mt-0.5">{closedCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters Toggle */}
      {tickets.length > 0 && (
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Filter tickets
        </button>
      )}

      {/* Filters */}
      {tickets.length > 0 && showFilters && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 flex flex-wrap gap-2 items-center animate-in slide-in-from-top-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by ticket #, name, email, subject..."
              className="w-full h-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-10 pr-3 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent">
            <option value="All">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="h-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent">
            <option value="All">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          {(search || filterStatus !== "All" || filterPriority !== "All") && (
            <button onClick={() => { setSearch(""); setFilterStatus("All"); setFilterPriority("All") }}
              className="h-8 px-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border))] rounded hover:bg-[hsl(var(--muted))]/10">Clear</button>
          )}
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto">{filtered.length} of {tickets.length}</span>
        </div>
      )}

      {/* Tickets list */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[hsl(var(--border))]/30 rounded-xl bg-[hsl(var(--card))]">
          <div className="h-12 w-12 rounded-full bg-[hsl(var(--muted))]/30 flex items-center justify-center mx-auto mb-3">
            <Ticket className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">No tickets yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Create your first support ticket to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-xs text-[hsl(var(--muted-foreground))] border border-dashed border-[hsl(var(--border))]/30 rounded-lg bg-[hsl(var(--card))]">No tickets match your filters.</div>
      ) : (
        <div className="border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20">
                <th className="text-left px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Ticket</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Priority</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Status</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Customer</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Subject</th>
                <th className="text-right px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Created</th>
                <th className="text-right px-2 py-1.5 text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} onClick={() => setViewTicket(t)}
                  className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/5 cursor-pointer transition-colors">
                  <td className="px-2 py-1.5">
                    <p className="text-[10px] font-medium text-[hsl(var(--foreground))]">{t.ticketNumber}</p>
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge variant={PRIORITY_VARIANT[t.priority]} className="text-[8px] px-1 py-0">{PRIORITY_LABELS[t.priority]}</Badge>
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge variant={STATUS_VARIANT[t.status]} className="text-[8px] px-1 py-0">{STATUS_LABELS[t.status]}</Badge>
                  </td>
                  <td className="px-2 py-1.5">
                    <p className="text-[10px] text-[hsl(var(--foreground))]">{t.customerName}</p>
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{t.customerEmail}</p>
                  </td>
                  <td className="px-2 py-1.5">
                    <p className="text-[10px] text-[hsl(var(--foreground))] truncate max-w-[200px]">{t.subject}</p>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{formatDate(t.createdAt)}</p>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost"
                        className="h-5 w-5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={e => { e.stopPropagation(); handleDelete(t.id) }}>
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Ticket Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <p className="text-base font-semibold text-[hsl(var(--foreground))]">{editingTicket ? "Edit Ticket" : "New Support Ticket"}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={resetForm}><X className="h-5 w-5" /></Button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Customer Name *</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="e.g. John Doe"
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Customer Email *</label>
                <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} required type="email" placeholder="email@example.com"
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Customer Phone</label>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+92 300 0000000"
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Subject *</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} required placeholder="Brief description of the issue"
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value as Ticket["priority"])}
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Description *</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={4} placeholder="Detailed description of the customer's query or issue..."
                  className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-10" onClick={resetForm}>Cancel</Button>
                <Button type="submit" size="sm" className="flex-1 h-10 bg-[#1a9f9a] hover:bg-[#158a85] text-white" disabled={saving}>
                  {saving ? "Saving..." : editingTicket ? "Update Ticket" : "Create Ticket"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Ticket Modal */}
      {viewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewTicket(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <div className="flex items-center gap-3">
                <Ticket className="h-5 w-5 text-[#1a9f9a]" />
                <p className="text-base font-semibold text-[hsl(var(--foreground))]">{viewTicket.ticketNumber}</p>
                <Badge variant={PRIORITY_VARIANT[viewTicket.priority]} className="text-[10px] px-1.5 py-0">{PRIORITY_LABELS[viewTicket.priority]}</Badge>
                <Badge variant={STATUS_VARIANT[viewTicket.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[viewTicket.status]}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8" onClick={() => openEditForm(viewTicket)}>Edit</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => setViewTicket(null)}><X className="h-5 w-5" /></Button>
              </div>
            </div>
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Subject */}
              <div>
                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Subject</p>
                <p className="text-lg font-semibold text-[hsl(var(--foreground))]">{viewTicket.subject}</p>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 px-4 py-3">
                  <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Email</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewTicket.customerEmail}</p>
                  </div>
                </div>
                {viewTicket.customerPhone && (
                  <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 px-4 py-3">
                    <Phone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Phone</p>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewTicket.customerPhone}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Description</p>
                <p className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap bg-[hsl(var(--muted))]/10 rounded-lg border border-[hsl(var(--border))] p-4">{viewTicket.description}</p>
              </div>

              {/* Status Change */}
              <div>
                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Update Status</p>
                <div className="flex gap-2">
                  {(["open", "in_progress", "resolved", "closed"] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(viewTicket, status)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        viewTicket.status === status
                          ? "bg-[#1a9f9a] border-[#1a9f9a] text-white"
                          : "bg-[hsl(var(--background))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/10"
                      }`}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              {viewTicket.status !== "open" && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Resolution Notes</p>
                  <textarea
                    value={viewTicket.resolution || ""}
                    onChange={e => handleResolutionChange(viewTicket, e.target.value)}
                    rows={3}
                    placeholder="Add resolution notes..."
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent resize-none"
                  />
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1 pt-4 border-t border-[hsl(var(--border))]">
                <p>Created: {formatDate(viewTicket.createdAt)}</p>
                <p>Updated: {formatDate(viewTicket.updatedAt)}</p>
                {viewTicket.closedAt && <p>Closed: {formatDate(viewTicket.closedAt)}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
