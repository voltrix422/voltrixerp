"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Shield, Trash2, Edit, Plus, Search, AlertCircle, CheckCircle } from "lucide-react"

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
  const [search, setSearch] = useState("")

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
        alert("Failed to save warranty: " + (errorData.error || "Unknown error"))
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

  const filtered = warranties.filter(w =>
    w.productName.toLowerCase().includes(search.toLowerCase()) ||
    (w.customerName && w.customerName.toLowerCase().includes(search.toLowerCase())) ||
    (w.customerEmail && w.customerEmail.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">Warranty Management</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Track product warranties and check remaining coverage</p>
        </div>
        <Button size="sm" className="h-9 text-sm gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add Warranty
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by product name, customer..."
          className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-10 pr-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-sm text-[hsl(var(--muted-foreground))]">Loading warranties...</div>
      )}

      {/* Empty State */}
      {!loading && warranties.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed border-[hsl(var(--border))]/30 rounded-2xl bg-[hsl(var(--card))]">
          <div className="h-16 w-16 rounded-full bg-[hsl(var(--muted))]/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-base font-semibold text-[hsl(var(--foreground))]">No warranties yet</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">Add your first warranty record to start tracking</p>
        </div>
      )}

      {/* Warranty List */}
      {!loading && warranties.length > 0 && (
        <div className="grid gap-4">
          {filtered.map(warranty => {
            const remaining = calculateRemainingWarranty(warranty.warrantyEndDate)
            return (
              <Card key={warranty.id} className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">{warranty.productName}</h3>
                        <Badge
                          variant={remaining.status === "active" ? "success" : remaining.status === "expiring" ? "warning" : "destructive"}
                          className="text-[10px] px-2 py-0.5"
                        >
                          {remaining.status === "active" && <CheckCircle className="h-3 w-3 mr-1 inline" />}
                          {remaining.status === "expiring" && <AlertCircle className="h-3 w-3 mr-1 inline" />}
                          {remaining.status === "expired" && <AlertCircle className="h-3 w-3 mr-1 inline" />}
                          {remaining.status === "expired" ? `Expired ${remaining.days} days ago` : remaining.status === "expiring" ? `Expiring in ${remaining.days} days` : `${remaining.days} days remaining`}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Sold Date</p>
                          <p className="text-[hsl(var(--foreground))]">{formatDate(warranty.soldDate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Warranty Start</p>
                          <p className="text-[hsl(var(--foreground))]">{formatDate(warranty.warrantyStartDate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Warranty End</p>
                          <p className="text-[hsl(var(--foreground))]">{formatDate(warranty.warrantyEndDate)}</p>
                        </div>
                        {warranty.customerName && (
                          <div>
                            <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Customer</p>
                            <p className="text-[hsl(var(--foreground))]">{warranty.customerName}</p>
                          </div>
                        )}
                      </div>

                      {warranty.notes && (
                        <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">{warranty.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => openEditForm(warranty)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDelete(warranty.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
    </div>
  )
}
