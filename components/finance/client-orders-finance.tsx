"use client"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  getOrders,
  saveOrder,
  getOrderPaymentProofUrls,
  getPaymentSubmissionStatus,
  getSubmittedPayments,
  shouldShowOrderInFinance,
  getOrderAmountPaid,
  getOrderCreditBalance,
  getOrderCashbackAmount,
  getOrderCashbackPaymentProofUrls,
  hasOutstandingCredit,
  isOrderOnCredit,
  canCapturePaymentsForOrder,
  isPostDeliveryPaymentCapture,
  normalizeOrderPaymentTerms,
  type Order,
} from "@/lib/orders"
import { aggregateOrderPaymentStats, isCrmErpOrderForPaymentStats } from "@/lib/order-payment-stats"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { CrmOrderSummaryDisplay } from "@/components/crm/crm-order-summary-display"
import { formatCrmItemsQtyLabel } from "@/components/crm/crm-items-qty-cell"
import { Loader2, X, Plus, SlidersHorizontal, Search } from "lucide-react"
import { PaymentCapture } from "@/components/crm/payment-capture"

export type ClientOrdersCreditFilter = "all" | "outstanding" | "on_credit"

interface ClientOrdersFinanceProps {
  search?: string
  dateFrom?: string
  dateTo?: string
  creditFilter?: ClientOrdersCreditFilter
}

