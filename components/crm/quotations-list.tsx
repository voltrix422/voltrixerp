"use client"
import { useState, useEffect } from "react"
import { getQuotations, saveQuotation, deleteQuotation, generateQuotationNumber, type Quotation, type QuotationItem, STATUS_LABELS, STATUS_COLORS } from "@/lib/quotations"
import { getClients, type Client } from "@/lib/crm"
import { getInventoryItems, type InventoryItem } from "@/lib/purchase"
import { downloadQuotationPDF } from "@/lib/generate-quotation-pdf"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { Plus, X, Trash2, FileText, Edit, ShoppingCart } from "lucide-react"
import { saveOrder, generateOrderNumber } from "@/lib/orders"
import type { Order } from "@/lib/orders"

export function QuotationsList({ currentUser }: { currentUser: string }) {
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Quotation | null>(null)
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Quotation | null>(null)

  useEffect(() => {
    Promise.all([getQuotations(), getClients()]).then(([q, c]) => {
      setQuotations(q); setClients(c); setLoading(false)
    })
  }, [])

  const filtered = quotations.filter(q => {
    const ms = (q.quotationNumber?.toLowerCase() || "").includes(search.toLowerCase()) || (q.clientName?.toLowerCase() || "").includes(search.toLowerCase())
    return ms && (statusFilter === "all" || q.status === statusFilter)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b">
          {["all","draft","sent","accepted","rejected","expired","converted"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium transition-colors relative cursor-pointer ${statusFilter===s?"text-[hsl(var(--foreground))]":"text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}>
              {s==="all"?"All":STATUS_LABELS[s as keyof typeof STATUS_LABELS]||s}
              {statusFilter===s&&<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]"/>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="h-8 px-3 rounded border bg-[hsl(var(--background))] text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] w-40"/>
          <Button size="sm" className="h-8 text-xs px-3 cursor-pointer" onClick={()=>setShowForm(true)}><Plus className="h-3.5 w-3.5 mr-1"/>Create Quotation</Button>
        </div>
      </div>
      {loading?(<div className="flex items-center justify-center py-20"><div className="h-8 w-8 rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent animate-spin"/></div>
      ):filtered.length===0?(<div className="flex flex-col items-center justify-center py-20 text-center"><FileText className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3"/><p className="text-sm text-[hsl(var(--muted-foreground))]">{quotations.length===0?"No quotations yet. Create your first one!":"No quotations match your filters."}</p></div>
      ):(<div className="rounded-lg border overflow-hidden"><table className="w-full"><thead><tr className="border-b bg-[hsl(var(--muted))]/40">
        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Quotation #</th>
        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Client</th>
        <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Items</th>
        <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total</th>
        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Valid Until</th>
        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
        <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Actions</th>
      </tr></thead><tbody className="divide-y">
        {filtered.map(q=>(
          <tr key={q.id} className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer" onClick={()=>setSelected(q)}>
            <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{q.quotationNumber}</td>
            <td className="px-4 py-2.5 text-xs font-medium">{q.clientName}</td>
            <td className="px-4 py-2.5 text-xs text-center">{q.items?.length||0}</td>
            <td className="px-4 py-2.5 text-xs text-right font-semibold">PKR {(q.total||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
            <td className="px-4 py-2.5"><span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status]}</span></td>
            <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{q.validUntil?new Date(q.validUntil).toLocaleDateString():"—"}</td>
            <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{q.createdAt?new Date(q.createdAt).toLocaleDateString():"—"}</td>
            <td className="px-4 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-center gap-2">
                <button onClick={()=>setEditingQuotation(q)} className="text-blue-500 hover:text-blue-700 cursor-pointer" title="Edit"><Edit className="h-3.5 w-3.5"/></button>
                <button onClick={()=>downloadQuotationPDF(q)} className="text-[#1a9f9a] hover:text-[#158a85] cursor-pointer" title="Download PDF"><FileText className="h-3.5 w-3.5"/></button>
                <button onClick={()=>setDeleteConfirm(q)} className="text-red-500 hover:text-red-700 cursor-pointer" title="Delete"><Trash2 className="h-3.5 w-3.5"/></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody></table></div>)}
      {showForm&&<QuotationForm currentUser={currentUser} clients={clients} onClose={()=>setShowForm(false)} onSave={q=>{setQuotations(prev=>[q,...prev.filter(x=>x.id!==q.id)]);setShowForm(false)}}/>}
      {editingQuotation&&<QuotationForm currentUser={currentUser} clients={clients} existing={editingQuotation} onClose={()=>setEditingQuotation(null)} onSave={q=>{setQuotations(prev=>prev.map(x=>x.id===q.id?q:x));setEditingQuotation(null)}}/>}
      {selected&&!editingQuotation&&<QuotationDetail quotation={selected} onClose={()=>setSelected(null)} onEdit={()=>{setEditingQuotation(selected);setSelected(null)}} onDelete={id=>{setQuotations(prev=>prev.filter(x=>x.id!==id));setSelected(null)}}/>}
      <ConfirmDialog isOpen={!!deleteConfirm} title="Delete Quotation" message={`Delete ${deleteConfirm?.quotationNumber}?`} confirmText="Delete" cancelText="Cancel" variant="danger"
        onConfirm={()=>{if(deleteConfirm){deleteQuotation(deleteConfirm.id);setQuotations(prev=>prev.filter(x=>x.id!==deleteConfirm.id))}setDeleteConfirm(null)}}
        onCancel={()=>setDeleteConfirm(null)}/>
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────
function QuotationForm({ currentUser, clients, existing, onClose, onSave }: {
  currentUser: string; clients: Client[]; existing?: Quotation
  onClose: () => void; onSave: (q: Quotation) => void
}) {
  const [clientId, setClientId] = useState(existing?.clientId || "")
  const [clientSearch, setClientSearch] = useState("")
  const [showClientDrop, setShowClientDrop] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState(existing?.deliveryAddress || "")
  const [validUntil, setValidUntil] = useState(existing?.validUntil || "")
  const [notes, setNotes] = useState(existing?.notes || "")
  const [items, setItems] = useState<QuotationItem[]>(existing?.items || [])
  const [taxPercent, setTaxPercent] = useState(existing?.taxPercent || 0)
  const [discount, setDiscount] = useState(existing?.discount || 0)
  const [discountIsPercentage, setDiscountIsPercentage] = useState(existing?.discountIsPercentage ?? true)
  const [transportCost, setTransportCost] = useState(existing?.transportCost || 0)
  const [transportLabel, setTransportLabel] = useState(existing?.transportLabel || "Transport")
  const [transportIsPercentage, setTransportIsPercentage] = useState(existing?.transportIsPercentage ?? false)
  const [otherCost, setOtherCost] = useState(existing?.otherCost || 0)
  const [otherCostLabel, setOtherCostLabel] = useState(existing?.otherCostLabel || "Other")
  const [otherCostIsPercentage, setOtherCostIsPercentage] = useState(existing?.otherCostIsPercentage ?? false)
  const [status, setStatus] = useState<Quotation["status"]>(existing?.status || "draft")
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [showInventory, setShowInventory] = useState(false)
  const [invSearch, setInvSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [qtyError, setQtyError] = useState("")

  useEffect(() => { getInventoryItems().then(setInventoryItems) }, [])

  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const discountAmount = discountIsPercentage ? subtotal * (discount / 100) : discount
  const discountedSubtotal = subtotal - discountAmount
  const taxAmount = subtotal * (taxPercent / 100)
  const transportAmount = transportIsPercentage ? discountedSubtotal * (transportCost / 100) : transportCost
  const otherAmount = otherCostIsPercentage ? discountedSubtotal * (otherCost / 100) : otherCost
  const total = discountedSubtotal + taxAmount + transportAmount + otherAmount

  function addCustomItem() {
    setItems(prev => [...prev, { id: Date.now().toString(), description: "", qty: 1, unit: "pcs", unitPrice: 0, isCustom: true }])
  }

  function addFromInventory(inv: InventoryItem) {
    const ex = items.find(i => i.inventoryItemId === inv.id)
    if (ex) {
      if (ex.qty < inv.qty) setItems(prev => prev.map(i => i.id === ex.id ? { ...i, qty: i.qty + 1 } : i))
    } else {
      setItems(prev => [...prev, { id: Date.now().toString(), description: inv.description, qty: 1, unit: inv.unit, unitPrice: inv.unitPrice, isCustom: false, inventoryItemId: inv.id, availableQty: inv.qty, costPrice: inv.unitPrice }])
    }
    setShowInventory(false)
  }

  function updateItem(id: string, key: keyof QuotationItem, value: any) {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      if (key === "qty" && i.availableQty !== undefined && Number(value) > i.availableQty) {
        setQtyError(`Max available: ${i.availableQty} ${i.unit}`); return i
      }
      setQtyError("")
      return { ...i, [key]: value }
    }))
  }

  async function submit() {
    if (!clientId || items.length === 0) return
    setSaving(true)
    const client = clients.find(c => c.id === clientId)
    const quotationNumber = existing?.quotationNumber || await generateQuotationNumber()
    const q: Quotation = {
      id: existing?.id || Date.now().toString(),
      quotationNumber, clientId, clientName: client?.name || "",
      items, subtotal, taxPercent, tax: taxAmount,
      transportCost, transportLabel, transportIsPercentage, transportCostValue: transportAmount,
      otherCost, otherCostLabel, otherCostIsPercentage, otherCostValue: otherAmount,
      discount, discountIsPercentage, discountValue: discountAmount,
      total, status, notes: notes.trim(), deliveryAddress: deliveryAddress.trim(),
      validUntil, createdAt: existing?.createdAt || new Date().toISOString(), createdBy: existing?.createdBy || currentUser,
    }
    await saveQuotation(q)
    onSave(q)
    setSaving(false)
  }

  const selectedClient = clients.find(c => c.id === clientId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <p className="text-base font-bold">{existing ? "Edit Quotation" : "Create Quotation"}</p>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose}><X className="h-4 w-4"/></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Client */}
          <div className="space-y-1.5 relative">
            <label className="text-xs font-semibold">Select Client *</label>
            <button type="button" onClick={() => setShowClientDrop(!showClientDrop)}
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm text-left flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]">
              <span className={clientId ? "capitalize" : "text-[hsl(var(--muted-foreground))]"}>{selectedClient?.name || "Choose a client..."}</span>
              <svg className="h-4 w-4 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>
            {showClientDrop && (
              <><div className="fixed inset-0 z-10" onClick={() => setShowClientDrop(false)}/>
              <div className="absolute z-20 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-[hsl(var(--background))] shadow-lg">
                <div className="p-2 border-b"><input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Search client..." className="w-full h-8 rounded border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none"/></div>
                {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                  <div key={c.id} onClick={() => { setClientId(c.id); setShowClientDrop(false); setClientSearch("") }} className="px-3 py-2 text-sm cursor-pointer hover:bg-[hsl(var(--muted))]/40 capitalize border-t">
                    {c.name}{c.company && <span className="text-[hsl(var(--muted-foreground))] ml-2 text-xs">({c.company})</span>}
                  </div>
                ))}
              </div></>
            )}
          </div>
          {/* Delivery & Validity */}
          <div className="grid grid-cols-3 gap-4 pt-3 border-t">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-semibold">Delivery Address</label>
              <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Enter delivery address"
                className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Valid Until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
            </div>
          </div>
          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="• Special instructions&#10;• Delivery requirements&#10;• Terms and conditions"
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"/>
          </div>
          {/* Items */}
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Items *</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => setShowInventory(true)}><Plus className="h-3.5 w-3.5 mr-1"/>From Inventory</Button>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={addCustomItem}><Plus className="h-3.5 w-3.5 mr-1"/>Custom Product</Button>
              </div>
            </div>
            {qtyError && <p className="text-xs text-orange-600 mb-2">{qtyError}</p>}
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center bg-[hsl(var(--muted))]/10">
                <ShoppingCart className="h-10 w-10 text-[hsl(var(--muted-foreground))] opacity-30 mx-auto mb-2"/>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No items added yet</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[hsl(var(--muted))]/40 border-b">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] w-24">Qty</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] w-20">Unit</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[hsl(var(--muted-foreground))] w-32">Unit Price</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[hsl(var(--muted-foreground))] w-28">Total</th>
                    <th className="w-10"/>
                  </tr></thead>
                  <tbody className="divide-y">
                    {items.map(item => (
                      <tr key={item.id}>
                        <td className="px-2 py-1.5">
                          <input value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)} disabled={!item.isCustom} placeholder="Product description"
                            className="w-full h-8 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:opacity-60"/>
                          {item.availableQty !== undefined && <p className="text-[10px] text-green-600 mt-0.5 px-1">Stock: {item.availableQty} {item.unit}</p>}
                        </td>
                        <td className="px-2 py-1.5"><input type="number" min="1" value={item.qty} onChange={e => updateItem(item.id, "qty", Number(e.target.value))} className="w-full h-8 rounded border bg-[hsl(var(--background))] px-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"/></td>
                        <td className="px-2 py-1.5"><input value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)} className="w-full h-8 rounded border bg-[hsl(var(--background))] px-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"/></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" value={item.unitPrice} onChange={e => updateItem(item.id, "unitPrice", Number(e.target.value))} className="w-full h-8 rounded border bg-[hsl(var(--background))] px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"/></td>
                        <td className="px-2 py-1.5 text-xs text-right font-medium">PKR {(item.qty * item.unitPrice).toLocaleString()}</td>
                        <td className="px-2 py-1.5"><button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-600 cursor-pointer"><X className="h-3.5 w-3.5"/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Financials */}
          <div className="pt-3 border-t grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Tax (%)</label>
                <input type="number" min="0" max="100" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))} className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Discount</label>
                <div className="flex gap-2">
                  <input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="flex-1 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                  <select value={discountIsPercentage?"pct":"flat"} onChange={e => setDiscountIsPercentage(e.target.value==="pct")} className="h-9 rounded-md border bg-[hsl(var(--background))] px-2 text-sm focus:outline-none">
                    <option value="pct">%</option><option value="flat">PKR</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Transport / Expense</label>
                <div className="flex gap-2">
                  <input value={transportLabel} onChange={e => setTransportLabel(e.target.value)} placeholder="Label" className="w-28 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                  <input type="number" min="0" value={transportCost} onChange={e => setTransportCost(Number(e.target.value))} className="flex-1 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                  <select value={transportIsPercentage?"pct":"flat"} onChange={e => setTransportIsPercentage(e.target.value==="pct")} className="h-9 rounded-md border bg-[hsl(var(--background))] px-2 text-sm focus:outline-none">
                    <option value="flat">PKR</option><option value="pct">%</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Other Cost</label>
                <div className="flex gap-2">
                  <input value={otherCostLabel} onChange={e => setOtherCostLabel(e.target.value)} placeholder="Label" className="w-28 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                  <input type="number" min="0" value={otherCost} onChange={e => setOtherCost(Number(e.target.value))} className="flex-1 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                  <select value={otherCostIsPercentage?"pct":"flat"} onChange={e => setOtherCostIsPercentage(e.target.value==="pct")} className="h-9 rounded-md border bg-[hsl(var(--background))] px-2 text-sm focus:outline-none">
                    <option value="flat">PKR</option><option value="pct">%</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          {/* Summary */}
          <div className="pt-3 border-t">
            <div className="ml-auto w-64 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Subtotal</span><span className="font-medium">PKR {subtotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              {discount>0&&<div className="flex justify-between text-red-600"><span>Discount {discountIsPercentage?`(${discount}%)`:""}</span><span>-PKR {discountAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {taxPercent>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Tax ({taxPercent}%)</span><span>PKR {taxAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {transportCost>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">{transportLabel}</span><span>PKR {transportAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {otherCost>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">{otherCostLabel}</span><span>PKR {otherAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              <div className="flex justify-between pt-1.5 border-t font-bold text-sm"><span>Total</span><span className="text-[#1faca6]">PKR {total.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
            </div>
          </div>
          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as Quotation["status"])} className="h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]">
              {(["draft","sent","accepted","rejected","expired"] as const).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={submit} disabled={saving||!clientId||items.length===0}>
            {saving?"Saving...":existing?"Update Quotation":"Create Quotation"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={onClose}>Cancel</Button>
        </div>
      </div>
      {/* Inventory Picker */}
      {showInventory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowInventory(false)}>
          <div className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <p className="text-sm font-semibold">Select from Inventory</p>
              <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => setShowInventory(false)}><X className="h-4 w-4"/></Button>
            </div>
            <div className="p-3 border-b shrink-0">
              <input value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search inventory..." className="w-full h-8 rounded border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"/>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {inventoryItems.filter(i => i.description.toLowerCase().includes(invSearch.toLowerCase())).map(inv => (
                <div key={inv.id} onClick={() => addFromInventory(inv)} className="flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--muted))]/40 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">{inv.description}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Stock: {inv.qty} {inv.unit} | {inv.supplier}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">PKR {inv.unitPrice.toLocaleString()}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">per {inv.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Detail View ──────────────────────────────────────────────────────────────
function QuotationDetail({ quotation, onClose, onEdit, onDelete }: {
  quotation: Quotation; onClose: () => void; onEdit: () => void; onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await deleteQuotation(quotation.id)
    onDelete(quotation.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <p className="text-base font-bold text-[hsl(var(--primary))]">{quotation.quotationNumber}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{quotation.clientName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[quotation.status]}`}>{STATUS_LABELS[quotation.status]}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose}><X className="h-4 w-4"/></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Info Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Created</p>
              <p className="text-sm font-medium">{new Date(quotation.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Valid Until</p>
              <p className="text-sm font-medium">{quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "—"}</p>
            </div>
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Created By</p>
              <p className="text-sm font-medium">{quotation.createdBy}</p>
            </div>
          </div>

          {/* Delivery Address */}
          {quotation.deliveryAddress && (
            <div>
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Delivery Address</p>
              <p className="text-sm">{quotation.deliveryAddress}</p>
            </div>
          )}

          {/* Notes */}
          {quotation.notes && (
            <div>
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">Notes</p>
              <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-3">
                {quotation.notes.split("\n").map((line, i) => (
                  <p key={i} className="text-sm">{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Items</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b bg-[hsl(var(--muted))]/40">
                  <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Description</th>
                  <th className="h-8 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-20">Qty</th>
                  <th className="h-8 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-16">Unit</th>
                  <th className="h-8 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-28">Unit Price</th>
                  <th className="h-8 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-28">Total</th>
                </tr></thead>
                <tbody className="divide-y">
                  {quotation.items.map(item => (
                    <tr key={item.id} className="hover:bg-[hsl(var(--muted))]/20">
                      <td className="px-3 py-2 text-xs">{item.description}</td>
                      <td className="px-3 py-2 text-xs text-center">{item.qty}</td>
                      <td className="px-3 py-2 text-xs text-center">{item.unit}</td>
                      <td className="px-3 py-2 text-xs text-right">PKR {item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-right font-medium">PKR {(item.qty * item.unitPrice).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Subtotal</span><span>PKR {quotation.subtotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              {(quotation.discountValue||0)>0&&<div className="flex justify-between text-red-600"><span>Discount {quotation.discountIsPercentage?`(${quotation.discount}%)`:""}</span><span>-PKR {(quotation.discountValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {quotation.taxPercent>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Tax ({quotation.taxPercent}%)</span><span>PKR {quotation.tax.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {quotation.transportCost>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">{quotation.transportLabel}</span><span>PKR {(quotation.transportCostValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {quotation.otherCost>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">{quotation.otherCostLabel}</span><span>PKR {(quotation.otherCostValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              <div className="flex justify-between pt-1.5 border-t font-bold text-sm"><span>Total</span><span className="text-[#1faca6]">PKR {quotation.total.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={onEdit}><Edit className="h-3.5 w-3.5 mr-1"/>Edit</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => downloadQuotationPDF(quotation)}><FileText className="h-3.5 w-3.5 mr-1"/>Download PDF</Button>
          <ConvertToOrderButton quotation={quotation} onConverted={id => { onDelete(quotation.id) }} />
          <Button size="sm" variant="destructive" className="h-8 text-xs cursor-pointer ml-auto" onClick={handleDelete} disabled={deleting}><Trash2 className="h-3.5 w-3.5 mr-1"/>{deleting?"Deleting...":"Delete"}</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Convert to Order Button ──────────────────────────────────────────────────
function ConvertToOrderButton({ quotation, onConverted }: { quotation: Quotation; onConverted: (orderId: string) => void }) {
  const [converting, setConverting] = useState(false)
  const [done, setDone] = useState(false)
  const [orderId, setOrderId] = useState("")

  async function convert() {
    if (quotation.status === "converted") return
    setConverting(true)
    try {
      const orderNumber = await generateOrderNumber()
      const order: Order = {
        id: Date.now().toString(),
        orderNumber,
        clientId: quotation.clientId,
        clientName: quotation.clientName,
        items: quotation.items.map(i => ({
          id: i.id,
          description: i.description,
          qty: i.qty,
          unit: i.unit,
          unitPrice: i.unitPrice,
          isCustom: i.isCustom,
          inventoryItemId: i.inventoryItemId,
        })),
        subtotal: quotation.subtotal,
        taxPercent: quotation.taxPercent,
        tax: quotation.tax,
        transportCost: quotation.transportCost,
        transportLabel: quotation.transportLabel,
        transportIsPercentage: quotation.transportIsPercentage,
        transportCostValue: quotation.transportCostValue,
        otherCost: quotation.otherCost,
        otherCostLabel: quotation.otherCostLabel,
        otherCostIsPercentage: quotation.otherCostIsPercentage,
        otherCostValue: quotation.otherCostValue,
        shipping: 0,
        discount: quotation.discount,
        discountIsPercentage: quotation.discountIsPercentage,
        discountValue: quotation.discountValue,
        total: quotation.total,
        status: "pending_approval",
        notes: quotation.notes,
        createdAt: new Date().toISOString(),
        createdBy: quotation.createdBy,
        deliveryAddress: quotation.deliveryAddress,
        deliveryDate: quotation.validUntil || "",
        payments: [],
      }
      await saveOrder(order)
      // Mark quotation as converted
      await fetch("/api/crm/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quotation, status: "converted", convertedToOrderId: order.id }),
      })
      setOrderId(order.id)
      setDone(true)
      onConverted(order.id)
    } catch (e) {
      console.error("Convert failed", e)
    }
    setConverting(false)
  }

  if (done) return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
      <ShoppingCart className="h-3 w-3"/> Converted to Order
    </span>
  )

  if (quotation.status === "converted") return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
      <ShoppingCart className="h-3 w-3"/> Already Converted
    </span>
  )

  return (
    <Button size="sm" className="h-8 text-xs cursor-pointer bg-green-600 hover:bg-green-700 text-white" onClick={convert} disabled={converting}>
      <ShoppingCart className="h-3.5 w-3.5 mr-1"/>
      {converting ? "Converting..." : "Convert to Order"}
    </Button>
  )
}
