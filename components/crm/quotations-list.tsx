"use client"
import { useState, useEffect } from "react"
import { getQuotations, saveQuotation, deleteQuotation, generateQuotationNumber, type Quotation, type QuotationItem, STATUS_LABELS, STATUS_COLORS } from "@/lib/quotations"
import { getClients, type Client } from "@/lib/crm"
import { matchesOwnerRecord, resolveOwnerUserId, initialQuotationStatus, orderStatusForQuotationConversion, type CrmWorkspaceScope } from "@/lib/crm-workspace"
import { SalesAgentSourceBadge } from "@/components/crm/sales-agent-source-badge"
import { SalesDateRangePanel } from "@/components/crm/sales-date-range-panel"
import { CrmWarehouseInventoryPicker } from "@/components/crm/crm-warehouse-inventory-picker"
import { CrmLineItemsEditor } from "@/components/crm/crm-line-items-editor"
import { loadCrmWarehouseProducts, type CrmWarehouseProduct } from "@/lib/warehouse-inventory-picker"
import { downloadQuotationPDF } from "@/lib/generate-quotation-pdf"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { Plus, X, Trash2, FileText, Edit, ShoppingCart } from "lucide-react"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { downloadQuotationsExcel } from "@/lib/crm-excel-export"
import { saveOrder, generateOrderNumber } from "@/lib/orders"
import type { Order } from "@/lib/orders"

function defaultFromDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function inDateRange(createdAt: string | undefined, from: string, to: string) {
  if (!from && !to) return true
  if (!createdAt) return false
  const d = new Date(createdAt)
  if (from) {
    const f = new Date(from)
    f.setHours(0, 0, 0, 0)
    if (d < f) return false
  }
  if (to) {
    const t = new Date(to)
    t.setHours(23, 59, 59, 999)
    if (d > t) return false
  }
  return true
}

