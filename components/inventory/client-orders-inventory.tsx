"use client"
import { useState, useEffect } from "react"
import { getOrders, saveOrder, type Order } from "@/lib/orders"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, X, Eye, Download, Truck, FileText } from "lucide-react"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import { generateDispatchNotePDF } from "@/lib/generate-dispatch-note"
import { deductInventoryForOrder } from "@/lib/inventory"

export function ClientOrdersInventory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    getOrders().then(o => {
      // Show confirmed orders (sent from Finance) and processing/shipped/delivered orders
      const filtered = o.filter(order => 
        order.status === "confirmed" || 
        order.status === "processing" || 
        order.status === "shipped" || 
        order.status === "delivered"
      )
      console.log("Inventory orders loaded:", filtered.length, filtered)
      setOrders(filtered)
      setLoading(false)
    })
    const channel = supabase
      .channel("inventory_client_orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "erp_orders" }, () => {
        getOrders().then(o => {
          const filtered = o.filter(order => 
            order.status === "confirmed" || 
            order.status === "processing" || 
            order.status === "shipped" || 
            order.status === "delivered"
          )
          console.log("Inventory orders updated:", filtered.length, filtered)
          setOrders(filtered)
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="space-y-4">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{orders.length} order{orders.length !== 1 ? "s" : ""} for dispatch</p>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading orders...</p>
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium">No orders for dispatch</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Confirmed orders from Finance will appear here.
          </p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                {["Order #", "Client", "Items", "Total", "Dispatcher", "Delivery Date", "Status"].map(h => (
                  <th key={h} className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map(order => (
                <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-[hsl(var(--muted))]/30 transition-colors cursor-pointer">
                  <td className="px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary))]">{order.orderNumber}</td>
                  <td className="px-4 py-2.5 text-xs font-medium">{order.clientName}</td>
                  <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{order.items.length}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold">PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2.5 text-xs">{order.dispatcher || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={
                      order.status === "delivered" ? "success" :
                      order.status === "shipped" ? "info" :
                      order.status === "processing" ? "warning" : "default"
                    } className="text-[10px] px-1.5 py-0">
                      {order.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrder && (
        <ClientOrderInventoryDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={o => {
            setOrders(prev => prev.map(x => x.id === o.id ? o : x))
            setSelectedOrder(o)
          }}
        />
      )}
    </div>
  )
}


function ClientOrderInventoryDetail({ order, onClose, onUpdate }: {
  order: Order
  onClose: () => void
  onUpdate: (o: Order) => void
}) {
  const [updating, setUpdating] = useState(false)
  const [showDispatchDialog, setShowDispatchDialog] = useState(false)
  const [showDeliveryConfirm, setShowDeliveryConfirm] = useState(false)
  const [stockItems, setStockItems] = useState<any[]>([])
  const [loadingStock, setLoadingStock] = useState(false)
  const [dispatcherName, setDispatcherName] = useState(order.dispatcher || "")
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0])
  const [showDeliveryAnimation, setShowDeliveryAnimation] = useState(false)

  async function downloadInvoice() {
    try {
      await downloadInvoicePDF(order)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  async function viewInvoice() {
    try {
      const blob = await import("@/lib/generate-invoice-pdf").then(m => m.generateInvoicePDF(order))
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  async function handleDownloadDispatchNote() {
    if (!dispatcherName.trim()) {
      alert("Please enter dispatcher name")
      return
    }
    
    try {
      const blob = await generateDispatchNotePDF(order, dispatcherName, new Date(dispatchDate).toLocaleDateString())
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Dispatch-Note-${order.orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setShowDispatchDialog(false)
    } catch (error) {
      console.error("Error generating dispatch note:", error)
      alert("Failed to generate dispatch note. Please try again.")
    }
  }

  async function updateStatus(newStatus: "processing" | "shipped" | "delivered") {
    setUpdating(true)
    const updated: Order = { ...order, status: newStatus }
    await saveOrder(updated)
    
    // Deduct inventory when order is delivered
    if (newStatus === "delivered") {
      await deductInventoryForOrder(updated)
      
      // Close the delivery confirmation dialog
      if (showDeliveryConfirm) {
        setShowDeliveryConfirm(false)
      }
      
      // Show delivery animation
      setShowDeliveryAnimation(true)
      
      // Hide animation and update order after 3 seconds
      setTimeout(() => {
        setShowDeliveryAnimation(false)
        onUpdate(updated)
        setUpdating(false)
      }, 3000)
    } else {
      onUpdate(updated)
      setUpdating(false)
    }
  }

  async function handleMarkAsDelivered() {
    // Check if this is a custom order (no stock tracking needed)
    const isCustomOrder = order.items.every(item => !item.trackInventory)
    
    if (isCustomOrder) {
      // For custom orders, just show a simple confirmation
      setShowDeliveryConfirm(true)
      return
    }
    
    setLoadingStock(true)
    setShowDeliveryConfirm(true)
    
    try {
      console.log("📦 Loading inventory from received POs...")
      
      // Get all POs that have been received
      const allPOs = await import("@/lib/purchase").then(m => m.getPOs())
      const receivedPOs = allPOs.filter(p => 
        p.flowHistory?.some(h => h.step === "Items Received")
      )
      
      console.log(`✅ Found ${receivedPOs.length} received POs`)
      
      // Build inventory from received POs
      const inventoryItems: any[] = []
      
      for (const po of receivedPOs) {
        if (po.type === "imported") {
          for (const item of po.importedItems) {
            const usedQty = (item as any).usedQty || 0
            const availableQty = item.qty - usedQty
            
            inventoryItems.push({
              id: `${po.id}-${item.id}`,
              po_id: po.id,
              po_number: po.poNumber,
              item_id: item.id,
              description: item.description,
              unit: item.unit,
              available_qty: availableQty,
              cost_price: item.unitPrice,
              supplier_name: po.importedSupplierName || "—",
              po_type: "imported",
              created_at: po.flowHistory.find(h => h.step === "Items Received")?.doneAt || po.createdAt
            })
          }
        } else {
          // Direct PO - calculate landed cost
          const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId)
          const itemsTotal = po.items.reduce((sum, item) => {
            const qi = quote?.items.find(q => q.itemId === item.id)
            return sum + (qi ? qi.unitPrice * item.qty : 0)
          }, 0)
          const additionalCosts = (quote?.taxPct || 0) + (quote?.transportCost || 0) + (quote?.otherCost || 0)
          
          for (const item of po.items) {
            const qi = quote?.items.find(q => q.itemId === item.id)
            const basePrice = qi?.unitPrice || 0
            const itemTotal = basePrice * item.qty
            const proportionalAdditionalCost = itemsTotal > 0 ? (itemTotal / itemsTotal) * additionalCosts : 0
            const landedCostPerUnit = basePrice + (item.qty > 0 ? proportionalAdditionalCost / item.qty : 0)
            
            const usedQty = (item as any).usedQty || 0
            const availableQty = item.qty - usedQty
            
            inventoryItems.push({
              id: `${po.id}-${item.id}`,
              po_id: po.id,
              po_number: po.poNumber,
              item_id: item.id,
              description: item.description,
              unit: item.unit,
              available_qty: availableQty,
              cost_price: landedCostPerUnit,
              supplier_name: po.supplierNames[0] || "—",
              po_type: "local",
              created_at: po.flowHistory?.find(h => h.step === "Items Received")?.doneAt || po.createdAt
            })
          }
        }
      }
      
      console.log(`📋 Total inventory items: ${inventoryItems.length}`)
      
      // Filter for items matching the order
      const itemDescriptions = order.items.map(item => item.description)
      console.log("🔍 Looking for items:", itemDescriptions)
      
      const matchingStock = inventoryItems.filter(stock => 
        itemDescriptions.includes(stock.description)
      )
      
      console.log(`✅ Found ${matchingStock.length} matching items`)
      console.log("📦 Matching items:", matchingStock)
      
      setStockItems(matchingStock)
    } catch (error) {
      console.error("💥 Exception while fetching inventory:", error)
      setStockItems([])
    } finally {
      setLoadingStock(false)
    }
  }

  const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-lg font-bold text-[hsl(var(--primary))]">{order.orderNumber}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{order.clientName}</p>
            </div>
            {(order.dispatcher || order.deliveryDate) && (
              <>
                <div className="h-8 w-px bg-[hsl(var(--border))]" />
                <div className="flex items-center gap-3 text-xs">
                  {order.dispatcher && (
                    <div>
                      <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Dispatcher</p>
                      <p className="font-medium">{order.dispatcher}</p>
                    </div>
                  )}
                  {order.deliveryDate && (
                    <div>
                      <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Delivery Date</p>
                      <p className="font-medium">{new Date(order.deliveryDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Order Status */}
          <div>
            <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-2">Order Status</p>
            <Badge variant={
              order.status === "delivered" ? "success" :
              order.status === "shipped" ? "info" :
              order.status === "processing" ? "warning" : "default"
            } className="text-xs">
              {order.status}
            </Badge>
          </div>

          {/* Order Items */}
          <div>
            <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-2">Order Items</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[hsl(var(--muted))]/40 border-b">
                    <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                    <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-16">Qty</th>
                    <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-16">Unit</th>
                    <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-24">Unit Price</th>
                    <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-center">{item.qty}</td>
                      <td className="px-3 py-2">{item.unit}</td>
                      <td className="px-3 py-2 text-right">PKR {item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-medium">PKR {(item.unitPrice * item.qty).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Costs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>Subtotal</span>
              <span className="font-semibold">PKR {order.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {order.taxPercent > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span>Tax ({order.taxPercent}%)</span>
                <span>PKR {order.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {order.transportCost > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span>{order.transportLabel}</span>
                <span>PKR {order.transportCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {order.otherCost > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span>{order.otherCostLabel}</span>
                <span>PKR {order.otherCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-bold border-t pt-2">
              <span>Total</span>
              <span>PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={viewInvoice}>
            <Eye className="h-3 w-3 mr-1.5" /> View Invoice
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={downloadInvoice}>
            <Download className="h-3 w-3 mr-1.5" /> Download Invoice
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs bg-purple-50 hover:bg-purple-100 dark:bg-purple-950 dark:hover:bg-purple-900" onClick={() => setShowDispatchDialog(true)}>
            <FileText className="h-3 w-3 mr-1.5" /> Download Dispatch Note
          </Button>
          
          {order.status === "confirmed" && (
            <Button size="sm" className="h-8 text-xs bg-yellow-600 hover:bg-yellow-700" onClick={() => updateStatus("processing")} disabled={updating}>
              <Truck className="h-3 w-3 mr-1.5" /> {updating ? "Updating..." : "Start Processing"}
            </Button>
          )}
          
          {order.status === "processing" && (
            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => updateStatus("shipped")} disabled={updating}>
              <Truck className="h-3 w-3 mr-1.5" /> {updating ? "Updating..." : "Mark as Shipped"}
            </Button>
          )}
          
          {order.status === "shipped" && (
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={handleMarkAsDelivered} disabled={updating}>
              <Truck className="h-3 w-3 mr-1.5" /> {updating ? "Updating..." : "Mark as Delivered"}
            </Button>
          )}
          
          <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={onClose}>Close</Button>
        </div>
      </div>

      {showDispatchDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDispatchDialog(false)}>
          <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <p className="text-base font-bold">Dispatch Note Details</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Enter dispatcher information</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowDispatchDialog(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                  Dispatcher Name *
                </label>
                <input
                  type="text"
                  value={dispatcherName}
                  onChange={e => setDispatcherName(e.target.value)}
                  placeholder="Enter dispatcher name"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">
                  Dispatch Date *
                </label>
                <input
                  type="date"
                  value={dispatchDate}
                  onChange={e => setDispatchDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowDispatchDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 ml-auto" onClick={handleDownloadDispatchNote}>
                <Download className="h-3 w-3 mr-1.5" /> Generate Dispatch Note
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeliveryConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDeliveryConfirm(false)}>
          <div className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b bg-green-50 dark:bg-green-950 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-base font-bold text-green-900 dark:text-green-100">Confirm Delivery</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">Review stock items and confirm delivery</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowDeliveryConfirm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingStock ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading stock data...</p>
                </div>
              ) : order.items.every(item => !item.trackInventory) ? (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-6 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Truck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Custom Order</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        This is a custom order. No inventory tracking required.
                      </p>
                    </div>
                  </div>
                </div>
              ) : stockItems.length === 0 ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
                    <div className="flex gap-3">
                      <svg className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="text-xs text-red-800 dark:text-red-200">
                        <p className="font-semibold mb-1">No Stock Data Found</p>
                        <p>No stock items found for the order items. Please ensure items have been properly received from POs.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">Looking for these items:</p>
                    <div className="space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
                          <span className="font-mono bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">"{item.description}"</span>
                          <span className="text-blue-600 dark:text-blue-400">({item.qty} {item.unit})</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
                      💡 Check the browser console for debugging information about available stock items.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Stock Items</p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[hsl(var(--muted))]/40 border-b">
                            <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Item Description</th>
                            <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-24">PO #</th>
                            <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-32">Supplier</th>
                            <th className="px-3 py-2 text-center font-semibold text-[hsl(var(--muted-foreground))] w-16">Qty</th>
                            <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-16">Unit</th>
                            <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-28">Landed Cost/Unit</th>
                            <th className="px-3 py-2 text-right font-semibold text-[hsl(var(--muted-foreground))] w-28">Total Value</th>
                            <th className="px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))] w-24">Received</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {stockItems.map(stock => (
                            <tr key={stock.id}>
                              <td className="px-3 py-2">{stock.description}</td>
                              <td className="px-3 py-2 text-[hsl(var(--primary))] font-semibold">{stock.po_number}</td>
                              <td className="px-3 py-2">{stock.supplier_name || "—"}</td>
                              <td className="px-3 py-2 text-center font-medium">{stock.available_qty}</td>
                              <td className="px-3 py-2">{stock.unit}</td>
                              <td className="px-3 py-2 text-right">PKR {(stock.cost_price || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium">PKR {((stock.cost_price || 0) * stock.available_qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{new Date(stock.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/30 p-4">
                    <p className="text-sm font-semibold mb-3 text-yellow-900 dark:text-yellow-100">Quantities to be deducted:</p>
                    <div className="space-y-2">
                      {order.items.map((item, index) => {
                        const itemStocks = stockItems.filter(s => s.description === item.description)
                        const totalAvailable = itemStocks.reduce((sum, s) => sum + s.available_qty, 0)
                        const hasEnough = totalAvailable >= item.qty
                        
                        return (
                          <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0 border-yellow-200 dark:border-yellow-800">
                            <div className="flex-1">
                              <p className="font-medium text-yellow-900 dark:text-yellow-100">{item.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-yellow-700 dark:text-yellow-300">
                                  Current: <span className="font-semibold">{totalAvailable} {item.unit}</span>
                                </span>
                                <span className="text-xs text-yellow-700 dark:text-yellow-300">→</span>
                                <span className={`text-xs font-semibold ${hasEnough ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  After: {totalAvailable - item.qty} {item.unit}
                                </span>
                              </div>
                              {!hasEnough && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                                  ⚠ Insufficient stock! Need {item.qty - totalAvailable} more
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-bold text-red-600 dark:text-red-400">- {item.qty} {item.unit}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4">
                    <div className="flex gap-3">
                      <svg className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-xs text-orange-800 dark:text-orange-200">
                        <p className="font-semibold mb-1">Important:</p>
                        <p>Once marked as delivered, the inventory quantities will be permanently reduced. Make sure the order has been successfully delivered to the customer.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowDeliveryConfirm(false)}>
                Cancel
              </Button>
              <Button 
                size="sm" 
                className="h-8 text-xs bg-green-600 hover:bg-green-700 ml-auto" 
                onClick={() => updateStatus("delivered")} 
                disabled={updating || loadingStock || (!order.items.every(item => !item.trackInventory) && stockItems.length === 0)}
              >
                <Truck className="h-3 w-3 mr-1.5" /> {updating ? "Processing..." : "Confirm & Mark as Delivered"}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delivery Animation */}
      {showDeliveryAnimation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl h-48 overflow-hidden">
            {/* Truck Animation */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-[slideRight_3s_ease-in-out]">
                <Truck className="h-24 w-24 text-green-500" />
              </div>
            </div>
            
            {/* Success Message */}
            <div className="absolute inset-0 flex items-center justify-center animate-[fadeInOut_3s_ease-in-out]">
              <div className="text-center">
                <p className="text-2xl font-bold text-white mb-2">Order Delivered!</p>
                <p className="text-sm text-white/80">Inventory has been updated</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
