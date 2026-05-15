"use client"
import { useState, useEffect } from "react"
import { getOrders, saveOrder, getOrderPaymentProofUrls, getPaymentSubmissionStatus, getSubmittedPayments, shouldShowOrderInFinance, type Order, STATUS_LABELS, STATUS_COLORS } from "@/lib/orders"
// DB access via /api/db routes (Prisma)
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, X } from "lucide-react"

interface ClientOrdersFinanceProps {
  search: string
  dateFrom: string
  dateTo: string
}

export function ClientOrdersFinance({ search, dateFrom, dateTo }: ClientOrdersFinanceProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    getOrders().then(o => {
      setOrders(o.filter(order => shouldShowOrderInFinance(order)))
      setLoading(false)
    })
    const interval = setInterval(() => {
      getOrders().then(o => setOrders(o.filter(order => shouldShowOrderInFinance(order))))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Filter all orders without tab filtering
  const filteredOrders = orders.filter(order => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      order.orderNumber.toLowerCase().includes(q) ||
      order.clientName.toLowerCase().includes(q)
    
    const orderDate = new Date(order.createdAt)
    const matchFrom = !dateFrom || orderDate >= new Date(dateFrom)
    const matchTo = !dateTo || orderDate <= new Date(dateTo + "T23:59:59")
    
    return matchSearch && matchFrom && matchTo
  })

  // Calculate total payments for filtered orders
  const totalPayments = filteredOrders.reduce((sum, order) => {
    return sum + getSubmittedPayments(order.payments, order.status).reduce((s, p) => s + p.amount, 0)
  }, 0)

  const totalOrdersValue = filteredOrders.reduce((sum, order) => sum + order.total, 0)
  const hasFilters = search || dateFrom || dateTo

  return (
    <div className="space-y-3">
      {/* Stats */}
      {filteredOrders.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Orders
              </p>
              <p className="text-xl font-bold tabular-nums leading-tight text-[hsl(var(--foreground))]">
                {filteredOrders.length}
              </p>
            </div>
            <div className="border-l pl-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                {hasFilters ? "Filtered" : "Total"} Payments
              </p>
              <p className="text-xl font-bold tabular-nums leading-tight text-[hsl(var(--foreground))]">
                PKR {totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading orders...</p>
        </div>
      )}

      {!loading && filteredOrders.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {hasFilters 
              ? "No orders match your filters"
              : "No orders found"
            }
          </p>
        </div>
      )}

      {!loading && filteredOrders.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                {["Order #", "Client", "Items", "Total", "Paid", "Remaining", "Status", "Date"].map(h => (
                  <th key={h} className="h-8 px-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map(order => {
                const totalPaid = getSubmittedPayments(order.payments, order.status).reduce((s, p) => s + p.amount, 0)
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
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
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
  const [approvingPayment, setApprovingPayment] = useState(false)
  const taxAmount = Number(order.tax || 0)
  const hasTax = Math.abs(taxAmount) > 0.004

  async function approvePaymentForInventory() {
    setApprovingPayment(true)

    const updated: Order = {
      ...order,
      status: "confirmed",
      payments: (order.payments || []).map(p => ({
        ...p,
        submissionStatus: getPaymentSubmissionStatus(p, order.status) === "pending_approval" ? "approved" as const : p.submissionStatus,
      })),
    }

    await saveOrder(updated)

    setApprovingPayment(false)
    onUpdate(updated)
    onClose()
  }

  const submittedPayments = getSubmittedPayments(order.payments, order.status)
  const totalPaid = submittedPayments.reduce((s, p) => s + p.amount, 0)
  const remaining = order.total - totalPaid
  const isFullyPaid = remaining <= 0
  const hasPendingSubmission = submittedPayments.some(p => getPaymentSubmissionStatus(p, order.status) === "pending_approval")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-[hsl(var(--primary))]">{order.orderNumber}</p>
                {(order.status === "payment_added" || order.status === "confirmed" || order.status === "processing" || order.status === "shipped" || order.status === "delivered") && (
                  <Badge
                    variant={order.status === "payment_added" ? "warning" : "success"}
                    className="text-[10px]"
                  >
                    {order.status === "payment_added"
                      ? "Payment Added - Pending Approval"
                      : order.status === "confirmed"
                        ? "Confirmed - Sent to Inventory"
                        : order.status === "processing"
                          ? "Processing"
                          : order.status === "shipped"
                            ? "Shipped"
                            : "Delivered"}
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
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onClose}>
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
            {hasTax && (
              <div className="flex items-center justify-between text-xs">
                <span>Tax ({order.taxPercent}%)</span>
                <span>PKR {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
            {(order.discount > 0 || (order.discountValue && order.discountValue > 0)) && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600">Discount ({order.discount || 2}%)</span>
                <span className="font-semibold text-green-600">- PKR {(order.discountValue || (order.discountIsPercentage ? (order.subtotal * (order.discount || 2) / 100) : order.discount)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-bold border-t pt-2">
              <span>Total</span>
              <span>PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Payment Section */}
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-blue-900 dark:text-blue-100 mb-3">Payment</p>
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Total Amount: PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              {order.payments && order.payments.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {order.payments.map(p => (
                    <div key={p.id} className="text-xs text-blue-700 dark:text-blue-300">
                      PKR {p.amount.toLocaleString()} · {p.method} · {new Date(p.date).toLocaleDateString()}
                      {getPaymentSubmissionStatus(p, order.status) === "pending_approval" && " · Pending approval"}
                      {getPaymentSubmissionStatus(p, order.status) === "draft" && " · Draft"}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">No payments received yet</p>
              )}
            </div>
          </div>

          {/* Payments */}
          {order.payments && order.payments.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-2">Payments Received</p>
              <div className="rounded-lg border overflow-hidden p-3 space-y-2 bg-green-50 dark:bg-green-950/20">
                {order.payments.map((p, paymentIndex) => {
                  const pStatus = getPaymentSubmissionStatus(p, order.status)
                  return (
                  <div key={p.id} className="flex items-center justify-between text-xs border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">Payment {paymentIndex + 1} — PKR {p.amount.toLocaleString()}</p>
                      <p className="text-[hsl(var(--muted-foreground))]">
                        {p.method} · {new Date(p.date).toLocaleDateString()}
                        {pStatus === "draft" && " · Draft"}
                        {pStatus === "pending_approval" && " · Pending approval"}
                        {pStatus === "approved" && " · Approved"}
                      </p>
                      {p.notes && <p className="text-[hsl(var(--muted-foreground))] text-[10px] mt-0.5">{p.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {getOrderPaymentProofUrls(p).map((proofUrl, proofIndex) => (
                        <a
                          key={`${p.id}-${proofIndex}`}
                          href={proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[hsl(var(--primary))] underline text-[10px]"
                        >
                          {getOrderPaymentProofUrls(p).length > 1 ? `Proof ${proofIndex + 1}` : "View Proof"}
                        </a>
                      ))}
                    </div>
                  </div>
                  )
                })}
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
          {order.status === "payment_added" ? (
            <Button
              size="sm"
              className="h-8 text-xs bg-green-600 hover:bg-green-700 cursor-pointer ml-auto"
              onClick={approvePaymentForInventory}
              disabled={approvingPayment || !isFullyPaid}
            >
              {approvingPayment ? "Approving..." : "Approve Payment & Send to Inventory"}
            </Button>
          ) : order.status === "confirmed" || order.status === "processing" || order.status === "shipped" ? (
            <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">Sent to inventory</span>
          ) : order.status === "delivered" ? (
            <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">Delivered</span>
          ) : (
            <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">Awaiting payment</span>
          )}
        </div>
      </div>
    </div>
  )
}