export function QuotationsList({
  currentUser,
  currentUserId,
  workspace,
  agentDisplayName,
}: {
  currentUser: string
  currentUserId?: string
  workspace?: CrmWorkspaceScope
  agentDisplayName?: string
}) {
  const { toast } = useToast()
  const isSalesAgent = workspace?.mode === "sales_agent"
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Quotation | null>(null)
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Quotation | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [dateFrom, setDateFrom] = useState(defaultFromDate)
  const [dateTo, setDateTo] = useState(todayDate)
  const [appliedFrom, setAppliedFrom] = useState(defaultFromDate)
  const [appliedTo, setAppliedTo] = useState(todayDate)

  useEffect(() => {
    Promise.all([getQuotations(), getClients()]).then(([q, c]) => {
      const scopedQuotations = workspace?.ownerUserId
        ? q.filter(quotation => matchesOwnerRecord(quotation.ownerUserId, workspace.ownerUserId))
        : q
      const scopedClients = workspace?.ownerUserId
        ? c.filter(client => matchesOwnerRecord(client.ownerUserId, workspace.ownerUserId))
        : c
      setQuotations(scopedQuotations)
      setClients(scopedClients)
      setLoading(false)
    })
  }, [])

  const filtered = quotations.filter(q => {
    const ms =
      (q.quotationNumber?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (q.clientName?.toLowerCase() || "").includes(search.toLowerCase())
    const dateOk = isSalesAgent ? inDateRange(q.createdAt, appliedFrom, appliedTo) : true
    return ms && dateOk
  })

  function applyDates() {
    setAppliedFrom(dateFrom)
    setAppliedTo(dateTo)
  }

  function clearDates() {
    setDateFrom("")
    setDateTo("")
    setAppliedFrom("")
    setAppliedTo("")
  }

  async function exportListPdf() {
    setExporting(true)
    try {
      const { downloadQuotationsReportPDF } = await import("@/lib/generate-quotations-report-pdf")
      await downloadQuotationsReportPDF({
        agentName: agentDisplayName || currentUser,
        quotations: filtered,
        dateFrom: isSalesAgent ? appliedFrom || null : null,
        dateTo: isSalesAgent ? appliedTo || null : null,
        statusFilter: "all",
      })
      toast({ title: "Downloaded", message: "Quotations report saved as PDF.", type: "success" })
    } catch {
      toast({ title: "Error", message: "Could not generate PDF.", type: "error" })
    } finally {
      setExporting(false)
    }
  }

  function exportListExcel() {
    setExportingExcel(true)
    try {
      downloadQuotationsExcel(filtered, agentDisplayName || currentUser)
      toast({
        title: "Download started",
        message: `${filtered.length} quotation(s) exported for Excel.`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not export quotations.", type: "error" })
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {isSalesAgent && (
        <SalesDateRangePanel
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          onApply={applyDates}
          onClear={clearDates}
          onExport={exportListPdf}
          exporting={exporting}
          showExport
          defaultOpen={false}
          subtitle="Filter quotations & export PDF"
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="h-8 px-3 rounded border bg-[hsl(var(--background))] text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] w-full min-w-0 sm:w-40"
        />
        <CrmExcelExportButton
          onExport={exportListExcel}
          exporting={exportingExcel}
          disabled={loading || filtered.length === 0}
        />
        {!workspace?.readOnly && (
          <Button size="sm" className="h-8 text-xs px-3 cursor-pointer w-full sm:w-auto" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Quotation
          </Button>
        )}
      </div>

      {isSalesAgent && (appliedFrom || appliedTo) && (
        <p className="text-[10px] text-center text-[hsl(var(--muted-foreground))] -mt-1">
          {appliedFrom && appliedTo
            ? `${appliedFrom} → ${appliedTo}`
            : appliedFrom
              ? `From ${appliedFrom}`
              : `Until ${appliedTo}`}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {quotations.length === 0
              ? "No quotations yet. Create your first one!"
              : "No quotations match your search."}
          </p>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-2">
            {filtered.map(q => (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelected(q)}
                className="w-full text-left rounded-lg border p-3 space-y-2 hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {q.ownerUserId && <SalesAgentSourceBadge agentName={q.createdBy} kind="quotation" />}
                    <p className="text-xs font-semibold text-[#1faca6] truncate">{q.quotationNumber}</p>
                    <p className="text-sm font-medium truncate">{q.clientName}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[q.status]}`}>
                    {STATUS_LABELS[q.status]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                  <span>{q.items?.length || 0} items</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">
                    PKR {(q.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span>{q.createdAt ? new Date(q.createdAt).toLocaleDateString() : "—"}</span>
                </div>
                <div className="flex gap-3 pt-1" onClick={e => e.stopPropagation()}>
                  {!workspace?.readOnly && (
                    <button onClick={() => setEditingQuotation(q)} className="text-blue-500 text-xs cursor-pointer">
                      Edit
                    </button>
                  )}
                  <button onClick={() => downloadQuotationPDF(q)} className="text-[#1a9f9a] text-xs cursor-pointer">
                    PDF
                  </button>
                  {!workspace?.readOnly && (
                    <button onClick={() => setDeleteConfirm(q)} className="text-red-500 text-xs cursor-pointer">
                      Delete
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="hidden md:block rounded-lg border overflow-hidden"><table className="w-full"><thead><tr className="border-b bg-[hsl(var(--muted))]/40">
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
            <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">
              <div className="flex flex-col items-start gap-1">
                {q.ownerUserId && <SalesAgentSourceBadge agentName={q.createdBy} kind="quotation" />}
                <span>{q.quotationNumber}</span>
              </div>
            </td>
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
      </tbody></table></div>
        </>
      )}
      {showForm&&<QuotationForm currentUser={currentUser} currentUserId={currentUserId} workspace={workspace} clients={clients} onClose={()=>setShowForm(false)} onSave={q=>{setQuotations(prev=>[q,...prev.filter(x=>x.id!==q.id)]);setShowForm(false)}}/>}
      {editingQuotation&&<QuotationForm currentUser={currentUser} currentUserId={currentUserId} workspace={workspace} clients={clients} existing={editingQuotation} onClose={()=>setEditingQuotation(null)} onSave={q=>{setQuotations(prev=>prev.map(x=>x.id===q.id?q:x));setEditingQuotation(null)}}/>}
      {selected&&!editingQuotation&&<QuotationDetail quotation={selected} readOnly={!!workspace?.readOnly} onClose={()=>setSelected(null)} onEdit={()=>{setEditingQuotation(selected);setSelected(null)}} onDelete={id=>{setQuotations(prev=>prev.filter(x=>x.id!==id));setSelected(null)}} onUpdate={updated=>{setQuotations(prev=>prev.map(x=>x.id===updated.id?updated:x));setSelected(updated)}}/>}
      <ConfirmDialog isOpen={!!deleteConfirm} title="Delete Quotation" message={`Delete ${deleteConfirm?.quotationNumber}?`} confirmText="Delete" cancelText="Cancel" variant="danger"
        onConfirm={()=>{if(deleteConfirm){deleteQuotation(deleteConfirm.id);setQuotations(prev=>prev.filter(x=>x.id!==deleteConfirm.id))}setDeleteConfirm(null)}}
        onCancel={()=>setDeleteConfirm(null)}/>
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────
function QuotationForm({ currentUser, currentUserId, workspace, clients, existing, onClose, onSave }: {
  currentUser: string; currentUserId?: string; workspace?: CrmWorkspaceScope; clients: Client[]; existing?: Quotation
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
  const [status, setStatus] = useState<Quotation["status"]>(existing?.status || initialQuotationStatus(workspace))
  const [warehouseProducts, setWarehouseProducts] = useState<CrmWarehouseProduct[]>([])
  const [showInventory, setShowInventory] = useState(false)
  const [invSearch, setInvSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [qtyError, setQtyError] = useState("")

  useEffect(() => {
    void loadCrmWarehouseProducts().then(setWarehouseProducts)
  }, [])

  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const discountAmount = discountIsPercentage ? subtotal * (discount / 100) : discount
  const discountedSubtotal = subtotal - discountAmount
  const taxAmount = discountedSubtotal * (taxPercent / 100)
  const transportAmount = transportIsPercentage ? discountedSubtotal * (transportCost / 100) : transportCost
  const otherAmount = otherCostIsPercentage ? discountedSubtotal * (otherCost / 100) : otherCost
  const total = discountedSubtotal + taxAmount + transportAmount + otherAmount
  const hasTax = Math.abs(taxAmount) > 0.004

  function addFromInventory(product: CrmWarehouseProduct) {
    const ex = items.find((i) => i.inventoryItemId === product.id)
    if (ex) {
      if (ex.qty < product.qty) {
        setItems((prev) => prev.map((i) => (i.id === ex.id ? { ...i, qty: i.qty + 1 } : i)))
      }
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          description: product.displayName,
          qty: 1,
          unit: product.unit,
          unitPrice: 0,
          isCustom: false,
          inventoryItemId: product.id,
          availableQty: product.qty,
          costPrice: 0,
        },
      ])
    }
    setShowInventory(false)
    setInvSearch("")
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
      ownerUserId: existing?.ownerUserId || resolveOwnerUserId(workspace?.ownerUserId, currentUserId),
    }
    await saveQuotation(q)
    onSave(q)
    setSaving(false)
  }

  const selectedClient = clients.find(c => c.id === clientId)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-5xl rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
          <p className="text-base font-bold">{existing ? "Edit Quotation" : "Create Quotation"}</p>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 cursor-pointer" onClick={onClose}><X className="h-4 w-4"/></Button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-3 border-t">
            <div className="space-y-1.5 sm:col-span-2">
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Items *</p>
              <Button type="button" size="sm" className="h-9 w-full sm:w-auto text-xs bg-[#1faca6] hover:bg-[#17857f] text-white cursor-pointer" onClick={() => setShowInventory(true)}>
                <Plus className="h-3.5 w-3.5 mr-1"/>Add from inventory
              </Button>
            </div>
            {qtyError && <p className="text-xs text-orange-600 mb-2">{qtyError}</p>}
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center bg-[hsl(var(--muted))]/10">
                <ShoppingCart className="h-10 w-10 text-[hsl(var(--muted-foreground))] opacity-30 mx-auto mb-2"/>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No items added yet</p>
              </div>
            ) : (
              <CrmLineItemsEditor
                items={items}
                onUpdate={(id, key, value) => updateItem(id, key, value)}
                onRemove={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
                size="sm"
                removeIcon="x"
              />
            )}

          </div>
          {/* Financials */}
          <div className="pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Discount</label>
                <div className="flex gap-2">
                  <input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="flex-1 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                  <select value={discountIsPercentage?"pct":"flat"} onChange={e => setDiscountIsPercentage(e.target.value==="pct")} className="h-9 rounded-md border bg-[hsl(var(--background))] px-2 text-sm focus:outline-none">
                    <option value="pct">%</option><option value="flat">PKR</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Tax (%)</label>
                <input type="number" min="0" max="100" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))} className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Tax is applied on subtotal after discount.</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Transport / Expense</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={transportLabel} onChange={e => setTransportLabel(e.target.value)} placeholder="Label" className="w-full sm:w-28 h-10 sm:h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                  <input type="number" min="0" value={transportCost} onChange={e => setTransportCost(Number(e.target.value))} className="flex-1 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                  <select value={transportIsPercentage?"pct":"flat"} onChange={e => setTransportIsPercentage(e.target.value==="pct")} className="h-9 rounded-md border bg-[hsl(var(--background))] px-2 text-sm focus:outline-none">
                    <option value="flat">PKR</option><option value="pct">%</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Other Cost</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={otherCostLabel} onChange={e => setOtherCostLabel(e.target.value)} placeholder="Label" className="w-full sm:w-28 h-10 sm:h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
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
            <div className="w-full sm:ml-auto sm:w-64 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Subtotal</span><span className="font-medium">PKR {subtotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              {discount>0&&<div className="flex justify-between text-red-600"><span>Discount {discountIsPercentage?`(${discount}%)`:""}</span><span>-PKR {discountAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {hasTax&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Tax ({taxPercent}%)</span><span>PKR {taxAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
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
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button size="sm" variant="outline" className="h-10 sm:h-8 text-xs cursor-pointer w-full sm:w-auto" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="h-10 sm:h-8 text-xs cursor-pointer w-full sm:w-auto bg-[#1faca6] hover:bg-[#17857f] text-white" onClick={submit} disabled={saving||!clientId||items.length===0}>
            {saving?"Saving...":existing?"Update Quotation":"Create Quotation"}
          </Button>
        </div>
      </div>
      <CrmWarehouseInventoryPicker
        open={showInventory}
        products={warehouseProducts}
        search={invSearch}
        onSearchChange={setInvSearch}
        onClose={() => setShowInventory(false)}
        onSelect={addFromInventory}
      />
    </div>
  )
}

// ─── Detail View ──────────────────────────────────────────────────────────────
function QuotationDetail({ quotation, onClose, onEdit, onDelete, readOnly, onUpdate }: {
  quotation: Quotation; onClose: () => void; onEdit: () => void; onDelete: (id: string) => void; readOnly?: boolean; onUpdate?: (q: Quotation) => void
}) {
  const { toast } = useToast()
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
            <div className="flex flex-wrap items-center gap-2">
              {quotation.ownerUserId && <SalesAgentSourceBadge agentName={quotation.createdBy} kind="quotation" />}
              <p className="text-base font-bold text-[hsl(var(--primary))]">{quotation.quotationNumber}</p>
            </div>
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
              {Math.abs(Number(quotation.tax || 0))>0.004&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Tax ({quotation.taxPercent}%)</span><span>PKR {Number(quotation.tax || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {quotation.transportCost>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">{quotation.transportLabel}</span><span>PKR {(quotation.transportCostValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {quotation.otherCost>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">{quotation.otherCostLabel}</span><span>PKR {(quotation.otherCostValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              <div className="flex justify-between pt-1.5 border-t font-bold text-sm"><span>Total</span><span className="text-[#1faca6]">PKR {quotation.total.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          {!readOnly && (
            <>
              <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={onEdit}><Edit className="h-3.5 w-3.5 mr-1"/>Edit</Button>
              <ConvertToOrderButton
                quotation={quotation}
                onConverted={updated => {
                  onUpdate?.(updated)
                  toast({ title: "Order submitted", message: "The converted order was sent to admin for approval.", type: "success" })
                }}
              />
              <Button size="sm" variant="destructive" className="h-8 text-xs cursor-pointer ml-auto" onClick={handleDelete} disabled={deleting}><Trash2 className="h-3.5 w-3.5 mr-1"/>{deleting?"Deleting...":"Delete"}</Button>
            </>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => downloadQuotationPDF(quotation)}><FileText className="h-3.5 w-3.5 mr-1"/>Download PDF</Button>
          <Button size="sm" variant="outline" className={`h-8 text-xs cursor-pointer ${readOnly ? "ml-auto" : ""}`} onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Convert to Order Button ──────────────────────────────────────────────────
function ConvertToOrderButton({ quotation, onConverted }: { quotation: Quotation; onConverted: (updated: Quotation) => void }) {
  const [converting, setConverting] = useState(false)
  const [done, setDone] = useState(false)

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
        status: orderStatusForQuotationConversion(),
        notes: quotation.notes,
        createdAt: new Date().toISOString(),
        createdBy: quotation.createdBy,
        deliveryAddress: quotation.deliveryAddress,
        deliveryDate: quotation.validUntil || "",
        payments: [],
        ownerUserId: quotation.ownerUserId,
      }
      await saveOrder(order)
      const updatedQuotation: Quotation = {
        ...quotation,
        status: "converted",
        convertedToOrderId: order.id,
      }
      await saveQuotation(updatedQuotation)
      setDone(true)
      onConverted(updatedQuotation)
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
