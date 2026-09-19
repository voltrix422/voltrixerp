import { getCrmItemsTotalQty } from "@/lib/crm-line-items-summary"
import { approvedBalancePaymentAmount } from "@/lib/finance-overview"
import {
  STATUS_LABELS,
  getOrderAmountPaid,
  getOrderCreditBalance,
  getOrderSourcePdfLabel,
  hasOutstandingCredit,
  isOrderOnCredit,
  isOrderReturned,
  type Order,
  type OrderItem,
} from "@/lib/orders"
import { aggregateOrderPaymentStats } from "@/lib/order-payment-stats"
import { dateRangeLabel, downloadPlainReportPdf, pct, type PlainTable } from "@/lib/plain-report-pdf"

function pkr(n: number) {
  return `PKR\u00A0${Number(n || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function shortDate(value?: string) {
  const raw = String(value || "").trim()
  if (!raw) return "—"
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1].slice(2)}`
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  const dd = String(parsed.getDate()).padStart(2, "0")
  const mm = String(parsed.getMonth() + 1).padStart(2, "0")
  const yy = String(parsed.getFullYear()).slice(2)
  return `${dd}/${mm}/${yy}`
}

function compactItems(items: OrderItem[] | undefined) {
  if (!items?.length) return "—"
  return items
    .map((item) => {
      const name = item.description || item.model || "Item"
      const qty = item.qty > 0 ? `${item.qty}× ` : ""
      return `${qty}${name}`
    })
    .join("\n")
}

function paymentLabel(order: Order) {
  if (hasOutstandingCredit(order)) return "On Credit"
  if (!isOrderOnCredit(order)) return "Not Credit"
  return "Paid"
}

