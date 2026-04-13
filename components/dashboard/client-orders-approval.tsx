"use client"
import { useState, useEffect } from "react"
import { getOrders, saveOrder, type Order, STATUS_LABELS, STATUS_COLORS } from "@/lib/orders"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, CheckCircle2, XCircle } from "lucide-react"

export function ClientOrdersApproval() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selected, setSelected] = useState<Order | null>(null)
  const [processing, setProcessing] = useState(false)
  const [tab, setTab] = useState<"pending" | "approved">("pending")
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")

  useEffect(() => {
    getOrders().then(setOrders)
    const channel = supabase
      .channel("dashboard_orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "erp_orders" }, () => {
        getOrders().then(setOrders)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const pendingOrders = orders.filter(o => o.status === "pending_approval")
  const approvedOrders = orders.filter(o => 
    o.status === "approved" || 
    o.status === "finalized" || 
    o.status === "confirmed" || 
    o.status === "processing" || 
    o.status === "shipped" || 
    o.status === "delivered"
  )
  
  const displayOrders = tab === "pending" ? pendingOrders : approvedOrders

  async function handleApprove() {
    if (!selected) return
    setProcessing(true)
    const updated = { ...selected, status: "approved" as const }
    await saveOrder(updated)
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    setSelected(null)
    setProcessing(false)
  }

  async function handleReject() {
    if (!selected) return
    setProcessing(true)
    const updated = { 
      ...selected, 
      status: "rejected" as const,
      notes: selected.notes + (rejectionReason ? `\n\nRejection reason: ${rejectionReason}` : "")
    }
    await saveOrder(updated)
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    setSelected(null)
    setShowRejectDialog(false)
    setRejectionReason("")
    setProcessing(false)
  }

  return (
    <>
      <div className="space-y-3">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-[hsl(var(--border))]">
          {(["pending", "approved"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
                tab === t ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {t === "pending" ? "Pending Approval" : "Approved Orders"}
              <span className="ml-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                ({t === "pending" ? pendingOrders.length : approvedOrders.length})
              </span>
              {tab === t && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          ))}
        </div>

        <div>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {displayOrders.length} order{displayOrders.length !== 1 ? "s" : ""} {tab === "pending" ? "pending" : "approved"}
          </p>
        </div>

        {displayOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {tab === "pending" ? "No orders pending approval" : "No approved orders"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-[hsl(var(--muted))]/40">
                  <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Order #</th>
                  <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Client</th>
                  <th className="h-8 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Items</th>
                  <th className="h-8 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total</th>
                  <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
                  <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayOrders.map(order => (
                  <tr key={order.id} className="hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer" onClick={() => setSelected(order)}>
                    <td className="px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))]">{order.orderNumber}</td>
                    <td className="px-3 py-2 text-xs font-medium capitalize">{order.clientName}</td>
                    <td className="px-3 py-2 text-xs text-center">{order.items.length}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold">PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-4xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
              <div>
                <p className="text-base font-bold text-[hsl(var(--primary))]">{selected.orderNumber}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 capitalize">{selected.clientName}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1.5">Order Items</p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[hsl(var(--muted))]/40 border-b">
                        <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">Description</th>
                        <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold text-[hsl(var(--muted-foreground))] w-14">Qty</th>
                        <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] w-14">Unit</th>
                        <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-[hsl(var(--muted-foreground))] w-24">Cost Price</th>
                        <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-[hsl(var(--muted-foreground))] w-24">Selling Price</th>
                        <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-[hsl(var(--muted-foreground))] w-20">Profit</th>
                        <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-[hsl(var(--muted-foreground))] w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selected.items.map(item => {
                        const costPrice = item.costPrice || 0
                        const sellingPrice = item.unitPrice
                        const profit = sellingPrice - costPrice
                        const profitPercent = costPrice > 0 ? ((profit / costPrice) * 100).toFixed(1) : 0
                        
                        return (
                          <tr key={item.id}>
                            <td className="px-2.5 py-1.5">{item.description}</td>
                            <td className="px-2.5 py-1.5 text-center">{item.qty}</td>
                            <td className="px-2.5 py-1.5">{item.unit}</td>
                            <td className="px-2.5 py-1.5 text-right text-blue-600 dark:text-blue-400">
                              {costPrice > 0 ? `PKR ${costPrice.toLocaleString()}` : "—"}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-medium">PKR {sellingPrice.toLocaleString()}</td>
                            <td className="px-2.5 py-1.5 text-right text-[10px]">
                              {costPrice > 0 ? (
                                <span className={profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                  PKR {profit.toLocaleString()} ({profitPercent}%)
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-semibold">PKR {(sellingPrice * item.qty).toLocaleString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span>Subtotal</span>
                  <span className="font-semibold">PKR {selected.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold border-t pt-1.5">
                  <span>Total</span>
                  <span>PKR {selected.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {selected.deliveryAddress && (
                  <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-2.5">
                    <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1">Delivery address</p>
                    <p className="text-xs whitespace-pre-wrap">{selected.deliveryAddress}</p>
                  </div>
                )}

                {selected.deliveryDate && (
                  <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-2.5">
                    <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1">Delivery date</p>
                    <p className="text-xs">{new Date(selected.deliveryDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {selected.notes && (
                <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-2.5">
                  <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1">Notes</p>
                  <p className="text-xs whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}

              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Created {new Date(selected.createdAt).toLocaleString()} by {selected.createdBy}
              </div>
            </div>

            <div className="flex items-center gap-2 px-5 py-3 border-t bg-[hsl(var(--muted))]/20 shrink-0">
              {selected.status === "pending_approval" && (
                <>
                  <Button size="sm" className="h-7 text-xs bg-green-400 hover:bg-green-500 text-white" onClick={handleApprove} disabled={processing}>
                    <CheckCircle2 className="h-3 w-3 mr-1.5" /> {processing ? "Processing..." : "Approve Order"}
                  </Button>
                  <Button size="sm" className="h-7 text-xs bg-red-400 hover:bg-red-500 text-white" onClick={() => setShowRejectDialog(true)} disabled={processing}>
                    <XCircle className="h-3 w-3 mr-1.5" /> Reject Order
                  </Button>
                </>
              )}
              {selected.status !== "pending_approval" && (
                <Badge variant="success" className="text-xs">Order {STATUS_LABELS[selected.status]}</Badge>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Rejection Dialog */}
      {showRejectDialog && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowRejectDialog(false)}>
          <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <p className="text-sm font-semibold">Reject Order</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowRejectDialog(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <div className="p-5 space-y-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Are you sure you want to reject order {selected.orderNumber}?
              </p>
              
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Reason for rejection (optional)</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={3}
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-5 py-3 border-t bg-[hsl(var(--muted))]/20">
              <Button size="sm" className="h-7 text-xs bg-red-400 hover:bg-red-500 text-white" onClick={handleReject} disabled={processing}>
                {processing ? "Rejecting..." : "Reject Order"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