function fmtPkr(n: number) {
  return `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
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

export function ClientOrdersFinance({
  search: searchProp = "",
  dateFrom: dateFromProp = "",
  dateTo: dateToProp = "",
  creditFilter: creditFilterProp = "all",
}: ClientOrdersFinanceProps) {
  const [crmOrdersAll, setCrmOrdersAll] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [includeOutstanding, setIncludeOutstanding] = useState(false)
  const [search, setSearch] = useState(searchProp)
  const [dateFrom, setDateFrom] = useState(dateFromProp)
  const [dateTo, setDateTo] = useState(dateToProp)
  const [creditFilter, setCreditFilter] = useState<ClientOrdersCreditFilter>(creditFilterProp)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const load = () =>
      getOrders().then((o) => {
        setCrmOrdersAll(o.filter(isCrmErpOrderForPaymentStats))
      })
    load().then(() => setLoading(false))
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  function placeFilterPanel() {
    const btn = filterBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const panelW = Math.min(328, window.innerWidth - 24)
    const panelH = 280
    const pad = 16
    setFilterPos({
      top: Math.max(pad, Math.min(rect.top, window.innerHeight - panelH - pad)),
      left: Math.max(pad, window.innerWidth - panelW - pad),
    })
  }

  useEffect(() => {
    if (!filtersOpen) {
      setFilterPos(null)
      return
    }
    placeFilterPanel()
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (filtersRef.current?.contains(t) || filterBtnRef.current?.contains(t)) return
      setFiltersOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false)
    }
    function onReposition() {
      placeFilterPanel()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("resize", onReposition)
    window.addEventListener("scroll", onReposition, true)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", onReposition)
      window.removeEventListener("scroll", onReposition, true)
    }
  }, [filtersOpen])

  const filteredCrmOrders = crmOrdersAll.filter((order) => {
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

  const filteredOrders = filteredCrmOrders.filter(shouldShowOrderInFinance)

  const paymentStats = aggregateOrderPaymentStats(filteredCrmOrders)
  const totalPayments = paymentStats.totalReceived
  const totalOutstandingAll = paymentStats.totalOutstanding
  const displayPaymentsTotal = includeOutstanding ? totalPayments + totalOutstandingAll : totalPayments

  const totalCreditOutstanding = filteredCrmOrders.reduce(
    (sum, order) => (hasOutstandingCredit(order) ? sum + getOrderCreditBalance(order) : sum),
    0,
  )

  const creditOrdersInView = filteredCrmOrders.filter(hasOutstandingCredit).length

  const hasFilters = !!(search || dateFrom || dateTo || creditFilter !== "all")

  const emptyMessage =
    creditFilter === "outstanding"
      ? "No orders with outstanding credit match your filters"
      : creditFilter === "on_credit"
        ? "No credit-based orders match your filters"
        : hasFilters
          ? "No orders match your filters"
          : "No orders found"

  function clearLocalFilters() {
    setSearch("")
    setDateFrom("")
    setDateTo("")
    setCreditFilter("all")
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {(filteredOrders.length > 0 || crmOrdersAll.length > 0) && (
        <section className="shrink-0 rounded-[18px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.04] dark:border-[hsl(var(--border))] overflow-visible relative z-20">
          <div className="flex items-center justify-end px-3 pt-2.5">
            <button
              ref={filterBtnRef}
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                filtersOpen
                  ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                  : "text-[#86868b] hover:bg-black/[0.05] dark:hover:bg-white/10 hover:text-[#1d1d1f]"
              }`}
              aria-label="Filters"
              aria-expanded={filtersOpen}
              title="Filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.06] dark:divide-[hsl(var(--border))]">
            <div className="min-w-0">
              <div className="px-2.5 sm:px-3 pb-3.5 pt-0.5 min-h-[72px] flex flex-col justify-end gap-1">
                <p className="text-[11px] font-medium text-[#86868b] dark:text-[hsl(var(--muted-foreground))] truncate">
                  {hasFilters ? "Filtered orders" : "Orders"}
                </p>
                <p className="text-[17px] sm:text-[18px] font-bold tracking-tight leading-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums">
                  {paymentStats.orderCount}
                  {paymentStats.returnedCount > 0 ? (
                    <span className="text-[12px] font-semibold text-[#aeaeb2]">
                      {" "}
                      (+{paymentStats.returnedCount} returned)
                    </span>
                  ) : null}
                </p>
                {creditFilter === "outstanding" && creditOrdersInView > 0 ? (
                  <p className="text-[10px] text-[#aeaeb2] truncate">with balance due</p>
                ) : (
                  <p className="text-[10px] text-[#aeaeb2] truncate">CRM active</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIncludeOutstanding((v) => !v)}
              className="min-w-0 text-left cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
              title={includeOutstanding ? "Showing received + still outstanding" : "Add still outstanding to total"}
            >
              <div className="px-2.5 sm:px-3 pb-3.5 pt-0.5 min-h-[72px] flex flex-col justify-end gap-1">
                <p className="text-[11px] font-medium text-[#86868b] dark:text-[hsl(var(--muted-foreground))] truncate">
                  Money received
                </p>
                <p
                  className="text-[17px] sm:text-[18px] font-bold tracking-tight leading-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums break-words"
                  title={fmtPkr(displayPaymentsTotal)}
                >
                  {fmtPkr(displayPaymentsTotal)}
                </p>
                <p className="text-[10px] text-[#aeaeb2] truncate">
                  {includeOutstanding ? "Incl. outstanding" : "+ Still outstanding"}
                </p>
              </div>
            </button>

            <div className="min-w-0">
              <div className="px-2.5 sm:px-3 pb-3.5 pt-0.5 min-h-[72px] flex flex-col justify-end gap-1">
                <p className="text-[11px] font-medium text-[#86868b] dark:text-[hsl(var(--muted-foreground))] truncate">
                  Credit outstanding
                </p>
                <p
                  className="text-[17px] sm:text-[18px] font-bold tracking-tight leading-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] tabular-nums break-words"
                  title={fmtPkr(totalCreditOutstanding)}
                >
                  {fmtPkr(totalCreditOutstanding)}
                </p>
                <p className="text-[10px] text-[#aeaeb2] truncate">
                  {totalCreditOutstanding > 0.004
                    ? `${creditOrdersInView} order${creditOrdersInView === 1 ? "" : "s"} on credit`
                    : "No credit due"}
                </p>
              </div>
            </div>
          </div>

          {filtersOpen &&
            filterPos &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={filtersRef}
                className="fixed z-[95] w-[min(20.5rem,calc(100vw-1.5rem))] rounded-[16px] border border-black/[0.08] bg-white/95 dark:bg-[hsl(var(--card))]/95 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.18)] p-3 space-y-2.5"
                style={{ top: filterPos.top, left: filterPos.left }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-4 -left-1.5 h-3 w-3 rotate-45 rounded-[2px] border-b border-l border-black/[0.08] bg-white dark:bg-[hsl(var(--card))]"
                />
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <p className="text-[11px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                    Filters
                  </p>
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={clearLocalFilters}
                      className="text-[10px] font-medium text-[#0071e3] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search orders..."
                    className="w-full h-8 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] pl-8 pr-3 text-[11px] focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 rounded-xl border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2 text-[11px] flex-1 min-w-0 cursor-pointer"
                  />
                  <span className="text-[9px] text-[#86868b] shrink-0">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 rounded-xl border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-2 text-[11px] flex-1 min-w-0 cursor-pointer"
                  />
                </div>
                <div className="flex rounded-[10px] bg-black/[0.06] dark:bg-white/10 p-[3px]">
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "outstanding", label: "Due" },
                      { id: "on_credit", label: "Credit" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCreditFilter(opt.id)}
                      className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-[8px] transition-all duration-200 cursor-pointer ${
                        creditFilter === opt.id
                          ? "bg-white dark:bg-[hsl(var(--card))] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] shadow-sm"
                          : "text-[#6e6e73] hover:text-[#1d1d1f]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>,
              document.body,
            )}
        </section>
      )}

      {loading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading orders...</p>
        </div>
      )}

      {!loading && filteredOrders.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center shrink-0">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{emptyMessage}</p>
        </div>
      )}

      {!loading && filteredOrders.length > 0 && (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-white dark:bg-[hsl(var(--card))]">
          <div className="md:hidden space-y-2 p-2">
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
                      <OrderStatusBadge status={order.status} className="text-right" />
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

          <table className="hidden md:table w-full text-sm min-w-[48rem]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-[#f5f5f7] dark:bg-[hsl(var(--muted))] shadow-[0_1px_0_rgba(0,0,0,0.06)]">
                {["Order #", "Client", "Items", "Total", "Paid", "Remaining", "Status", "Date"].map((h) => (
                  <th
                    key={h}
                    className="h-8 px-4 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] whitespace-nowrap bg-[#f5f5f7] dark:bg-[hsl(var(--muted))]"
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
                      <OrderStatusBadge status={order.status} />
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
      )}

      {selectedOrder && (
        <ClientOrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(updatedOrder) => {
            setCrmOrdersAll((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)))
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
  const [showPayment, setShowPayment] = useState(false)

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
  const canAddPayment = canCapturePaymentsForOrder(order)
  const postDelivery = isPostDeliveryPaymentCapture(order)

  if (showPayment) {
    return (
      <PaymentCapture
        order={order}
        currentUser={user?.name || user?.email || "Finance"}
        onClose={() => setShowPayment(false)}
        onUpdate={(updated) => {
          onUpdate(updated)
          setShowPayment(false)
        }}
      />
    )
  }

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
            <OrderStatusBadge status={order.status} />
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

          {(order.cashbackPayments?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-2">Cashback</p>
              <div className="rounded-lg border border-violet-200 bg-violet-50/50 divide-y overflow-hidden">
                {order.cashbackPayments!.map((p, i) => (
                  <div key={p.id} className="p-3 sm:p-4 space-y-2 bg-[hsl(var(--background))]/60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-violet-900">
                          {p.source === "other" ? "Goodwill bonus" : "From order"} {i + 1} — PKR {p.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-violet-700 mt-0.5">
                          {p.method} · {new Date(p.date).toLocaleDateString()}
                        </p>
                        {p.notes && <p className="text-xs text-violet-600 mt-1">{p.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {getOrderCashbackPaymentProofUrls(p).map((url, idx) => (
                          <a
                            key={`${p.id}-${idx}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-violet-700 underline text-xs"
                          >
                            Attachment {idx + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="px-3 sm:px-4 py-3 bg-violet-100/40 text-sm font-semibold text-violet-900 flex justify-between gap-2">
                  <span>Total cashback</span>
                  <span className="tabular-nums">PKR {getOrderCashbackAmount(order).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {canAddPayment && (
            <Button
              size="sm"
              className="h-11 w-full text-sm bg-blue-600 hover:bg-blue-700 cursor-pointer"
              onClick={() => setShowPayment(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {postDelivery ? "Attach proof (not in balance)" : "Add payment"}
            </Button>
          )}
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
                    {totalPaid <= 0.004
                      ? `No payment received. Full order balance PKR ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} can be sent on credit.`
                      : `Partial payment received (PKR ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}). Remaining PKR ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} can go on credit.`}
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
                : remaining > 0.004
                  ? `Delivered — PKR ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} outstanding`
                  : "Delivered — paid in full"}
            </p>
          ) : (
            <p className="text-xs text-center text-[hsl(var(--muted-foreground))] py-1">Awaiting payment</p>
          )}
        </div>
      </div>
    </div>
  )
}
