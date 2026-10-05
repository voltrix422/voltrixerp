import { getCrmItemsTotalQty } from "@/lib/crm-line-items-summary"
import {
  crmOrdersReportMoney,
  crmPeriodBounds,
  orderLastPaymentInPeriod,
  orderPeriodPaymentLines,
  orderReceivedInPeriod,
} from "@/lib/crm-order-period"
import {
  getBalanceSubmittedPayments,
  getOrderAmountPaid,
  getOrderCreditBalance,
  getOrderNetSalesValue,
  hasOutstandingCredit,
  isOrderOnCredit,
  type Order,
  type OrderItem,
} from "@/lib/orders"
import { dateRangeLabel, downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"

export type CrmOrdersPdfClient = {
  name: string
  company?: string
  phone?: string
  email?: string
  ntn?: string
  address?: string
  city?: string
}

function amt(n: number) {
  return Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })
}

function shortDate(value?: string | Date) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "—"
    const dd = String(value.getDate()).padStart(2, "0")
    const mm = String(value.getMonth() + 1).padStart(2, "0")
    const yy = String(value.getFullYear()).slice(2)
    return `${dd}/${mm}/${yy}`
  }
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

/** Full product names on one compact line — no mid-word wrapping. */
function fullItems(items: OrderItem[] | undefined) {
  if (!items?.length) return "—"
  return items
    .map((item) => {
      const name = String(item.description || item.model || "Item")
        .replace(/\s+/g, " ")
        .trim()
      const qty = item.qty > 0 ? `${item.qty}× ` : ""
      return `${qty}${name}`
    })
    .join("; ")
}

function paymentLabel(order: Order) {
  if (order.status === "payment_added") return "Pend"
  if (order.status === "returned") return "Ret"
  if (hasOutstandingCredit(order)) return "Credit"
  if (!isOrderOnCredit(order) || getOrderCreditBalance(order) <= 0.004) return "Paid"
  return "Paid"
}

/** Paid cell: period payments when a date range is set, otherwise lifetime. */
function paidWithDates(order: Order, dateFrom?: string, dateTo?: string) {
  const bounds = crmPeriodBounds(dateFrom, dateTo)
  if (bounds) {
    const lines = orderPeriodPaymentLines(order, bounds.start, bounds.end).map(
      (p) => `${amt(p.amount)} · ${shortDate(p.date)}`,
    )
    const paid = orderReceivedInPeriod(order, bounds.start, bounds.end)
    if (!lines.length) return paid > 0.004 ? amt(paid) : "0"
    if (lines.length === 1) return lines[0]
    return `Total ${amt(paid)}; ${lines.join("; ")}`
  }

  const paid = getOrderAmountPaid(order)
  const lines = getBalanceSubmittedPayments(order.payments, order.status)
    .filter((p) => (Number(p.amount) || 0) > 0.004)
    .map((p) => `${amt(p.amount)} · ${shortDate(p.date || p.createdAt)}`)

  if (!lines.length) return paid > 0.004 ? amt(paid) : "0"
  if (lines.length === 1) return lines[0]
  return `Total ${amt(paid)}; ${lines.join("; ")}`
}

function clientDetailRows(clients: CrmOrdersPdfClient[]): (string | number)[][] {
  const rows: (string | number)[][] = []
  clients.forEach((client, index) => {
    if (clients.length > 1) {
      rows.push([`Client ${index + 1}`, client.name || "—"])
    } else {
      rows.push(["Name", client.name || "—"])
    }
    if (client.company?.trim()) rows.push(["Company", client.company.trim()])
    if (client.phone?.trim()) rows.push(["Phone", client.phone.trim()])
    if (client.email?.trim()) rows.push(["Email", client.email.trim()])
    if (client.ntn?.trim()) rows.push(["NTN", client.ntn.trim()])
    const place = [client.address, client.city].map((s) => String(s || "").trim()).filter(Boolean).join(", ")
    if (place) rows.push(["Address", place])
    if (clients.length > 1 && index < clients.length - 1) {
      rows.push(["", ""])
    }
  })
  return rows
}

