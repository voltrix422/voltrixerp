"use client"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  getOrders,
  saveOrder,
  getOrderPaymentProofUrls,
  getPaymentSubmissionStatus,
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
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { CrmOrderSummaryDisplay } from "@/components/crm/crm-order-summary-display"
import { formatCrmItemsQtyLabel } from "@/components/crm/crm-items-qty-cell"
import { Loader2, X, Plus, SlidersHorizontal, Search, ExternalLink } from "lucide-react"
import { PaymentCapture } from "@/components/crm/payment-capture"
import { cn } from "@/lib/utils"

type AppleTone = "neutral" | "green" | "amber" | "blue" | "violet"

function ApplePill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode
  tone?: AppleTone
  className?: string
}) {
  const tones: Record<AppleTone, string> = {
    neutral: "bg-black/[0.06] text-[#1d1d1f] dark:bg-white/10 dark:text-white",
    green: "bg-[#30d158]/18 text-[#248a3d] dark:bg-[#30d158]/20 dark:text-[#30d158]",
    amber: "bg-[#ff9f0a]/18 text-[#9a6700] dark:bg-[#ff9f0a]/20 dark:text-[#ffd60a]",
    blue: "bg-[#007aff]/14 text-[#0071e3] dark:bg-[#007aff]/20 dark:text-[#0a84ff]",
    violet: "bg-[#bf5af2]/15 text-[#8944ab] dark:bg-[#bf5af2]/20 dark:text-[#bf5af2]",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-tight whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

function AppleGroup({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {title ? (
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">
          {title}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-[14px] border border-black/[0.04] bg-white dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--card))]">
        {children}
      </div>
    </div>
  )
}

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
        <div className="min-h-0 flex-1 overflow-auto rounded-[16px] border border-black/[0.04] bg-white/90 dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--card))] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="md:hidden divide-y divide-black/[0.05] dark:divide-[hsl(var(--border))]">
            {filteredOrders.map((order) => {
              const { totalPaid, remaining } = orderPaymentTotals(order)
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="w-full text-left p-3.5 space-y-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold tracking-tight text-[#0071e3] truncate">
                        {order.orderNumber}
                      </p>
                      <p className="text-[14px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate mt-0.5">
                        {order.clientName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {hasOutstandingCredit(order) && <ApplePill tone="amber">Credit</ApplePill>}
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                    <div>
                      <p className="text-[10px] font-medium text-[#86868b]">Items</p>
                      <p className="font-semibold tracking-tight">{formatCrmItemsQtyLabel(order.items)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-[#86868b]">Total</p>
                      <p className="font-semibold tracking-tight tabular-nums">
                        {fmtPkr(order.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-[#86868b]">Paid</p>
                      <p className="tabular-nums tracking-tight">{fmtPkr(totalPaid)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-[#86868b]">Remaining</p>
                      {remaining <= 0.004 ? (
                        <ApplePill tone="green">Paid</ApplePill>
                      ) : (
                        <p className="font-semibold tabular-nums tracking-tight text-[#9a6700]">
                          {fmtPkr(remaining)}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-[#aeaeb2]">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </button>
              )
            })}
          </div>

          <table className="hidden md:table w-full text-[13px] min-w-[48rem]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-black/[0.06] dark:border-[hsl(var(--border))]">
                {["Order #", "Client", "Items", "Total", "Paid", "Remaining", "Status", "Date"].map((h) => (
                  <th
                    key={h}
                    className="h-9 px-4 text-left text-[11px] font-semibold tracking-tight text-[#86868b] whitespace-nowrap bg-[#fafafa] dark:bg-[hsl(var(--muted))]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const { totalPaid, remaining } = orderPaymentTotals(order)
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="border-b border-black/[0.04] last:border-b-0 dark:border-[hsl(var(--border))] hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-semibold tracking-tight text-[#0071e3]">
                          {order.orderNumber}
                        </span>
                        {hasOutstandingCredit(order) && <ApplePill tone="amber">Credit</ApplePill>}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                      {order.clientName}
                    </td>
                    <td className="px-4 py-3 text-[#6e6e73] tabular-nums">
                      {formatCrmItemsQtyLabel(order.items)}
                    </td>
                    <td className="px-4 py-3 font-semibold tracking-tight whitespace-nowrap tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                      {fmtPkr(order.total)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-[#6e6e73]">
                      {fmtPkr(totalPaid)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {remaining <= 0.004 ? (
                        <ApplePill tone="green">Paid</ApplePill>
                      ) : (
                        <span className="font-semibold tracking-tight tabular-nums text-[#9a6700]">
                          {fmtPkr(remaining)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#aeaeb2] whitespace-nowrap tabular-nums">
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

/** Finance-only context — never duplicate the CRM status label. */
function financeStatusBadge(order: Order) {
  if (hasOutstandingCredit(order)) {
    return { label: "On credit", variant: "warning" as const }
  }
  if (isOrderOnCredit(order)) {
    return { label: "Credit cleared", variant: "success" as const }
  }
  if (order.status === "confirmed") {
    return { label: "In inventory", variant: "success" as const }
  }
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

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
  const postDelivery = isPostDeliveryPaymentCapture(order)
  // After delivery, only offer capture when balance remains (collect) — hide proof-only on paid-in-full.
  const canAddPayment =
    canCapturePaymentsForOrder(order) && !(postDelivery && isFullyPaid)
  const paymentActionLabel = postDelivery
    ? "Collect payment"
    : "Add payment"

  if (!mounted) return null

  if (showPayment) {
    return createPortal(
      <PaymentCapture
        order={order}
        currentUser={user?.name || user?.email || "Finance"}
        onClose={() => setShowPayment(false)}
        onUpdate={(updated) => {
          onUpdate(updated)
          setShowPayment(false)
        }}
      />,
      document.body,
    )
  }

  const footerNote =
    order.status === "payment_added"
      ? null
      : order.status === "confirmed" || order.status === "processing" || order.status === "shipped"
        ? hasOutstandingCredit(order)
          ? `Sent to inventory on credit — ${fmtPkr(remaining)} outstanding`
          : "Sent to inventory"
        : order.status === "delivered"
          ? onCredit && remaining > 0.004
            ? `Delivered — ${fmtPkr(remaining)} credit balance`
            : remaining > 0.004
              ? `Delivered — ${fmtPkr(remaining)} outstanding`
              : "Delivered — paid in full"
          : "Awaiting payment"

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[10px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[min(1120px,calc(100vw-2rem))] rounded-t-[22px] sm:rounded-[22px] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pt-4 pb-2.5 sm:px-7 sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <p className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.03em] text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                  {order.orderNumber}
                </p>
                <p className="text-[14px] font-medium tracking-tight text-[#6e6e73]">
                  {order.clientName}
                </p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <OrderStatusBadge status={order.status} />
                {statusBadge && (
                  <ApplePill tone={statusBadge.variant === "warning" ? "amber" : "green"}>
                    {statusBadge.label}
                  </ApplePill>
                )}
                {isFullyPaid && <ApplePill tone="green">Paid in full</ApplePill>}
                {order.dispatcher && (
                  <span className="text-[11px] text-[#aeaeb2]">
                    {order.dispatcher}
                  </span>
                )}
                {order.deliveryDate && (
                  <span className="text-[11px] text-[#aeaeb2] tabular-nums">
                    {new Date(order.deliveryDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white dark:hover:bg-white/15 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-7 pb-3 space-y-3 overflow-y-auto">
          <AppleGroup title="Order items">
            <div className="[&_.rounded-lg]:rounded-none [&_.rounded-lg]:border-0 text-[13px]">
              <CrmLineItemsDisplay items={order.items} />
            </div>
          </AppleGroup>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <AppleGroup title="Summary">
              <div className="[&_.rounded-lg]:rounded-none [&_.rounded-lg]:border-0 [&_table]:text-[13px]">
                <CrmOrderSummaryDisplay order={order} />
              </div>
            </AppleGroup>

            {order.payments && order.payments.length > 0 ? (
              <AppleGroup title="Payments">
                <div className="divide-y divide-black/[0.05] dark:divide-[hsl(var(--border))]">
                  {order.payments.map((p, paymentIndex) => {
                    const pStatus = getPaymentSubmissionStatus(p, order.status)
                    const proofs = getOrderPaymentProofUrls(p)
                    return (
                      <div key={p.id} className="px-3.5 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                            Payment {paymentIndex + 1}
                            <span className="text-[#86868b] font-medium"> · </span>
                            <span className="tabular-nums">{fmtPkr(p.amount)}</span>
                          </p>
                          <p className="text-[12px] text-[#86868b]">
                            {p.method} · {new Date(p.date).toLocaleDateString()}
                          </p>
                          <div className="pt-0.5">
                            {pStatus === "approved" && <ApplePill tone="green">Approved</ApplePill>}
                            {pStatus === "pending_approval" && (
                              <ApplePill tone="amber">Pending approval</ApplePill>
                            )}
                            {pStatus === "draft" && <ApplePill tone="neutral">Draft</ApplePill>}
                          </div>
                        </div>
                        {proofs.length > 0 && (
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {proofs.map((proofUrl, proofIndex) => (
                              <a
                                key={`${p.id}-${proofIndex}`}
                                href={proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0071e3] hover:underline"
                              >
                                {proofs.length > 1 ? `Proof ${proofIndex + 1}` : "Proof"}
                                <ExternalLink className="h-3 w-3" strokeWidth={2} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div className="px-3.5 py-3 bg-[#fafafa] dark:bg-white/[0.03] flex items-center justify-between gap-2">
                    <div className="text-[13px] font-semibold tracking-tight">
                      <span className="text-[#6e6e73]">Paid </span>
                      <span className="tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                        {fmtPkr(totalPaid)}
                      </span>
                    </div>
                    {remaining > 0.004 ? (
                      <span className="text-[13px] font-semibold tabular-nums text-[#9a6700]">
                        Due {fmtPkr(remaining)}
                      </span>
                    ) : (
                      <ApplePill tone="green">Paid in full</ApplePill>
                    )}
                  </div>
                </div>
              </AppleGroup>
            ) : (
              <AppleGroup title="Payments">
                <p className="px-4 py-6 text-center text-[13px] text-[#86868b]">
                  No payments yet
                </p>
              </AppleGroup>
            )}
          </div>

          {(order.cashbackPayments?.length ?? 0) > 0 && (
            <AppleGroup title="Cashback">
              <div className="divide-y divide-black/[0.05] dark:divide-[hsl(var(--border))]">
                {order.cashbackPayments!.map((p, i) => (
                  <div key={p.id} className="px-3.5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold tracking-tight">
                        {p.source === "other" ? "Bonus" : "Cashback"} {i + 1}
                        <span className="text-[#86868b] font-medium"> · </span>
                        <span className="tabular-nums">{fmtPkr(p.amount)}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {getOrderCashbackPaymentProofUrls(p).map((url, idx) => (
                        <a
                          key={`${p.id}-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0071e3] hover:underline"
                        >
                          File {idx + 1}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AppleGroup>
          )}
        </div>

        <div className="shrink-0 px-5 sm:px-7 pt-2 pb-[max(0.85rem,env(safe-area-inset-bottom))] space-y-2 border-t border-black/[0.05] dark:border-[hsl(var(--border))]">
          <div className="flex flex-col sm:flex-row gap-2">
            {canAddPayment && (
              <button
                type="button"
                onClick={() => setShowPayment(true)}
                className="h-10 flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0071e3] text-white text-[13px] font-semibold tracking-tight hover:bg-[#0077ed] transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" strokeWidth={2.25} />
                {paymentActionLabel}
              </button>
            )}
            {order.status === "payment_added" && isFullyPaid && (
              <button
                type="button"
                onClick={approvePaymentForInventory}
                disabled={approvingPayment || approvingCredit}
                className="h-10 flex-1 inline-flex items-center justify-center rounded-full bg-[#30d158] text-white text-[13px] font-semibold tracking-tight hover:brightness-95 disabled:opacity-60 transition cursor-pointer"
              >
                {approvingPayment ? "Approving..." : "Approve & send to Inventory"}
              </button>
            )}
            {order.status === "payment_added" && !isFullyPaid && (
              <button
                type="button"
                onClick={approveOnCreditForInventory}
                disabled={approvingPayment || approvingCredit}
                className="h-10 flex-1 inline-flex items-center justify-center rounded-full bg-[#ff9f0a] text-white text-[13px] font-semibold tracking-tight hover:brightness-95 disabled:opacity-60 transition cursor-pointer"
              >
                {approvingCredit ? "Approving..." : "Approve on credit"}
              </button>
            )}
          </div>
          {order.status === "payment_added" && !isFullyPaid && (
            <p className="text-[11px] text-center text-[#86868b]">
              {totalPaid <= 0.004
                ? `No payment yet. Full balance ${fmtPkr(remaining)} can go on credit.`
                : `Partial (${fmtPkr(totalPaid)}). Remaining ${fmtPkr(remaining)} can go on credit.`}
            </p>
          )}
          {order.status !== "payment_added" && footerNote && (
            <p className="text-[11px] text-center font-medium text-[#86868b]">{footerNote}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
