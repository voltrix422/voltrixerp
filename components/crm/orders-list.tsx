"use client"
import { useState, useEffect } from "react"
import { getOrders, saveOrder, deleteOrder, generateOrderNumber, getOrderPaymentProofUrls, getPaymentSubmissionStatus, getBalanceSubmittedPayments, getProofOnlyPayments, canCapturePaymentsForOrder, canShowOrderInvoiceActions, orderHasInvoiceDetails, getOrderAmountPaid, getOrderCreditBalance, getOrderReturnAmount, getOrderCashbackAmount, getOrderCashbackPaymentProofUrls, getOrderNetSalesValue, getOrderReturnPaymentProofUrls, hasOutstandingCredit, isOrderOnCredit, isOrderReturned, orderHasAnyReturns, orderHasCashback, getReturnedLinesSummary, getItemOriginalQty, getItemRemainingReturnableQty, canReturnOrder, canAddReturnPayment, canAddCashback, isPaymentDeletable, isReturnPaymentDeletable, isCashbackDeletable, isProofOnlyPayment, type Order, type OrderItem } from "@/lib/orders"
import { isBranchPosOrderHiddenFromErp } from "@/lib/branch-pos"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
import { getClients, type Client } from "@/lib/crm"
import { matchesOwnerRecord, resolveOwnerUserId, initialOrderStatus, type CrmWorkspaceScope } from "@/lib/crm-workspace"
import { OrderSourceBadge, OrderSourceLabel } from "@/components/crm/order-source-badge"
import { CrmWarehouseInventoryPicker } from "@/components/crm/crm-warehouse-inventory-picker"
import { CrmLineItemsEditor } from "@/components/crm/crm-line-items-editor"
import { CrmLineItemsDisplay } from "@/components/crm/crm-line-items-display"
import { CrmItemsQtyCell } from "@/components/crm/crm-items-qty-cell"
import { getCrmItemsTotalQty } from "@/lib/crm-line-items-summary"
import { CrmOrdersListCards } from "@/components/crm/crm-orders-list-cards"
import { CrmOrderSummaryDisplay } from "@/components/crm/crm-order-summary-display"
import { loadCrmWarehouseProducts, type CrmWarehouseProduct } from "@/lib/warehouse-inventory-picker"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
// DB access via /api/db routes (Prisma)
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { Plus, X, Trash2, ShoppingCart, FileText, Download, Eye, DollarSign, Edit, Loader2, RotateCcw, Gift, Shield, PlayCircle, SlidersHorizontal, ChevronDown } from "lucide-react"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { downloadOrdersExcel } from "@/lib/crm-excel-export"
import { ClientExcludePicker, ClientLedgerPicker, ClientLedgerSummary } from "@/components/crm/client-ledger-panel"
import {
  findLedgerClients,
  listLedgerClients,
  ledgerClientsLabel,
  orderBelongsToAnyClient,
} from "@/lib/client-order-ledger"
import { useSalesAgentUserIds } from "@/hooks/use-sales-agent-user-ids"
import { PaymentCapture } from "@/components/crm/payment-capture"
import { OrderReturn, ReturnPaymentCapture } from "@/components/crm/order-return"
import { OrderFreeItem } from "@/components/crm/order-free-item"
import { CashbackCapture } from "@/components/crm/order-cashback"
import { OrderFinalize } from "@/components/crm/order-finalize"
import { InvoicePreviewModal } from "@/components/crm/invoice-preview-modal"
import { InvoiceEditModal } from "@/components/crm/invoice-edit-modal"
import { canEditOrderInvoice } from "@/lib/invoice-edit"
import {
  calculateGstInclusiveTotals,
  DEFAULT_GST_PERCENT,
} from "@/lib/gst-inclusive-pricing"
import { CrmPriceTierSelect } from "@/components/crm/crm-price-tier-select"
import {
  applyCrmPriceTierToItems,
  buildCrmPriceMap,
  getCrmProductPrices,
  lookupCrmUnitPrice,
  type CrmPriceTier,
  type CrmProductPrice,
} from "@/lib/crm-product-prices"
import {
  aggregateOrderPaymentStats,
  aggregateOrderPaymentsInPeriod,
  isApprovedAwaitingPaymentOrder,
  isDeliveredFullyPaidOrder,
  isPartiallyPaidOrder,
} from "@/lib/order-payment-stats"
import {
  crmOrdersReportMoney,
  crmPeriodBounds,
  orderMatchesCrmDateRange,
  orderReceivedInPeriod,
} from "@/lib/crm-order-period"

type OrderStatusFilter = "all" | "delivered" | "approved" | "confirmed" | "returned"
type PaymentFilter = "all" | "on_credit" | "paid" | "not_credit" | "cashback"
type DatePreset = "" | "today" | "tomorrow" | "last_3" | "last_7" | "last_15" | "last_30"
const STATUS_FILTER_OPTIONS: { value: OrderStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "delivered", label: "Delivered" },
  { value: "approved", label: "Approved" },
  { value: "confirmed", label: "Confirmed" },
  { value: "returned", label: "Returned" },
]

const PAYMENT_FILTER_OPTIONS: { value: PaymentFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "on_credit", label: "On Credit" },
  { value: "paid", label: "Fully Paid" },
  { value: "not_credit", label: "Not Credit" },
  { value: "cashback", label: "Cashback" },
]

