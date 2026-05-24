"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Calendar, Shield, Trash2, Edit, Plus, Search, AlertCircle, CheckCircle, Filter, PlayCircle, Truck, RotateCcw } from "lucide-react"

interface Warranty {
  id: string
  warrantyId: string
  serialNumber?: string | null
  productName: string
  soldDate: string
  warrantyStartDate: string
  warrantyEndDate: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  customerAddress?: string
  installLocation?: string
  invoiceDocumentUrl?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export function WarrantyManager() {
  const [startedWarranties, setStartedWarranties] = useState<Warranty[]>([])
  const [deliveredWarranties, setDeliveredWarranties] = useState<Warranty[]>([])
  const [listTab, setListTab] = useState<"delivered" | "started">("delivered")
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resetConfirmWarranty, setResetConfirmWarranty] = useState<Warranty | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingWarranty, setEditingWarranty] = useState<Warranty | null>(null)
  const [viewDetail, setViewDetail] = useState<Warranty | null>(null)
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expiring" | "expired">("all")

  // Form state
  const [productName, setProductName] = useState("")
  const [soldDate, setSoldDate] = useState("")
  const [warrantyStartDate, setWarrantyStartDate] = useState("")
  const [warrantyEndDate, setWarrantyEndDate] = useState("")
  const [warrantyDuration, setWarrantyDuration] = useState<"2" | "5" | "10" | "custom">("5")
  const [customYears, setCustomYears] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    fetchWarranties()
  }, [])

  // Auto-calculate warranty end date when start date or duration changes
  useEffect(() => {
    if (warrantyStartDate && warrantyDuration !== "custom") {
      const startDate = new Date(warrantyStartDate)
      const years = parseInt(warrantyDuration)
      const endDate = new Date(startDate)
      endDate.setFullYear(endDate.getFullYear() + years)
      setWarrantyEndDate(endDate.toISOString().split("T")[0])
    } else if (warrantyStartDate && warrantyDuration === "custom" && customYears) {
      const startDate = new Date(warrantyStartDate)
      const years = parseInt(customYears)
      if (!isNaN(years) && years > 0) {
        const endDate = new Date(startDate)
        endDate.setFullYear(endDate.getFullYear() + years)
        setWarrantyEndDate(endDate.toISOString().split("T")[0])
      }
    }
  }, [warrantyStartDate, warrantyDuration, customYears])

  async function fetchWarranties() {
    try {
      const res = await fetch("/api/db/warranties?split=1")
      if (res.ok) {
        const data = await res.json()
        setStartedWarranties(data.started || [])
        setDeliveredWarranties(data.delivered || [])
      }
    } catch (error) {
      console.error("Error fetching warranties:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStartWarranty(warranty: Warranty) {
    const serial = warranty.serialNumber?.trim()
    if (!serial) {
      alert("No serial number on this record.")
      return
    }
    setActivatingId(warranty.id)
    try {
      const res = await fetch("/api/warranty/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan: serial, activatedBy: "Website admin" }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Could not start warranty")
        return
      }
      await fetchWarranties()
      setListTab("started")
    } catch {
      alert("Failed to start warranty")
    } finally {
      setActivatingId(null)
    }
  }

  async function performResetWarranty(warranty: Warranty) {
    setResettingId(warranty.id)
    try {
      const res = await fetch("/api/warranty/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: warranty.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "Could not reset warranty")
        return
      }
      await fetchWarranties()
      setListTab("delivered")
    } catch {
      alert("Failed to reset warranty")
    } finally {
      setResettingId(null)
    }
  }

  function resetForm() {
    setProductName("")
    setSoldDate("")
    setWarrantyStartDate("")
    setWarrantyEndDate("")
    setWarrantyDuration("5")
    setCustomYears("")
    setCustomerName("")
    setCustomerEmail("")
    setCustomerPhone("")
    setNotes("")
    setEditingWarranty(null)
    setShowForm(false)
  }

  function clearFilters() {
    setDateFrom("")
    setDateTo("")
    setStatusFilter("all")
    setSearch("")
  }

  function openEditForm(warranty: Warranty) {
    setEditingWarranty(warranty)
    setProductName(warranty.productName)
    setSoldDate(warranty.soldDate.split("T")[0])
    setWarrantyStartDate(warranty.warrantyStartDate.split("T")[0])
    setWarrantyEndDate(warranty.warrantyEndDate.split("T")[0])
    setCustomerName(warranty.customerName || "")
    setCustomerEmail(warranty.customerEmail || "")
    setCustomerPhone(warranty.customerPhone || "")
    setNotes(warranty.notes || "")
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const body = {
        id: editingWarranty?.id,
        productName,
        soldDate: new Date(soldDate).toISOString(),
        warrantyStartDate: new Date(warrantyStartDate).toISOString(),
        warrantyEndDate: new Date(warrantyEndDate).toISOString(),
        customerName,
        customerEmail,
        customerPhone,
        notes,
      }

      const res = await fetch("/api/db/warranties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const updated = await res.json()
        await fetchWarranties()
        resetForm()
      } else {
        const errorData = await res.json()
        alert("Failed to save warranty: " + (errorData.details || errorData.error || "Unknown error"))
        console.error("API error:", errorData)
      }
    } catch (error) {
      console.error("Error saving warranty:", error)
      alert("Failed to save warranty. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this warranty record?")) return

    try {
      const res = await fetch("/api/db/warranties", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        await fetchWarranties()
      }
    } catch (error) {
      console.error("Error deleting warranty:", error)
    }
  }

  function calculateRemainingWarranty(endDate: string): { days: number; status: "active" | "expiring" | "expired" } {
    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { days: Math.abs(diffDays), status: "expired" }
    } else if (diffDays <= 30) {
      return { days: diffDays, status: "expiring" }
    } else {
      return { days: diffDays, status: "active" }
    }
  }
  
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }

  const warranties = listTab === "started" ? startedWarranties : deliveredWarranties

  const filtered = warranties.filter(w => {
    const remaining = calculateRemainingWarranty(w.warrantyEndDate)
    
    // Search filter
    const matchesSearch = 
      w.productName.toLowerCase().includes(search.toLowerCase()) ||
      (w.serialNumber && w.serialNumber.toLowerCase().includes(search.toLowerCase())) ||
      (w.customerName && w.customerName.toLowerCase().includes(search.toLowerCase())) ||
      (w.customerEmail && w.customerEmail.toLowerCase().includes(search.toLowerCase()))
    
    // Status filter
    const matchesStatus = statusFilter === "all" || remaining.status === statusFilter
    
    // Date range filter
    let matchesDateRange = true
    if (dateFrom) {
      matchesDateRange = matchesDateRange && new Date(w.warrantyStartDate) >= new Date(dateFrom)
    }
    if (dateTo) {
      matchesDateRange = matchesDateRange && new Date(w.warrantyEndDate) <= new Date(dateTo)
    }
    
    return matchesSearch && matchesStatus && matchesDateRange
  })

  return (
    <div className="space-y-3">
      <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
        <strong>Delivered</strong> lists units dispatched to customers whose warranty has not been started yet.
        After someone scans the product QR (branch or{" "}
        <a href="https://voltrixbatteries.com/warranty" className="text-[#1a9f9a] underline" target="_blank" rel="noreferrer">
          voltrixbatteries.com/warranty
        </a>
        ), they move to <strong>Warranty started</strong>.
      </p>

      <div className="flex gap-1 border-b border-[hsl(var(--border))]">
        <button
          type="button"
          onClick={() => setListTab("delivered")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium relative ${
            listTab === "delivered" ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <Truck className="h-4 w-4" />
          Delivered (not started)
          <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-1">{deliveredWarranties.length}</Badge>
          {listTab === "delivered" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a9f9a]" />}
        </button>
        <button
          type="button"
          onClick={() => setListTab("started")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium relative ${
            listTab === "started" ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <Shield className="h-4 w-4" />
          Warranty started
          <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-1">{startedWarranties.length}</Badge>
          {listTab === "started" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a9f9a]" />}
        </button>
      </div>

      {/* Header with Filters and Add button on right */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer ${
            showFilters ? "text-[#1a9f9a]" : ""
          }`}
        >
          <Filter className="h-4 w-4" />
        </button>
        <Button size="sm" className="h-9 text-sm gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add Warranty
        </Button>
      </div>

      {/* Collapsible Filters with Search */}
      {showFilters && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <div className="w-48 space-y-0.5">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Product, customer..."
                  className="w-full h-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-7 pr-2 text-[10px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent"
                />
              </div>
            </div>
            <div className="w-32 space-y-0.5">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Warranty Start From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full h-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-[10px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent"
              />
            </div>
            <div className="w-32 space-y-0.5">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Warranty End To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full h-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-[10px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent"
              />
            </div>
            <div className="w-32 space-y-0.5">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as "all" | "active" | "expiring" | "expired")}
                className="w-full h-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-[10px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expiring">Expiring Soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <button
              onClick={clearFilters}
              className="self-end px-2 py-1 text-[10px] border rounded hover:bg-[hsl(var(--muted))]/10 cursor-pointer transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-xs text-[hsl(var(--muted-foreground))]">Loading warranties...</div>
      )}

      {!loading && warranties.length === 0 && (
        <div className="text-center py-10 rounded-lg border border-dashed">
          <Shield className="h-10 w-10 mx-auto text-[hsl(var(--muted-foreground))] opacity-40 mb-2" />
          <p className="text-sm font-medium">
            {listTab === "delivered" ? "No delivered units waiting for warranty start" : "No started warranties yet"}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-md mx-auto">
            {listTab === "delivered"
              ? "Units appear here after dispatch. Customer or branch must scan the product QR to start warranty."
              : "Started warranties show here after the first QR scan."}
          </p>
        </div>
      )}

      {/* Warranty Table */}
      {!loading && warranties.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))]/60 bg-[hsl(var(--card))] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]/50 bg-[hsl(var(--muted))]/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Sold Date</th>
                  {listTab === "started" && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Warranty Period</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(warranty => {
                  const remaining = calculateRemainingWarranty(warranty.warrantyEndDate)
                  return (
                    <tr key={warranty.id} className="border-b border-[hsl(var(--border))]/40 hover:bg-[hsl(var(--muted))]/15 transition-colors cursor-pointer" onClick={() => setViewDetail(warranty)}>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{warranty.productName}</p>
                        {warranty.serialNumber && warranty.serialNumber !== warranty.productName && (
                          <p className="text-xs font-mono text-[hsl(var(--muted-foreground))] mt-0.5">{warranty.serialNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-[hsl(var(--foreground))] capitalize">{warranty.customerName || "-"}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-[hsl(var(--foreground))]">{formatDate(warranty.soldDate)}</p>
                      </td>
                      {listTab === "started" && (
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(warranty.warrantyStartDate)} – {formatDate(warranty.warrantyEndDate)}</p>
                        </td>
                      )}
                      <td className="px-4 py-3.5">
                        {listTab === "delivered" ? (
                          <Badge variant="warning" className="text-xs px-2.5 py-1 font-medium">
                            Pending start
                          </Badge>
                        ) : (
                          <Badge
                            variant={remaining.status === "active" ? "success" : remaining.status === "expiring" ? "warning" : "destructive"}
                            className="text-xs px-2.5 py-1 font-medium"
                          >
                            {remaining.status === "active" && <CheckCircle className="h-3.5 w-3.5 mr-1 inline" />}
                            {remaining.status === "expiring" && <AlertCircle className="h-3.5 w-3.5 mr-1 inline" />}
                            {remaining.status === "expired" && <AlertCircle className="h-3.5 w-3.5 mr-1 inline" />}
                            {remaining.status === "expired" ? `Expired ${remaining.days} days ago` : remaining.status === "expiring" ? `Expiring in ${remaining.days} days` : `${remaining.days} days remaining`}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                          {listTab === "delivered" && warranty.serialNumber && (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs font-medium bg-[#1a9f9a] hover:bg-[#158a85] text-white"
                              disabled={activatingId === warranty.id}
                              onClick={() => void handleStartWarranty(warranty)}
                            >
                              <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                              {activatingId === warranty.id ? "Starting…" : "Start warranty"}
                            </Button>
                          )}
                          {listTab === "started" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs font-medium"
                              disabled={resettingId === warranty.id}
                              onClick={() => setResetConfirmWarranty(warranty)}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              {resettingId === warranty.id ? "Resetting…" : "Reset warranty"}
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => openEditForm(warranty)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDelete(warranty.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Warranty Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <p className="text-base font-semibold text-[hsl(var(--foreground))]">{editingWarranty ? "Edit Warranty" : "Add New Warranty"}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={resetForm}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Product Name *</label>
                <input
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  required
                  placeholder="e.g. Battery, Inverter, Solar Panel"
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Sold Date *</label>
                  <input
                    type="date"
                    value={soldDate}
                    onChange={e => setSoldDate(e.target.value)}
                    required
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Warranty Start Date *</label>
                  <input
                    type="date"
                    value={warrantyStartDate}
                    onChange={e => setWarrantyStartDate(e.target.value)}
                    required
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Warranty Duration</label>
                <div className="flex gap-2">
                  <select
                    value={warrantyDuration}
                    onChange={e => setWarrantyDuration(e.target.value as "2" | "5" | "10" | "custom")}
                    className="flex-1 h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                  >
                    <option value="2">2 Years</option>
                    <option value="5">5 Years</option>
                    <option value="10">10 Years</option>
                    <option value="custom">Custom</option>
                  </select>
                  {warrantyDuration === "custom" && (
                    <input
                      type="number"
                      value={customYears}
                      onChange={e => setCustomYears(e.target.value)}
                      placeholder="Years"
                      min="1"
                      className="w-24 h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Warranty End Date *</label>
                <input
                  type="date"
                  value={warrantyEndDate}
                  onChange={e => setWarrantyEndDate(e.target.value)}
                  required
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Auto-calculated based on warranty duration</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Customer Name</label>
                <input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer name (optional)"
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Customer Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Customer Phone</label>
                  <input
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="+92 300 0000000"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional notes..."
                  className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-10" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="flex-1 h-10 bg-[#1a9f9a] hover:bg-[#158a85] text-white" disabled={saving}>
                  {saving ? "Saving..." : editingWarranty ? "Update Warranty" : "Add Warranty"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {viewDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewDetail(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <p className="text-base font-semibold text-[hsl(var(--foreground))]">Warranty Details</p>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => setViewDetail(null)}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            <div className="overflow-y-auto p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[#1a9f9a]/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-[#1a9f9a]" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">{viewDetail.productName.charAt(0).toUpperCase() + viewDetail.productName.slice(1)}</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Warranty ID: {viewDetail.warrantyId}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Sold Date</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{formatDate(viewDetail.soldDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Warranty Start Date</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{formatDate(viewDetail.warrantyStartDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Warranty End Date</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{formatDate(viewDetail.warrantyEndDate)}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Customer Name</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewDetail.customerName ? viewDetail.customerName.charAt(0).toUpperCase() + viewDetail.customerName.slice(1) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Customer Email</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewDetail.customerEmail || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Customer Phone</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewDetail.customerPhone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Address</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewDetail.customerAddress || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Install location</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewDetail.installLocation || "-"}</p>
                  </div>
                  {viewDetail.invoiceDocumentUrl && (
                    <div>
                      <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Invoice file</p>
                      <a
                        href={viewDetail.invoiceDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[#1a9f9a] underline"
                      >
                        View uploaded invoice
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-[hsl(var(--border))]">
                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm text-[hsl(var(--foreground))] bg-[hsl(var(--muted))]/30 rounded-lg p-3">{viewDetail.notes || "No notes"}</p>
              </div>

              <div className="pt-4 border-t border-[hsl(var(--border))]">
                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Warranty Status</p>
                {(() => {
                  const remaining = calculateRemainingWarranty(viewDetail.warrantyEndDate)
                  return (
                    <Badge
                      variant={remaining.status === "active" ? "success" : remaining.status === "expiring" ? "warning" : "destructive"}
                      className="text-sm px-3 py-1"
                    >
                      {remaining.status === "active" && <CheckCircle className="h-4 w-4 mr-2 inline" />}
                      {remaining.status === "expiring" && <AlertCircle className="h-4 w-4 mr-2 inline" />}
                      {remaining.status === "expired" && <AlertCircle className="h-4 w-4 mr-2 inline" />}
                      {remaining.status === "expired" ? `Expired ${remaining.days} days ago` : remaining.status === "expiring" ? `Expiring in ${remaining.days} days` : `${remaining.days} days remaining`}
                    </Badge>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!resetConfirmWarranty}
        title="Reset warranty"
        message="Reset this warranty to not started? The unit will move back to Delivered and the customer will need to scan the QR again."
        confirmText="Reset to not started"
        cancelText="Cancel"
        variant="warning"
        onCancel={() => setResetConfirmWarranty(null)}
        onConfirm={() => {
          const target = resetConfirmWarranty
          setResetConfirmWarranty(null)
          if (target) void performResetWarranty(target)
        }}
      />
    </div>
  )
}
