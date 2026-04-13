"use client"
import { useEffect, useState } from "react"
import { getPOs, savePO, type PurchaseOrder, type ImportedPOItem } from "@/lib/purchase"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, Search, X, CheckCircle2 } from "lucide-react"
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
        const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId)
        return po.items.reduce((s, item) => {
          const quoteItem = quote?.items.find(qi => qi.itemId === item.id)
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

  const items = isImported ? po.importedItems : po.items.map(item => {
    const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId)
    const quoteItem = quote?.items.find(qi => qi.itemId === item.id)
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
              <Badge variant="success" className="text-[10px] flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" /> Received
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
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
            <Button size="sm" className="h-8 text-xs" onClick={onReceive} disabled={receiving}>
              {receiving ? "Processing..." : "Receive Items & Generate GRN"}
            </Button>
          )}
          {alreadyReceived && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => generateGRN(po)}>
              Generate GRN
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={onClose}>Close</Button>
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
}

export function InventoryList() {
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [receiving, setReceiving] = useState(false)
  const [tab, setTab] = useState<"receiving" | "inventory" | "stock">("receiving")
  const [receivingSubTab, setReceivingSubTab] = useState<"pending" | "received">("pending")
  const [inventorySubTab, setInventorySubTab] = useState<"items" | "history">("items")
  const [allInventoryItems, setAllInventoryItems] = useState<InventoryItem[]>([])
  const [usingFallbackData, setUsingFallbackData] = useState(false)
  const [inventoryCount, setInventoryCount] = useState(0)

  useEffect(() => {
    getPOs().then(all => {
      setPos(all.filter(p => p.status === "imp_inventory" || p.status === "in_inventory"))
      setLoading(false)
    })
    
    // Load inventory count immediately on mount
    loadInventoryCount()
  }, [])
  
  async function loadInventoryCount() {
    const { data: stockItems, error } = await supabase
      .from("erp_inventory_stock")
      .select("*", { count: "exact" })
    
    if (!error && stockItems && stockItems.length > 0) {
      setInventoryCount(stockItems.length)
    } else {
      // Fallback: count from received POs
      const allPOs = await getPOs()
      const receivedPOs = allPOs.filter(p => p.flowHistory?.some(h => h.step === "Items Received"))
      const itemCount = receivedPOs.reduce((sum, po) => {
        if (po.type === "imported") {
          return sum + po.importedItems.length
        }
        return sum + po.items.length
      }, 0)
      setInventoryCount(itemCount)
    }
  }

  // Load stock items from erp_inventory_stock table
  useEffect(() => {
    async function loadStockItems() {
      console.log("📦 Loading stock items from database...")
      const { data: stockItems, error } = await supabase
        .from("erp_inventory_stock")
        .select("*")
        .order("created_at", { ascending: false })
      
      if (error) {
        console.log("⚠️ Could not load stock items, using fallback from POs")
        loadFallbackInventoryItems()
        setUsingFallbackData(true)
        return
      }
      
      if (stockItems && stockItems.length > 0) {
        console.log(`✅ Loaded ${stockItems.length} stock items from database`)
        const inventoryItems: InventoryItem[] = stockItems.map(stock => ({
          id: stock.item_id,
          description: stock.description,
          qty: stock.available_qty, // Use available_qty instead of received_qty
          unit: stock.unit,
          unitPrice: stock.cost_price,
          poNumber: stock.po_number,
          supplier: stock.supplier_name || "—",
          pssid: undefined,
          receivedAt: stock.created_at,
        }))
        setAllInventoryItems(inventoryItems)
        setInventoryCount(inventoryItems.length)
        setUsingFallbackData(false)
      } else {
        console.log("⚠️ No stock items found in database, using fallback from POs")
        // Fallback to PO items if stock table is empty
        loadFallbackInventoryItems()
        setUsingFallbackData(true)
      }
    }
    
    function loadFallbackInventoryItems() {
      const receivedPOs = pos.filter(p => p.flowHistory?.some(h => h.step === "Items Received"))
      const fallbackItems: InventoryItem[] = receivedPOs.flatMap(po => {
        if (po.type === "imported") {
          return po.importedItems.map(item => {
            const usedQty = (item as any).usedQty || 0
            const availableQty = item.qty - usedQty
            
            return {
              ...item,
              qty: availableQty, // Show available quantity
              poNumber: po.poNumber,
              supplier: po.importedSupplierName || "—",
              pssid: po.pssid,
              receivedAt: po.flowHistory.find(h => h.step === "Items Received")?.doneAt || po.createdAt,
            }
          })
        } else {
          // Handle direct/finalized POs - calculate landed cost per item
          const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId)
          
          // Calculate total items cost
          const itemsTotal = po.items.reduce((sum, item) => {
            const qi = quote?.items.find(q => q.itemId === item.id)
            return sum + (qi ? qi.unitPrice * item.qty : 0)
          }, 0)
          
          // Calculate additional costs (tax, transport, other)
          const additionalCosts = (quote?.taxPct || 0) + (quote?.transportCost || 0) + (quote?.otherCost || 0)
          
          return po.items.map(item => {
            const qi = quote?.items.find(q => q.itemId === item.id)
            const basePrice = qi?.unitPrice || 0
            const itemTotal = basePrice * item.qty
            
            // Proportional share of additional costs
            const proportionalAdditionalCost = itemsTotal > 0 ? (itemTotal / itemsTotal) * additionalCosts : 0
            
            // Landed cost per unit = base price + (proportional additional costs / quantity)
            const landedCostPerUnit = basePrice + (item.qty > 0 ? proportionalAdditionalCost / item.qty : 0)
            
            const usedQty = (item as any).usedQty || 0
            const availableQty = item.qty - usedQty
            
            return {
              id: item.id,
              description: item.description,
              qty: availableQty, // Show available quantity
              unit: item.unit,
              unitPrice: landedCostPerUnit,
              poNumber: po.poNumber,
              supplier: po.supplierNames[0] || "—",
              pssid: undefined,
              receivedAt: po.flowHistory?.find(h => h.step === "Items Received")?.doneAt || po.createdAt,
            }
          })
        }
      })
      setAllInventoryItems(fallbackItems)
      setInventoryCount(fallbackItems.length)
    }
    
    if (tab === "inventory" || tab === "stock") {
      loadStockItems()
    }
  }, [tab, pos])
  const receivingPOs = pos.filter(p => {
    if (p.type === "imported") {
      return true // All imported POs in imp_inventory status
    }
    // For direct POs, they're in receiving if status is in_inventory
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
      return p.poNumber.toLowerCase().includes(searchLower) ||
        (p.importedSupplierName ?? "").toLowerCase().includes(searchLower) ||
        (p.pssid ?? "").toLowerCase().includes(searchLower) ||
        p.importedItems.some(i => i.description.toLowerCase().includes(searchLower))
    } else {
      return p.poNumber.toLowerCase().includes(searchLower) ||
        p.supplierNames.some(s => s.toLowerCase().includes(searchLower)) ||
        p.items.some(i => i.description.toLowerCase().includes(searchLower))
    }
  })

  const filteredInventory = allInventoryItems.filter(item =>
    item.description.toLowerCase().includes(search.toLowerCase()) ||
    item.poNumber.toLowerCase().includes(search.toLowerCase()) ||
    item.supplier.toLowerCase().includes(search.toLowerCase()) ||
    (item.pssid ?? "").toLowerCase().includes(search.toLowerCase())
  )

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
  async function receiveItems(po: PurchaseOrder) {
    console.log("📦 Receiving items for PO:", po.poNumber)
    setReceiving(true)
    const updated: PurchaseOrder = {
      ...po,
      flowHistory: [
        ...po.flowHistory,
        { step: "Items Received", actor: "Inventory", note: "GRN generated", doneAt: new Date().toISOString() },
      ],
    }
    await savePO(updated)
    console.log("✅ PO updated with 'Items Received' status")
    
    // Items are now available in the Updated Stock tab (loaded from PO data)
    console.log("✅ Items will appear in Updated Stock tab")
    
    setPos(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSelected(updated)
    generateGRN(updated)
    setReceiving(false)
    
    console.log("🔄 Refreshing inventory display...")
    // Force reload of inventory items by toggling tab
    const currentTab = tab
    setTab("receiving")
    setTimeout(() => {
      setTab(currentTab)
      loadInventoryCount() // Refresh the count
      console.log("✅ Inventory display refreshed")
      // If we were on inventory tab, it will reload. If on receiving, switch back.
    }, 100)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-sm text-[hsl(var(--muted-foreground))]">
      Loading inventory...
    </div>
  )
  return (
    <div className="space-y-4">
      {/* Main Tabs */}
      <div className="flex items-center justify-between gap-0 border-b -mx-6 px-6">
        <div className="flex gap-0">
          {(["receiving", "stock", "inventory"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t ? "border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]"
                : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {t === "receiving" ? "Receiving" : t === "stock" ? "Updated Stock" : "Inventory"}
              <span className="ml-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                ({t === "receiving" ? receivingPOs.length : t === "stock" ? inventoryCount : inventoryCount})
              </span>
            </button>
          ))}
        </div>
        
        {/* Search */}
        <div className="relative w-80 -mb-px pb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === "receiving" ? "Search PO, supplier, PSSID..." : "Search item, PO, supplier..."}
            className="w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-10 pr-4 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Receiving Sub-tabs */}
      {tab === "receiving" && (
        <div className="flex gap-0 border-b -mx-6 px-6 -mt-4">
          {(["pending", "received"] as const).map(st => (
            <button key={st} onClick={() => setReceivingSubTab(st)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                receivingSubTab === st ? "border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]"
                : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {st === "pending" ? "Pending" : "Received"}
              <span className="ml-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                ({st === "pending" ? pendingReceivingPOs.length : receivedReceivingPOs.length})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Updated Stock Sub-tabs */}
      {tab === "stock" && (
        <div className="flex gap-0 border-b -mx-6 px-6 -mt-4">
          <span className="px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))]">
            Stock Items
          </span>
        </div>
      )}

      {/* Inventory Sub-tabs */}
      {tab === "inventory" && (
        <div className="flex gap-0 border-b -mx-6 px-6 -mt-4">
          <span className="px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))]">
            Stock Items
          </span>
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
      {/* Updated Stock Tab */}
      {tab === "stock" && (
        <>
          {filteredInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-[hsl(var(--muted-foreground))]">
              <Package className="h-8 w-8 opacity-30" />
              <p className="text-sm">{allInventoryItems.length === 0 ? "No items in stock yet. Receive items from POs to add them here." : "No results found."}</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-[hsl(var(--muted))]/40">
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Item Description</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-28">PO #</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-32">Supplier</th>
                    <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-20">Qty</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-16">Unit</th>
                    <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-32">Landed Cost/Unit</th>
                    <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-32">Total Value</th>
                    <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-28">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInventory.map(item => (
                    <tr key={item.id} className="hover:bg-[hsl(var(--muted))]/30 transition-colors">
                      <td className="px-4 py-2.5 text-xs font-medium">{item.description}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{item.poNumber}</td>
                      <td className="px-4 py-2.5 text-xs">{item.supplier}</td>
                      <td className="px-4 py-2.5 text-xs text-center font-semibold">{item.qty}</td>
                      <td className="px-4 py-2.5 text-xs">{item.unit}</td>
                      <td className="px-4 py-2.5 text-xs text-right">PKR {item.unitPrice.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-semibold">PKR {(item.unitPrice * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{new Date(item.receivedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      
      {/* Inventory Tab */}
      {tab === "inventory" && (
        <>
          {inventorySubTab === "items" ? (
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
                        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-28">PO #</th>
                        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-36">Supplier</th>
                        <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-16">Qty</th>
                        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-16">Unit</th>
                        <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-32">Landed Cost/Unit</th>
                        <th className="h-9 px-4 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-32">Total Value</th>
                        <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-28">Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredInventory.map((item, idx) => (
                        <tr key={`${item.poNumber}-${item.id}-${idx}`} className="hover:bg-[hsl(var(--muted))]/30 transition-colors">
                          <td className="px-4 py-2.5 text-xs font-medium">{item.description}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{item.poNumber}</td>
                          <td className="px-4 py-2.5 text-xs">{item.supplier}</td>
                          <td className="px-4 py-2.5 text-xs text-center">{item.qty}</td>
                          <td className="px-4 py-2.5 text-xs">{item.unit}</td>
                          <td className="px-4 py-2.5 text-xs text-right">PKR {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-xs text-right font-semibold">PKR {(item.unitPrice * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{new Date(item.receivedAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <InventoryHistory />
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
    </div>
  )
}