function prettyMethod(value: string) {
  const v = String(value || "—").trim()
  if (!v) return "—"
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function paymentMethods(orders: Order[]) {
  const totals = new Map<string, number>()
  for (const order of orders) {
    if (isOrderReturned(order)) continue
    for (const payment of order.payments || []) {
      const amount = approvedBalancePaymentAmount(payment, order.status)
      if (amount <= 0.004) continue
      const method = prettyMethod(payment.method || "Other")
      totals.set(method, (totals.get(method) || 0) + amount)
    }
  }
  return [...totals.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export async function downloadCrmOrdersReportPdf(
  orders: Order[],
  opts?: {
    dateFrom?: string
    dateTo?: string
    exportedBy?: string
    salesAgentUserIds?: ReadonlySet<string>
    clientName?: string
    includeOutstanding?: boolean
  },
) {
  const stats = aggregateOrderPaymentStats(orders)
  const totalQty = orders.reduce((sum, order) => sum + getCrmItemsTotalQty(order.items), 0)
  const moneyReceived = stats.totalReceived
  const outstanding = stats.totalOutstanding
  const headline = opts?.includeOutstanding ? moneyReceived + outstanding : moneyReceived
  const methods = paymentMethods(orders)
  const methodTotal = methods.reduce((sum, row) => sum + row.amount, 0)
  const range = dateRangeLabel(opts?.dateFrom || "", opts?.dateTo || "")
  const sourceOpts = opts?.salesAgentUserIds ? { salesAgentUserIds: opts.salesAgentUserIds } : undefined

  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const breakdownRows: (string | number)[][] = [
    [
      `Delivered fully paid (${stats.deliveredFullyPaidCount})`,
      pkr(stats.deliveredFullyPaidReceived),
    ],
    [`Partial payments (${stats.partialPaymentCount})`, pkr(stats.partialPaymentsReceived)],
  ]
  if (stats.otherPaymentsReceived > 0.004) {
    breakdownRows.push(["Confirmed / in progress", pkr(stats.otherPaymentsReceived)])
  }
  if (stats.creditPaymentsReceived > 0.004) {
    breakdownRows.push(["Credit installments", pkr(stats.creditPaymentsReceived)])
  }
  if (stats.approvedUnpaidCount > 0) {
    breakdownRows.push([
      `Approved awaiting payment (${stats.approvedUnpaidCount})`,
      pkr(stats.approvedUnpaidOutstanding),
    ])
  }

  const tables: PlainTable[] = [
    {
      title: "Money received",
      columns: [
        { header: "Item", width: 120 },
        { header: "Amount", align: "right", width: 66 },
      ],
      rows: [
        ["Money received", pkr(moneyReceived)],
        ["Still outstanding", pkr(outstanding)],
        ...(opts?.includeOutstanding
          ? [["Received + outstanding", pkr(headline)]]
          : []),
        ["Orders in view", String(orders.length)],
      ],
    },
    {
      title: "Order summary",
      columns: [
        { header: "Item", width: 120 },
        { header: "Amount", align: "right", width: 66 },
      ],
      rows: [
        ["ERP orders", String(orders.length)],
        ["Order value", pkr(stats.totalOrderValue)],
        ["Total qty", `${totalQty} pcs`],
        ["Returned", String(stats.returnedCount)],
        ["On credit", `${stats.creditOrderCount} · ${pkr(stats.creditOutstanding)}`],
      ],
    },
    {
      title: "Breakdown",
      columns: [
        { header: "Item", width: 120 },
        { header: "Amount", align: "right", width: 66 },
      ],
      rows: breakdownRows,
      foot: ["Total received", pkr(moneyReceived)],
    },
  ]

  if (methods.length) {
    tables.push({
      title: "Payments by method",
      newPage: true,
      columns: [
        { header: "Method", width: 100 },
        { header: "Amount", align: "right", width: 46 },
        { header: "%", align: "right", width: 40 },
      ],
      rows: methods.map((row) => [row.method, pkr(row.amount), pct(row.amount, methodTotal)]),
      foot: ["Total", pkr(methodTotal), "100%"],
    })
  }

  tables.push({
    title: "ERP client orders",
    newPage: true,
    columns: [
      { header: "Date", width: 22, minWidth: 22 },
      { header: "Order", width: 24 },
      { header: "Client", width: 30 },
      { header: "Items", width: 42, small: true },
      { header: "Payment", width: 24, small: true },
      { header: "Total", align: "right", width: 28 },
      { header: "Paid", align: "right", width: 28 },
      { header: "Credit", align: "right", width: 26 },
    ],
    rows: orders.map((order) => {
      const paid = getOrderAmountPaid(order)
      const credit = getOrderCreditBalance(order)
      const client = [order.clientName || "—"]
      const source = getOrderSourcePdfLabel(order, sourceOpts)
      if (source) client.push(source)
      if (order.warrantyHolderName?.trim()) client.push(`W: ${order.warrantyHolderName.trim()}`)
      return [
        shortDate(order.createdAt),
        order.orderNumber || "—",
        client.join("\n"),
        compactItems(order.items),
        `${paymentLabel(order)}\n${STATUS_LABELS[order.status] || order.status}`,
        pkr(order.total || 0),
        pkr(paid),
        pkr(credit),
      ]
    }),
    foot: [
      "",
      "",
      "",
      `${orders.length}`,
      "",
      pkr(orders.reduce((sum, order) => sum + (order.total || 0), 0)),
      pkr(moneyReceived),
      pkr(outstanding),
    ],
  })

  const meta = [
    "ERP client orders only · Branch POS excluded",
    opts?.clientName ? `Client  ${opts.clientName}` : "",
    opts?.exportedBy ? `Exported by  ${opts.exportedBy}` : "",
    `Generated  ${generated}  (Pakistan time)`,
    `Money received  ${pkr(moneyReceived)}      Outstanding  ${pkr(outstanding)}`,
  ].filter(Boolean)

  const from = opts?.dateFrom || "all"
  const to = opts?.dateTo || "all"

  await downloadPlainReportPdf({
    title: "CRM orders report",
    subtitle: range,
    meta,
    filename: `crm-orders-${from}-to-${to}.pdf`,
    pagePerTable: false,
    tables,
  })
}
