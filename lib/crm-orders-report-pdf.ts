import { getCrmItemsTotalQty } from "@/lib/crm-line-items-summary"
import { approvedBalancePaymentAmount } from "@/lib/finance-overview"
import {
  getOrderAmountPaid,
  getOrderCreditBalance,
  hasOutstandingCredit,
  isOrderOnCredit,
  isOrderReturned,
  type Order,
  type OrderItem,
} from "@/lib/orders"
import { aggregateOrderPaymentStats } from "@/lib/order-payment-stats"
import { dateRangeLabel, downloadPlainReportPdf, pct, pkr, type PlainTable } from "@/lib/plain-report-pdf"

function amt(n: number) {
  return Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })
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

function shortItemName(item: OrderItem) {
  const model = String(item.model || "").trim()
  if (model && !/^MAN-/i.test(model)) return model
  const desc = String(item.description || model || "Item").replace(/\s+/g, " ").trim()
  const paren = desc.match(/\(([^)]+)\)/)
  if (paren?.[1]) return paren[1].replace(/\s+/g, "")
  return desc
    .replace(/lithium iron phosphate battery/i, "LFP")
    .replace(/lithium-ion battery/i, "Li-ion")
    .replace(/battery storage/i, "kWh")
    .replace(/hybrid inverter/i, "Hybrid")
    .replace(/inverter/i, "Inv")
    .slice(0, 26)
}

function compactItems(items: OrderItem[] | undefined) {
  if (!items?.length) return "—"
  return items
    .map((item) => {
      const qty = item.qty > 0 ? `${item.qty}×` : ""
      return `${qty}${shortItemName(item)}`.trim()
    })
    .join(" · ")
}

function paymentLabel(order: Order) {
  if (order.status === "payment_added") return "Pend"
  if (order.status === "returned") return "Ret"
  if (hasOutstandingCredit(order)) return "Credit"
  if (!isOrderOnCredit(order) || getOrderCreditBalance(order) <= 0.004) return "Paid"
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
  const orderValue = orders.reduce((sum, order) => sum + (order.total || 0), 0)

  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const summaryRows: (string | number)[][] = [
    ["Money received", pkr(moneyReceived)],
    ["Still outstanding", pkr(outstanding)],
    ...(opts?.includeOutstanding ? [["Received + outstanding", pkr(headline)]] : []),
    ["Orders / qty", `${orders.length} · ${totalQty} pcs`],
    ["Order value", pkr(stats.totalOrderValue || orderValue)],
    ["On credit", `${stats.creditOrderCount} · ${pkr(stats.creditOutstanding)}`],
  ]
  if (stats.deliveredFullyPaidCount) {
    summaryRows.push([
      `Delivered paid (${stats.deliveredFullyPaidCount})`,
      pkr(stats.deliveredFullyPaidReceived),
    ])
  }
  if (stats.partialPaymentCount) {
    summaryRows.push([`Part paid (${stats.partialPaymentCount})`, pkr(stats.partialPaymentsReceived)])
  }
  if (stats.otherPaymentsReceived > 0.004) {
    summaryRows.push(["In progress", pkr(stats.otherPaymentsReceived)])
  }
  if (stats.creditPaymentsReceived > 0.004) {
    summaryRows.push(["Credit installments", pkr(stats.creditPaymentsReceived)])
  }
  if (stats.returnedCount) {
    summaryRows.push(["Returned", String(stats.returnedCount)])
  }
  for (const row of methods) {
    summaryRows.push([`${row.method} (${pct(row.amount, methodTotal)})`, pkr(row.amount)])
  }

  const tables: PlainTable[] = [
    {
      title: "Summary",
      columns: [
        { header: "Item", width: 120 },
        { header: "Amount", align: "right", width: 66 },
      ],
      rows: summaryRows,
    },
    {
      title: "ERP client orders",
      columns: [
        { header: "Date", width: 16, minWidth: 16 },
        { header: "Order", width: 22, minWidth: 22 },
        { header: "Client", width: 32 },
        { header: "Items", width: 52, small: true },
        { header: "Pay", width: 14, minWidth: 14 },
        { header: "Total", align: "right", width: 28 },
        { header: "Paid", align: "right", width: 28 },
        { header: "Credit", align: "right", width: 26 },
      ],
      rows: orders.map((order) => {
        const paid = getOrderAmountPaid(order)
        const credit = getOrderCreditBalance(order)
        const by = order.createdBy?.trim()
        const client = by ? `${order.clientName || "—"} · ${by}` : order.clientName || "—"
        return [
          shortDate(order.createdAt),
          order.orderNumber || "—",
          client,
          compactItems(order.items),
          paymentLabel(order),
          amt(order.total || 0),
          amt(paid),
          amt(credit),
        ]
      }),
      foot: [
        "",
        "",
        "",
        String(orders.length),
        "",
        amt(orderValue),
        amt(moneyReceived),
        amt(outstanding),
      ],
    },
  ]

  const meta = [
    opts?.clientName
      ? `ERP orders only · ${opts.clientName} · ${opts.exportedBy || ""}`.trim()
      : `ERP orders only · Branch POS excluded${opts?.exportedBy ? ` · ${opts.exportedBy}` : ""}`,
    `Generated  ${generated}  (Pakistan time) · Received ${pkr(moneyReceived)} · Due ${pkr(outstanding)}`,
  ]

  const from = opts?.dateFrom || "all"
  const to = opts?.dateTo || "all"

  await downloadPlainReportPdf({
    title: "CRM orders report",
    subtitle: range,
    meta,
    filename: `crm-orders-${from}-to-${to}.pdf`,
    compact: true,
    pagePerTable: false,
    tables,
  })
}
