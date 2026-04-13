"use client"
import { useState } from "react"
import { type PurchaseOrder, type Supplier, type SupplierQuote, type POItem, STATUS_LABELS, STATUS_VARIANT, calcQuoteTotal } from "@/lib/purchase"
import { generatePOPdf } from "@/lib/generate-po-pdf"
import { useDialog } from "@/components/ui/dialog-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  X, Download, MessageCircle, CheckCircle, XCircle, Send,
  Building2, Phone, Mail, MapPin, Calendar, User, Hash, ChevronRight
} from "lucide-react"

interface Props {
  po: PurchaseOrder
  allSuppliers: Supplier[]
  isAdmin: boolean
  onClose: () => void
  onUpdate: (updated: PurchaseOrder) => void
}

// ── Step indicator ───────────────────────────────────────────────
const STEPS = ["Created", "Sent to Admin", "Approved", "Sharing", "Quoted", "Finalized"]
const STATUS_STEP: Record<string, number> = {
  draft: 0, sent_to_admin: 1, approved: 2, rejected: 2,
  sharing: 3, quoted: 4, finalized: 5,
}

function StepBar({ status }: { status: string }) {
  const current = STATUS_STEP[status] ?? 0
  const rejected = status === "rejected"
  return (
    <div className="flex items-center gap-0 px-6 py-4 border-b bg-gradient-to-r from-[hsl(var(--muted))]/10 to-transparent overflow-x-auto">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center shrink-0">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            rejected && i === 2 ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30" :
            i < current ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" :
            i === current ? "text-[hsl(var(--foreground))] font-semibold bg-[hsl(var(--muted))]/40" :
            "text-[hsl(var(--muted-foreground))]"
          }`}>
            <div className={`h-2.5 w-2.5 rounded-full transition-colors ${
              rejected && i === 2 ? "bg-red-500" :
              i < current ? "bg-emerald-500" :
              i === current ? "bg-[hsl(var(--foreground))]" :
              "bg-[hsl(var(--border))]"
            }`} />
            {rejected && i === 2 ? "Rejected" : s}
          </div>
          {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-[hsl(var(--border))] mx-1" />}
        </div>
      ))}
    </div>
  )
}

// ── Quote entry form ─────────────────────────────────────────────
function QuoteForm({ po, supplierId, supplierName, existing, onSave, onCancel }: {
  po: PurchaseOrder
  supplierId: string
  supplierName: string
  existing?: SupplierQuote
  onSave: (q: SupplierQuote) => void
  onCancel: () => void
}) {
  const [items, setItems] = useState(
    po.items.map(i => ({ itemId: i.id, unitPrice: existing?.items.find(q => q.itemId === i.id)?.unitPrice ?? 0 }))
  )
  const [tax, setTax] = useState(existing?.taxPct ?? 0)
  const [transport, setTransport] = useState(existing?.transportCost ?? 0)
  const [other, setOther] = useState(existing?.otherCost ?? 0)
  const [otherLabel, setOtherLabel] = useState(existing?.otherCostLabel ?? "")
  const [notes, setNotes] = useState(existing?.notes ?? "")

  const itemsTotal = items.reduce((s, qi) => {
    const item = po.items.find(i => i.id === qi.itemId)
    return s + qi.unitPrice * (item?.qty ?? 0)
  }, 0)
  const grandTotal = itemsTotal + tax + transport + other

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ supplierId, supplierName, items, taxPct: tax, transportCost: transport, otherCost: other, otherCostLabel: otherLabel, notes, submittedAt: new Date().toISOString() })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[hsl(var(--muted))]/50 border-b">
              <th className="px-3 py-2 text-left font-medium text-[hsl(var(--muted-foreground))]">Item</th>
              <th className="px-3 py-2 text-right font-medium text-[hsl(var(--muted-foreground))] w-16">Qty</th>
              <th className="px-3 py-2 text-right font-medium text-[hsl(var(--muted-foreground))] w-28">Unit Price (PKR)</th>
              <th className="px-3 py-2 text-right font-medium text-[hsl(var(--muted-foreground))] w-24">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {po.items.map((item, idx) => (
              <tr key={item.id}>
                <td className="px-3 py-2">{item.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{item.qty} {item.unit}</td>
                <td className="px-3 py-2">
                  <input type="number" min="0" step="0.01" required value={items[idx].unitPrice}
                    onChange={e => setItems(prev => prev.map((q, i) => i === idx ? { ...q, unitPrice: Number(e.target.value) } : q))}
                    className="w-full h-7 rounded border bg-[hsl(var(--background))] px-2 text-right text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {(items[idx].unitPrice * item.qty).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Tax (PKR)", val: tax, set: setTax },
          { label: "Transport Cost", val: transport, set: setTransport },
          { label: "Other Cost", val: other, set: setOther },
        ].map(f => (
          <div key={f.label} className="space-y-1">
            <label className="text-xs font-medium">{f.label}</label>
            <input type="number" min="0" step="0.01" value={f.val}
              onChange={e => f.set(Number(e.target.value))}
              className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs font-medium">Other Cost Label</label>
          <input value={otherLabel} onChange={e => setOtherLabel(e.target.value)} placeholder="e.g. Customs"
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted))]/40 px-4 py-2.5">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">Grand Total</span>
        <span className="text-sm font-bold">PKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-8">Save Quote</Button>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

// ── Quote comparison table ───────────────────────────────────────
function QuoteComparison({ po }: { po: PurchaseOrder }) {
  if (po.quotes.length === 0) return null

  // Calculate item subtotals and total
  const itemSubtotals = po.items.map(item => {
    return po.quotes.map(q => {
      const qi = q.items.find(x => x.itemId === item.id)
      return qi ? qi.unitPrice * item.qty : 0
    })
  })

  const totalSubtotal = po.items.reduce((sum, item, idx) => {
    return sum + (itemSubtotals[idx]?.[0] || 0)
  }, 0)

  // Find best supplier by total cost
  const supplierTotals = po.quotes.map(q => calcQuoteTotal(po, q))
  const bestSupplierIdx = supplierTotals.indexOf(Math.min(...supplierTotals))
  const bestSupplier = po.quotes[bestSupplierIdx]

  // Calculate final cost per unit for each item from each supplier
  const getFinalUnitCost = (quote: SupplierQuote, item: POItem, itemIndex: number) => {
    const qi = quote.items.find(q => q.itemId === item.id)
    if (!qi) return 0

    // Item subtotal
    const itemSubtotal = qi.unitPrice * item.qty
    
    // Calculate this item's share of total
    const itemSharePercent = totalSubtotal > 0 ? itemSubtotal / totalSubtotal : 0
    
    // Distribute extra costs proportionally
    const totalExtraCost = quote.taxPct + quote.transportCost + quote.otherCost
    const itemExtraCost = itemSharePercent * totalExtraCost
    
    // Final cost for this item
    const finalItemCost = itemSubtotal + itemExtraCost
    
    // Cost per unit
    return finalItemCost / item.qty
  }

  return (
    <div className="space-y-3">
      {/* Price Per Unit + Cost Breakdown side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Quick comparison - Item prices */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Price Per Unit</p>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[hsl(var(--muted))]/40 border-b">
                  <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Item</th>
                  <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-8">Qty</th>
                  {po.quotes.map(q => (
                    <th key={q.supplierId} className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] text-[9px]">
                      {q.supplierName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {po.items.map((item, itemIdx) => {
                  const finalUnitCosts = po.quotes.map(q => getFinalUnitCost(q, item, itemIdx))
                  const minCost = Math.min(...finalUnitCosts)
                  
                  return (
                    <tr key={item.id} className="hover:bg-[hsl(var(--muted))]/20">
                      <td className="px-3 py-2 font-medium text-xs">{item.description}</td>
                      <td className="px-3 py-2 text-center text-[hsl(var(--muted-foreground))] text-xs">{item.qty}</td>
                      {po.quotes.map((q, qi) => {
                        const finalUnitCost = finalUnitCosts[qi]
                        const isBest = finalUnitCost === minCost
                        
                        return (
                          <td key={q.supplierId} className={`px-3 py-2 text-right font-semibold text-xs ${isBest ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40" : ""}`}>
                            {isBest && <span className="text-[8px] mr-1">✓</span>}
                            PKR {finalUnitCost.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total costs comparison */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Cost Breakdown</p>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[hsl(var(--muted))]/40 border-b">
                  <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Cost</th>
                  {po.quotes.map(q => (
                    <th key={q.supplierId} className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] text-[9px]">
                      {q.supplierName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">Items</td>
                  {po.quotes.map(q => {
                    const subtotal = po.items.reduce((sum, item) => {
                      const qi = q.items.find(x => x.itemId === item.id)
                      return sum + (qi ? qi.unitPrice * item.qty : 0)
                    }, 0)
                    return (
                      <td key={q.supplierId} className="px-3 py-2 text-right font-medium text-xs">
                        PKR {subtotal.toLocaleString()}
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">Tax</td>
                  {po.quotes.map(q => (
                    <td key={q.supplierId} className="px-3 py-2 text-right font-medium text-xs">
                      PKR {q.taxPct.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">Transport</td>
                  {po.quotes.map(q => (
                    <td key={q.supplierId} className="px-3 py-2 text-right font-medium text-xs">
                      PKR {q.transportCost.toLocaleString()}
                    </td>
                  ))}
                </tr>
                {po.quotes.some(q => q.otherCost > 0) && (
                  <tr>
                    <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{po.quotes[0]?.otherCostLabel || "Other"}</td>
                    {po.quotes.map(q => (
                      <td key={q.supplierId} className="px-3 py-2 text-right font-medium text-xs">
                        {q.otherCost > 0 ? `PKR ${q.otherCost.toLocaleString()}` : "—"}
                      </td>
                    ))}
                  </tr>
                )}
                <tr className="bg-[hsl(var(--muted))]/30 font-bold">
                  <td className="px-3 py-2 text-xs">TOTAL</td>
                  {po.quotes.map(q => {
                    const total = calcQuoteTotal(po, q)
                    const allTotals = po.quotes.map(x => calcQuoteTotal(po, x))
                    const isBest = total === Math.min(...allTotals)
                    return (
                      <td key={q.supplierId} className={`px-3 py-2 text-right text-xs font-bold ${isBest ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40" : ""}`}>
                        {isBest && <span className="text-[8px] mr-1">✓</span>}
                        PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main PODetail ────────────────────────────────────────────────
export function PODetail({ po, allSuppliers, isAdmin, onClose, onUpdate }: Props) {
  const { alert } = useDialog()
  const [adminNote, setAdminNote] = useState(po.adminNote)
  const [addingQuoteFor, setAddingQuoteFor] = useState<string | null>(null)
  const [showDownloadOptions, setShowDownloadOptions] = useState(false)
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)
  const [selectedSupplierForFinalize, setSelectedSupplierForFinalize] = useState<string | null>(null)

  const selectedSuppliers = allSuppliers.filter(s => po.supplierIds.includes(s.id))

  function approve() { onUpdate({ ...po, status: "approved", adminNote }) }
  async function reject() {
    if (!adminNote.trim()) {
      await alert({ type: "error", title: "Rejection Reason Required", message: "Please add a note explaining why this PO is being rejected." })
      return
    }
    onUpdate({ ...po, status: "rejected", adminNote })
  }
  function sendToAdmin() { onUpdate({ ...po, status: "sent_to_admin" }) }

  function sendWhatsApp(sup: Supplier) {
    const phone = sup.contact.replace(/\D/g, "")
    const text = [
      `*Purchase Order: ${po.poNumber}*`,
      `Date: ${new Date(po.createdAt).toLocaleDateString()}`,
      po.deliveryDate ? `Required Delivery: ${po.deliveryDate}` : "",
      ``,
      `*Items:*`,
      ...po.items.map((i, idx) => `${idx + 1}. ${i.description} — Qty: ${i.qty} ${i.unit}`),
      po.notes ? `\nNotes: ${po.notes}` : "",
      `\nPlease reply with your best quote including unit prices, tax, and delivery charges.`,
    ].filter(Boolean).join("\n")
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank")

    const alreadySent = po.suppliersSent.find(s => s.supplierId === sup.id)
    if (!alreadySent) {
      const updated: PurchaseOrder = {
        ...po,
        status: "sharing",
        suppliersSent: [...po.suppliersSent, { supplierId: sup.id, supplierName: sup.name, sentAt: new Date().toISOString() }],
      }
      onUpdate(updated)
    }
  }

  function saveQuote(q: SupplierQuote) {
    const existing = po.quotes.filter(x => x.supplierId !== q.supplierId)
    const updated: PurchaseOrder = {
      ...po,
      status: "quoted",
      quotes: [...existing, q],
    }
    onUpdate(updated)
    setAddingQuoteFor(null)
  }

  function finalize() { setShowFinalizeModal(true) }

  function confirmFinalize(supplierId: string) {
    const selectedQuote = po.quotes.find(q => q.supplierId === supplierId)
    onUpdate({ 
      ...po, 
      status: "finalized", 
      supplierIds: [supplierId], 
      supplierNames: [selectedQuote?.supplierName || ""],
      finalizedSupplierId: supplierId
    })
    setShowFinalizeModal(false)
  }

  async function handleDownload(includeSuppliers: boolean) {
    await generatePOPdf(po, selectedSuppliers, includeSuppliers)
    setShowDownloadOptions(false)
  }

  // Suppliers to show in sharing step — all suppliers of same type
  const shareableSuppliers = allSuppliers.filter(s => s.type === po.type && po.supplierIds.includes(s.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Chrome header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[hsl(var(--muted))]/40 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-[hsl(var(--primary))]">{po.poNumber}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Purchase Order</span>
            </div>
            <div className="h-8 w-px bg-[hsl(var(--border))]" />
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[po.status]} className="text-[10px]">{STATUS_LABELS[po.status]}</Badge>
              <Badge variant={po.type === "local" ? "secondary" : "secondary"} className="text-[10px]">{po.type}</Badge>
              {po.quotes.length > 0 && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  {po.quotes.length} Quote{po.quotes.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setShowDownloadOptions(true)}>
              Download
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[hsl(var(--muted))]/20" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Step bar — hidden for direct POs */}
        {po.status !== "direct" && <StepBar status={po.status} />}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 pt-6 pb-4 border-b bg-gradient-to-b from-[hsl(var(--muted))]/5 to-transparent">
            <div className="flex items-start justify-between gap-8">
              <div>
                <p className="text-2xl font-bold tracking-tight">Purchase Order</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">VoltrixERP · Procurement</p>
              </div>
              <div className="text-right space-y-2 shrink-0">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xl font-bold text-[hsl(var(--primary))]">{po.poNumber}</span>
                </div>
                <div className="flex items-center justify-end gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  <span>{new Date(po.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</span>
                </div>
                <div className="flex items-center justify-end gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  <span>{po.createdBy}</span>
                </div>
                {po.deliveryDate && (
                  <div className="flex items-center justify-end gap-1.5 text-xs">
                    <span className="font-medium text-[hsl(var(--foreground))]">Required by {po.deliveryDate}</span>
                  </div>
                )}
                {po.receivingLocation && (
                  <div className="flex items-center justify-end gap-1.5 text-xs">
                    <span className="font-medium text-[hsl(var(--foreground))]">{po.receivingLocation}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* Row 1: Best Supplier + Suppliers */}
            <div className="grid grid-cols-3 gap-4">
              {/* Best Supplier - 1 col */}
              {po.quotes.length > 0 && (
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3 space-y-2 h-full flex flex-col">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-[8px] font-bold text-[hsl(var(--muted-foreground))]">BEST</p>
                      <p className="text-[8px] font-bold text-[hsl(var(--muted-foreground))]">SUPPLIER</p>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-[hsl(var(--foreground))]">{po.quotes[po.quotes.map(q => calcQuoteTotal(po, q)).indexOf(Math.min(...po.quotes.map(q => calcQuoteTotal(po, q))))].supplierName}</p>
                  <div className="rounded-lg bg-[hsl(var(--background))] p-2 space-y-0.5 border">
                    <p className="text-[8px] text-[hsl(var(--muted-foreground))]">Total Cost</p>
                    <p className="text-sm font-bold text-[hsl(var(--foreground))]">PKR {Math.min(...po.quotes.map(q => calcQuoteTotal(po, q))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--background))] p-2 border">
                    <p className="text-[8px] text-[hsl(var(--muted-foreground))]">Savings</p>
                    <p className="text-xs font-bold text-[hsl(var(--foreground))]">PKR {(Math.max(...po.quotes.map(q => calcQuoteTotal(po, q))) - Math.min(...po.quotes.map(q => calcQuoteTotal(po, q)))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              )}

              {/* Suppliers - 2 cols */}
              <div className="col-span-2 rounded-lg border bg-gradient-to-br from-[hsl(var(--muted))]/5 to-transparent p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Suppliers ({po.supplierNames.length})</p>
                  <Badge variant="secondary" className="text-[8px] h-5">{po.supplierNames.length} Active</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selectedSuppliers.map(supplier => (
                    <div key={supplier.id} className="rounded-lg border bg-[hsl(var(--card))] p-2.5 hover:shadow-md transition-shadow">
                      <p className="text-[10px] font-bold text-[hsl(var(--primary))]">{supplier.name}</p>
                      <div className="space-y-1 mt-1.5">
                        {supplier.company && <div className="flex items-center gap-1 text-[9px] text-[hsl(var(--muted-foreground))]"><span>{supplier.company}</span></div>}
                        <div className="flex items-center gap-1 text-[9px] text-[hsl(var(--muted-foreground))]"><span className="font-medium">{supplier.contact}</span></div>
                        {supplier.email && <div className="flex items-center gap-1 text-[9px] text-[hsl(var(--muted-foreground))]"><span>{supplier.email}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quote Comparison */}
            {po.quotes.length > 0 && <QuoteComparison po={po} />}

            {/* Items — shown when pending approval (no quotes yet) */}
            {po.status === "sent_to_admin" && po.items.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Order Items</p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[hsl(var(--muted))]/40 border-b">
                        <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                        <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-16">Qty</th>
                        <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-16">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {po.items.map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-center">{item.qty}</td>
                          <td className="px-3 py-2">{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Send to Suppliers */}
            {!isAdmin && po.status !== "sent_to_admin" && po.status !== "direct" && (
              <div className="space-y-2">
                <button
                  onClick={() => setAddingQuoteFor(addingQuoteFor === "toggle-suppliers" ? null : "toggle-suppliers")}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center justify-between flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Send to Suppliers</p>
                    <Badge variant="outline" className="text-[8px] gap-1 h-5">
                      {po.suppliersSent.length} sent · {po.quotes.length} quoted
                    </Badge>
                  </div>
                  <span className="text-xs ml-2">{addingQuoteFor === "toggle-suppliers" ? "−" : "+"}</span>
                </button>
                
                {addingQuoteFor === "toggle-suppliers" && (
                  <div className="grid grid-cols-2 gap-2">
                    {shareableSuppliers.map(sup => {
                      const sent = po.suppliersSent.find(s => s.supplierId === sup.id)
                      const hasQuote = po.quotes.find(q => q.supplierId === sup.id)
                      return (
                        <div key={sup.id} className={`flex items-center justify-between rounded-lg border px-2.5 py-2 transition-all text-xs ${
                          hasQuote ? "bg-[hsl(var(--muted))]/30 border-[hsl(var(--border))]" : "hover:bg-[hsl(var(--muted))]/20"
                        }`}>
                          <div>
                            <p className="text-[9px] font-semibold text-[hsl(var(--foreground))]">{sup.name}</p>
                            <p className="text-[8px] text-[hsl(var(--muted-foreground))]">{sup.contact}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {hasQuote && <Badge variant="secondary" className="text-[7px] gap-0.5 h-4">Quoted</Badge>}
                            {sent && !hasQuote && <Badge variant="secondary" className="text-[7px] h-4">Sent</Badge>}
                            <Button size="sm" variant={sent ? "outline" : "default"} className="h-5 text-[8px] px-1.5 gap-0.5"
                              onClick={() => sendWhatsApp(sup)}>
                              {sent ? "Resend" : "Send"}
                            </Button>
                            {sent && (
                              <Button size="sm" variant="outline" className="h-5 text-[8px] px-1.5"
                                onClick={() => setAddingQuoteFor(addingQuoteFor === sup.id ? null : sup.id)}>
                                {hasQuote ? "Edit" : "Add Quote"}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}


              </div>
            )}

            {/* Admin note */}
            {isAdmin && po.status !== "approved" && po.status !== "in_inventory" && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Admin Note</p>
                <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                  placeholder="Add notes for this PO"
                  className="w-full rounded-lg border bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
              </div>
            )}

            {po.adminNote && !isAdmin && (
              <div className={`rounded-lg border px-3 py-2 ${po.status === "rejected" ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "bg-[hsl(var(--muted))]/30"}`}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">Admin Note</p>
                <p className={`text-xs ${po.status === "rejected" ? "text-red-700 dark:text-red-400" : ""}`}>{po.adminNote}</p>
              </div>
            )}

            {po.notes && (
              <div className="rounded-lg border px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">Notes</p>
                <p className="text-xs">{po.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 px-8 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          {po.status !== "direct" && !isAdmin && (
            <>
              {po.status === "draft" && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onUpdate({ ...po, status: "draft" })}>
                  Back to Draft
                </Button>
              )}
              {po.status === "draft" && (
                <Button size="sm" className="h-8 text-xs" onClick={sendToAdmin}>
                  Send to Admin
                </Button>
              )}
              {po.status !== "finalized" && po.status !== "in_inventory" && po.quotes.length > 0 && (
                <Button size="sm" className="h-8 text-xs" onClick={finalize}>
                  Finalize Order
                </Button>
              )}
            </>
          )}
          {po.status !== "direct" && isAdmin && (
            <>
              {po.status !== "draft" && po.status !== "finalized" && po.status !== "approved" && po.status !== "in_inventory" && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onUpdate({ ...po, status: "draft" })}>
                  Back to Draft
                </Button>
              )}
              {po.status !== "approved" && po.status !== "rejected" && po.status !== "finalized" && po.status !== "in_inventory" && (
                <Button size="sm" className="h-8 text-xs" onClick={approve}>
                  Approve
                </Button>
              )}
              {po.status !== "rejected" && po.status !== "finalized" && po.status !== "approved" && po.status !== "in_inventory" && (
                <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={reject}>
                  Reject
                </Button>
              )}
            </>
          )}
          <Button size="sm" variant="ghost" className="h-8 text-xs ml-auto" onClick={onClose}>Close</Button>
        </div>
      </div>

      {/* Add Quote Modal */}
      {addingQuoteFor && addingQuoteFor !== "toggle-suppliers" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAddingQuoteFor(null)}>
          <div className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <p className="text-sm font-semibold">Add Quote</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {shareableSuppliers.find(s => s.id === addingQuoteFor)?.name}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddingQuoteFor(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6">
              <QuoteForm
                po={po}
                supplierId={addingQuoteFor}
                supplierName={shareableSuppliers.find(s => s.id === addingQuoteFor)?.name ?? ""}
                existing={po.quotes.find(q => q.supplierId === addingQuoteFor)}
                onSave={saveQuote}
                onCancel={() => setAddingQuoteFor(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Download options dialog */}
      {showDownloadOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDownloadOptions(false)}>
          <div className="w-full max-w-sm rounded-xl border bg-[hsl(var(--card))] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <p className="text-sm font-semibold">Download PO</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowDownloadOptions(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Choose download format:</p>
              <Button size="sm" className="w-full h-9 justify-start" onClick={() => handleDownload(true)}>
                <Download className="h-3.5 w-3.5 mr-2" />
                With Supplier Details
              </Button>
              <Button size="sm" variant="outline" className="w-full h-9 justify-start" onClick={() => handleDownload(false)}>
                <Download className="h-3.5 w-3.5 mr-2" />
                Without Supplier Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Order Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowFinalizeModal(false)}>
          <div className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <p className="text-sm font-semibold">Finalize Order</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Select a supplier to finalize this purchase order</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowFinalizeModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-3">
              {po.quotes.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No quotes available</p>
              ) : (
                <>
                  {po.quotes.map(quote => {
                    const total = calcQuoteTotal(po, quote)
                    const allTotals = po.quotes.map(q => calcQuoteTotal(po, q))
                    const isBest = total === Math.min(...allTotals)
                    const isSelected = selectedSupplierForFinalize === quote.supplierId
                    
                    return (
                      <button
                        key={quote.supplierId}
                        onClick={() => setSelectedSupplierForFinalize(quote.supplierId)}
                        className={`w-full rounded-lg border p-4 text-left transition-all hover:shadow-md ${
                          isSelected
                            ? "border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 ring-2 ring-blue-400"
                            : isBest
                            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                            : "border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 hover:bg-[hsl(var(--muted))]/30"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{quote.supplierName}</p>
                              {isBest && (
                                <Badge variant="secondary" className="text-[8px] h-5">BEST</Badge>
                              )}
                              {isSelected && (
                                <Badge variant="secondary" className="text-[8px] h-5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">SELECTED</Badge>
                              )}
                            </div>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                              Total Cost: PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Items: PKR {po.items.reduce((sum, item) => {
                              const qi = quote.items.find(q => q.itemId === item.id)
                              return sum + (qi ? qi.unitPrice * item.qty : 0)
                            }, 0).toLocaleString()}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Tax: PKR {quote.taxPct.toLocaleString()}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Transport: PKR {quote.transportCost.toLocaleString()}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
              <Button 
                size="sm" 
                className="h-8 text-xs" 
                onClick={() => selectedSupplierForFinalize && confirmFinalize(selectedSupplierForFinalize)}
                disabled={!selectedSupplierForFinalize}
              >
                Send to Finance
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 text-xs" 
                onClick={() => setShowFinalizeModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
