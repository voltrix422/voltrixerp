"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Shield, Trash2, Edit, Plus, Search, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Eye, Filter, X } from "lucide-react"

interface Warranty {
  id: string
  productName: string
  soldDate: string
  warrantyStartDate: string
  warrantyEndDate: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export function WarrantyManager() {
  const [warranties, setWarranties] = useState<Warranty[]>([])
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
      const res = await fetch("/api/db/warranties")
      if (res.ok) {
        const data = await res.json()
        setWarranties(data)
      }
    } catch (error) {
      console.error("Error fetching warranties:", error)
    } finally {
      setLoading(false)
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
        if (editingWarranty) {
          setWarranties(prev => prev.map(w => w.id === updated.id ? updated : w))
        } else {
          setWarranties(prev => [...prev, updated])
        }
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
        setWarranties(prev => prev.filter(w => w.id !== id))
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

  const filtered = warranties.filter(w => {
    const remaining = calculateRemainingWarranty(w.warrantyEndDate)
    
    // Search filter
    const matchesSearch = 
      w.productName.toLowerCase().includes(search.toLowerCase()) ||
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
      {/* Header with Filters and Add button on right */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer ${
            showFilters ? "text-[#1a9f9a]" : ""
          }`}
        >
          <Filter className="h-4 w-4" />
        </button>
        <Button size="sm" className="h-8 text-xs gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Warranty
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

      {/* Warranty Table */}
      {!loading && warranties.length > 0 && (
        <div className="rounded-lg border border-[hsl(var(--border))]/50 bg-[hsl(var(--card))] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]/50 bg-[hsl(var(--muted))]/30">
                  <th className="text-left px-2 py-1.5 text-[9px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Product</th>
                  <th className="text-left px-2 py-1.5 text-[9px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Customer</th>
                  <th className="text-left px-2 py-1.5 text-[9px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Sold Date</th>
                  <th className="text-left px-2 py-1.5 text-[9px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Warranty Period</th>
                  <th className="text-left px-2 py-1.5 text-[9px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Status</th>
                  <th className="text-right px-2 py-1.5 text-[9px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(warranty => {
                  const remaining = calculateRemainingWarranty(warranty.warrantyEndDate)
                  return (
                    <tr key={warranty.id} className="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer" onClick={() => setViewDetail(warranty)}>
                      <td className="px-2 py-1.5">
                        <p className="text-[10px] font-medium text-[hsl(var(--foreground))]">{warranty.productName}</p>
                      </td>
                      <td className="px-2 py-1.5">
                        <p className="text-[10px] text-[hsl(var(--foreground))]">{warranty.customerName || "-"}</p>
                      </td>
                      <td className="px-2 py-1.5">
                        <p className="text-[10px] text-[hsl(var(--foreground))]">{formatDate(warranty.soldDate)}</p>
                      </td>
                      <td className="px-2 py-1.5">
                        <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{formatDate(warranty.warrantyStartDate)} - {formatDate(warranty.warrantyEndDate)}</p>
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge
                          variant={remaining.status === "active" ? "success" : remaining.status === "expiring" ? "warning" : "destructive"}
                          className="text-[8px] px-1 py-0"
                        >
                          {remaining.status === "active" && <CheckCircle className="h-2.5 w-2.5 mr-0.5 inline" />}
                          {remaining.status === "expiring" && <AlertCircle className="h-2.5 w-2.5 mr-0.5 inline" />}
                          {remaining.status === "expired" && <AlertCircle className="h-2.5 w-2.5 mr-0.5 inline" />}
                          {remaining.status === "expired" ? `Expired ${remaining.days} days ago` : remaining.status === "expiring" ? `Expiring in ${remaining.days} days` : `${remaining.days} days remaining`}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => openEditForm(warranty)}>
                            <Edit className="h-2.5 w-2.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDelete(warranty.id)}>
                            <Trash2 className="h-2.5 w-2.5" />
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
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Warranty ID: {viewDetail.id.slice(0, 8)}...</p>
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
    </div>
  )
}
