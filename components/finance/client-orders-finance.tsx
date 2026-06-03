"use client"
import { useState, useEffect } from "react"
import {
  getOrders,
  saveOrder,
  getOrderPaymentProofUrls,
  getPaymentSubmissionStatus,
  getSubmittedPayments,
  shouldShowOrderInFinance,
  getOrderAmountPaid,
  getOrderCreditBalance,
  hasOutstandingCredit,
  isOrderOnCredit,
  normalizeOrderPaymentTerms,
  type Order,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/orders"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { CrmOrderSummaryDisplay } from "@/components/crm/crm-order-summary-display"
import { formatCrmItemsQtyLabel } from "@/components/crm/crm-items-qty-cell"
import { Loader2, X } from "lucide-react"

export type ClientOrdersCreditFilter = "all" | "outstanding" | "on_credit"

interface ClientOrdersFinanceProps {
  search: string
  dateFrom: string
  dateTo: string
  creditFilter?: ClientOrdersCreditFilter
}

function orderPaymentTotals(order: Order) {
  const totalPaid = getOrderAmountPaid(order)
  const remaining = getOrderCreditBalance(order)
  return { totalPaid, remaining }
}

function matchesCreditFilter(order: Order, creditFilter: ClientOrdersCreditFilter) {
  if (creditFilter === "outstanding") return hasOutstandingCredit(order)
  if (creditFilter === "on_credit") return isOrderOnCredit(order)
  return true
}

export function ClientOrdersFinance({ search, dateFrom, dateTo, creditFilter = "all" }: ClientOrdersFinanceProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    getOrders().then((o) => {
      setOrders(o.filter((order) => shouldShowOrderInFinance(order)))
      setLoading(false)
    })
    const interval = setInterval(() => {
      getOrders().then((o) => setOrders(o.filter((order) => shouldShowOrderInFinance(order))))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const filteredOrders = orders.filter((order) => {
    const q = search.toLowerCase()
    const matchSearch =
      !search ||
      order.orderNumber.toLowerCase().includes(q) ||
      order.clientName.toLowerCase().includes(q)

    const orderDate = new Date(order.createdAt)
    const matchFrom = !dateFrom || orderDate >= new Date(dateFrom)
    const matchTo = !dateTo || orderDate <= new Date(dateTo + "T23:59:59")

    return matchSearch && matchFrom && matchTo && matchesCreditFilter(order, creditFilter)
  })

  const totalPayments = filteredOrders.reduce((sum, order) => sum + getOrderAmountPaid(order), 0)

  const totalCreditOutstanding = filteredOrders.reduce(
    (sum, order) => (hasOutstandingCredit(order) ? sum + getOrderCreditBalance(order) : sum),
    0,
  )

  const creditOrdersInView = filteredOrders.filter(hasOutstandingCredit).length

  const hasFilters = search || dateFrom || dateTo || creditFilter !== "all"

  const emptyMessage =
    creditFilter === "outstanding"
      ? "No orders with outstanding credit match your filters"
      : creditFilter === "on_credit"
        ? "No credit-based orders match your filters"
        : hasFilters
          ? "No orders match your filters"
          : "No orders found"

  return (
    <div className="space-y-3">
      {(filteredOrders.length > 0 || orders.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg border bg-[hsl(var(--muted))]/20 p-3 sm:flex sm:flex-wrap sm:items-center sm:gap-6 sm:p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              {hasFilters ? "Filtered" : ""} Orders
            </p>
            <p className="text-lg sm:text-xl font-bold tabular-nums leading-tight">{filteredOrders.length}</p>
            {creditFilter === "outstanding" && creditOrdersInView > 0 && (
              <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">with balance due</p>
            )}
          </div>
          <div className="sm:border-l sm:pl-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              {hasFilters ? "Filtered" : "Total"} Payments
            </p>
            <p className="text-sm sm:text-xl font-bold tabular-nums leading-tight break-words">
              PKR {totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 sm:border-l sm:pl-6 border-t sm:border-t-0 pt-2 sm:pt-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              Credit outstanding
            </p>
            <p className="text-sm sm:text-xl font-bold tabular-nums leading-tight text-amber-700 dark:text-amber-300 break-words">
              PKR {totalCreditOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            {totalCreditOutstanding > 0.004 && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                {creditOrdersInView} order{creditOrdersInView === 1 ? "" : "s"} on credit
              </p>
            )}
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
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{emptyMessage}</p>
        </div>
      )}

      {!loading && filteredOrders.length > 0 && (
        <>
          <div className="md:hidden space-y-2">
            {filteredOrders.map((order) => {
              const { totalPaid, remaining } = orderPaymentTotals(order)
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="w-full text-left rounded-lg border p-3 space-y-2.5 hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#1faca6] truncate">{order.orderNumber}</p>
                      <p className="text-sm font-medium truncate mt-0.5">{order.clientName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 max-w-[45%]">
                      {hasOutstandingCredit(order) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          Credit
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-right leading-tight ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Items</p>
                      <p className="font-medium">{formatCrmItemsQtyLabel(order.items)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Total</p>
                      <p className="font-semibold tabular-nums">
                        PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Paid</p>
                      <p className="tabular-nums">
                        PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Remaining</p>
                      <p
                        className={`font-medium tabular-nums ${remaining <= 0 ? "text-emerald-600" : ""}`}
                      >
                        {remaining <= 0
                          ? "Paid"
                          : `PKR ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="hidden md:block rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[48rem]">
                <thead>
                  <tr className="border-b bg-[hsl(var(--muted))]/40">
                    {["Order #", "Client", "Items", "Total", "Paid", "Remaining", "Status", "Date"].map((h) => (
                      <th
                        key={h}
                        className="h-8 px-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((order) => {
                    const { totalPaid, remaining } = orderPaymentTotals(order)
                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-2.5 font-medium text-[hsl(var(--primary))] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {order.orderNumber}
                            {hasOutstandingCredit(order) && (
                              <Badge variant="warning" className="text-[9px] px-1 py-0">Credit</Badge>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs">{order.clientName}</td>
                        <td className="px-4 py-2.5 text-xs">{formatCrmItemsQtyLabel(order.items)}</td>
                        <td className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap tabular-nums">
                          PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap tabular-nums">
                          PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium whitespace-nowrap">
                          {remaining <= 0.004 ? (
                            <span className="text-emerald-600">Paid</span>
                          ) : (
                            <span className={`tabular-nums ${hasOutstandingCredit(order) ? "text-amber-700 dark:text-amber-300 font-semibold" : ""}`}>
                              PKR {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedOrder && (
        <ClientOrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(updatedOrder) => {
            setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)))
            setSelectedOrder(updatedOrder)
          }}
        />
      )}
    </div>
  )
}

function financeStatusBadge(order: Order) {
  if (order.status === "payment_added") {
    return { label: "Payment Added — Pending Approval", variant: "warning" as const }
  }
  if (hasOutstandingCredit(order)) {
    return { label: "On credit — balance outstanding", variant: "warning" as const }
  }
  if (isOrderOnCredit(order)) {
    return { label: "Credit cleared", variant: "success" as const }
  }
  if (order.status === "confirmed") {
    return { label: "Confirmed — Sent to Inventory", variant: "success" as const }
  }
  if (order.status === "processing") return { label: "Processing", variant: "success" as const }
  if (order.status === "shipped") return { label: "Shipped", variant: "success" as const }
  if (order.status === "delivered") return { label: "Delivered", variant: "success" as const }
  return null
}

function ClientOrderDetail({
  order,
  onClose,
  onUpdate,
}: {
  order: Order
  onClose: () => void
  onUpdate: (order: Order) => void
}) {
  const { user } = useAuth()
  const [approvingPayment, setApprovingPayment] = useState(false)
  const [approvingCredit, setApprovingCredit] = useState(false)

  function approvePaymentsOnOrder(base: Order): Order {
    return {
      ...base,
      status: "confirmed",
      payments: (base.payments || []).map((p) => ({
        ...p,
        submissionStatus:
          getPaymentSubmissionStatus(p, base.status) === "pending_approval"
            ? ("approved" as const)
            : p.submissionStatus,
      })),
    }
  }

  async function approvePaymentForInventory() {
    setApprovingPayment(true)
    const updated = normalizeOrderPaymentTerms(approvePaymentsOnOrder({ ...order, paymentTerms: "full" }))
    await saveOrder(updated)
    setApprovingPayment(false)
    onUpdate(updated)
    onClose()
  }

  async function approveOnCreditForInventory() {
    setApprovingCredit(true)
    const approver = user?.name || user?.email || "Finance"
    const updated = normalizeOrderPaymentTerms({
      ...approvePaymentsOnOrder(order),
      paymentTerms: "credit",
      creditApprovedAt: new Date().toISOString(),
      creditApprovedBy: approver,
    })
    await saveOrder(updated)
    setApprovingCredit(false)
    onUpdate(updated)
    onClose()
  }

  const totalPaid = getOrderAmountPaid(order)
  const remaining = getOrderCreditBalance(order)
  const isFullyPaid = remaining <= 0.004
  const onCredit = isOrderOnCredit(order)
  const statusBadge = financeStatusBadge(order)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
          <div className="min-w-0 flex-1 pr-2 space-y-2">
            <p className="text-base sm:text-lg font-bold text-[hsl(var(--primary))] truncate">
              {order.orderNumber}
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] truncate -mt-1">{order.clientName}</p>
            {statusBadge && (
              <Badge variant={statusBadge.variant} className="text-[10px] w-fit">
                {statusBadge.label}
              </Badge>
            )}
            {(order.dispatcher || order.deliveryDate) && (
              <div className="flex flex-wrap gap-3 text-xs pt-1">
                {order.dispatcher && (
                  <div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Dispatcher</p>
                    <p className="font-medium">{order.dispatcher}</p>
                  </div>
                )}
                {order.deliveryDate && (
                  <div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Delivery date</p>
                    <p className="font-medium">{new Date(order.deliveryDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 cursor-pointer" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-4">
          <div>
            <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Order Items</p>
            <CrmLineItemsDisplay items={order.items} />
          </div>

          <CrmOrderSummaryDisplay order={order} />

          {order.payments && order.payments.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Payments</p>
              <div className="rounded-lg border divide-y overflow-hidden">
                {order.payments.map((p, paymentIndex) => {
                  const pStatus = getPaymentSubmissionStatus(p, order.status)
                  return (
                    <div key={p.id} className="p-3 sm:p-4 space-y-2 bg-[hsl(var(--background))]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            Payment {paymentIndex + 1} — PKR {p.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                            {p.method} · {new Date(p.date).toLocaleDateString()}
                            {pStatus === "draft" && " · Draft"}
                            {pStatus === "pending_approval" && " · Pending approval"}
                            {pStatus === "approved" && " · Approved"}
                          </p>
                          {p.notes && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{p.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {getOrderPaymentProofUrls(p).map((proofUrl, proofIndex) => (
                            <a
                              key={`${p.id}-${proofIndex}`}
                              href={proofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[hsl(var(--primary))] underline text-xs"
                            >
                              {getOrderPaymentProofUrls(p).length > 1
                                ? `Proof ${proofIndex + 1}`
                                : "View proof"}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="px-3 sm:px-4 py-3 bg-[hsl(var(--muted))]/30 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2 font-semibold">
                    <span>Total paid</span>
                    <span className="tabular-nums">
                      PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {remaining > 0 ? (
                    <div className="flex justify-between gap-2 font-semibold text-orange-600">
                      <span>Remaining</span>
                      <span className="tabular-nums">
                        PKR {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-emerald-600">Paid in full</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {(!order.payments || order.payments.length === 0) && (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No payments received yet</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {order.status === "payment_added" ? (
            <>
              {isFullyPaid ? (
                <Button
                  size="sm"
                  className="h-11 w-full text-sm bg-green-600 hover:bg-green-700 cursor-pointer"
                  onClick={approvePaymentForInventory}
                  disabled={approvingPayment || approvingCredit}
                >
                  {approvingPayment ? "Approving..." : "Approve Payment & Send to Inventory"}
                </Button>
              ) : (
                <>
                  <p className="text-xs text-center text-[hsl(var(--muted-foreground))]">
                    Partial payment received (PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}).
                    Remaining PKR {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} can go on credit.
                  </p>
                  <Button
                    size="sm"
                    className="h-11 w-full text-sm bg-amber-600 hover:bg-amber-700 cursor-pointer"
                    onClick={approveOnCreditForInventory}
                    disabled={approvingPayment || approvingCredit}
                  >
                    {approvingCredit ? "Approving..." : "Approve on Credit & Send to Inventory"}
                  </Button>
                </>
              )}
            </>
          ) : order.status === "confirmed" ||
            order.status === "processing" ||
            order.status === "shipped" ? (
            <p className="text-xs text-center text-[hsl(var(--muted-foreground))] py-1">
              {hasOutstandingCredit(order)
                ? `Sent to inventory on credit — PKR ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} outstanding`
                : "Sent to inventory"}
            </p>
          ) : order.status === "delivered" ? (
            <p className="text-xs text-center text-[hsl(var(--muted-foreground))] py-1">
              {onCredit && remaining > 0.004
                ? `Delivered — PKR ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} credit balance`
                : "Delivered"}
            </p>
          ) : (
            <p className="text-xs text-center text-[hsl(var(--muted-foreground))] py-1">Awaiting payment</p>
          )}
        </div>
      </div>
    </div>
  )
}
