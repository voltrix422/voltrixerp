"use client"
import { useState, useEffect } from "react"
import { getOrders, saveOrder, canShowOrderInvoiceActions, type Order, STATUS_LABELS, STATUS_COLORS } from "@/lib/orders"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import { InvoicePreviewModal } from "@/components/crm/invoice-preview-modal"
import { getClients, type Client } from "@/lib/crm"
import { OrderSourceBadge } from "@/components/crm/order-source-badge"
import { CrmItemsQtyCell } from "@/components/crm/crm-items-qty-cell"
import { CrmOrdersListCards } from "@/components/crm/crm-orders-list-cards"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { CrmOrderSummaryDisplay } from "@/components/crm/crm-order-summary-display"
import { OrderForm } from "@/components/crm/orders-list"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, CheckCircle2, XCircle, Edit, Eye, Download, Loader2 } from "lucide-react"

export function ClientOrdersApproval() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selected, setSelected] = useState<Order | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [processing, setProcessing] = useState(false)
  const [tab, setTab] = useState<"pending" | "approved">("pending")
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showInvoicePreview, setShowInvoicePreview] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState<null | "download">(null)
  const [rejectionReason, setRejectionReason] = useState("")

  useEffect(() => {
    Promise.all([getOrders(), getClients()]).then(([o, c]) => {
      setOrders(o)
      setClients(c)
    })
    const interval = setInterval(() => {
      getOrders().then(setOrders)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setDetailOrder(selected)
    setShowEdit(false)
    setShowInvoicePreview(false)
  }, [selected])

  const pendingOrders = orders.filter(o => o.status === "pending_approval")
  const approvedOrders = orders.filter(o =>
    o.status === "approved" ||
    o.status === "finalized" ||
    o.status === "payment_added" ||
    o.status === "confirmed" ||
    o.status === "processing" ||
    o.status === "shipped" ||
    o.status === "delivered"
  )

  const displayOrders = tab === "pending" ? pendingOrders : approvedOrders
  const canEditOrder = detailOrder?.status === "pending_approval"
  const showInvoiceActions = detailOrder ? canShowOrderInvoiceActions(detailOrder) : false
  const currentUserName = user?.name || user?.email || "Admin"

  async function downloadInvoice() {
    if (!detailOrder || invoiceLoading) return
    setInvoiceLoading("download")
    try {
      await downloadInvoicePDF(detailOrder)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setInvoiceLoading(null)
    }
  }

  function viewInvoice() {
    if (invoiceLoading) return
    setShowInvoicePreview(true)
  }

  async function handleApprove() {
    if (!detailOrder) return
    setProcessing(true)
    const updated = { ...detailOrder, status: "approved" as const }
    await saveOrder(updated)
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    setSelected(null)
    setProcessing(false)
  }

  async function handleReject() {
    if (!detailOrder) return
    setProcessing(true)
    const updated = {
      ...detailOrder,
      status: "rejected" as const,
      notes: detailOrder.notes + (rejectionReason ? `\n\nRejection reason: ${rejectionReason}` : ""),
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
      <div className="space-y-2">
        <div className="flex gap-1 border-b border-[hsl(var(--border))]">
          {(["pending", "approved"] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                tab === t
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {t === "pending" ? `Pending (${pendingOrders.length})` : `Approved (${approvedOrders.length})`}
              {tab === t && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#1faca6] rounded-full" />}
            </button>
          ))}
        </div>

        {displayOrders.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] py-3">
            {tab === "pending" ? "No orders pending approval." : "No approved orders yet."}
          </p>
        ) : (
          <>
            <CrmOrdersListCards orders={displayOrders} onSelect={setSelected} />

            <div className="hidden md:block rounded-lg border border-[hsl(var(--border))]/50 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-[hsl(var(--muted))]/40">
                    <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Order #</th>
                    <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Source</th>
                    <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Client</th>
                    <th className="h-8 px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Qty</th>
                    <th className="h-8 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total</th>
                    <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</th>
                    <th className="h-8 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayOrders.map(order => (
                    <tr
                      key={order.id}
                      className="hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer"
                      onClick={() => setSelected(order)}
                    >
                      <td className="px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))]">{order.orderNumber}</td>
                      <td className="px-3 py-2">
                        <OrderSourceBadge order={order} />
                      </td>
                      <td className="px-3 py-2 text-xs font-medium capitalize">{order.clientName}</td>
                      <td className="px-3 py-2 text-xs text-center">
                        <CrmItemsQtyCell items={order.items} />
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-semibold tabular-nums">
                        PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showEdit && canEditOrder && detailOrder && (
        <OrderForm
          existing={detailOrder}
          clients={clients}
          currentUser={currentUserName}
          currentUserId={user?.id}
          onClose={() => setShowEdit(false)}
          onSave={(o) => {
            setOrders(prev => prev.map(x => x.id === o.id ? o : x))
            setDetailOrder(o)
            setSelected(o)
            setShowEdit(false)
          }}
        />
      )}

      {showInvoicePreview && detailOrder && (
        <InvoicePreviewModal order={detailOrder} onClose={() => setShowInvoicePreview(false)} />
      )}

      {detailOrder && !showEdit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full sm:max-w-4xl rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 px-4 sm:px-5 py-3 border-b shrink-0">
              <div className="min-w-0">
                <p className="text-base font-bold text-[hsl(var(--primary))] truncate">{detailOrder.orderNumber}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 capitalize truncate">{detailOrder.clientName}</p>
                <div className="mt-2">
                  <OrderSourceBadge order={detailOrder} />
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 cursor-pointer" onClick={() => setSelected(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Order Items</p>
                <CrmLineItemsDisplay items={detailOrder.items} size="md" />
              </div>

              <CrmOrderSummaryDisplay order={detailOrder} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {detailOrder.deliveryAddress && (
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] font-bold uppercase text-[hsl(var(--muted-foreground))] mb-1">Delivery address</p>
                    <p className="text-sm whitespace-pre-wrap">{detailOrder.deliveryAddress}</p>
                  </div>
                )}
                {detailOrder.deliveryDate && (
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] font-bold uppercase text-[hsl(var(--muted-foreground))] mb-1">Delivery date</p>
                    <p className="text-sm">{new Date(detailOrder.deliveryDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {detailOrder.notes && (
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] font-bold uppercase text-[hsl(var(--muted-foreground))] mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{detailOrder.notes}</p>
                </div>
              )}

              <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1">
                <p>Source: {detailOrder.ownerUserId ? `Sales agent · ${detailOrder.createdBy}` : "CRM"}</p>
                <p>Created {new Date(detailOrder.createdAt).toLocaleString()} by {detailOrder.createdBy}</p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 px-4 sm:px-5 py-3 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {detailOrder.status === "pending_approval" && (
                <>
                  <Button
                    size="sm"
                    className="h-10 w-full sm:w-auto text-sm bg-green-400 hover:bg-green-500 text-white cursor-pointer"
                    onClick={handleApprove}
                    disabled={processing}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {processing ? "Processing..." : "Approve Order"}
                  </Button>
                  <Button
                    size="sm"
                    className="h-10 w-full sm:w-auto text-sm bg-red-400 hover:bg-red-500 text-white cursor-pointer"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Reject Order
                  </Button>
                </>
              )}
              {canEditOrder && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 w-full sm:w-auto text-sm cursor-pointer"
                  onClick={() => setShowEdit(true)}
                >
                  <Edit className="h-4 w-4 mr-2" /> Edit order
                </Button>
              )}
              {detailOrder.status !== "pending_approval" && (
                <Badge variant="success" className="text-xs w-fit">Order {STATUS_LABELS[detailOrder.status]}</Badge>
              )}
              {showInvoiceActions && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 w-10 p-0 cursor-pointer shrink-0"
                    onClick={viewInvoice}
                    disabled={!!invoiceLoading}
                    title="View Invoice"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 w-10 p-0 cursor-pointer shrink-0"
                    onClick={() => void downloadInvoice()}
                    disabled={!!invoiceLoading}
                    title={invoiceLoading === "download" ? "Generating PDF…" : "Download PDF"}
                  >
                    {invoiceLoading === "download" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-full sm:w-auto text-sm sm:ml-auto cursor-pointer"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {showRejectDialog && detailOrder && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowRejectDialog(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b">
              <p className="text-sm font-semibold">Reject Order</p>
              <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer" onClick={() => setShowRejectDialog(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 sm:p-5 space-y-3">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Are you sure you want to reject order {detailOrder.orderNumber}?
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason for rejection (optional)</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={3}
                  className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 px-4 sm:px-5 py-3 border-t bg-[hsl(var(--muted))]/20 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button
                size="sm"
                variant="outline"
                className="h-10 text-sm cursor-pointer"
                onClick={() => setShowRejectDialog(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-10 text-sm bg-red-400 hover:bg-red-500 text-white cursor-pointer"
                onClick={handleReject}
                disabled={processing}
              >
                {processing ? "Rejecting..." : "Reject Order"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
