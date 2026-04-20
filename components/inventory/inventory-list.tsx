"use client"
import { useEffect, useState } from "react"
import { getPOs, savePO, type PurchaseOrder, type ImportedPOItem } from "@/lib/purchase"
// DB access via /api/db routes (Prisma)
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, Search, X, CheckCircle2, Plus, Calendar, Calculator, Trash2 } from "lucide-react"
import { generateGRN } from "@/lib/generate-grn"
import { InventoryHistory } from "@/components/inventory/inventory-history"

interface PODetailModalProps {
  po: PurchaseOrder
  receiving: boolean
  alreadyReceived: boolean
  onReceive: () => void
  onClose: () => void
}

function PODetailModal({ po, receiving, alreadyReceived, onReceive, onClose }: PODetailModalProps) {
  const isImported = po.type === "imported"
  const poTotal = isImported
    ? po.importedItems.reduce((s, i) => s + i.unitPrice * i.qty, 0)
    : (() => {
        const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId) || po.quotes[0]
        return po.items.reduce((s, item, idx) => {
          const quoteItem = quote?.items.find(qi => qi.itemId === item.id) || quote?.items[idx]
          return s + (quoteItem?.unitPrice || 0) * item.qty
        }, 0)
      })()
  
  const arrivedAt = isImported
    ? po.flowHistory.findLast(h => h.step === "Moved to Inventory")?.doneAt ?? po.createdAt
    : po.createdAt

  const allDocs = isImported ? [
    ...po.adminDocuments.map(d => ({ ...d, section: "Admin" })),
    ...po.financeDocuments1.map(d => ({ ...d, section: "Finance (Round 1)" })),
    ...po.purchaseDocuments.map(d => ({ ...d, section: "Purchase" })),
    ...po.financeDocuments2.map(d => ({ ...d, section: "Finance (Payment)" })),
  ] : []

  const items = isImported ? po.importedItems : po.items.map((item, idx) => {
    const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId) || po.quotes[0]
    const quoteItem = quote?.items.find(qi => qi.itemId === item.id) || quote?.items[idx]
    return {
      id: item.id,
      description: item.description,
      qty: item.qty,
      unit: item.unit,
      unitPrice: quoteItem?.unitPrice || 0,
    }
  })

  const supplierName = isImported ? po.importedSupplierName : po.supplierNames[0]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[hsl(var(--muted))]/40 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-lg font-bold text-[hsl(var(--primary))]">{po.poNumber}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {isImported ? "Imported PO" : "Direct PO"} · Arrived {new Date(arrivedAt).toLocaleDateString()}
              </p>
            </div>
            <Badge variant="secondary" className="text-[10px]">Inventory</Badge>
            {alreadyReceived && (
              <Badge variant="success" className="text-[10px] flex items-center gap-1 cursor-pointer">
                <CheckCircle2 className="h-2.5 w-2.5" /> Received
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {supplierName && (
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">Supplier</p>
              <p className="text-sm font-semibold">{supplierName}</p>
            </div>
          )}

          {isImported && po.pssid && (
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">PSSID</p>
              <p className="text-sm font-mono font-semibold">{po.pssid}</p>
            </div>
          )}

          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Items</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[hsl(var(--muted))]/40 border-b">
                    <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                    <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-14">Qty</th>
                    <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-14">Unit</th>
                    <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-24">Unit Price</th>
                    <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-center">{item.qty}</td>
                      <td className="px-3 py-2">{item.unit}</td>
                      <td className="px-3 py-2 text-right">PKR {item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-medium">PKR {(item.unitPrice * item.qty).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-[hsl(var(--muted))]/30 font-bold">
                    <td colSpan={4} className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">
                      PKR {poTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {!isImported && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Cost Breakdown</p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <tbody className="divide-y">
                    <tr><td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">Items Subtotal</td><td className="px-3 py-2 text-right font-medium">PKR {poTotal.toLocaleString()}</td></tr>
                    {(() => {
                      const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId) || po.quotes[0]
                      const taxPct = quote?.taxPct || 0
                      const taxAmount = poTotal * (taxPct / 100)
                      const transport = quote?.transportCost || 0
                      const other = quote?.otherCost || 0
                      const totalCost = poTotal + taxAmount + transport + other
                      return (
                        <>
                          {taxPct > 0 && <tr><td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">Tax</td><td className="px-3 py-2 text-right font-medium">{taxPct}% (PKR {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})</td></tr>}
                          {transport > 0 && <tr><td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">Transport</td><td className="px-3 py-2 text-right font-medium">PKR {transport.toLocaleString()}</td></tr>}
                          {other > 0 && <tr><td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{quote?.otherCostLabel || "Other"}</td><td className="px-3 py-2 text-right font-medium">PKR {other.toLocaleString()}</td></tr>}
                          <tr className="bg-[hsl(var(--muted))]/30 font-bold"><td className="px-3 py-2">Total Cost</td><td className="px-3 py-2 text-right">PKR {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
                        </>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {po.payments && po.payments.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Payments</p>
              <div className="space-y-1">
                {po.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border bg-[hsl(var(--muted))]/10 px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold">PKR {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{p.method} · {p.date}{p.notes ? ` · ${p.notes}` : ""}</p>
                    </div>
                    {p.proofUrl && (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[hsl(var(--primary))] underline shrink-0 ml-3">Proof</a>
                    )}
                  </div>
                ))}
                <p className="text-xs font-bold text-right pr-1">
                  Total Paid: PKR {po.payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          {allDocs.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Documents</p>
              <div className="space-y-1">
                {allDocs.map(d => (
                  <div key={d.id} className="flex items-center justify-between rounded-md border bg-[hsl(var(--muted))]/10 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">{d.name}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{d.section} · {d.uploadedBy} · {new Date(d.uploadedAt).toLocaleDateString()}</p>
                    </div>
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-[10px] text-[hsl(var(--primary))] underline">View</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {po.flowHistory.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Flow History</p>
              <div className="space-y-1.5">
                {po.flowHistory.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--border))] shrink-0" />
                    <div>
                      <span className="font-medium">{h.step}</span>
                      <span className="text-[hsl(var(--muted-foreground))]"> · {h.actor}</span>
                      {h.note && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{h.note}</p>}
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{new Date(h.doneAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          {!alreadyReceived && (
            <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={onReceive} disabled={receiving}>
              {receiving ? "Processing..." : "Receive Items & Generate GRN"}
            </Button>
          )}
          {alreadyReceived && (
            <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => generateGRN(po)}>
              Generate GRN
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs ml-auto cursor-pointer" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
type InventoryItem = ImportedPOItem & {
  poNumber: string
  supplier: string
  pssid?: string
  receivedAt: string
  gst?: number
  otherExpense?: number
  specs?: string
}

export function InventoryList() {
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null)
  const [receiving, setReceiving] = useState(false)
  const [tab, setTab] = useState<"receiving" | "inventory">("receiving")
  const [receivingSubTab, setReceivingSubTab] = useState<"pending" | "received">("pending")
  const [inventorySubTab, setInventorySubTab] = useState<"po" | "manual">("po")
  const [allInventoryItems, setAllInventoryItems] = useState<InventoryItem[]>([])
  const [usingFallbackData, setUsingFallbackData] = useState(false)
  const [showManualItemModal, setShowManualItemModal] = useState(false)
  const [manualItem, setManualItem] = useState({
    description: "",
    qty: "",
    unit: "pcs",
    unitPrice: "",
    supplierName: "",
    gst: "",
    otherExpense: ""
  })
  const [savingManualItem, setSavingManualItem] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function deleteInventoryItem(item: InventoryItem) {
    setItemToDelete(item)
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!itemToDelete) return

    try {
      const res = await fetch("/api/db/inventory-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", data: { itemId: itemToDelete.id } }),
      })

      if (!res.ok) {
        throw new Error("Failed to delete item")
      }

      // Refresh the inventory list
      loadStockItems()
      setShowDeleteConfirm(false)
      setItemToDelete(null)
    } catch (error) {
      console.error("Error deleting item:", error)
      alert("Failed to delete item. Please try again.")
    }
  }

  async function loadStockItems() {
    console.log("Loading stock items from database...")

    // Always load PO-derived items as a base
    const poItems = getPODerivedItems()

    try {
      const res = await fetch("/api/db/inventory-stock")
      if (res.ok) {
        const stockItems = await res.json()
        if (stockItems && stockItems.length > 0) {
          const dbItems: InventoryItem[] = stockItems.map((stock: Record<string, unknown>) => ({
            id: (stock.itemId || stock.item_id) as string,
            description: stock.description as string,
            qty: (stock.availableQty || stock.available_qty) as number,
            unit: stock.unit as string,
            unitPrice: (stock.costPrice || stock.cost_price || 0) as number,
            poNumber: (stock.poNumber || stock.po_number || "") as string,
            supplier: (stock.supplierName || stock.supplier_name || "—") as string,
            pssid: undefined,
            receivedAt: (stock.createdAt || stock.created_at || "") as string,
            gst: (stock.gst || 0) as number,
            otherExpense: (stock.otherExpense || stock.other_expense || 0) as number,
            specs: (stock.specs || "") as string,
          }))

          // Merge: use DB items, but also include PO items not yet in DB
          // Deduplicate by poNumber + description (more reliable than id matching)
          const dbKeys = new Set(dbItems.map(i => `${i.poNumber}|${i.description}`))
          const missingPOItems = poItems.filter(i => !dbKeys.has(`${i.poNumber}|${i.description}`))
          const merged = [...dbItems, ...missingPOItems]

          setAllInventoryItems(merged)
          setUsingFallbackData(false)
          return
        }
      }
    } catch {}
    console.log("Could not load stock items, using fallback from POs")
    setAllInventoryItems(poItems)
    setUsingFallbackData(true)
  }

  function getPODerivedItems(): InventoryItem[] {
    const receivedPOs = pos.filter(p => {
      if (p.type === "imported") {
        return p.flowHistory.some(h => h.step === "Items Received")
      }
      return p.status === "in_inventory" && p.flowHistory.some(h => h.step === "Items Received")
    })

    return receivedPOs.flatMap(po => {
      if (po.type === "imported") {
        return po.importedItems.map(item => {
          return {
            ...item,
            qty: item.qty,
            poNumber: po.poNumber,
            supplier: po.importedSupplierName || "—",
            pssid: po.pssid,
            receivedAt: po.flowHistory.find(h => h.step === "Items Received")?.doneAt || po.createdAt,
            specs: item.specs || "",
          }
        })
      } else {
        const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId)

        const itemsTotal = po.items.reduce((sum, item) => {
          const qi = quote?.items.find(q => q.itemId === item.id)
          return sum + (qi ? qi.unitPrice * item.qty : 0)
        }, 0)

        const taxAmount = itemsTotal * ((quote?.taxPct || 0) / 100)
        const additionalCosts = taxAmount + (quote?.transportCost || 0) + (quote?.otherCost || 0)

        return po.items.map(item => {
          const qi = quote?.items.find(q => q.itemId === item.id)
          const basePrice = qi?.unitPrice || 0
          const itemTotal = basePrice * item.qty

          const proportionalAdditionalCost = itemsTotal > 0 ? (itemTotal / itemsTotal) * additionalCosts : 0

          const landedCostPerUnit = basePrice + (item.qty > 0 ? proportionalAdditionalCost / item.qty : 0)

          return {
            id: item.id,
            description: item.description,
            qty: item.qty,
            unit: item.unit,
            unitPrice: landedCostPerUnit,
            poNumber: po.poNumber,
            supplier: po.supplierNames[0] || "—",
            pssid: undefined,
            receivedAt: po.flowHistory?.find(h => h.step === "Items Received")?.doneAt || po.createdAt,
            specs: item.specs || "",
          }
        })
      }
    })
  }

  useEffect(() => {
    getPOs().then(all => {
      setPos(all.filter(p => p.status === "imp_inventory" || p.status === "in_inventory"))
      loadStockItems()
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (tab === "inventory" || pos.length > 0) {
      loadStockItems()
    }
  }, [tab, pos])

  const receivingPOs = pos.filter(p => {
    if (p.type === "imported") {
      return true
    }
    return p.status === "in_inventory"
  })

  const pendingReceivingPOs = receivingPOs.filter(p => {
    if (p.type === "imported") {
      return !p.flowHistory.some(h => h.step === "Items Received")
    }
    return !p.flowHistory?.some(h => h.step === "Items Received")
  })

  const receivedReceivingPOs = receivingPOs.filter(p => {
    if (p.type === "imported") {
      return p.flowHistory.some(h => h.step === "Items Received")
    }
    return p.flowHistory?.some(h => h.step === "Items Received")
  })

  const filteredReceiving = (receivingSubTab === "pending" ? pendingReceivingPOs : receivedReceivingPOs).filter(p => {
    const searchLower = search.toLowerCase()
    if (p.type === "imported") {
      return (p.poNumber ?? "").toLowerCase().includes(searchLower) ||
        (p.importedSupplierName ?? "").toLowerCase().includes(searchLower) ||
        (p.pssid ?? "").toLowerCase().includes(searchLower) ||
        p.importedItems.some(i => (i.description ?? "").toLowerCase().includes(searchLower))
    } else {
      return (p.poNumber ?? "").toLowerCase().includes(searchLower) ||
        (p.supplierNames || []).some(s => (s ?? "").toLowerCase().includes(searchLower)) ||
        (p.items || []).some(i => (i.description ?? "").toLowerCase().includes(searchLower))
    }
  })

  const filteredInventory = allInventoryItems.filter(item => {
    const matchesSearch = 
      (item.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (item.poNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (item.supplier ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (item.pssid ?? "").toLowerCase().includes(search.toLowerCase())
    
    const itemDate = new Date(item.receivedAt)
    const matchesDateRange = 
      (!fromDate || itemDate >= new Date(fromDate)) &&
      (!toDate || itemDate <= new Date(toDate))
    
    const isManual = item.poNumber?.startsWith("MI-")
    const isFromPO = item.poNumber && item.poNumber.trim() !== "" && !isManual
    const matchesSource = inventorySubTab === "po" ? isFromPO : isManual
    
    return matchesSearch && matchesDateRange && matchesSource
  })

  const totalReceivingItems = (receivingSubTab === "pending" ? pendingReceivingPOs : receivedReceivingPOs).reduce((s, p) => {
    if (p.type === "imported") {
      return s + p.importedItems.length
    }
    return s + p.items.length
  }, 0)
  
  const totalReceivingValue = (receivingSubTab === "pending" ? pendingReceivingPOs : receivedReceivingPOs).reduce((s, p) => {
    if (p.type === "imported") {
      return s + p.importedItems.reduce((ss, i) => ss + i.unitPrice * i.qty, 0)
    } else {
      const quote = p.quotes.find(q => q.supplierId === p.finalizedSupplierId)
      return s + p.items.reduce((ss, item) => {
        const quoteItem = quote?.items.find(qi => qi.itemId === item.id)
        return ss + (quoteItem?.unitPrice || 0) * item.qty
      }, 0)
    }
  }, 0)
  
  const totalInventoryItems = allInventoryItems.length
  const totalInventoryValue = allInventoryItems.reduce((s, i) => s + i.unitPrice * i.qty, 0)

  const alreadyReceived = (po: PurchaseOrder) => po.flowHistory.some(h => h.step === "Items Received")

  async function saveManualItem() {
    if (!manualItem.description || !manualItem.qty || !manualItem.unitPrice) {
      alert("Please fill in all required fields")
      return
    }

    setSavingManualItem(true)

    try {
      const stockId = `manual-${Date.now()}`
      const qty = parseFloat(manualItem.qty)
      const gstTotal = parseFloat(manualItem.gst || "0")
      const otherExpenseTotal = parseFloat(manualItem.otherExpense || "0")
      const gstPerUnit = qty > 0 ? gstTotal / qty : 0
      const otherExpensePerUnit = qty > 0 ? otherExpenseTotal / qty : 0
      const landedCostPerUnit = parseFloat(manualItem.unitPrice) + gstPerUnit + otherExpensePerUnit

      // Generate serial ID for manual item
      const existingManualCount = allInventoryItems.filter(i => i.poNumber?.startsWith("MI-")).length
      const serialNumber = `MI-${String(existingManualCount + 1).padStart(4, "0")}`

      const itemData = {
        id: stockId,
        itemId: stockId,
        description: manualItem.description,
        unit: manualItem.unit,
        receivedQty: qty,
        availableQty: qty,
        allocatedQty: 0,
        costPrice: landedCostPerUnit,
        supplierName: manualItem.supplierName || "Manual",
        poNumber: serialNumber,
        poType: "manual",
        gst: gstTotal,
        otherExpense: otherExpenseTotal,
      }

      const res = await fetch("/api/db/inventory-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "insert", data: itemData }),
      })

      if (!res.ok) {
        throw new Error("Failed to save item")
      }

      // Refresh inventory list
      loadStockItems()
      setShowManualItemModal(false)
      setManualItem({
        description: "",
        qty: "",
        unit: "pcs",
        unitPrice: "",
        supplierName: "",
        gst: "",
        otherExpense: ""
      })
    } catch (error) {
      console.error("Error saving manual item:", error)
      alert("Failed to save item. Please try again.")
    } finally {
      setSavingManualItem(false)
    }
  }

  async function receiveItems(po: any) {
    console.log("Receiving items for PO:", po.poNumber)
    setReceiving(true)
    
    const updatedItems = po.type === "imported"
      ? po.importedItems.map((item: any) => ({ ...item, usedQty: 0 }))
      : po.items.map((item: any) => ({ ...item, usedQty: 0 }))
    
    const updated = {
      ...po,
      flowHistory: [
        ...po.flowHistory,
        { step: "Items Received", actor: "Inventory", note: "GRN generated", doneAt: new Date().toISOString() },
      ],
      ...(po.type === "imported" ? { importedItems: updatedItems } : { items: updatedItems }),
    }
    
    try {
      await savePO(updated)
      console.log("PO updated with Items Received status")
    } catch (err) {
      console.error("Failed to save PO:", err)
      alert("Error: Failed to save PO. Please try again.")
      setReceiving(false)
      return
    }

    const itemsToInsert = po.type === "imported"
      ? po.importedItems.map((item: any) => ({
          itemId: item.id,
          description: item.description,
          availableQty: item.qty,
          unit: item.unit,
          costPrice: item.unitPrice,
          poNumber: po.poNumber,
          supplierName: po.importedSupplierName || "—",
          specs: item.specs || "",
        }))
      : (() => {
          const quote = po.quotes.find((q: any) => q.supplierId === po.finalizedSupplierId) || po.quotes[0]
          return po.items.map((item: any, idx: number) => {
            const quoteItem = quote?.items.find((qi: any) => qi.itemId === item.id) || quote?.items[idx]
            const unitPrice = quoteItem?.unitPrice || 0
            return {
              itemId: item.id,
              description: item.description,
              availableQty: item.qty,
              unit: item.unit,
              costPrice: unitPrice,
              poNumber: po.poNumber,
              supplierName: po.supplierNames[0] || "—",
              specs: item.specs || "",
            }
          })
        })()

    for (const item of itemsToInsert) {
      try {
        await fetch("/api/db/inventory-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "insert", data: item }),
        })
      } catch (err) {
        console.error("Failed to insert item:", err)
      }
    }

    setPos(pos.filter(p => p.status === "imp_inventory" || p.status === "in_inventory"))
    setSelected(updated)
    generateGRN(updated)
    setReceiving(false)

    const currentTab = tab
    setTab("receiving")
    setTimeout(() => {
      setTab(currentTab)
      loadStockItems()
    }, 100)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-sm text-[hsl(var(--muted-foreground))]">
      Loading inventory...
    </div>
  )
  return (
    <div className="space-y-4">
      {/* Filter Section */}
      {showFilters && (
        <div className="flex items-center gap-2 rounded-lg border bg-[hsl(var(--muted))]/20 p-2">
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            placeholder="From Date"
            className="h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] w-36 cursor-pointer"
          />
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            placeholder="To Date"
            className="h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] w-36 cursor-pointer"
          />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === "receiving" ? "Search PO, supplier, PSSID..." : "Search item, PO, supplier..."}
              className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          {(search || fromDate || toDate) && (
            <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => { setSearch(""); setFromDate(""); setToDate("") }}>Clear</Button>
          )}
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex items-center justify-between gap-0 border-b -mx-6 px-6">
        <div className="flex gap-0">
          {(["receiving", "inventory"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative cursor-pointer ${
                tab === t ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {t === "receiving" ? "Receiving" : "Inventory"}
              {tab === t && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          ))}
        </div>
        
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 cursor-pointer" onClick={() => setShowFilters(!showFilters)}>Filters</Button>
      </div>

      {/* Receiving Sub-tabs */}
      {tab === "receiving" && (
        <div className="flex gap-0 border-b -mx-6 px-6 -mt-4">
          {(["pending", "received"] as const).map(st => (
            <button key={st} onClick={() => setReceivingSubTab(st)}
              className={`px-3 py-2 text-xs font-medium transition-colors relative cursor-pointer ${
                receivingSubTab === st ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {st === "pending" ? "Pending" : "Received"}
              <span className="ml-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                ({st === "pending" ? pendingReceivingPOs.length : receivedReceivingPOs.length})
              </span>
              {receivingSubTab === st && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Inventory Sub-tabs */}
      {tab === "inventory" && (
        <div className="flex items-center gap-0 border-b -mx-6 px-6 -mt-4">
          <div className="flex gap-0">
            {(["po", "manual"] as const).map(st => (
              <button key={st} onClick={() => setInventorySubTab(st)}
                className={`px-3 py-2 text-xs font-medium transition-colors relative cursor-pointer ${
                  inventorySubTab === st ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}>
                {st === "po" ? "From Purchase Orders" : "Manual Added"}
                <span className="ml-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                  {st === "po" ? allInventoryItems.filter(i => i.poNumber && i.poNumber.trim() !== "" && !i.poNumber.startsWith("MI-")).length : allInventoryItems.filter(i => i.poNumber?.startsWith("MI-")).length}
                </span>
                {inventorySubTab === st && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
                )}
              </button>
            ))}
          </div>
          {inventorySubTab === "manual" && (
            <button 
              onClick={() => setShowManualItemModal(true)}
              className="text-xs font-medium text-[hsl(var(--primary))] hover:underline decoration-dotted underline-offset-2 cursor-pointer transition-colors ml-auto"
            >
              Add Manual Item
            </button>
          )}
        </div>
      )}

      {/* Receiving Tab */}
      {tab === "receiving" && (
        <>
          {filteredReceiving.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-[hsl(var(--muted-foreground))]">
              <Package className="h-8 w-8 opacity-30" />
              <p className="text-sm">
                {receivingSubTab === "pending" 
                  ? (pendingReceivingPOs.length === 0 ? "No pending items to receive." : "No results found.")
                  : (receivedReceivingPOs.length === 0 ? "No received items yet." : "No results found.")
                }
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredReceiving.map(po => {
                const isImported = po.type === "imported"
                const poTotal = isImported 
                  ? po.importedItems.reduce((s, i) => s + i.unitPrice * i.qty, 0)
                  : (() => {
                      const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId)
                      return po.items.reduce((s, item) => {
                        const quoteItem = quote?.items.find(qi => qi.itemId === item.id)
                        return s + (quoteItem?.unitPrice || 0) * item.qty
                      }, 0)
                    })()
                const arrivedAt = isImported
                  ? po.flowHistory.findLast(h => h.step === "Moved to Inventory")?.doneAt ?? po.createdAt
                  : po.createdAt
                const itemCount = isImported ? po.importedItems.length : po.items.length
                const supplierName = isImported ? po.importedSupplierName : po.supplierNames[0]
                const isReceived = po.flowHistory?.some(h => h.step === "Items Received")
                
                return (
                  <div
                    key={po.id}
                    className="rounded-lg border bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]/50 transition-colors cursor-pointer"
                    onClick={() => setSelected(po)}
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[hsl(var(--primary))]">{po.poNumber}</span>
                          <Badge variant={isImported ? "secondary" : "info"} className="text-[10px]">
                            {isImported ? "Imported PO" : "Direct PO"}
                          </Badge>
                          {isReceived && (
                            <Badge variant="success" className="text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Received
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                          {supplierName ?? "—"}
                          {isImported && po.pssid && <span className="ml-2 font-mono">· PSSID: {po.pssid}</span>}
                          <span className="ml-2">· {itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                          <span className="ml-2">· Arrived {new Date(arrivedAt).toLocaleDateString()}</span>
                        </p>
                      </div>
                      <p className="text-sm font-bold shrink-0">
                        PKR {poTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      {/* Inventory Tab */}
      {tab === "inventory" && (
        <>
          {filteredInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-[hsl(var(--muted-foreground))]">
              <Package className="h-8 w-8 opacity-30" />
              <p className="text-sm">{allInventoryItems.length === 0 ? "No items in inventory yet." : "No results found."}</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-[hsl(var(--muted))]/40">
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Item Description</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Specs</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Product ID</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">PO</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Supplier</th>
                    <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Qty</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Unit</th>
                    <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Landed Cost/Unit</th>
                    <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total Value</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Received</th>
                    {inventorySubTab === "manual" && (
                      <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInventory.map((item) => {
                    // Generate persistent Product ID based on database ID
                    const idHash = item.id.replace(/[^0-9]/g, '').slice(-6)
                    const productId = `P-${idHash}`
                    const isManual = item.poNumber?.startsWith("MI-")
                    
                    return (
                      <tr key={item.id} className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer" onClick={() => setSelectedInventoryItem(item)}>
                        <td className="px-4 py-2.5 text-xs font-medium">{item.description}</td>
                        <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{item.specs || "—"}</td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{productId}</td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{item.poNumber}</td>
                        <td className="px-4 py-2.5 text-xs">{item.supplier}</td>
                        <td className="px-4 py-2.5 text-xs text-center">{item.qty}</td>
                        <td className="px-4 py-2.5 text-xs">{item.unit}</td>
                        <td className="px-4 py-2.5 text-xs text-right">PKR {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-xs text-right font-semibold">PKR {(item.unitPrice * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{new Date(item.receivedAt).toLocaleDateString()}</td>
                        {inventorySubTab === "manual" && isManual && (
                          <td className="px-4 py-2.5 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteInventoryItem(item)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selected && (
        <PODetailModal
          po={selected}
          receiving={receiving}
          alreadyReceived={alreadyReceived(selected)}
          onReceive={() => receiveItems(selected)}
          onClose={() => setSelected(null)}
        />
      )}

      {selectedInventoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedInventoryItem(null)}>
          <div className="w-full max-w-2xl rounded-lg border bg-[hsl(var(--card))] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[hsl(var(--muted))]/20 flex items-center justify-center">
                  <Package className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div>
                  <p className="text-base font-bold text-[hsl(var(--foreground))]">{selectedInventoryItem.description}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {(() => {
                      const idHash = selectedInventoryItem.id.replace(/[^0-9]/g, '').slice(-6)
                      const productId = `P-${idHash}`
                      return `Product ID: ${productId}`
                    })()}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => setSelectedInventoryItem(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              {/* Quantity and Entry Info */}
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Quantity</p>
                  <p className="text-lg font-bold">{selectedInventoryItem.qty}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{selectedInventoryItem.unit}</p>
                </div>
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Supplier</p>
                  <p className="text-sm font-semibold truncate">{selectedInventoryItem.supplier}</p>
                </div>
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Date Received</p>
                  <p className="text-sm font-semibold">{new Date(selectedInventoryItem.receivedAt).toLocaleDateString()}</p>
                </div>
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Time Received</p>
                  <p className="text-sm font-semibold">{new Date(selectedInventoryItem.receivedAt).toLocaleTimeString()}</p>
                </div>
              </div>

              {selectedInventoryItem.pssid && (
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">PSSID</p>
                  <p className="text-sm font-mono font-semibold">{selectedInventoryItem.pssid}</p>
                </div>
              )}

              {/* Cost Breakdown */}
              <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4">
                <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-3">Cost Breakdown</p>
                <div className="space-y-3">
                  {(() => {
                    const isManualItem = selectedInventoryItem.poNumber?.startsWith("MI-")
                    
                    if (isManualItem) {
                      // Manual item calculation (uses gst and otherExpense fields)
                      const gstPerUnit = (selectedInventoryItem.gst || 0) / selectedInventoryItem.qty
                      const otherPerUnit = (selectedInventoryItem.otherExpense || 0) / selectedInventoryItem.qty
                      const baseUnitCost = selectedInventoryItem.unitPrice - gstPerUnit - otherPerUnit
                      const unitCostWithGST = baseUnitCost + gstPerUnit
                      
                      return (
                        <>
                          <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                            <div>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">Base Unit Cost (without GST & expenses)</p>
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">PKR {baseUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} / unit</p>
                            </div>
                            <p className="text-sm font-semibold">PKR {(baseUnitCost * selectedInventoryItem.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                            <div>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">Unit Cost (with GST)</p>
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">PKR {unitCostWithGST.toLocaleString(undefined, { minimumFractionDigits: 2 })} / unit</p>
                            </div>
                            <p className="text-sm font-semibold">PKR {(unitCostWithGST * selectedInventoryItem.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                            <div>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">Unit Cost (with GST & other expenses)</p>
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">PKR {selectedInventoryItem.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} / unit</p>
                            </div>
                            <p className="text-sm font-bold">PKR {(selectedInventoryItem.unitPrice * selectedInventoryItem.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                        </>
                      )
                    } else {
                      // PO-derived item calculation (uses quote data from PO)
                      const po = pos.find(p => p.poNumber === selectedInventoryItem.poNumber)
                      if (po && po.quotes.length > 0) {
                        const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId) || po.quotes[0]
                        const itemsTotal = po.items.reduce((sum, item) => {
                          const qi = quote?.items.find(q => q.itemId === item.id)
                          return sum + (qi ? qi.unitPrice * item.qty : 0)
                        }, 0)
                        
                        const taxAmount = itemsTotal * ((quote?.taxPct || 0) / 100)
                        const transportCost = quote?.transportCost || 0
                        const otherCost = quote?.otherCost || 0
                        const additionalCosts = taxAmount + transportCost + otherCost
                        
                        // Find this specific item in the PO to get its base price
                        const poItem = po.items.find(item => item.description === selectedInventoryItem.description)
                        const quoteItem = quote?.items.find(q => q.itemId === poItem?.id)
                        const baseUnitPrice = quoteItem?.unitPrice || 0
                        const itemTotal = baseUnitPrice * selectedInventoryItem.qty
                        
                        // Calculate proportional share of additional costs for this item
                        const proportionalAdditionalCost = itemsTotal > 0 ? (itemTotal / itemsTotal) * additionalCosts : 0
                        const proportionalTaxAmount = itemsTotal > 0 ? (itemTotal / itemsTotal) * taxAmount : 0
                        
                        const unitCostWithTax = baseUnitPrice + (proportionalTaxAmount / selectedInventoryItem.qty)
                        const landedCostPerUnit = baseUnitPrice + (proportionalAdditionalCost / selectedInventoryItem.qty)
                        
                        return (
                          <>
                            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                              <div>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Base Unit Cost (without tax & expenses)</p>
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">PKR {baseUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} / unit</p>
                              </div>
                              <p className="text-sm font-semibold">PKR {itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                              <div>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Unit Cost (with tax)</p>
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">PKR {unitCostWithTax.toLocaleString(undefined, { minimumFractionDigits: 2 })} / unit</p>
                              </div>
                              <p className="text-sm font-semibold">PKR {(unitCostWithTax * selectedInventoryItem.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                              <div>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Unit Cost (with tax & other expenses)</p>
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">PKR {landedCostPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2 })} / unit</p>
                              </div>
                              <p className="text-sm font-bold">PKR {(landedCostPerUnit * selectedInventoryItem.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                          </>
                        )
                      } else {
                        return (
                          <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                            <div>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">Unit Cost</p>
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">PKR {selectedInventoryItem.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} / unit</p>
                            </div>
                            <p className="text-sm font-bold">PKR {(selectedInventoryItem.unitPrice * selectedInventoryItem.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                        )
                      }
                    }
                  })()}
                </div>
              </div>

              {/* Tax & Expenses */}
              {(selectedInventoryItem.gst || selectedInventoryItem.otherExpense) && (
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4">
                  <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-3">Tax & Expenses</p>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedInventoryItem.gst && selectedInventoryItem.gst > 0 && (
                      <>
                        <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">GST Total</p>
                          <p className="text-sm font-semibold">PKR {selectedInventoryItem.gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">GST/Unit</p>
                          <p className="text-sm font-semibold">PKR {(selectedInventoryItem.gst / selectedInventoryItem.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                      </>
                    )}
                    {selectedInventoryItem.otherExpense && selectedInventoryItem.otherExpense > 0 && (
                      <>
                        <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">Other Expense Total</p>
                          <p className="text-sm font-semibold">PKR {selectedInventoryItem.otherExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))]">
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">Other Expense/Unit</p>
                          <p className="text-sm font-semibold">PKR {(selectedInventoryItem.otherExpense / selectedInventoryItem.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showManualItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowManualItemModal(false)}>
          <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[hsl(var(--muted))]/40 to-transparent shrink-0">
              <div>
                <p className="text-sm font-bold text-[hsl(var(--primary))]">Add Manual Item</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Add inventory item manually</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => setShowManualItemModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1 block">Description *</label>
                  <input
                    type="text"
                    value={manualItem.description}
                    onChange={e => setManualItem({ ...manualItem, description: e.target.value })}
                    placeholder="Item description"
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1 block">Quantity *</label>
                    <input
                      type="number"
                      value={manualItem.qty}
                      onChange={e => setManualItem({ ...manualItem, qty: e.target.value })}
                      placeholder="0"
                      className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1 block">Unit *</label>
                    <input
                      type="text"
                      value={manualItem.unit}
                      onChange={e => setManualItem({ ...manualItem, unit: e.target.value })}
                      placeholder="pcs"
                      className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1 block">Unit Price (PKR) *</label>
                  <input
                    type="number"
                    value={manualItem.unitPrice}
                    onChange={e => setManualItem({ ...manualItem, unitPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1 block">Supplier Name</label>
                  <input
                    type="text"
                    value={manualItem.supplierName}
                    onChange={e => setManualItem({ ...manualItem, supplierName: e.target.value })}
                    placeholder="Optional supplier name"
                    className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1 block">GST (PKR)</label>
                    <input
                      type="number"
                      value={manualItem.gst}
                      onChange={e => setManualItem({ ...manualItem, gst: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1 block">Other Expense (PKR)</label>
                    <input
                      type="number"
                      value={manualItem.otherExpense}
                      onChange={e => setManualItem({ ...manualItem, otherExpense: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => setShowManualItemModal(false)}>Cancel</Button>
                <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={saveManualItem} disabled={savingManualItem}>
                  {savingManualItem ? "Saving..." : "Save Item"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-lg border bg-[hsl(var(--card))] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[hsl(var(--foreground))]">Delete Item</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Are you sure you want to delete "{itemToDelete.description}"?</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer flex-1" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                <Button size="sm" className="h-8 text-xs cursor-pointer flex-1 bg-red-600 hover:bg-red-700" onClick={confirmDelete}>Delete</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}