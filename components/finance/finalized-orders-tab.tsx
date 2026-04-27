"use client"
import { useState, useEffect } from "react"
import { getPOs, savePO, type PurchaseOrder, type Supplier, type PaymentRecord, STATUS_LABELS, STATUS_VARIANT, calcQuoteTotal } from "@/lib/purchase"
import { getSuppliers } from "@/lib/purchase"
import { uploadFile } from "@/lib/upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, X, Search, Calendar, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react"
import { ImportedPODetail } from "@/components/purchase/imported-po-detail"

export function FinalizedOrdersTab() {
  const [pos, setPOs] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [tab, setTab] = useState<"finalized" | "direct" | "imported">("finalized")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    Promise.all([getPOs(), getSuppliers()]).then(([p, s]) => {
      setPOs(p.filter(po =>
        (po.type === "local" && (po.status === "finalized" || po.status === "direct" || po.status === "in_inventory")) ||
        (po.type === "imported" && !po.status.startsWith("imp_admin_draft") && !po.status.startsWith("imp_purchase") && po.status !== "imp_rejected")
      ))
      setSuppliers(s)
      setLoading(false)
    })
    // Refresh data periodically (replaces Supabase realtime)
    const interval = setInterval(() => {
      getPOs().then(p => setPOs(p.filter(po =>
        (po.type === "local" && (po.status === "finalized" || po.status === "direct" || po.status === "in_inventory")) ||
        (po.type === "imported" && !po.status.startsWith("imp_admin_draft") && !po.status.startsWith("imp_purchase") && po.status !== "imp_rejected")
      )))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleUpdate(updated: PurchaseOrder) {
    await savePO(updated)
    setPOs(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSelectedPO(updated)
  }

  const filtered = pos.filter(po => {
    const q = search.toLowerCase()
    const supplier = suppliers.find(s => s.id === po.finalizedSupplierId)
    const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId) || po.quotes[0]
    const supplierName = supplier?.name || quote?.supplierName || po.supplierNames?.[0] || ""
    const poNumberDisplay = po.poNumber || `PO-${po.id.slice(0, 8)}`

    const matchSearch = !search ||
      poNumberDisplay.toLowerCase().includes(q) ||
      supplierName.toLowerCase().includes(q)

    const poDate = new Date(po.createdAt)
    const matchFrom = !dateFrom || poDate >= new Date(dateFrom)
    const matchTo = !dateTo || poDate <= new Date(dateTo + "T23:59:59")

    if (tab === "imported") {
      return po.type === "imported" && matchSearch && matchFrom && matchTo
    } else if (tab === "direct") {
      return po.status === "direct" && po.type === "local" && matchSearch && matchFrom && matchTo
    } else if (tab === "finalized") {
      return po.type === "local" && (po.status === "finalized" || po.status === "in_inventory") && matchSearch && matchFrom && matchTo
    }
    return false
  })

  const hasFilters = search || dateFrom || dateTo

  function clearFilters() {
    setSearch("")
    setDateFrom("")
    setDateTo("")
  }

  return (
    <div className="p-6 space-y-4">
      {/* Tabs */}
      <div className="flex gap-0 border-b -mx-6 px-6">
        {(["finalized", "direct", "imported"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer ${
              tab === t ? "border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]"
              : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}>
            {t === "finalized" ? "Detail POs" : t === "direct" ? "Direct POs" : "Imported POs"}
            <span className="ml-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
              ({pos.filter(p => {
                if (t === "imported") return p.type === "imported"
                if (t === "direct") return p.status === "direct" && p.type === "local"
                if (t === "finalized") return p.type === "local" && (p.status === "finalized" || p.status === "in_inventory")
                return false
              }).length})
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{filtered.length} order{filtered.length !== 1 ? "s" : ""}</p>
        <Button
          size="sm" variant="outline"
          className="h-8 text-xs gap-1.5 cursor-pointer"
          onClick={() => setShowFilters(v => !v)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-[#1faca6]" />}
          {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Filters - Collapsible */}
      {showFilters && (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-4 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by PO # or supplier..."
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]"
            />
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6] w-32"
            />
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6] w-32"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="h-9 px-3 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border rounded-md transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading orders...</p>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium">
            {hasFilters 
              ? `No ${tab === "direct" ? "direct" : tab === "imported" ? "imported" : "finalized"} orders match your filters`
              : `No ${tab === "direct" ? "direct" : tab === "imported" ? "imported" : "finalized"} orders`
            }
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            {hasFilters 
              ? "Try adjusting your search or date range"
              : (tab === "direct" ? "Direct POs from purchase will appear here." : 
                 tab === "imported" ? "Imported POs will appear here." :
                 "Finalized POs from purchase will appear here.")
            }
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                {["PO #", "Supplier", "Type", "Items", "Total", "Paid", "Remaining", "Date"].map(h => (
                  <th key={h} className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(po => {
                if (po.type === "imported") {
                  const totalCost = po.importedItems.reduce((s, i) => s + i.unitPrice * i.qty, 0)
                  const totalPaid = (po.payments || []).reduce((s, p) => s + p.amount, 0)
                  const remaining = totalCost - totalPaid
                  return (
                    <tr key={po.id} onClick={() => setSelectedPO(po)} className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer">
                      <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{po.poNumber}</td>
                      <td className="px-4 py-2.5 text-xs font-medium">{po.importedSupplierName || "—"}</td>
                      <td className="px-4 py-2.5"><Badge variant="info" className="text-[10px] px-1.5 py-0">imported</Badge></td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.importedItems.length}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold">PKR {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2.5 text-xs">PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2.5 text-xs font-medium">{remaining <= 0 ? <span className="text-emerald-600">Paid</span> : `PKR ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{new Date(po.createdAt).toLocaleDateString()}</td>
                    </tr>
                  )
                }
                const supplier = suppliers.find(s => s.id === po.finalizedSupplierId)
                const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId) || po.quotes[0]
                const totalCost = quote ? calcQuoteTotal(po, quote) : 0
                const totalPaid = (po.payments || []).reduce((s, p) => s + p.amount, 0)
                const remaining = totalCost - totalPaid
                const supplierName = supplier?.name || quote?.supplierName || po.supplierNames?.[0] || "—"
                const poNumberDisplay = po.poNumber || `PO-${po.id.slice(0, 8)}`
                return (
                  <tr key={po.id} onClick={() => setSelectedPO(po)} className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer">
                    <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{poNumberDisplay}</td>
                    <td className="px-4 py-2.5 text-xs font-medium">{supplierName}</td>
                    <td className="px-4 py-2.5"><Badge variant={po.type === "local" ? "success" : "info"} className="text-[10px] px-1.5 py-0">{po.type}</Badge></td>
                    <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{po.items.length}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold">PKR {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2.5 text-xs">PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2.5 text-xs font-medium">{remaining <= 0 ? <span className="text-emerald-600">Paid</span> : `PKR ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</td>
                    <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{new Date(po.createdAt).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedPO && selectedPO.type === "imported" && (
        <ImportedPODetail
          po={selectedPO}
          isAdmin={false}
          role="finance"
          onClose={() => setSelectedPO(null)}
          onUpdate={handleUpdate}
        />
      )}

      {selectedPO && selectedPO.type !== "imported" && (
        <FinalizedOrderDetail
          po={selectedPO}
          suppliers={suppliers}
          onClose={() => setSelectedPO(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}

function FinalizedOrderDetail({ po, suppliers, onClose, onUpdate }: {
  po: PurchaseOrder; suppliers: Supplier[]; onClose: () => void; onUpdate: (u: PurchaseOrder) => void
}) {
  const [tab, setTab] = useState<"order" | "payment">("order")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("")
  const [date, setDate] = useState("")
  const [notes, setNotes] = useState("")
  const [showAddForm, setShowAddForm] = useState(true)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const supplier = suppliers.find(s => s.id === po.finalizedSupplierId)
  const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId) || po.quotes[0]

  const itemsTotal = po.items.reduce((sum, item, idx) => {
    const qi = quote?.items.find(q => q.itemId === item.id) || quote?.items[idx]
    const unitPrice = qi?.unitPrice || 0
    return sum + unitPrice * item.qty
  }, 0)
  const taxAmount = itemsTotal * ((quote?.taxPct || 0) / 100)
  const totalCost = itemsTotal + taxAmount + (quote?.transportCost || 0) + (quote?.otherCost || 0)
  const payments = po.payments || []
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const remaining = totalCost - totalPaid

  function handleProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    const reader = new FileReader()
    reader.onload = ev => setProofPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function addPayment() {
    if (!amount || !method || !date) return
    setSaving(true)

    let proofUrl: string | undefined
    if (proofFile) {
      try { proofUrl = await uploadFile(proofFile, "payment-proofs") } catch {}
    }

    const newPayment: PaymentRecord = {
      id: Date.now().toString(),
      amount: Number(amount),
      method, date, notes,
      proofUrl,
      createdAt: new Date().toISOString(),
    }
    onUpdate({ ...po, payments: [...payments, newPayment] })
    setAmount(""); setMethod(""); setDate(""); setNotes(""); setProofFile(null); setProofPreview(null)
    setShowAddForm(false)
    setSaving(false)
  }

  async function moveToInventory() {
    setSaving(true)
    const updated: PurchaseOrder = {
      ...po,
      status: "in_inventory",
    }
    onUpdate(updated)
    setSaving(false)
  }

  const isFullyPaid = remaining <= 10 // Allow small rounding differences
  const isInInventory = po.status === "in_inventory"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[hsl(var(--muted))]/40 to-transparent shrink-0">
          <div>
            <p className="text-lg font-bold text-[hsl(var(--primary))]">{po.poNumber}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Finalized Order</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex gap-0 border-b px-6 bg-[hsl(var(--background))] shrink-0">
          {(["order", "payment"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer ${
                tab === t ? "border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]"
                : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {t === "order" ? "Order Details" : `Payment${payments.length > 0 ? ` (${payments.length})` : ""}`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab === "order" ? (
            <>
              <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Selected Supplier</p>
                <p className="text-sm font-semibold">{supplier?.name}</p>
                {supplier?.company && <p className="text-xs text-[hsl(var(--muted-foreground))]">{supplier.company}</p>}
                {supplier?.contact && <p className="text-xs text-[hsl(var(--muted-foreground))]">{supplier.contact}</p>}
                {supplier?.email && <p className="text-xs text-[hsl(var(--muted-foreground))]">{supplier.email}</p>}
              </div>

              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Order Items</p>
                {!quote || quote.items.length === 0 ? (
                  <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
                    <p className="text-xs text-amber-700 dark:text-amber-300">No quote data available for this order</p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-[hsl(var(--muted))]/40 border-b">
                        <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                        <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-16">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-24">Unit Price</th>
                        <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-24">Total</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {po.items.map((item, idx) => {
                          const qi = quote?.items.find(q => q.itemId === item.id) || quote?.items[idx]
                          const unitPrice = qi?.unitPrice || 0
                          return (
                            <tr key={item.id}>
                              <td className="px-3 py-2">{item.description}</td>
                              <td className="px-3 py-2 text-center">{item.qty} {item.unit}</td>
                              <td className="px-3 py-2 text-right">PKR {unitPrice.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-medium">PKR {(unitPrice * item.qty).toLocaleString()}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Cost Breakdown</p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody className="divide-y">
                      <tr><td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">Items Subtotal</td><td className="px-3 py-2 text-right font-medium">PKR {itemsTotal.toLocaleString()}</td></tr>
                      {quote && quote.taxPct > 0 && <tr><td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">Tax</td><td className="px-3 py-2 text-right font-medium">{quote.taxPct}% (PKR {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})</td></tr>}
                      {quote && quote.transportCost > 0 && <tr><td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">Transport</td><td className="px-3 py-2 text-right font-medium">PKR {quote.transportCost.toLocaleString()}</td></tr>}
                      {quote && quote.otherCost > 0 && <tr><td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{quote.otherCostLabel || "Other"}</td><td className="px-3 py-2 text-right font-medium">PKR {quote.otherCost.toLocaleString()}</td></tr>}
                      <tr className="bg-[hsl(var(--muted))]/30 font-bold"><td className="px-3 py-2">Total Cost</td><td className="px-3 py-2 text-right">PKR {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {payments.length > 0 && (
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4 space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Payment Summary</p>
                  <div className="flex items-center justify-between"><span className="text-xs text-[hsl(var(--muted-foreground))]">Total Paid</span><span className="text-xs font-semibold">PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex items-center justify-between border-t pt-2"><span className="text-xs font-medium">Remaining</span><span className={`text-xs font-bold ${remaining <= 0 ? "text-emerald-600" : ""}`}>PKR {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Summary */}
              <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">Order Summary</p>
                <div className="flex items-center justify-between"><span className="text-xs text-[hsl(var(--muted-foreground))]">PO Number</span><span className="text-xs font-semibold">{po.poNumber}</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[hsl(var(--muted-foreground))]">Supplier</span><span className="text-xs font-semibold">{supplier?.name}</span></div>
                {supplier?.bankAccountName && <div className="flex items-center justify-between"><span className="text-xs text-[hsl(var(--muted-foreground))]">Bank Account</span><span className="text-xs font-semibold">{supplier.bankAccountName}</span></div>}
                {supplier?.bankIban && <div className="flex items-center justify-between"><span className="text-xs text-[hsl(var(--muted-foreground))]">IBAN</span><span className="text-xs font-mono font-semibold">{supplier.bankIban}</span></div>}
                <div className="border-t pt-2 space-y-1.5">
                  <div className="flex items-center justify-between"><span className="text-xs font-medium">Total Amount</span><span className="text-sm font-bold">PKR {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex items-center justify-between"><span className="text-xs text-[hsl(var(--muted-foreground))]">Paid</span><span className="text-xs font-semibold">PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex items-center justify-between"><span className="text-xs font-medium">Remaining</span><span className={`text-xs font-bold ${remaining <= 0 ? "text-emerald-600" : ""}`}>PKR {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>
              </div>

              {/* Payment history */}
              {payments.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Payment History</p>
                  <div className="space-y-2">
                    {payments.map((p, i) => (
                      <div key={p.id} className="rounded-lg border bg-[hsl(var(--muted))]/10 p-3 flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold">PKR {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))] capitalize">{p.method.replace(/_/g, " ")} · {new Date(p.date).toLocaleDateString()}</p>
                          {p.notes && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{p.notes}</p>}
                        </div>
                        {p.proofUrl && (
                          <a href={p.proofUrl} target="_blank" rel="noreferrer">
                            <img src={p.proofUrl} alt={`Proof ${i + 1}`} className="h-14 w-14 rounded-lg object-cover border shrink-0" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add payment */}
              {!showAddForm ? (
                <Button size="sm" variant="outline" className="h-8 text-xs w-full cursor-pointer"
                  onClick={() => setShowAddForm(true)}>
                  + Add Another Payment
                </Button>
              ) : (
              <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Add Payment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Amount (PKR)</label>
                      <input type="number" min="0" step="0.01" value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder={`Remaining: ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Method</label>
                      <select value={method} onChange={e => setMethod(e.target.value)}
                        className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]">
                        <option value="">Select method</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="online">Online Payment</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                      className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Notes</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Reference number, remarks..."
                      className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Payment Proof</label>
                    <input type="file" accept="image/*" onChange={handleProofChange}
                      className="w-full text-xs file:mr-3 file:h-7 file:rounded file:border-0 file:bg-[hsl(var(--muted))] file:px-3 file:text-xs file:font-medium cursor-pointer" />
                    {proofPreview && <img src={proofPreview} alt="Preview" className="mt-2 h-24 rounded-lg border object-cover" />}
                  </div>
                  <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={addPayment}
                    disabled={saving || !amount || !method || !date}>
                    {saving ? "Saving..." : "Add Payment"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          {isFullyPaid && !isInInventory && (po.status === "direct" || po.status === "finalized") && (
            <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={moveToInventory} disabled={saving}>
              {saving ? "Moving..." : "Move to Inventory"}
            </Button>
          )}
          {isInInventory && (
            <Badge variant="success" className="text-xs">In Inventory</Badge>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs ml-auto cursor-pointer" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