export async function downloadCrmOrdersReportPdf(
  orders: Order[],
  opts?: {
    dateFrom?: string
    dateTo?: string
    exportedBy?: string
    salesAgentUserIds?: ReadonlySet<string>
    clientName?: string
    clients?: CrmOrdersPdfClient[]
    includeOutstanding?: boolean
  },
) {
  const money = crmOrdersReportMoney(orders, opts?.dateFrom, opts?.dateTo)
  const bounds = crmPeriodBounds(opts?.dateFrom, opts?.dateTo)
  const totalQty = orders.reduce((sum, order) => sum + getCrmItemsTotalQty(order.items), 0)
  const moneyReceived = money.moneyReceived
  const outstanding = money.outstanding
  const orderValue = money.orderValue
  const range = dateRangeLabel(opts?.dateFrom || "", opts?.dateTo || "")
  const clients = (opts?.clients || []).filter((c) => c.name?.trim())

  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const tables: PlainTable[] = []

  if (clients.length > 0) {
    tables.push({
      title: clients.length > 1 ? `Client details · ${clients.length} clients` : "Client details",
      columns: [
        { header: "Field", width: 42, minWidth: 36 },
        { header: "Detail", width: 144 },
      ],
      rows: clientDetailRows(clients),
    })
  } else if (opts?.clientName?.trim()) {
    tables.push({
      title: "Client details",
      columns: [
        { header: "Field", width: 42, minWidth: 36 },
        { header: "Detail", width: 144 },
      ],
      rows: [["Name", opts.clientName.trim()]],
    })
  }

  tables.push({
    title: "Totals",
    sectionStart: "Money in",
    columns: [
      { header: "Item", width: 120 },
      { header: "Amount", align: "right", width: 66 },
    ],
    rows: [
      ["Total order value", pkr(orderValue)],
      [money.periodScoped ? "Received in period" : "Received", pkr(moneyReceived)],
      ["Outstanding", pkr(outstanding)],
      ["Total order qty", `${totalQty} pcs`],
      ["Orders", String(orders.length)],
    ],
  })

  tables.push({
    title: money.periodScoped ? "ERP client payments received" : "ERP client orders",
    columns: [
      { header: "Date", width: 15, minWidth: 14 },
      { header: "Order", width: 18, minWidth: 16 },
      { header: "Client", width: 26, minWidth: 22 },
      { header: "Items", width: 72, minWidth: 58 },
      { header: "Pay", width: 12, minWidth: 11 },
      { header: "Order total", align: "right", width: 18, minWidth: 16 },
      { header: money.periodScoped ? "Received" : "Paid", align: "right", width: 22, minWidth: 18 },
      { header: "Credit", align: "right", width: 16, minWidth: 14 },
    ],
    rows: orders.map((order) => {
      const credit = getOrderCreditBalance(order)
      const by = order.createdBy?.trim()
      const client = by ? `${order.clientName || "—"} · ${by}` : order.clientName || "—"
      const paymentDate = bounds ? orderLastPaymentInPeriod(order, bounds.start, bounds.end) : null
      return [
        shortDate(paymentDate || order.createdAt),
        order.orderNumber || "—",
        client,
        fullItems(order.items),
        paymentLabel(order),
        amt(getOrderNetSalesValue(order)),
        paidWithDates(order, opts?.dateFrom, opts?.dateTo),
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
  })

  const clientLabel =
    clients.length > 1
      ? `${clients.length} clients`
      : clients[0]?.name || opts?.clientName || ""

  const meta = [
    clientLabel
      ? `ERP orders only · ${clientLabel}${opts?.exportedBy ? ` · ${opts.exportedBy}` : ""}`
      : `ERP orders only · Branch POS excluded${opts?.exportedBy ? ` · ${opts.exportedBy}` : ""}`,
    money.periodScoped
      ? `Generated  ${generated}  (Pakistan time) · Received in period ${pkr(moneyReceived)} · Due ${pkr(outstanding)}`
      : `Generated  ${generated}  (Pakistan time) · Received ${pkr(moneyReceived)} · Due ${pkr(outstanding)}`,
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
