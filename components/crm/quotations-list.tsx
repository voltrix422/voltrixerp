"use client"
import { useState, useEffect } from "react"
import { getQuotations, saveQuotation, deleteQuotation, generateQuotationNumber, duplicateQuotation, type Quotation, type QuotationItem, STATUS_LABELS, STATUS_COLORS } from "@/lib/quotations"
import { getClients, type Client } from "@/lib/crm"
import { matchesOwnerRecord, resolveOwnerUserId, initialQuotationStatus, type CrmWorkspaceScope } from "@/lib/crm-workspace"
import { SalesAgentSourceBadge } from "@/components/crm/sales-agent-source-badge"
import { SalesDateRangePanel } from "@/components/crm/sales-date-range-panel"
import { CrmWarehouseInventoryPicker } from "@/components/crm/crm-warehouse-inventory-picker"
import { CrmLineItemsEditor } from "@/components/crm/crm-line-items-editor"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { CrmItemsQtyCell, formatCrmItemsQtyLabel } from "@/components/crm/crm-items-qty-cell"
import { loadCrmWarehouseProducts, type CrmWarehouseProduct } from "@/lib/warehouse-inventory-picker"
import { CrmPriceTierSelect } from "@/components/crm/crm-price-tier-select"
import {
  applyCrmPriceTierToItems,
  buildCrmPriceMap,
  getCrmProductPrices,
  lookupCrmUnitPrice,
  type CrmPriceTier,
  type CrmProductPrice,
} from "@/lib/crm-product-prices"
import { downloadQuotationPDF } from "@/lib/generate-quotation-pdf"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { Plus, X, Trash2, FileText, Edit, ShoppingCart, Copy } from "lucide-react"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { downloadQuotationsExcel } from "@/lib/crm-excel-export"
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
  const [duplicatingQuotation, setDuplicatingQuotation] = useState<Quotation | null>(null)
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

  function startDuplicate(q: Quotation) {
    setSelected(null)
    setEditingQuotation(null)
    setDuplicatingQuotation({ ...duplicateQuotation(q), quotationNumber: q.quotationNumber })
  }

  return (
    <div className="space-y-4 max-w-full">
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
                  <span>{formatCrmItemsQtyLabel(q.items)}</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">
                    PKR {(q.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span>{q.createdAt ? new Date(q.createdAt).toLocaleDateString() : "—"}</span>
                </div>
                <div className="flex gap-3 pt-1" onClick={e => e.stopPropagation()}>
                  {!workspace?.readOnly && (
                    <>
                    <button onClick={() => setEditingQuotation(q)} className="text-blue-500 text-xs cursor-pointer">
                      Edit
                    </button>
                    <button onClick={() => startDuplicate(q)} className="text-[hsl(var(--foreground))] text-xs cursor-pointer">
                      Duplicate
                    </button>
                    </>
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

          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b bg-[hsl(var(--muted))]/40">
                  <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Quotation #</th>
                  <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Client</th>
                  <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] min-w-[7rem]">Qty</th>
                  <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] whitespace-nowrap">Total</th>
                  <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
                  <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] whitespace-nowrap">Valid Until</th>
                  <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] whitespace-nowrap">Date</th>
                  <th className="sticky right-0 z-10 h-9 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/95 backdrop-blur-sm border-l border-[hsl(var(--border))] min-w-[7.5rem] shadow-[-6px_0_10px_-8px_rgba(0,0,0,0.25)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((q) => (
                  <tr
                    key={q.id}
                    className="group hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer"
                    onClick={() => setSelected(q)}
                  >
                    <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">
                      <div className="flex flex-col items-start gap-1">
                        {q.ownerUserId && <SalesAgentSourceBadge agentName={q.createdBy} kind="quotation" />}
                        <span>{q.quotationNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium max-w-[12rem] truncate" title={q.clientName}>
                      {q.clientName}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-center">
                      <CrmItemsQtyCell items={q.items} compact />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right font-semibold whitespace-nowrap">
                      PKR {(q.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[q.status]}`}>
                        {STATUS_LABELS[q.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                      {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                      {q.createdAt ? new Date(q.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td
                      className="sticky right-0 z-10 px-3 py-2.5 text-center bg-[hsl(var(--card))] group-hover:bg-[hsl(var(--muted))]/30 border-l border-[hsl(var(--border))] shadow-[-6px_0_10px_-8px_rgba(0,0,0,0.12)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                        {!workspace?.readOnly && (
                          <>
                            <button
                              onClick={() => setEditingQuotation(q)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-blue-500 hover:text-blue-700 hover:bg-blue-500/10 cursor-pointer"
                              title="Edit"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => startDuplicate(q)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]/50 cursor-pointer"
                              title="Duplicate"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(q)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:text-red-700 hover:bg-red-500/10 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => downloadQuotationPDF(q)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#1a9f9a] hover:text-[#158a85] hover:bg-[#1faca6]/10 cursor-pointer"
                          title="Download PDF"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {showForm&&<QuotationForm currentUser={currentUser} currentUserId={currentUserId} workspace={workspace} clients={clients} onClose={()=>setShowForm(false)} onSave={q=>{setQuotations(prev=>[q,...prev.filter(x=>x.id!==q.id)]);setShowForm(false)}}/>}
      {editingQuotation&&<QuotationForm currentUser={currentUser} currentUserId={currentUserId} workspace={workspace} clients={clients} existing={editingQuotation} onClose={()=>setEditingQuotation(null)} onSave={q=>{setQuotations(prev=>prev.map(x=>x.id===q.id?q:x));setEditingQuotation(null)}}/>}
      {duplicatingQuotation&&<QuotationForm currentUser={currentUser} currentUserId={currentUserId} workspace={workspace} clients={clients} duplicateFrom={duplicatingQuotation} onClose={()=>setDuplicatingQuotation(null)} onSave={q=>{setQuotations(prev=>[q,...prev]);setDuplicatingQuotation(null)}}/>}
      {selected&&!editingQuotation&&!duplicatingQuotation&&<QuotationDetail quotation={selected} readOnly={!!workspace?.readOnly} onClose={()=>setSelected(null)} onEdit={()=>{setEditingQuotation(selected);setSelected(null)}} onDuplicate={()=>startDuplicate(selected)} onDelete={id=>{setQuotations(prev=>prev.filter(x=>x.id!==id));setSelected(null)}}/>}
      <ConfirmDialog isOpen={!!deleteConfirm} title="Delete Quotation" message={`Delete ${deleteConfirm?.quotationNumber}?`} confirmText="Delete" cancelText="Cancel" variant="danger"
        onConfirm={()=>{if(deleteConfirm){deleteQuotation(deleteConfirm.id);setQuotations(prev=>prev.filter(x=>x.id!==deleteConfirm.id))}setDeleteConfirm(null)}}
        onCancel={()=>setDeleteConfirm(null)}/>
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────
function QuotationForm({ currentUser, currentUserId, workspace, clients, existing, duplicateFrom, onClose, onSave }: {
  currentUser: string; currentUserId?: string; workspace?: CrmWorkspaceScope; clients: Client[]; existing?: Quotation; duplicateFrom?: Quotation
  onClose: () => void; onSave: (q: Quotation) => void
}) {
  const source = duplicateFrom || existing
  const [clientId, setClientId] = useState(source?.clientId || "")
  const [clientSearch, setClientSearch] = useState("")
  const [showClientDrop, setShowClientDrop] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState(source?.deliveryAddress || "")
  const [validUntil, setValidUntil] = useState(source?.validUntil || "")
  const [notes, setNotes] = useState(source?.notes || "")
  const [items, setItems] = useState<QuotationItem[]>(source?.items || [])
  const [discount, setDiscount] = useState(source?.discount || 0)
  const [discountIsPercentage, setDiscountIsPercentage] = useState(source?.discountIsPercentage ?? true)
  const [transportCost, setTransportCost] = useState(
    source?.transportIsPercentage ? (source?.transportCostValue || 0) : (source?.transportCost || 0)
  )
  const [transportLabel, setTransportLabel] = useState(source?.transportLabel || "Transport")
  const [otherCost, setOtherCost] = useState(
    source?.otherCostIsPercentage ? (source?.otherCostValue || 0) : (source?.otherCost || 0)
  )
  const [otherCostLabel, setOtherCostLabel] = useState(source?.otherCostLabel || "Other")
  const [status, setStatus] = useState<Quotation["status"]>(
    duplicateFrom ? initialQuotationStatus(workspace) : (source?.status || initialQuotationStatus(workspace))
  )
  const [warehouseProducts, setWarehouseProducts] = useState<CrmWarehouseProduct[]>([])
  const [showInventory, setShowInventory] = useState(false)
  const [invSearch, setInvSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [qtyError, setQtyError] = useState("")
  const [priceTier, setPriceTier] = useState<CrmPriceTier>("retail")
  const [priceMap, setPriceMap] = useState<Map<string, CrmProductPrice>>(() => new Map())

  useEffect(() => {
    void Promise.all([loadCrmWarehouseProducts(), getCrmProductPrices().catch(() => [])]).then(
      ([products, prices]) => {
        const map = buildCrmPriceMap(prices)
        setPriceMap(map)
        setWarehouseProducts(products)
        if (source?.items?.length) {
          setItems(
            source.items.map((item) => {
              const product = products.find((p) => p.id === item.inventoryItemId)
              const model = item.model || product?.model
              return product
                ? {
                    ...item,
                    availableQty: product.qty,
                    model,
                    unitPrice: item.unitPrice,
                  }
                : item
            }),
          )
        }
      },
    )
  }, [source?.id])

  useEffect(() => {
    setItems((prev) => applyCrmPriceTierToItems(prev, priceTier, priceMap))
  }, [priceTier, priceMap])

  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const discountAmount = discountIsPercentage
    ? Math.max(0, Math.min(subtotal, (subtotal * discount) / 100))
    : Math.max(0, Math.min(subtotal, discount))
  const discountedSubtotal = Math.max(0, subtotal - discountAmount)
  const transportAmount = Math.max(0, transportCost || 0)
  const otherAmount = Math.max(0, otherCost || 0)
  const total = discountedSubtotal + transportAmount + otherAmount

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
          unitPrice: lookupCrmUnitPrice(priceMap, product.model, priceTier),
          isCustom: false,
          inventoryItemId: product.id,
          model: product.model,
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
    if (!clientId || items.length === 0 || items.some((i) => !i.description.trim())) return
    setSaving(true)
    const client = clients.find(c => c.id === clientId)
    const quotationNumber = duplicateFrom || !existing?.quotationNumber
      ? await generateQuotationNumber()
      : existing.quotationNumber
    const q: Quotation = {
      id: duplicateFrom || !existing ? Date.now().toString() : existing.id,
      quotationNumber, clientId, clientName: client?.name || "",
      items, subtotal, taxPercent: 0, tax: 0,
      transportCost, transportLabel, transportIsPercentage: false, transportCostValue: transportAmount,
      otherCost, otherCostLabel, otherCostIsPercentage: false, otherCostValue: otherAmount,
      discount, discountIsPercentage, discountValue: discountAmount,
      total, status, notes: notes.trim(), deliveryAddress: deliveryAddress.trim(),
      validUntil,
      createdAt: duplicateFrom || !existing ? new Date().toISOString() : existing.createdAt,
      createdBy: duplicateFrom || !existing ? currentUser : existing.createdBy,
      ownerUserId: duplicateFrom
        ? resolveOwnerUserId(workspace?.ownerUserId, currentUserId)
        : (existing?.ownerUserId || resolveOwnerUserId(workspace?.ownerUserId, currentUserId)),
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
          <div className="min-w-0">
          <p className="text-base font-bold">
            {duplicateFrom ? "Duplicate Quotation" : existing ? "Edit Quotation" : "Create Quotation"}
          </p>
          {duplicateFrom && (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] font-normal mt-0.5">
              Copied from {duplicateFrom.quotationNumber || "previous quotation"} — edit and save as a new draft.
            </p>
          )}
          </div>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Items *</p>
              <CrmPriceTierSelect value={priceTier} onChange={setPriceTier} className="sm:max-w-xs" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto sm:justify-end mb-3">
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
              <div className="space-y-3">
                <CrmLineItemsEditor
                  items={items}
                  onUpdate={(id, key, value) => updateItem(id, key, value)}
                  onRemove={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
                  size="sm"
                  removeIcon="x"
                />
                {subtotal > 0 && (
                  <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3 text-xs">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        Subtotal
                      </p>
                      <p className="font-semibold tabular-nums mt-1">
                        PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
          {/* Financials */}
          {items.length > 0 && (
          <div className="pt-3 border-t space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Discount Percentage</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountIsPercentage ? discount : subtotal > 0 ? ((discountAmount / subtotal) * 100).toFixed(2) : 0}
                  onChange={(e) => {
                    setDiscount(Number(e.target.value))
                    if (!discountIsPercentage) setDiscountIsPercentage(true)
                  }}
                  className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Discount Amount (PKR)</label>
                <input
                  type="number"
                  min="0"
                  value={discountIsPercentage ? discountAmount : discount}
                  onChange={(e) => {
                    setDiscount(Number(e.target.value))
                    if (discountIsPercentage) setDiscountIsPercentage(false)
                  }}
                  className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Transport / Expense</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={transportLabel} onChange={e => setTransportLabel(e.target.value)} placeholder="Label" className="w-full sm:w-28 h-10 sm:h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                  <input type="number" min="0" value={transportCost} onChange={e => setTransportCost(Number(e.target.value))} className="flex-1 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Other Cost</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={otherCostLabel} onChange={e => setOtherCostLabel(e.target.value)} placeholder="Label" className="w-full sm:w-28 h-10 sm:h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                  <input type="number" min="0" value={otherCost} onChange={e => setOtherCost(Number(e.target.value))} className="flex-1 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
                </div>
              </div>
            </div>
          </div>
          )}
          {/* Summary */}
          <div className="pt-3 border-t">
            <div className="w-full sm:ml-auto sm:w-72 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Subtotal</span><span className="font-medium">PKR {subtotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              {discountAmount>0&&<div className="flex justify-between text-red-600"><span>Discount{discountIsPercentage?` (${discount}%)`:""}</span><span>-PKR {discountAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {discountAmount>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Subtotal after discount</span><span>PKR {discountedSubtotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
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
          <Button size="sm" className="h-10 sm:h-8 text-xs cursor-pointer w-full sm:w-auto bg-[#1faca6] hover:bg-[#17857f] text-white" onClick={submit} disabled={saving||!clientId||items.length===0||items.some(i=>!i.description.trim())}>
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
function QuotationDetail({ quotation, onClose, onEdit, onDuplicate, onDelete, readOnly }: {
  quotation: Quotation; onClose: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: (id: string) => void; readOnly?: boolean
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await deleteQuotation(quotation.id)
    onDelete(quotation.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
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

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5">
          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
            <CrmLineItemsDisplay items={quotation.items} size="sm" />
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Subtotal</span><span>PKR {quotation.subtotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              {(quotation.discountValue||0)>0&&<div className="flex justify-between text-red-600"><span>Discount {quotation.discountIsPercentage?`(${quotation.discount}%)`:""}</span><span>-PKR {(quotation.discountValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {Math.abs(Number(quotation.tax || 0))>0.004&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Tax ({quotation.taxPercent}%)</span><span>PKR {Number(quotation.tax || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {quotation.transportCost>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">{quotation.transportLabel}</span><span>PKR {(quotation.transportCostValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              {quotation.otherCost>0&&<div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">{quotation.otherCostLabel}</span><span>PKR {(quotation.otherCostValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
              <div className="flex justify-between pt-1.5 border-t font-bold text-sm"><span>Total</span><span className="text-[#1faca6]">PKR {quotation.total.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!readOnly && (
            <>
              <Button size="sm" className="h-9 sm:h-8 w-full sm:w-auto text-xs cursor-pointer" onClick={onEdit}><Edit className="h-3.5 w-3.5 mr-1"/>Edit</Button>
              <Button size="sm" variant="outline" className="h-9 sm:h-8 w-full sm:w-auto text-xs cursor-pointer" onClick={onDuplicate}><Copy className="h-3.5 w-3.5 mr-1"/>Duplicate</Button>
              <Button size="sm" variant="destructive" className="h-8 text-xs cursor-pointer sm:ml-auto" onClick={handleDelete} disabled={deleting}><Trash2 className="h-3.5 w-3.5 mr-1"/>{deleting?"Deleting...":"Delete"}</Button>
            </>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => downloadQuotationPDF(quotation)}><FileText className="h-3.5 w-3.5 mr-1"/>Download PDF</Button>
          <Button size="sm" variant="outline" className={`h-8 text-xs cursor-pointer ${readOnly ? "ml-auto" : ""}`} onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