function formatOrderPkr(amount: number) {
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

function orderMatchesPaymentFilter(order: Order, filter: PaymentFilter): boolean {
  if (filter === "all") return true
  if (filter === "cashback") return orderHasCashback(order)
  if (filter === "on_credit") return hasOutstandingCredit(order)
  if (filter === "paid") return !isOrderReturned(order) && getOrderCreditBalance(order) <= 0.004
  if (filter === "not_credit") return !isOrderOnCredit(order)
  return true
}

function isApprovedAwaitingPayment(order: Order): boolean {
  return isApprovedAwaitingPaymentOrder(order)
}

function isDeliveredFullyPaid(order: Order): boolean {
  return isDeliveredFullyPaidOrder(order)
}

function isPartiallyPaid(order: Order): boolean {
  return isPartiallyPaidOrder(order)
}

function ToggleChip({
  on,
  label,
  onClick,
}: {
  on: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-tight transition-colors shrink-0 cursor-pointer ${
        on
          ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
          : "bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
      }`}
    >
      {label}
    </button>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="tabular-nums font-medium shrink-0">{value}</span>
    </div>
  )
}

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "last_3", label: "Last 3 days" },
  { value: "last_7", label: "Last 7 days" },
  { value: "last_15", label: "Last 15 days" },
  { value: "last_30", label: "Last 30 days" },
]

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function getDatePresetRange(preset: DatePreset): { from: string; to: string } | null {
  const today = startOfDay(new Date())
  switch (preset) {
    case "today":
      return { from: toYmd(today), to: toYmd(today) }
    case "tomorrow": {
      const t = new Date(today)
      t.setDate(t.getDate() + 1)
      return { from: toYmd(t), to: toYmd(t) }
    }
    case "last_3": {
      const from = new Date(today)
      from.setDate(from.getDate() - 2)
      return { from: toYmd(from), to: toYmd(today) }
    }
    case "last_7": {
      const from = new Date(today)
      from.setDate(from.getDate() - 6)
      return { from: toYmd(from), to: toYmd(today) }
    }
    case "last_15": {
      const from = new Date(today)
      from.setDate(from.getDate() - 14)
      return { from: toYmd(from), to: toYmd(today) }
    }
    case "last_30": {
      const from = new Date(today)
      from.setDate(from.getDate() - 29)
      return { from: toYmd(from), to: toYmd(today) }
    }
    default:
      return null
  }
}

function orderMatchesDateRange(order: Pick<Order, "createdAt" | "payments" | "status">, fromDate: string, toDate: string): boolean {
  return orderMatchesCrmDateRange(order, fromDate, toDate)
}

export function OrdersList({ currentUser, currentUserId, workspace }: { currentUser: string; currentUserId?: string; workspace?: CrmWorkspaceScope }) {
  const { toast } = useToast()
  const salesAgentUserIds = useSalesAgentUserIds()
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Order | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all")
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all")
  const [datePreset, setDatePreset] = useState<DatePreset>("")
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<Order | null>(null)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfDownloadingId, setPdfDownloadingId] = useState<string | null>(null)
  const [includeOutstandingInTotal, setIncludeOutstandingInTotal] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [ledgerClientIds, setLedgerClientIds] = useState<string[]>([])
  const [referrerFilter, setReferrerFilter] = useState("")
  const [excludedClientIds, setExcludedClientIds] = useState<string[]>([])

  async function handleListDownloadPdf(order: Order, e?: { stopPropagation: () => void }) {
    e?.stopPropagation()
    if (pdfDownloadingId) return
    setPdfDownloadingId(order.id)
    try {
      await downloadInvoicePDF(order)
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({ title: "Error", message: "Failed to generate PDF. Please try again.", type: "error" })
    } finally {
      setPdfDownloadingId(null)
    }
  }

  useEffect(() => {
    Promise.all([getOrders(), getClients()]).then(([o, c]) => {
      const withoutPos = o.filter(order => !isBranchPosOrderHiddenFromErp(order))
      const scopedOrders = workspace?.ownerUserId
        ? withoutPos.filter(order => matchesOwnerRecord(order.ownerUserId, workspace.ownerUserId))
        : withoutPos
      const scopedClients = workspace?.ownerUserId
        ? c.filter(client => matchesOwnerRecord(client.ownerUserId, workspace.ownerUserId))
        : c
      setOrders(scopedOrders)
      setClients(scopedClients)
      setLoading(false)
    })
    const interval = setInterval(() => {
      getOrders().then(o => {
        const withoutPos = o.filter(order => !isBranchPosOrderHiddenFromErp(order))
        const scopedOrders = workspace?.ownerUserId
          ? withoutPos.filter(order => matchesOwnerRecord(order.ownerUserId, workspace.ownerUserId))
          : withoutPos
        setOrders(scopedOrders)
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const ledgerOptions = listLedgerClients(clients, orders)
  const ledgerClients = findLedgerClients(ledgerOptions, ledgerClientIds)
  const excludedClients = findLedgerClients(ledgerOptions, excludedClientIds)
  const ledgerLabel = ledgerClientsLabel(ledgerClients)

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    const matchesSearch =
      !search ||
      (o.orderNumber?.toLowerCase() || "").includes(q) ||
      (o.clientName?.toLowerCase() || "").includes(q) ||
      (o.warrantyHolderName?.toLowerCase() || "").includes(q) ||
      (o.referrerName?.toLowerCase() || "").includes(q)

    const matchesStatus = statusFilter === "all" || o.status === statusFilter
    const matchesPayment = orderMatchesPaymentFilter(o, paymentFilter)
    const matchesDateRange = orderMatchesDateRange(o, fromDate, toDate)
    const matchesClient = ledgerClients.length
      ? orderBelongsToAnyClient(o, ledgerClients)
      : excludedClients.length === 0 || !orderBelongsToAnyClient(o, excludedClients)
    const matchesReferrer =
      !referrerFilter ||
      (o.referrerName || "").trim().toLowerCase() === referrerFilter.toLowerCase()

    return matchesSearch && matchesStatus && matchesPayment && matchesDateRange && matchesClient && matchesReferrer
  })

  const referrerOptions = Array.from(
    new Set(
      orders
        .map((o) => (o.referrerName || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))

  const hasActiveFilters = Boolean(
    search || fromDate || toDate || statusFilter !== "all" || paymentFilter !== "all" || ledgerClientIds.length > 0 || referrerFilter || excludedClientIds.length > 0,
  )

  function applyDatePreset(preset: DatePreset) {
    if (datePreset === preset) {
      setDatePreset("")
      setFromDate("")
      setToDate("")
      return
    }
    const range = getDatePresetRange(preset)
    if (!range) return
    setDatePreset(preset)
    setFromDate(range.from)
    setToDate(range.to)
  }

  function clearFilters() {
    setSearch("")
    setFromDate("")
    setToDate("")
    setStatusFilter("all")
    setPaymentFilter("all")
    setDatePreset("")
    setLedgerClientIds([])
    setReferrerFilter("")
    setExcludedClientIds([])
  }

  function selectLedgerClients(ids: string[]) {
    const firstPick = ledgerClientIds.length === 0 && ids.length > 0
    setLedgerClientIds(ids)
    if (!firstPick) return
    setSearch("")
    setFromDate("")
    setToDate("")
    setStatusFilter("all")
    setPaymentFilter("all")
    setDatePreset("")
    setReferrerFilter("")
    setExcludedClientIds([])
  }

  function exportListExcel() {
    setExportingExcel(true)
    try {
      downloadOrdersExcel(filtered, {
        exportedBy: currentUser,
        salesAgentUserIds: salesAgentUserIds ?? undefined,
        dateFrom: fromDate,
        dateTo: toDate,
        clientName: ledgerLabel || undefined,
        clients: ledgerClients.map((c) => ({
          name: c.name,
          company: c.company,
          phone: c.phone,
          email: c.email,
          ntn: c.ntn,
          address: c.address,
          city: c.city,
        })),
      })
      toast({
        title: "Download started",
        message: `${filtered.length} order(s) exported for Excel.`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not export orders.", type: "error" })
    } finally {
      setExportingExcel(false)
    }
  }

  async function exportListPdf() {
    if (exportingPdf) return
    setExportingPdf(true)
    try {
      const { downloadCrmOrdersReportPdf } = await import("@/lib/crm-orders-report-pdf")
      await downloadCrmOrdersReportPdf(filtered, {
        dateFrom: fromDate,
        dateTo: toDate,
        exportedBy: currentUser,
        salesAgentUserIds: salesAgentUserIds ?? undefined,
        clientName: ledgerLabel || undefined,
        clients: ledgerClients.map((c) => ({
          name: c.name,
          company: c.company,
          phone: c.phone,
          email: c.email,
          ntn: c.ntn,
          address: c.address,
          city: c.city,
        })),
        includeOutstanding: includeOutstandingInTotal,
      })
      toast({
        title: "Downloaded",
        message: `${filtered.length} ERP order(s) saved as PDF.`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not generate PDF.", type: "error" })
    } finally {
      setExportingPdf(false)
    }
  }

  // Payment stats — shared logic with Finance overview (lib/order-payment-stats).
  // Date range filters orders by created date. "Money received" still uses payments dated in that range
  // (so credit collections show only the amount received then, not the full order).
  const paymentStats = aggregateOrderPaymentStats(filtered)
  const periodBounds = crmPeriodBounds(fromDate, toDate)
  const periodMoney = crmOrdersReportMoney(filtered, fromDate, toDate)
  const periodPaymentStats = periodBounds
    ? aggregateOrderPaymentsInPeriod(filtered, periodBounds.start, periodBounds.end)
    : null
  const totalOrderValue = paymentStats.totalOrderValue
  const totalOrderQty = filtered.reduce((sum, o) => sum + getCrmItemsTotalQty(o.items), 0)

  const deliveredFullyPaid = filtered.filter(isDeliveredFullyPaid)
  const creditOrders = filtered.filter(hasOutstandingCredit)
  const approvedAwaitingPayment = filtered.filter(isApprovedAwaitingPayment)
  const returnedOrders = filtered.filter(isOrderReturned)
  const partiallyPaidOrders = filtered
    .filter(isPartiallyPaid)
    .map((order) => ({
      order,
      paid: periodBounds
        ? orderReceivedInPeriod(order, periodBounds.start, periodBounds.end)
        : getOrderAmountPaid(order),
      balance: getOrderCreditBalance(order),
    }))
    .sort((a, b) => b.paid - a.paid)

  const totalReceived = periodMoney.moneyReceived
  const totalOutstanding = paymentStats.totalOutstanding
  const deliveredFullyPaidReceived = periodPaymentStats
    ? periodPaymentStats.deliveredFullyPaidInPeriod
    : paymentStats.deliveredFullyPaidReceived
  const onCreditAmount = paymentStats.creditOutstanding
  const creditPaymentsReceived = periodPaymentStats
    ? periodPaymentStats.partialPaymentsInPeriod
    : paymentStats.creditPaymentsReceived
  const approvedUnpaidAmount = paymentStats.approvedUnpaidOutstanding
  const partialPaymentAmount = periodPaymentStats
    ? periodPaymentStats.partialPaymentsInPeriod
    : paymentStats.partialPaymentsReceived
  const otherPaymentsReceived = periodPaymentStats
    ? periodPaymentStats.otherPaymentsInPeriod
    : paymentStats.otherPaymentsReceived
  const returnedRefundAmount = paymentStats.returnedRefundAmount
  const cashbackOrders = filtered.filter(orderHasCashback)
  const cashbackAmount = paymentStats.cashbackAmount

  const headlineTotal = includeOutstandingInTotal
    ? totalReceived + totalOutstanding
    : totalReceived

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        {!workspace?.readOnly && (
          <Button
            size="sm"
            className="h-8 text-xs px-3 cursor-pointer bg-[#1faca6] hover:bg-[#17857f] text-white"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Order
          </Button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`relative h-8 w-8 inline-flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
              showFilters
                ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))] border-transparent"
                : "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/40"
            }`}
            aria-label="Filters and exports"
            title="Filters · ledger · export"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            {hasActiveFilters && !showFilters && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#1faca6]" />
            )}
          </button>
          {showFilters && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowFilters(false)} />
              <div className="absolute right-0 top-full mt-2 z-40 w-[min(22rem,calc(100vw-1.25rem))] max-h-[min(70vh,32rem)] overflow-y-auto rounded-2xl border bg-[hsl(var(--card))] shadow-xl p-3 space-y-2.5">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Client ledger
                  </p>
                  <ClientLedgerPicker
                    clients={clients}
                    orders={orders}
                    selectedIds={ledgerClientIds}
                    onChange={selectLedgerClients}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <CrmExcelExportButton
                    onExport={exportListExcel}
                    exporting={exportingExcel}
                    disabled={loading || filtered.length === 0 || exportingPdf}
                    className="h-7 text-[10px] gap-1 cursor-pointer shrink-0"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] gap-1 cursor-pointer shrink-0"
                    disabled={loading || filtered.length === 0 || exportingPdf}
                    onClick={() => void exportListPdf()}
                  >
                    {exportingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    {exportingPdf ? "PDF…" : "PDF"}
                  </Button>
                  {hasActiveFilters && (
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] cursor-pointer ml-auto px-2" onClick={clearFilters}>
                      Clear
                    </Button>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Status</p>
                  <div className="flex flex-wrap gap-1">
                    {STATUS_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatusFilter(opt.value)}
                        className={`h-6 px-2 rounded-md border text-[10px] font-medium transition-colors cursor-pointer ${
                          statusFilter === opt.value
                            ? "bg-[#1faca6] text-white border-[#1faca6]"
                            : "bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]/40"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Payment</p>
                  <div className="flex flex-wrap gap-1">
                    {PAYMENT_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPaymentFilter(opt.value)}
                        className={`h-6 px-2 rounded-md border text-[10px] font-medium transition-colors cursor-pointer ${
                          paymentFilter === opt.value
                            ? "bg-[#1faca6] text-white border-[#1faca6]"
                            : "bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]/40"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ClientExcludePicker
                  clients={clients}
                  orders={orders}
                  excludedIds={excludedClientIds}
                  onChange={(ids) => {
                    setExcludedClientIds(ids)
                    if (ids.length) setLedgerClientIds([])
                  }}
                />

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Referrer</p>
                  <select
                    value={referrerFilter}
                    onChange={(e) => setReferrerFilter(e.target.value)}
                    className="w-full h-7 px-2 rounded-md border bg-[hsl(var(--background))] text-[11px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  >
                    <option value="">All referrers</option>
                    {referrerOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1">Date</p>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {DATE_PRESET_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => applyDatePreset(opt.value)}
                        className={`h-6 px-2 rounded-md border text-[10px] font-medium transition-colors cursor-pointer ${
                          datePreset === opt.value
                            ? "bg-[#1faca6] text-white border-[#1faca6]"
                            : "bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]/40"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setFromDate(e.target.value)
                        setDatePreset("")
                      }}
                      className="h-7 flex-1 min-w-0 px-1.5 rounded-md border bg-[hsl(var(--background))] text-[11px]"
                    />
                    <span className="text-[9px] text-[hsl(var(--muted-foreground))]">to</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => {
                        setToDate(e.target.value)
                        setDatePreset("")
                      }}
                      className="h-7 flex-1 min-w-0 px-1.5 rounded-md border bg-[hsl(var(--background))] text-[11px]"
                    />
                  </div>
                </div>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search orders, client, referrer…"
                  className="w-full h-7 px-2.5 rounded-md border bg-[hsl(var(--background))] text-[11px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading orders...</p>
        </div>
      ) : (
        <>
          {ledgerClients.length > 0 && (
            <ClientLedgerSummary clients={ledgerClients} orders={filtered} currentUser={currentUser} />
          )}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingCart className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {orders.length === 0
              ? "No orders found"
              : ledgerClients.length
                ? `No orders for ${ledgerLabel}`
              : hasActiveFilters
                ? "No orders match your filters"
                : "No orders found"}
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-[18px] border border-black/[0.04] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-hidden">
            <button
              type="button"
              onClick={() => setSummaryOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
              aria-expanded={summaryOpen}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                  Order summary
                </p>
                <p className="text-[12px] text-[#86868b] mt-0.5 tabular-nums">
                  {filtered.length} orders · {formatOrderPkr(totalOrderValue)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ToggleChip
                  on={includeOutstandingInTotal}
                  label={includeOutstandingInTotal ? "Incl. outstanding" : "+ Outstanding"}
                  onClick={() => setIncludeOutstandingInTotal((v) => !v)}
                />
                <ChevronDown
                  className={`h-4 w-4 text-[#86868b] transition-transform duration-200 ${summaryOpen ? "rotate-180" : ""}`}
                  strokeWidth={2}
                />
              </div>
            </button>

            {summaryOpen && (
              <div className="px-3.5 pb-3.5 space-y-3 border-t border-black/[0.05] dark:border-[hsl(var(--border))] pt-3">
                <div className="rounded-[14px] border border-black/[0.05] dark:border-[hsl(var(--border))] p-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-medium text-[#86868b]">Money received</p>
                    <p className="text-[18px] font-semibold tracking-tight tabular-nums text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                      {formatOrderPkr(headlineTotal)}
                    </p>
                  </div>
                  {includeOutstandingInTotal && (
                    <p className="text-[11px] text-[#aeaeb2] tabular-nums">
                      Received {formatOrderPkr(totalReceived)} + owed {formatOrderPkr(totalOutstanding)}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-px rounded-[10px] border border-black/[0.05] overflow-hidden bg-black/[0.04] dark:bg-[hsl(var(--border))]">
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">Received</p>
                      <p className="text-[13px] font-semibold tabular-nums mt-0.5">{formatOrderPkr(totalReceived)}</p>
                    </div>
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">Outstanding</p>
                      <p className="text-[13px] font-semibold tabular-nums mt-0.5">{formatOrderPkr(totalOutstanding)}</p>
                    </div>
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">In view</p>
                      <p className="text-[13px] font-semibold tabular-nums mt-0.5">{filtered.length}</p>
                    </div>
                  </div>
                  <div className="space-y-1 pt-0.5">
                    <SummaryRow label={`Delivered paid (${deliveredFullyPaid.length})`} value={formatOrderPkr(deliveredFullyPaidReceived)} />
                    <SummaryRow label={`Partial (${partiallyPaidOrders.length})`} value={formatOrderPkr(partialPaymentAmount)} />
                    {otherPaymentsReceived > 0.004 && (
                      <SummaryRow label="Confirmed / in progress" value={formatOrderPkr(otherPaymentsReceived)} />
                    )}
                    {creditPaymentsReceived > 0.004 && (
                      <SummaryRow label="Credit installments" value={formatOrderPkr(creditPaymentsReceived)} />
                    )}
                  </div>
                </div>

                <div className="rounded-[14px] border border-black/[0.05] dark:border-[hsl(var(--border))] overflow-hidden">
                  <div className="grid grid-cols-3 gap-px bg-black/[0.04] dark:bg-[hsl(var(--border))] border-b border-black/[0.05] dark:border-[hsl(var(--border))]">
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2.5">
                      <p className="text-[10px] text-[#86868b]">Orders</p>
                      <p className="text-[15px] font-semibold tabular-nums">{filtered.length}</p>
                    </div>
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2.5">
                      <p className="text-[10px] text-[#86868b]">Qty</p>
                      <p className="text-[15px] font-semibold tabular-nums">{totalOrderQty}</p>
                    </div>
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2.5">
                      <p className="text-[10px] text-[#86868b]">Value</p>
                      <p className="text-[13px] font-semibold tabular-nums">{formatOrderPkr(totalOrderValue)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-black/[0.04] dark:bg-[hsl(var(--border))]">
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">Delivered paid ({deliveredFullyPaid.length})</p>
                      <p className="text-[13px] font-semibold tabular-nums mt-0.5">{formatOrderPkr(deliveredFullyPaidReceived)}</p>
                    </div>
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">On credit ({creditOrders.length})</p>
                      <p className="text-[13px] font-semibold tabular-nums mt-0.5">{formatOrderPkr(onCreditAmount)}</p>
                    </div>
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">Partial ({partiallyPaidOrders.length})</p>
                      <p className="text-[13px] font-semibold tabular-nums mt-0.5">{formatOrderPkr(partialPaymentAmount)}</p>
                    </div>
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">Approved unpaid ({approvedAwaitingPayment.length})</p>
                      <p className="text-[13px] font-semibold tabular-nums mt-0.5">{formatOrderPkr(approvedUnpaidAmount)}</p>
                    </div>
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">Returned ({returnedOrders.length})</p>
                      <p className="text-[13px] font-semibold tabular-nums mt-0.5">{formatOrderPkr(returnedRefundAmount)}</p>
                    </div>
                    <div className="bg-white dark:bg-[hsl(var(--card))] px-2.5 py-2">
                      <p className="text-[10px] text-[#86868b]">Cashback ({cashbackOrders.length})</p>
                      <p className="text-[13px] font-semibold tabular-nums mt-0.5">{formatOrderPkr(cashbackAmount)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <CrmOrdersListCards
            orders={filtered}
            onSelect={setSelected}
            onDownloadPdf={(order, e) => void handleListDownloadPdf(order, e)}
            onDelete={setDeleteConfirmOrder}
            pdfDownloadingId={pdfDownloadingId}
          />
          <div className="hidden md:block rounded-xl border overflow-x-auto bg-[hsl(var(--card))] shadow-sm">
          <table className="w-full min-w-[1120px] table-fixed">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/35">
                <th className="h-8 px-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[7%]">Order #</th>
                <th className="h-8 px-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[11%]">Source</th>
                <th className="h-8 px-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[14%]">Client</th>
                <th className="h-8 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[5%]">Qty</th>
                <th className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[9%]">Total</th>
                <th className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[9%]">Paid</th>
                <th className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[9%]">Credit</th>
                <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[9%] whitespace-nowrap">Payment</th>
                <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[10%] whitespace-nowrap">Status</th>
                <th className="h-8 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[8%]">Date</th>
                <th className="h-8 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] w-[9%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]/70">
              {filtered.map(order => {
                const paid = getOrderAmountPaid(order)
                const due = getOrderCreditBalance(order)
                const netTotal = getOrderNetSalesValue(order)
                const onCredit = hasOutstandingCredit(order)
                const notCredit = !isOrderOnCredit(order)
                const returned = isOrderReturned(order)
                return (
                <tr
                  key={order.id}
                  className="group/row cursor-pointer transition-all duration-150 hover:bg-[#1faca6]/[0.06] hover:shadow-[inset_3px_0_0_0_#1faca6]"
                  onClick={() => setSelected(order)}
                >
                  <td className="px-2.5 py-2 text-xs font-semibold text-[#1faca6]">
                    <span className="whitespace-nowrap group-hover/row:underline underline-offset-2">{order.orderNumber || "—"}</span>
                  </td>
                  <td className="px-2.5 py-2">
                    <OrderSourceBadge order={order} />
                  </td>
                  <td className="px-2.5 py-2 text-xs font-medium">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate leading-tight">{order.clientName || "—"}</p>
                      {order.warrantyHolderName?.trim() && (
                        <p className="text-[10px] text-[#1a9f9a] truncate mt-0.5">Warranty: {order.warrantyHolderName}</p>
                      )}
                      {order.referrerName?.trim() && (
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">Referrer: {order.referrerName}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs text-center">
                    {returned ? (
                      <span className="text-[hsl(var(--muted-foreground))]">0</span>
                    ) : (
                      <CrmItemsQtyCell items={order.items} />
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs text-right font-semibold tabular-nums whitespace-nowrap">
                    {formatOrderPkr(netTotal)}
                  </td>
                  <td className="px-2 py-2 text-xs text-right tabular-nums text-emerald-700 whitespace-nowrap">
                    {formatOrderPkr(paid)}
                  </td>
                  <td className="px-2 py-2 text-xs text-right tabular-nums text-amber-700 whitespace-nowrap">
                    {formatOrderPkr(due)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {onCredit ? (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                        On Credit
                      </span>
                    ) : notCredit ? (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                        Not Credit
                      </span>
                    ) : (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 whitespace-nowrap">
                        Paid
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-2 py-2 text-[11px] text-[hsl(var(--muted-foreground))] whitespace-nowrap tabular-nums">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5 opacity-70 group-hover/row:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => void handleListDownloadPdf(order, e)}
                        disabled={pdfDownloadingId === order.id}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#1a9f9a] hover:bg-[#1a9f9a]/10 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download PDF"
                      >
                        {pdfDownloadingId === order.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmOrder(order)
                        }}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                        title="Delete order"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
        </>
      )}

      {showForm && (
        <OrderForm
          currentUser={currentUser}
          currentUserId={currentUserId}
          workspace={workspace}
          clients={clients}
          onClose={() => setShowForm(false)}
          onSave={o => {
            setOrders(prev => [o, ...prev.filter(x => x.id !== o.id)])
            setShowForm(false)
          }}
        />
      )}

      {selected && (
        <OrderDetail
          order={selected}
          clients={clients}
          workspace={workspace}
          currentUser={currentUser}
          currentUserId={currentUserId}
          onClose={() => setSelected(null)}
          onUpdate={o => {
            setOrders(prev => prev.map(x => x.id === o.id ? o : x))
            setSelected(o)
          }}
          onDelete={id => {
            setOrders(prev => prev.filter(x => x.id !== id))
            setSelected(null)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirmOrder}
        title="Delete Order"
        message={`Delete order ${deleteConfirmOrder?.orderNumber}? Any units dispatched for this order will be returned to inventory.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          const target = deleteConfirmOrder
          setDeleteConfirmOrder(null)
          if (!target) return
          void (async () => {
            try {
              await deleteOrder(target.id)
              setOrders((prev) => prev.filter((x) => x.id !== target.id))
              if (selected?.id === target.id) setSelected(null)
            } catch (err) {
              console.error(err)
              alert(
                err instanceof Error
                  ? err.message
                  : "Could not delete order.",
              )
            }
          })()
        }}
        onCancel={() => setDeleteConfirmOrder(null)}
      />
    </div>
  )
}

export function OrderForm({ currentUser, currentUserId, workspace, clients, existing, onClose, onSave }: {
  currentUser: string
  currentUserId?: string
  workspace?: CrmWorkspaceScope
  clients: Client[]
  existing?: Order
  onClose: () => void
  onSave: (o: Order) => void
}) {
  const { toast } = useToast()
  const isEdit = !!existing
  const [clientId, setClientId] = useState(existing?.clientId ?? "")
  const [items, setItems] = useState<OrderItem[]>(existing?.items ?? [])
  const [deliveryAddress, setDeliveryAddress] = useState(existing?.deliveryAddress ?? "")
  const [deliveryDate, setDeliveryDate] = useState(
    existing?.deliveryDate ?? toYmd(new Date()),
  )
  const [notes, setNotes] = useState(existing?.notes ?? "")
  const [referrerName, setReferrerName] = useState(existing?.referrerName ?? "")
  const [saving, setSaving] = useState(false)
  const [warehouseProducts, setWarehouseProducts] = useState<CrmWarehouseProduct[]>([])
  const [showInventory, setShowInventory] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const [inventorySearch, setInventorySearch] = useState("")
  const [quantityError, setQuantityError] = useState<string | null>(null)
  const [priceTier, setPriceTier] = useState<CrmPriceTier>("retail")
  const [priceMap, setPriceMap] = useState<Map<string, CrmProductPrice>>(() => new Map())
  
  // Tax and expenses state
  const taxPercent = DEFAULT_GST_PERCENT
  const [transportCost, setTransportCost] = useState<number>(existing?.transportCost ?? 0)
  const [transportLabel, setTransportLabel] = useState<string>(existing?.transportLabel ?? "Transport")
  const [transportIsPercentage, setTransportIsPercentage] = useState<boolean>(existing?.transportIsPercentage ?? false)
  const [otherCost, setOtherCost] = useState<number>(existing?.otherCost ?? 0)
  const [otherCostLabel, setOtherCostLabel] = useState<string>(existing?.otherCostLabel ?? "Other")
  const [otherCostIsPercentage, setOtherCostIsPercentage] = useState<boolean>(existing?.otherCostIsPercentage ?? false)
  const [discount, setDiscount] = useState<number>(existing?.discount ?? 0)
  const [discountIsPercentage, setDiscountIsPercentage] = useState<boolean>(existing?.discountIsPercentage ?? true)

  useEffect(() => {
    void Promise.all([loadCrmWarehouseProducts(), getCrmProductPrices().catch(() => [])]).then(
      ([products, prices]) => {
        const map = buildCrmPriceMap(prices)
        setPriceMap(map)
        setWarehouseProducts(products)
        if (existing?.items?.length) {
          setItems(
            existing.items.map((item) => {
              const product = products.find((p) => p.id === item.inventoryItemId)
              const model = item.model || product?.model
              return product
                ? {
                    ...item,
                    availableQty: product.qty,
                    model,
                    unitPrice: item.unitPrice,
                  }
                : item
            }),
          )
        }
      },
    )
  }, [existing?.id])

  useEffect(() => {
    setItems((prev) => applyCrmPriceTierToItems(prev, priceTier, priceMap))
  }, [priceTier, priceMap])

  useEffect(() => {
    if (quantityError) {
      const timer = setTimeout(() => {
        setQuantityError(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [quantityError])

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const pricing = calculateGstInclusiveTotals({
    subtotalInclGst: subtotal,
    gstPercent: taxPercent,
    discount,
    discountIsPercentage,
    transportCost,
    transportIsPercentage,
    otherCost,
    otherCostIsPercentage,
  })
  const {
    base: subtotalBeforeTax,
    discountedBase,
    gst: taxAmount,
    discountOnBase: discountAmount,
    discountedSubtotalInclGst: discountedSubtotal,
    transportAmount,
    otherAmount,
    total,
  } = pricing

  function updateItem(id: string, key: keyof OrderItem, value: any) {
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        // If updating quantity, validate against available stock
        if (key === "qty" && i.availableQty !== undefined) {
          const newQty = Number(value)
          if (newQty > i.availableQty) {
            setQuantityError(`Maximum available quantity is ${i.availableQty} ${i.unit}`)
            return i
          } else {
            setQuantityError(null)
          }
        }
        return { ...i, [key]: value }
      }
      return i
    }))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function addFromInventory(product: CrmWarehouseProduct) {
    const existingItem = items.find((i) => i.inventoryItemId === product.id)

    if (existingItem) {
      if (existingItem.qty < product.qty) {
        setItems((prev) =>
          prev.map((i) => (i.id === existingItem.id ? { ...i, qty: i.qty + 1 } : i)),
        )
      }
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          description: product.displayName,
          qty: 1,
          unit: product.unit,
          unitPrice: lookupCrmUnitPrice(priceMap, product.model, priceTier),
          isCustom: false,
          inventoryItemId: product.id,
          model: product.model,
          availableQty: product.qty,
          costPrice: 0,
        },
      ])
    }
    setShowInventory(false)
    setInventorySearch("")
  }

  async function submit() {
    if (!clientId || items.length === 0) return
    setSaving(true)

    const client = clients.find(c => c.id === clientId)

    const order: Order = isEdit
      ? {
          ...existing!,
          clientId,
          clientName: client?.name || existing!.clientName,
          items,
          subtotal,
          taxPercent,
          tax: taxAmount,
          transportCost,
          transportLabel,
          transportIsPercentage,
          transportCostValue: transportAmount,
          otherCost,
          otherCostLabel,
          otherCostIsPercentage,
          otherCostValue: otherAmount,
          shipping: existing!.shipping ?? 0,
          discount,
          discountIsPercentage,
          discountValue: discountAmount,
          total,
          notes: notes.trim(),
          referrerName: referrerName.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryDate: deliveryDate || "",
        }
      : {
          id: Date.now().toString(),
          orderNumber: await generateOrderNumber(),
          clientId,
          clientName: client?.name || "",
          items,
          subtotal,
          taxPercent,
          tax: taxAmount,
          transportCost,
          transportLabel,
          transportIsPercentage,
          transportCostValue: transportAmount,
          otherCost,
          otherCostLabel,
          otherCostIsPercentage,
          otherCostValue: otherAmount,
          shipping: 0,
          discount,
          discountIsPercentage,
          discountValue: discountAmount,
          total,
          status: initialOrderStatus(workspace),
          notes: notes.trim(),
          referrerName: referrerName.trim(),
          createdAt: new Date().toISOString(),
          createdBy: currentUser,
          ownerUserId: resolveOwnerUserId(workspace?.ownerUserId, currentUserId),
          deliveryAddress: deliveryAddress.trim(),
          deliveryDate: deliveryDate || "",
          payments: [],
        }

    await saveOrder(order)
    toast({
      title: isEdit ? "Order updated" : "Order created",
      message: isEdit ? "Changes saved." : "Order created successfully.",
      type: "success",
    })
    onSave(order)
    setSaving(false)
  }

  return (
    <>
      {quantityError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">{quantityError}</p>
        </div>
      )}
      <div className={`fixed inset-0 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[10px] p-0 sm:p-3 ${isEdit ? "z-[60]" : "z-50"}`} onClick={onClose}>
        <div className="w-full sm:w-[min(1180px,calc(100vw-1.25rem))] rounded-t-[22px] sm:rounded-[22px] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col max-h-[100dvh] sm:h-[min(96vh,980px)] sm:max-h-[96vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 px-5 sm:px-7 pt-4 pb-3 shrink-0">
            <p className="text-[22px] font-semibold tracking-[-0.03em] text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              {isEdit ? existing?.orderNumber : "New order"}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto sm:overflow-hidden overflow-x-hidden overscroll-contain px-5 sm:px-7 pb-3 space-y-3 sm:flex sm:flex-col">
            <div className="space-y-1.5 relative">
            <label className="text-[11px] font-medium text-[#86868b]">Client</label>
            {(() => {
              const selectedClient = clients.find((c) => c.id === clientId)
              return (
            <button
              type="button"
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="w-full min-h-10 rounded-[10px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] px-3.5 py-2 text-[13px] text-left focus:outline-none focus:ring-2 focus:ring-[#007aff]/35 flex items-center justify-between gap-3 cursor-pointer"
            >
              {selectedClient ? (
                <span className="min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="capitalize text-[#1d1d1f] dark:text-[hsl(var(--foreground))] font-medium truncate">{selectedClient.name}</span>
                  {selectedClient.company ? (
                    <span className="text-[11px] text-[#86868b] truncate">{selectedClient.company}</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-[#aeaeb2]">Select client</span>
              )}
              <ChevronDown className="h-4 w-4 text-[#86868b] shrink-0" strokeWidth={2} />
            </button>
              )
            })()}
            {showClientDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowClientDropdown(false)} />
                <div className="absolute z-20 w-full mt-1 max-h-72 overflow-auto rounded-[14px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] shadow-[0_16px_48px_rgba(0,0,0,0.16)]">
                  <div className="p-2 border-b border-black/[0.05]">
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Search name or company"
                      autoFocus
                      className="w-full h-9 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35"
                    />
                  </div>
                  {clients.filter(c => {
                    const q = clientSearch.trim().toLowerCase()
                    if (!q) return true
                    return (
                      c.name.toLowerCase().includes(q) ||
                      (c.company && c.company.toLowerCase().includes(q))
                    )
                  }).map(c => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setClientId(c.id)
                        setDeliveryAddress(c.address?.trim() || "")
                        setShowClientDropdown(false)
                        setClientSearch("")
                      }}
                      className="w-full px-3.5 py-2.5 text-[13px] text-left cursor-pointer hover:bg-black/[0.04] border-t border-black/[0.04]"
                    >
                      <span className="capitalize font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{c.name}</span>
                      {c.company ? (
                        <span className="block text-[11px] text-[#86868b] mt-0.5 truncate">{c.company}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <label className="text-[11px] font-medium text-[#86868b]">Address</label>
              <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="Optional"
                className="w-full h-10 rounded-[10px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] px-3.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#86868b]">Delivery date</label>
              <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                className="w-full h-10 rounded-[10px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] px-3.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#86868b]">Referrer</label>
              <input
                value={referrerName}
                onChange={e => setReferrerName(e.target.value)}
                placeholder="Optional"
                className="w-full h-10 rounded-[10px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] px-3.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#86868b]">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full h-10 rounded-[10px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] px-3.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35" />
            </div>
          </div>

          <div className="space-y-2 min-h-0 sm:flex-1 sm:flex sm:flex-col">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">
              <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">Items</p>
              <div className="flex flex-wrap items-center gap-2">
                <CrmPriceTierSelect value={priceTier} onChange={setPriceTier} />
                <button
                  type="button"
                  onClick={() => setShowInventory(true)}
                  className="h-8 px-3.5 rounded-full bg-[#007aff] text-[12px] font-semibold text-white hover:bg-[#0066d6] cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Inventory
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-black/[0.1] px-4 py-6 text-center">
                <p className="text-[13px] text-[#86868b]">No items yet</p>
              </div>
            ) : (
              <div className="min-h-0 sm:flex-1 sm:overflow-y-auto">
                <CrmLineItemsEditor
                  items={items}
                  onUpdate={(id, key, value) => updateItem(id, key, value)}
                  onRemove={removeItem}
                  size="md"
                  removeIcon="trash"
                  gstPercent={taxPercent}
                  variant="sheet"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_280px] gap-3 shrink-0">
            {items.length > 0 ? (
              <div className="rounded-[14px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.06] dark:border-[hsl(var(--border))] p-3 space-y-2.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#86868b]">Discount %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountIsPercentage ? discount : subtotalBeforeTax > 0 ? ((discountAmount / subtotalBeforeTax) * 100).toFixed(2) : 0}
                      onChange={e => {
                        const value = Number(e.target.value)
                        setDiscount(value)
                        setDiscountIsPercentage(true)
                      }}
                      className="w-full h-9 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] dark:border-[hsl(var(--border))] px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#86868b]">Discount PKR</label>
                    <input
                      type="number"
                      min="0"
                      value={discountIsPercentage ? discountAmount : discount}
                      onChange={e => {
                        setDiscount(Number(e.target.value))
                        setDiscountIsPercentage(false)
                      }}
                      className="w-full h-9 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] dark:border-[hsl(var(--border))] px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#86868b]">Expense</label>
                    <div className="flex gap-1.5">
                      <input
                        value={transportLabel}
                        onChange={e => setTransportLabel(e.target.value)}
                        placeholder="Transport"
                        className="w-full h-9 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] dark:border-[hsl(var(--border))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35"
                      />
                      <input
                        type="number"
                        min="0"
                        step={transportIsPercentage ? "0.01" : "1"}
                        value={transportCost}
                        onChange={e => setTransportCost(Number(e.target.value))}
                        className="w-[88px] h-9 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] dark:border-[hsl(var(--border))] px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35"
                      />
                      <button
                        type="button"
                        onClick={() => setTransportIsPercentage((v) => !v)}
                        className={`h-9 px-2 rounded-[10px] text-[11px] font-semibold shrink-0 cursor-pointer ${
                          transportIsPercentage
                            ? "bg-[#1d1d1f] text-white"
                            : "bg-black/[0.06] text-[#1d1d1f] dark:bg-white/10 dark:text-white"
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#86868b]">Other</label>
                    <div className="flex gap-1.5">
                      <input
                        value={otherCostLabel}
                        onChange={e => setOtherCostLabel(e.target.value)}
                        placeholder="Other"
                        className="w-full h-9 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] dark:border-[hsl(var(--border))] px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35"
                      />
                      <input
                        type="number"
                        min="0"
                        step={otherCostIsPercentage ? "0.01" : "1"}
                        value={otherCost}
                        onChange={e => setOtherCost(Number(e.target.value))}
                        className="w-[88px] h-9 rounded-[10px] border border-black/[0.08] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] dark:border-[hsl(var(--border))] px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35"
                      />
                      <button
                        type="button"
                        onClick={() => setOtherCostIsPercentage((v) => !v)}
                        className={`h-9 px-2 rounded-[10px] text-[11px] font-semibold shrink-0 cursor-pointer ${
                          otherCostIsPercentage
                            ? "bg-[#1d1d1f] text-white"
                            : "bg-black/[0.06] text-[#1d1d1f] dark:bg-white/10 dark:text-white"
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div />
            )}

            <div className="rounded-[14px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.06] dark:border-[hsl(var(--border))] px-3.5 py-3 space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#86868b]">Base</span>
                <span className="tabular-nums font-medium">PKR {subtotalBeforeTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#34c759]">Discount{discountIsPercentage ? ` (${discount}%)` : ""}</span>
                  <span className="tabular-nums font-medium text-[#34c759]">− PKR {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#86868b]">GST ({taxPercent}%)</span>
                <span className="tabular-nums font-medium">PKR {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {transportAmount > 0 && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#86868b]">{transportLabel}{transportIsPercentage ? ` (${transportCost}%)` : ""}</span>
                  <span className="tabular-nums font-medium">PKR {transportAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {otherAmount > 0 && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#86868b]">{otherCostLabel}{otherCostIsPercentage ? ` (${otherCost}%)` : ""}</span>
                  <span className="tabular-nums font-medium">PKR {otherAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-black/[0.06] dark:border-[hsl(var(--border))]">
                <span className="text-[15px] font-semibold tracking-tight">Total</span>
                <span className="text-[17px] font-semibold tracking-tight tabular-nums">PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 sm:px-7 py-3.5 shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-[#f5f5f7]/90 dark:bg-[hsl(var(--background))]/90 backdrop-blur-xl border-t border-black/[0.06] dark:border-[hsl(var(--border))]">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 sm:flex-none sm:px-5 rounded-full text-[13px] font-semibold bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !clientId || items.length === 0}
            className="h-10 flex-1 sm:flex-none sm:px-6 rounded-full text-[13px] font-semibold bg-[#007aff] text-white hover:bg-[#0066d6] disabled:opacity-40 cursor-pointer"
          >
            {saving ? "Saving…" : isEdit ? "Save" : workspace?.mode === "sales_agent" ? "Submit" : "Create"}
          </button>
        </div>
      </div>
      </div>

      <CrmWarehouseInventoryPicker
        open={showInventory}
        products={warehouseProducts}
        search={inventorySearch}
        onSearchChange={setInventorySearch}
        onClose={() => setShowInventory(false)}
        onSelect={addFromInventory}
      />
    </>
  )
}


function OrderDetail({
  order,
  clients,
  workspace,
  currentUser,
  currentUserId,
  onClose,
  onUpdate,
  onDelete,
}: {
  order: Order
  clients: Client[]
  workspace?: CrmWorkspaceScope
  currentUser: string
  currentUserId?: string
  onClose: () => void
  onUpdate: (o: Order) => void
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState(order.status)
  const [showFinalize, setShowFinalize] = useState(false)
  const [showInvoicePreview, setShowInvoicePreview] = useState(false)
  const [showInvoiceEdit, setShowInvoiceEdit] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [showReturnPayment, setShowReturnPayment] = useState(false)
  const [showCashback, setShowCashback] = useState(false)
  const [showFreeItem, setShowFreeItem] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)
  const [deletingPayment, setDeletingPayment] = useState(false)
  const [deleteReturnPaymentId, setDeleteReturnPaymentId] = useState<string | null>(null)
  const [deletingReturnPayment, setDeletingReturnPayment] = useState(false)
  const [deleteCashbackId, setDeleteCashbackId] = useState<string | null>(null)
  const [deletingCashback, setDeletingCashback] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [detailOrder, setDetailOrder] = useState(order)
  const [invoiceLoading, setInvoiceLoading] = useState<null | "view" | "download">(null)
  const [warrantyHolderDraft, setWarrantyHolderDraft] = useState(order.warrantyHolderName || "")
  const [savingWarrantyHolder, setSavingWarrantyHolder] = useState(false)
  const [showStartWarrantiesConfirm, setShowStartWarrantiesConfirm] = useState(false)
  const [startingWarranties, setStartingWarranties] = useState(false)
  const [warrantyStartResult, setWarrantyStartResult] = useState<string | null>(null)

  useEffect(() => {
    setDetailOrder(order)
    setStatus(order.status)
    setWarrantyHolderDraft(order.warrantyHolderName || "")
    setWarrantyStartResult(null)
  }, [order])

  const canEditOrder =
    detailOrder.status === "approved" || detailOrder.status === "pending_approval"

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteOrder(detailOrder.id)
      onDelete(detailOrder.id)
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error(err)
      alert(
        err instanceof Error
          ? err.message
          : "Could not delete order.",
      )
    } finally {
      setDeleting(false)
    }
  }

  async function updateStatus(newStatus: typeof status) {
    setStatus(newStatus)
    const updated = { ...detailOrder, status: newStatus }

    if (newStatus === "delivered" && status !== "delivered") {
      try {
        const { deductInventoryForOrder } = await import("@/lib/inventory")
        const result = await deductInventoryForOrder(updated)
        if (result.success || result.alreadyDeducted) {
          updated.inventoryDeductedAt = updated.inventoryDeductedAt ?? new Date().toISOString()
        }
      } catch (error) {
        console.error("Error deducting inventory:", error)
      }
    }

    let toSave = updated
    if (newStatus === "delivered") {
      const { applySalesCommissionOnDelivery } = await import("@/lib/sales-commission")
      toSave = await applySalesCommissionOnDelivery(updated)
    }

    await saveOrder(toSave)
    setDetailOrder(toSave)
    onUpdate(toSave)
  }

  const hasInvoiceDetails = orderHasInvoiceDetails(detailOrder)
  const showInvoiceActions = canShowOrderInvoiceActions(detailOrder)
  const canEditInvoice = canEditOrderInvoice(detailOrder)
  const canFinalize = detailOrder.status === "approved" && !hasInvoiceDetails
  const canManagePayments = canCapturePaymentsForOrder(detailOrder)
  const canDeletePayments = detailOrder.status === "delivered" && canManagePayments
  const canReturn = canReturnOrder(detailOrder) && !workspace?.readOnly
  const canManageReturnPayments = canAddReturnPayment(detailOrder) && !workspace?.readOnly
  const canManageCashback = canAddCashback(detailOrder) && !workspace?.readOnly
  const canAddFreeItem =
    !workspace?.readOnly &&
    !isOrderReturned(detailOrder) &&
    ["approved", "finalized", "payment_added", "confirmed", "processing", "shipped", "delivered"].includes(
      detailOrder.status,
    )
  const hasReturns = orderHasAnyReturns(detailOrder)
  const creditBalance = getOrderCreditBalance(detailOrder)
  const amountPaid = getOrderAmountPaid(detailOrder)
  const returnAmount = getOrderReturnAmount(detailOrder)
  const cashbackAmount = getOrderCashbackAmount(detailOrder)
  const cashbackFromOrder = getOrderCashbackAmount(detailOrder, "order")
  const cashbackOther = getOrderCashbackAmount(detailOrder, "other")

  async function handleSaveWarrantyHolder() {
    const nextName = warrantyHolderDraft.trim()
    if (workspace?.readOnly || detailOrder.status !== "delivered") return
    setSavingWarrantyHolder(true)
    try {
      const updated: Order = { ...detailOrder, warrantyHolderName: nextName }
      const saved = await saveOrder(updated)
      setDetailOrder(saved)
      setWarrantyHolderDraft(saved.warrantyHolderName || nextName)
      onUpdate(saved)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Could not save warranty name.")
    } finally {
      setSavingWarrantyHolder(false)
    }
  }

  const scannedSerialCount = (detailOrder.fulfillmentSerialAllocations || []).filter(
    (a) => String(a.serialNumber || "").trim(),
  ).length
  const savedWarrantyName = (detailOrder.warrantyHolderName || "").trim()
  const canStartOrderWarranties =
    !workspace?.readOnly &&
    detailOrder.status === "delivered" &&
    Boolean(savedWarrantyName) &&
    scannedSerialCount > 0

  async function handleStartOrderWarranties() {
    if (!canStartOrderWarranties || startingWarranties) return
    setStartingWarranties(true)
    setWarrantyStartResult(null)
    try {
      const res = await fetch("/api/db/orders/start-warranties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: detailOrder.id,
          confirm: true,
          activatedBy: currentUser || "ERP admin",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Could not start warranties")
      }
      const failCount = Array.isArray(data.failed) ? data.failed.length : 0
      const failHint =
        failCount && Array.isArray(data.failed)
          ? ` Failed: ${(data.failed as { serialNumber: string }[])
              .slice(0, 3)
              .map((f) => f.serialNumber)
              .join(", ")}${failCount > 3 ? "…" : ""}`
          : ""
      const parts = [
        data.started ? `${data.started} started` : null,
        data.alreadyActive ? `${data.alreadyActive} already started` : null,
        failCount ? `${failCount} failed` : null,
      ].filter(Boolean)
      setWarrantyStartResult(
        parts.length
          ? `${data.orderNumber}: ${parts.join(" · ")}.${failHint}`
          : "No warranties were started.",
      )
      setShowStartWarrantiesConfirm(false)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Could not start warranties.")
    } finally {
      setStartingWarranties(false)
    }
  }

  async function handleDeletePayment(paymentId: string) {
    const payment = detailOrder.payments?.find(p => p.id === paymentId)
    if (!payment || !isPaymentDeletable(payment, detailOrder.status)) return

    setDeletingPayment(true)
    try {
      const nextPayments = (detailOrder.payments || []).filter(p => p.id !== paymentId)
      const updated: Order = { ...detailOrder, payments: nextPayments, status: "delivered" }
      await saveOrder(updated)
      setDetailOrder(updated)
      onUpdate(updated)
      setDeletePaymentId(null)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Could not delete payment.")
    } finally {
      setDeletingPayment(false)
    }
  }

  async function handleDeleteReturnPayment(paymentId: string) {
    if (!isReturnPaymentDeletable(detailOrder) || workspace?.readOnly) return
    const payment = detailOrder.returnPayments?.find(p => p.id === paymentId)
    if (!payment) return

    setDeletingReturnPayment(true)
    try {
      const nextReturnPayments = (detailOrder.returnPayments || []).filter(p => p.id !== paymentId)
      const updated: Order = { ...detailOrder, returnPayments: nextReturnPayments }
      await saveOrder(updated)
      setDetailOrder(updated)
      onUpdate(updated)
      setDeleteReturnPaymentId(null)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Could not delete return payment.")
    } finally {
      setDeletingReturnPayment(false)
    }
  }

  async function handleDeleteCashback(paymentId: string) {
    if (!isCashbackDeletable(detailOrder) || workspace?.readOnly) return
    const payment = detailOrder.cashbackPayments?.find(p => p.id === paymentId)
    if (!payment) return

    setDeletingCashback(true)
    try {
      const nextCashback = (detailOrder.cashbackPayments || []).filter(p => p.id !== paymentId)
      const updated: Order = { ...detailOrder, cashbackPayments: nextCashback }
      await saveOrder(updated)
      setDetailOrder(updated)
      onUpdate(updated)
      setDeleteCashbackId(null)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Could not delete cashback.")
    } finally {
      setDeletingCashback(false)
    }
  }

  async function downloadInvoice() {
    if (invoiceLoading) return
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

  return (
    <>
      {showEdit && canEditOrder && (
        <OrderForm
          existing={detailOrder}
          clients={clients}
          workspace={workspace}
          currentUser={currentUser}
          currentUserId={currentUserId}
          onClose={() => setShowEdit(false)}
          onSave={(o) => {
            setDetailOrder(o)
            onUpdate(o)
            setShowEdit(false)
          }}
        />
      )}
      {showFinalize ? (
        <OrderFinalize
          order={detailOrder}
          currentUser={currentUser}
          onClose={() => setShowFinalize(false)}
          onUpdate={o => {
            setDetailOrder(o)
            onUpdate(o)
            setShowFinalize(false)
          }}
        />
      ) : showPayment ? (
        <PaymentCapture
          order={detailOrder}
          currentUser={currentUser}
          onClose={() => setShowPayment(false)}
          onUpdate={o => {
            setDetailOrder(o)
            setStatus(o.status)
            onUpdate(o)
          }}
        />
      ) : showReturn ? (
        <OrderReturn
          order={detailOrder}
          currentUser={currentUser}
          onClose={() => setShowReturn(false)}
          onUpdate={o => {
            setDetailOrder(o)
            setStatus(o.status)
            onUpdate(o)
          }}
        />
      ) : showReturnPayment ? (
        <ReturnPaymentCapture
          order={detailOrder}
          currentUser={currentUser}
          onClose={() => setShowReturnPayment(false)}
          onUpdate={o => {
            setDetailOrder(o)
            setStatus(o.status)
            onUpdate(o)
          }}
        />
      ) : showCashback ? (
        <CashbackCapture
          order={detailOrder}
          currentUser={currentUser}
          onClose={() => setShowCashback(false)}
          onUpdate={o => {
            setDetailOrder(o)
            setStatus(o.status)
            onUpdate(o)
          }}
        />
      ) : showFreeItem ? (
        <OrderFreeItem
          order={detailOrder}
          currentUser={currentUser}
          onClose={() => setShowFreeItem(false)}
          onSaved={o => {
            setDetailOrder(o)
            onUpdate(o)
          }}
        />
      ) : (
    <>
    {showInvoicePreview && (
      <InvoicePreviewModal order={detailOrder} onClose={() => setShowInvoicePreview(false)} />
    )}
    {showInvoiceEdit && (
      <InvoiceEditModal
        order={detailOrder}
        onClose={() => setShowInvoiceEdit(false)}
        onSave={(o) => {
          setDetailOrder(o)
          onUpdate(o)
          setShowInvoiceEdit(false)
        }}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-3" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-t-xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 px-3 sm:px-4 py-2.5 border-b shrink-0">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <OrderSourceBadge order={detailOrder} />
              <p className="text-sm font-bold text-[#1faca6]">{detailOrder.orderNumber}</p>
              <OrderStatusBadge status={detailOrder.status} />
              <p className="text-xs font-medium truncate">{detailOrder.clientName}</p>
              {detailOrder.warrantyHolderName?.trim() && (
                <p className="text-[10px] text-[#1a9f9a] truncate">Warranty: {detailOrder.warrantyHolderName}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
              {detailOrder.deliveryDate && (
                <span><span className="font-medium text-[hsl(var(--foreground))]">Delivery</span> {new Date(detailOrder.deliveryDate).toLocaleDateString()}</span>
              )}
              <span className="inline-flex items-center gap-1 min-w-0">
                <span className="font-medium text-[hsl(var(--foreground))] shrink-0">Source</span>
                <OrderSourceLabel order={detailOrder} className="truncate" />
              </span>
              <span><span className="font-medium text-[hsl(var(--foreground))]">Created</span> {new Date(detailOrder.createdAt).toLocaleDateString()} · {detailOrder.createdBy}</span>
              {detailOrder.deliveryAddress && (
                <span className="truncate max-w-[14rem]" title={detailOrder.deliveryAddress}>
                  <span className="font-medium text-[hsl(var(--foreground))]">Addr</span> {detailOrder.deliveryAddress}
                </span>
              )}
              {detailOrder.referrerName?.trim() && (
                <span><span className="font-medium text-[hsl(var(--foreground))]">Referrer</span> {detailOrder.referrerName}</span>
              )}
              {detailOrder.dispatcher && (
                <span className="truncate max-w-[12rem]"><span className="font-medium text-[hsl(var(--foreground))]">Dispatcher</span> {detailOrder.dispatcher}</span>
              )}
              {detailOrder.notes && (
                <span className="truncate max-w-[16rem]" title={detailOrder.notes}>
                  <span className="font-medium text-[hsl(var(--foreground))]">Notes</span> {detailOrder.notes}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2.5">

          {detailOrder.status === "delivered" && (
            <div className="rounded-lg border border-[#1a9f9a]/30 bg-[#1a9f9a]/5 px-2.5 py-2">
              {workspace?.readOnly ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Shield className="h-3.5 w-3.5 text-[#1a9f9a] shrink-0" />
                  <span className="font-medium">Warranty</span>
                  <span>{detailOrder.warrantyHolderName?.trim() || "Not set"}</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-[#1a9f9a] shrink-0" />
                  <span className="text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))] shrink-0">Warranty</span>
                  <input
                    value={warrantyHolderDraft}
                    onChange={(e) => setWarrantyHolderDraft(e.target.value)}
                    placeholder="Warranty name"
                    title={`Not the client (${detailOrder.clientName})`}
                    className="h-7 min-w-[8rem] flex-1 rounded-md border bg-[hsl(var(--background))] px-2 text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs bg-[#1a9f9a] hover:bg-[#158a85] text-white cursor-pointer"
                    disabled={
                      savingWarrantyHolder ||
                      warrantyHolderDraft.trim() === (detailOrder.warrantyHolderName || "").trim()
                    }
                    onClick={() => void handleSaveWarrantyHolder()}
                  >
                    {savingWarrantyHolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs cursor-pointer border-[#1a9f9a] text-[#1a9f9a] hover:bg-[#1a9f9a]/10"
                    disabled={!canStartOrderWarranties || startingWarranties}
                    onClick={() => setShowStartWarrantiesConfirm(true)}
                  >
                    {startingWarranties ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <PlayCircle className="h-3.5 w-3.5 mr-1" />
                        {scannedSerialCount > 0 ? `Start ${scannedSerialCount}` : "Start"}
                      </>
                    )}
                  </Button>
                  {!savedWarrantyName && (
                    <span className="text-[10px] text-amber-700">Save name first</span>
                  )}
                  {savedWarrantyName && scannedSerialCount === 0 && (
                    <span className="text-[10px] text-amber-700">No scanned serials</span>
                  )}
                  {warrantyStartResult && (
                    <span className="text-[10px] text-emerald-800">{warrantyStartResult}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {hasReturns && (
            <div className="rounded-lg border bg-orange-50 dark:bg-orange-950/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[9px] font-bold uppercase tracking-widest text-orange-900 dark:text-orange-100">
                  {isOrderReturned(detailOrder) ? "Order return" : "Partial return"}
                </p>
                {canManageReturnPayments && (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
                    onClick={() => setShowReturnPayment(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add return payment
                  </Button>
                )}
              </div>
              {detailOrder.returnReason && (
                <div>
                  <p className="text-[10px] font-bold text-orange-800 dark:text-orange-200 uppercase">Reason</p>
                  <p className="text-sm text-orange-900 dark:text-orange-100 mt-0.5 whitespace-pre-wrap">
                    {detailOrder.returnReason}
                  </p>
                </div>
              )}
              <div className="rounded-md border border-orange-200 dark:border-orange-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-orange-100/60 dark:bg-orange-900/30 text-left text-[10px] uppercase text-orange-800 dark:text-orange-200">
                      <th className="px-2 py-1.5 font-semibold">Item</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Returned</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Still on order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getReturnedLinesSummary(detailOrder).map((line) => {
                      const remainingItem = detailOrder.items.find((i) => i.id === line.orderItemId)
                      const remaining = remainingItem
                        ? getItemRemainingReturnableQty(detailOrder, remainingItem)
                        : 0
                      const original = remainingItem
                        ? getItemOriginalQty(detailOrder, remainingItem)
                        : line.qty
                      return (
                        <tr key={line.orderItemId} className="border-t border-orange-200/70 dark:border-orange-800/70">
                          <td className="px-2 py-1.5 text-orange-900 dark:text-orange-100">
                            {line.description}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-medium text-orange-900 dark:text-orange-100">
                            {line.qty} / {original}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-orange-800 dark:text-orange-200">
                            {remaining}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-orange-800 dark:text-orange-200">
                {detailOrder.returnedAt && (
                  <div>
                    <p className="font-bold uppercase text-[10px]">Returned</p>
                    <p className="mt-0.5">
                      {new Date(detailOrder.returnedAt).toLocaleDateString()}
                      {detailOrder.returnedBy ? ` by ${detailOrder.returnedBy}` : ""}
                    </p>
                  </div>
                )}
                <div>
                  <p className="font-bold uppercase text-[10px]">Refunded</p>
                  <p className="mt-0.5 font-medium">
                    PKR {returnAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="font-bold uppercase text-[10px]">Stock</p>
                  <p className="mt-0.5">
                    {detailOrder.inventoryReturnedAt
                      ? "Fully restored to inventory"
                      : "Returned quantities restored to inventory"}
                  </p>
                </div>
              </div>
              {(detailOrder.returnPayments?.length ?? 0) > 0 && (
                <div className="space-y-2 pt-1 border-t border-orange-200 dark:border-orange-800">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-orange-800 dark:text-orange-200">
                    Return payments
                  </p>
                  {detailOrder.returnPayments!.map((p, i) => {
                    const proofs = getOrderReturnPaymentProofUrls(p)
                    const canDeleteRefund =
                      canManageReturnPayments && isReturnPaymentDeletable(detailOrder)
                    return (
                      <div key={p.id} className="flex items-start justify-between gap-2 text-xs">
                        <div>
                          <p className="font-medium text-orange-900 dark:text-orange-100">
                            Return {i + 1}: PKR {p.amount.toLocaleString()} · {p.method} ·{" "}
                            {new Date(p.date).toLocaleDateString()}
                          </p>
                          {p.notes && (
                            <p className="text-orange-700 dark:text-orange-300 text-[10px] mt-0.5">{p.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {proofs.map((url, idx) => (
                            <a
                              key={`${p.id}-${idx}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline text-orange-700 dark:text-orange-300 text-[10px]"
                            >
                              {proofs.length > 1 ? `Proof ${idx + 1}` : "View Proof"}
                            </a>
                          ))}
                          {canDeleteRefund && (
                            <button
                              type="button"
                              onClick={() => setDeleteReturnPaymentId(p.id)}
                              className="p-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                              title="Delete refund"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-2.5 items-start">
          <div className="rounded-lg border p-2.5 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1.5">Order Items</p>
            <CrmLineItemsDisplay items={detailOrder.items} size="sm" />
            <div className="mt-2">
              <CrmOrderSummaryDisplay order={detailOrder} />
            </div>
          </div>

          <div className="space-y-3 min-w-0">
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-3 min-w-0">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[9px] font-bold uppercase tracking-widest text-blue-900 dark:text-blue-100">Payment</p>
                {hasOutstandingCredit(detailOrder) && (
                  <Badge variant="warning" className="text-[10px]">On credit</Badge>
                )}
                {isOrderOnCredit(detailOrder) && creditBalance <= 0.004 && (
                  <Badge variant="success" className="text-[10px]">Credit cleared</Badge>
                )}
                {cashbackAmount > 0 && (
                  <Badge className="text-[10px] bg-violet-100 text-violet-800 border-violet-200">
                    Cashback PKR {cashbackAmount.toLocaleString()}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {canManageCashback && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-violet-300 text-violet-700 hover:bg-violet-50 cursor-pointer"
                    onClick={() => setShowCashback(true)}
                  >
                    <Gift className="h-3.5 w-3.5 mr-1" />
                    Add cashback
                  </Button>
                )}
                {canManagePayments && (
                  <Button size="sm" className="h-8 text-xs bg-blue-500 hover:bg-blue-600 text-white cursor-pointer" onClick={() => setShowPayment(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {detailOrder.payments?.length ? "Manage payments" : hasOutstandingCredit(detailOrder) ? "Record payment" : "Add payment"}
                  </Button>
                )}
              </div>
            </div>
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Total Amount: PKR{" "}
                {getOrderNetSalesValue(detailOrder).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                {isOrderReturned(detailOrder) && Number(detailOrder.total) > 0.004 && (
                  <span className="text-xs font-normal text-blue-700 dark:text-blue-300">
                    {" "}
                    (original PKR {detailOrder.total.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                  </span>
                )}
              </p>
              {(detailOrder.payments?.length ?? 0) > 0 || cashbackFromOrder > 0 || returnAmount > 0 ? (
                <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                  Paid PKR {amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  {cashbackFromOrder > 0 && (
                    <> · Cashback (order) PKR {cashbackFromOrder.toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
                  )}
                  {returnAmount > 0 && (
                    <> · Refunded PKR {returnAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
                  )}
                  {creditBalance > 0.004 ? (
                    <> · Balance PKR {creditBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
                  ) : returnAmount > 0.004 || isOrderReturned(detailOrder) ? (
                    <> · Balance PKR 0.00</>
                  ) : null}
                </p>
              ) : null}
              {detailOrder.payments && detailOrder.payments.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {detailOrder.payments.map((p, i) => {
                    const pStatus = getPaymentSubmissionStatus(p, detailOrder.status)
                    return (
                    <div key={p.id} className="text-xs text-blue-700 dark:text-blue-300">
                      Payment {i + 1}: PKR {p.amount.toLocaleString()} · {p.method} · {new Date(p.date).toLocaleDateString()}
                      {pStatus === "draft" && " · Draft"}
                      {pStatus === "pending_approval" && " · Sent to finance"}
                    </div>
                  )})}
                </div>
              ) : (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  {canManagePayments
                    ? detailOrder.status === "delivered" && hasOutstandingCredit(detailOrder)
                      ? "Record payments with amount and proof — remaining credit balance updates automatically."
                      : detailOrder.status === "delivered"
                        ? "Attach delivery or payment proof here — saved on the order only, does not change the paid balance."
                        : "No payments yet — add payments with proof; each submit goes to Finance."
                    : "No payments received yet"}
                </p>
              )}
            </div>
          </div>

          {detailOrder.payments && detailOrder.payments.length > 0 && (
            <div className="rounded-lg border bg-green-50 dark:bg-green-950 p-3 mt-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-green-900 dark:text-green-100 mb-2">Payments Received</p>
              <div className="space-y-2">
                {getBalanceSubmittedPayments(detailOrder.payments, detailOrder.status).map(p => {
                  const proofUrls = getOrderPaymentProofUrls(p)
                  const pStatus = getPaymentSubmissionStatus(p, detailOrder.status)
                  return (
                  <div key={p.id} className="flex items-center justify-between text-xs border-b border-green-200 dark:border-green-800 pb-2 last:border-0 gap-2">
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">PKR {p.amount.toLocaleString()}</p>
                      <p className="text-green-700 dark:text-green-300">
                        {p.method} · {new Date(p.date).toLocaleDateString()}
                        {pStatus === "draft" && " · Draft"}
                        {pStatus === "pending_approval" && " · Pending finance"}
                        {pStatus === "approved" && " · Approved"}
                      </p>
                      {p.notes && <p className="text-green-600 dark:text-green-400 text-[10px] mt-0.5">{p.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                      {proofUrls.length > 0 && proofUrls.map((proofUrl, proofIndex) => (
                          <a
                            key={`${p.id}-${proofIndex}`}
                            href={proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-green-700 dark:text-green-300 underline text-[10px]"
                          >
                            {proofUrls.length > 1 ? `Proof ${proofIndex + 1}` : "View Proof"}
                          </a>
                        ))}
                      {canDeletePayments && isPaymentDeletable(p, detailOrder.status) && (
                        <button
                          type="button"
                          onClick={() => setDeletePaymentId(p.id)}
                          className="p-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                          title="Delete payment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  )
                })}
                {getProofOnlyPayments(detailOrder.payments, detailOrder.status).length > 0 && (
                  <>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-green-800 dark:text-green-200 pt-2">Delivery proofs (not in balance)</p>
                    {getProofOnlyPayments(detailOrder.payments, detailOrder.status).map(p => {
                      const proofUrls = getOrderPaymentProofUrls(p)
                      return (
                        <div key={p.id} className="flex items-center justify-between text-xs border-b border-green-200 dark:border-green-800 pb-2 last:border-0 gap-2">
                          <div>
                            <p className="font-medium text-green-900 dark:text-green-100">Proof attachment</p>
                            <p className="text-green-700 dark:text-green-300">
                              {new Date(p.date).toLocaleDateString()}
                            </p>
                            {p.notes && <p className="text-green-600 dark:text-green-400 text-[10px] mt-0.5">{p.notes}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                            {proofUrls.length > 0 && proofUrls.map((proofUrl, proofIndex) => (
                                <a
                                  key={`${p.id}-${proofIndex}`}
                                  href={proofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-green-700 dark:text-green-300 underline text-[10px]"
                                >
                                  {proofUrls.length > 1 ? `Proof ${proofIndex + 1}` : "View Proof"}
                                </a>
                              ))}
                            {canDeletePayments && isPaymentDeletable(p, detailOrder.status) && (
                              <button
                                type="button"
                                onClick={() => setDeletePaymentId(p.id)}
                                className="p-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                                title="Delete proof"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
                {(() => {
                  const submittedTotal = getOrderAmountPaid(detailOrder)
                  return (
                    <>
                <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-green-200 dark:border-green-800">
                  <span className="text-green-900 dark:text-green-100">Total Paid (submitted)</span>
                  <span className="text-green-900 dark:text-green-100">PKR {submittedTotal.toLocaleString()}</span>
                </div>
                {submittedTotal < detailOrder.total && (
                  <div className="flex items-center justify-between text-xs font-bold text-orange-700 dark:text-orange-300">
                    <span>Remaining</span>
                    <span>PKR {creditBalance.toLocaleString()}</span>
                  </div>
                )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}
          </div>
          </div>

          {(detailOrder.cashbackPayments?.length ?? 0) > 0 && (
            <div className="rounded-lg border bg-violet-50 dark:bg-violet-950/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[9px] font-bold uppercase tracking-widest text-violet-900 dark:text-violet-100 flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5" />
                  Cashback
                </p>
                {canManageCashback && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-violet-300 text-violet-700 hover:bg-violet-100 cursor-pointer"
                    onClick={() => setShowCashback(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add cashback
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-violet-800 dark:text-violet-200">
                <div>
                  <p className="font-bold uppercase text-[10px]">Total</p>
                  <p className="mt-0.5 font-medium">PKR {cashbackAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                {cashbackFromOrder > 0 && (
                  <div>
                    <p className="font-bold uppercase text-[10px]">From order</p>
                    <p className="mt-0.5 font-medium">PKR {cashbackFromOrder.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
                {cashbackOther > 0 && (
                  <div>
                    <p className="font-bold uppercase text-[10px]">Goodwill bonus</p>
                    <p className="mt-0.5 font-medium">PKR {cashbackOther.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2 pt-1 border-t border-violet-200 dark:border-violet-800">
                {detailOrder.cashbackPayments!.map((p, i) => {
                  const proofs = getOrderCashbackPaymentProofUrls(p)
                  const canDeleteCb = canManageCashback && isCashbackDeletable(detailOrder)
                  return (
                    <div key={p.id} className="flex items-start justify-between gap-2 text-xs">
                      <div>
                        <p className="font-medium text-violet-900 dark:text-violet-100">
                          {p.source === "other" ? "Bonus" : "From order"} {i + 1}: PKR {p.amount.toLocaleString()} · {p.method} ·{" "}
                          {new Date(p.date).toLocaleDateString()}
                        </p>
                        {p.notes && (
                          <p className="text-violet-700 dark:text-violet-300 text-[10px] mt-0.5">{p.notes}</p>
                        )}
                        <p className="text-violet-600 dark:text-violet-400 text-[10px] mt-0.5">By {p.createdBy}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {proofs.map((url, idx) => (
                          <a
                            key={`${p.id}-${idx}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline text-violet-700 dark:text-violet-300 text-[10px]"
                          >
                            {proofs.length > 1 ? `Attachment ${idx + 1}` : "View attachment"}
                          </a>
                        ))}
                        {canDeleteCb && (
                          <button
                            type="button"
                            onClick={() => setDeleteCashbackId(p.id)}
                            className="p-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                            title="Delete cashback"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-1.5 px-3 sm:px-4 py-2.5 border-t bg-[hsl(var(--muted))]/20 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {canEditOrder && (
            <Button size="sm" variant="outline" className="h-8 w-full sm:w-auto text-xs cursor-pointer" onClick={() => setShowEdit(true)}>
              <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
          {canFinalize && (
            <Button size="sm" className="h-8 text-xs bg-green-400 hover:bg-green-500 text-white cursor-pointer" onClick={() => setShowFinalize(true)}>
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Finalize
            </Button>
          )}
              {canManagePayments && (
                <Button size="sm" className="h-8 text-xs bg-blue-400 hover:bg-blue-500 text-white cursor-pointer" onClick={() => setShowPayment(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {detailOrder.payments?.length ? "Manage payments" : hasOutstandingCredit(detailOrder) ? "Record payment" : "Add payment"}
                </Button>
              )}
              {canManageCashback && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-violet-300 text-violet-700 hover:bg-violet-50 cursor-pointer"
                  onClick={() => setShowCashback(true)}
                >
                  <Gift className="h-3.5 w-3.5 mr-1.5" />
                  Cashback
                </Button>
              )}
              {canAddFreeItem && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                  onClick={() => setShowFreeItem(true)}
                >
                  <Gift className="h-3.5 w-3.5 mr-1.5" />
                  Free item
                </Button>
              )}
          {canReturn && (
            <Button
              size="sm"
              className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
              onClick={() => setShowReturn(true)}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              {hasReturns ? "Return more" : "Return"}
            </Button>
          )}
          {canManageReturnPayments && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs cursor-pointer border-orange-300 text-orange-800 hover:bg-orange-50"
              onClick={() => setShowReturnPayment(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Return payment
            </Button>
          )}
          {canEditInvoice && (
            <Button
              size="sm"
              variant="outline"
              className="h-10 text-sm cursor-pointer"
              onClick={() => setShowInvoiceEdit(true)}
            >
              <Edit className="h-4 w-4 mr-2" /> Edit invoice
            </Button>
          )}
          {showInvoiceActions && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-10 p-0 cursor-pointer"
                onClick={viewInvoice}
                disabled={!!invoiceLoading}
                title="View Invoice"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-10 p-0 cursor-pointer"
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
          <Button size="sm" variant="outline" className="h-10 w-full sm:w-auto text-sm sm:ml-auto cursor-pointer" onClick={onClose}>Close</Button>
          <Button size="sm" className="h-10 w-full sm:w-auto text-sm bg-red-400 hover:bg-red-500 text-white cursor-pointer" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
            <Trash2 className="h-4 w-4 mr-2" /> {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
    </>
      )}

      <ConfirmDialog
        isOpen={showStartWarrantiesConfirm}
        title="Start all warranties?"
        message={`Start the 5+5 year replacement warranty today for all scanned units on ${detailOrder.orderNumber}? Warranty name will be ${savedWarrantyName || "—"}. Already-started units are skipped. This cannot be undone without a warranty reset.`}
        confirmText={startingWarranties ? "Starting…" : "Start all warranties"}
        cancelText="Cancel"
        variant="warning"
        onConfirm={() => void handleStartOrderWarranties()}
        onCancel={() => !startingWarranties && setShowStartWarrantiesConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Order"
        message={`Are you sure you want to delete this order? Order ${detailOrder.orderNumber} will be permanently removed and any inventory deductions will be restored.`}
        confirmText="Delete Order"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        isOpen={deletePaymentId !== null}
        title="Delete payment record"
        message="Remove this payment or proof from the order? The order, items, and delivery details will stay — only this payment entry is deleted."
        confirmText={deletingPayment ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deletePaymentId && handleDeletePayment(deletePaymentId)}
        onCancel={() => !deletingPayment && setDeletePaymentId(null)}
      />

      <ConfirmDialog
        isOpen={deleteReturnPaymentId !== null}
        title="Delete refund"
        message="Remove this return payment (refund)? Order balance and finance stats will update. Returned items and stock restoration stay unchanged."
        confirmText={deletingReturnPayment ? "Deleting..." : "Delete refund"}
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deleteReturnPaymentId && handleDeleteReturnPayment(deleteReturnPaymentId)}
        onCancel={() => !deletingReturnPayment && setDeleteReturnPaymentId(null)}
      />

      <ConfirmDialog
        isOpen={deleteCashbackId !== null}
        title="Delete cashback"
        message="Remove this cashback / bonus? Order balance and finance money-out stats will update."
        confirmText={deletingCashback ? "Deleting..." : "Delete cashback"}
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deleteCashbackId && handleDeleteCashback(deleteCashbackId)}
        onCancel={() => !deletingCashback && setDeleteCashbackId(null)}
      />
    </>
  )
}
