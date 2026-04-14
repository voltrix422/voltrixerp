"use client"
import { useState, useEffect } from "react"
import { getOrders, type Order } from "@/lib/orders"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, X, Eye, Download, CheckCircle } from "lucide-react"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SuccessNotification } from "@/components/ui/success-notification"

export function ClientOrdersFinance() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [tab, setTab] = useState<"pending" | "paid">("pending")

  useEffect(() => {
    getOrders().then(o => {
      // Show all orders from finalized onwards (finalized, confirmed, processing, shipped, delivered)
      setOrders(o.filter(order => 
        order.status === "finalized" || 
        order.status === "confirmed" || 
        order.status === "processing" || 
        order.status === "shipped" || 
        order.status === "delivered"
      ))
      setLoading(false)
    })
    const channel = supabase
      .channel("finance_client_orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "erp_orders" }, () => {
        getOrders().then(o => setOrders(o.filter(order => 
          order.status === "finalized" || 
          order.status === "confirmed" || 
          order.status === "processing" || 
          order.status === "shipped" || 
          order.status === "delivered"
        )))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Filter based on status: finalized = pending, all others = paid
  const filteredOrders = orders.filter(order => {
    if (tab === "pending") {
      return order.status === "finalized"
    } else {
      return order.status === "confirmed" || 
             order.status === "processing" || 
             order.status === "shipped" || 
             order.status === "delivered"
    }
  })

  const pendingCount = orders.filter(o => o.status === "finalized").length
  const paidCount = orders.filter(o => o.status === "confirmed" || o.status === "processing" || o.status === "shipped" || o.status === "delivered").length

  return (
    <div className="space-y-3">
      {/* Sub Tabs */}
      <div className="flex items-center gap-1 border-b border-[hsl(var(--border))]">
        <button
          onClick={() => setTab("pending")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
            tab === "pending"
              ? "text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          }`}
        >
          Pending Orders ({pendingCount})
          {tab === "pending" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
          )}
        </button>
        <button
          onClick={() => setTab("paid")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
            tab === "paid"
              ? "text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          }`}
        >
          Paid Orders ({paidCount})
          {tab === "paid" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
          )}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading orders...</p>
        </div>
      )}

      {!loading && filteredOrders.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No {tab === "pending" ? "pending" : "paid"} orders
          </p>
        </div>
      )}

      {!loading && filteredOrders.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                {["Order #", "Client", "Items", "Total", "Paid", "Remaining", "Date"].map(h => (
                  <th key={h} className="h-8 px-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map(order => {
                const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0)
                const remaining = order.total - totalPaid
                return (
                  <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer">
                    <td className="px-4 py-2.5 font-medium text-[hsl(var(--primary))]">{order.orderNumber}</td>
                    <td className="px-4 py-2.5 text-xs">{order.clientName}</td>
                    <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{order.items.length}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold">PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2.5 text-xs">PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2.5 text-xs font-medium">
                      {remaining <= 0 ? <span className="text-emerald-600">Paid</span> : `PKR ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrder && (
        <ClientOrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(updatedOrder) => {
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o))
            setSelectedOrder(updatedOrder)
          }}
        />
      )}
    </div>
  )
}

function ClientOrderDetail({ order, onClose, onUpdate }: {
  order: Order
  onClose: () => void
  onUpdate: (order: Order) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

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

  async function confirmAndSendToInventory() {
    setShowConfirmDialog(false)
    setConfirming(true)
    
    const updated: Order = {
      ...order,
      status: "confirmed"
    }
    
    await import("@/lib/orders").then(m => m.saveOrder(updated))
    setConfirming(false)
    setShowSuccess(true)
    onUpdate(updated)
  }

  const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0)
  const remaining = order.total - totalPaid
  const isFullyPaid = remaining <= 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-[hsl(var(--primary))]">{order.orderNumber}</p>
                {(order.status === "confirmed" || order.status === "processing" || order.status === "shipped" || order.status === "delivered") && (
                  <Badge variant="success" className="text-[10px]">
                    {order.status === "confirmed" ? "Confirmed - Sent to Inventory" : 
                     order.status === "processing" ? "Processing" :
                     order.status === "shipped" ? "Shipped" :
                     "Delivered"}
                  </Badge>
                )}
              </div>
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
          {/* Order Items - Remove top border */}
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

          {/* Costs - No top border */}
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

          {/* Payments */}
          {order.payments && order.payments.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-2">Payments Received</p>
              <div className="rounded-lg border overflow-hidden p-3 space-y-2 bg-green-50 dark:bg-green-950/20">
                {order.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">PKR {p.amount.toLocaleString()}</p>
                      <p className="text-[hsl(var(--muted-foreground))]">{p.method} · {new Date(p.date).toLocaleDateString()}</p>
                      {p.notes && <p className="text-[hsl(var(--muted-foreground))] text-[10px] mt-0.5">{p.notes}</p>}
                    </div>
                    {p.proofUrl && (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-[hsl(var(--primary))] underline text-[10px]">View Proof</a>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs font-bold pt-2">
                  <span>Total Paid</span>
                  <span>PKR {totalPaid.toLocaleString()}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex items-center justify-between text-xs font-bold text-orange-600">
                    <span>Remaining</span>
                    <span>PKR {remaining.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={viewInvoice}>
            <Eye className="h-3 w-3 mr-1.5" /> View Invoice
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={downloadInvoice}>
            <Download className="h-3 w-3 mr-1.5" /> Download PDF
          </Button>
          {isFullyPaid && order.status === "finalized" && (
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => setShowConfirmDialog(true)} disabled={confirming}>
              <CheckCircle className="h-3 w-3 mr-1.5" /> {confirming ? "Confirming..." : "Confirm & Send to Inventory"}
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={onClose}>Close</Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onCancel={() => setShowConfirmDialog(false)}
        onConfirm={confirmAndSendToInventory}
        title="Confirm Order"
        message="Confirm this order and send to Inventory for dispatch?"
      />

      <SuccessNotification
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Order Confirmed"
        message="Order confirmed and sent to Inventory!"
      />
    </div>
  )
}
