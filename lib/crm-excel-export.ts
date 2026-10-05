import type { Client } from "@/lib/crm"
import type { CrmLeadRow } from "@/lib/crm-leads"
import { buildLeadsExportCsv, type LeadsExportMeta } from "@/lib/csv-leads"
import type { Order, OrderItem } from "@/lib/orders"
import type { ClientLedgerPayload } from "@/lib/client-order-ledger"
import {
  getBalanceSubmittedPayments,
  getOrderAmountPaid,
  getOrderCreditBalance,
  getOrderNetSalesValue,
  hasOutstandingCredit,
  isOrderOnCredit,
} from "@/lib/orders"
import type { Quotation } from "@/lib/quotations"
import { STATUS_LABELS as QUOTATION_STATUS_LABELS } from "@/lib/quotations"
import { getCrmItemsTotalQty } from "@/lib/crm-line-items-summary"
import {
  crmOrdersReportMoney,
  crmPeriodBounds,
  orderLastPaymentInPeriod,
  orderPeriodPaymentLines,
  orderReceivedInPeriod,
} from "@/lib/crm-order-period"
import { dateRangeLabel, pkr } from "@/lib/plain-report-pdf"
import type { CrmOrdersPdfClient } from "@/lib/crm-orders-report-pdf"

export function escCsvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "").replace(/"/g, '""')
  if (/[,"\r\n]/.test(s)) return `"${s}"`
  return s
}

function downloadCsv(filename: string, csvBody: string) {
  if (typeof document === "undefined") return
  const blob = new Blob(["\ufeff" + csvBody], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function formatDate(iso?: string) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("en-PK")
  } catch {
    return iso
  }
}

function formatItemsLine(
  items: { description: string; qty: number; unit: string; unitPrice: number }[] | undefined
) {
  if (!items?.length) return ""
  return items
    .map(i => `${i.description} (${i.qty} ${i.unit} @ PKR ${i.unitPrice})`)
    .join("; ")
}

function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
  return [
    headers.map(h => escCsvCell(h)).join(","),
    ...rows.map(r => r.map(c => escCsvCell(c)).join(",")),
  ].join("\r\n")
}

function kvRow(label: string, value: string | number) {
  return `${escCsvCell(label)},${escCsvCell(value)}`
}

function blankLine() {
  return ""
}

function sectionTitle(title: string) {
  return escCsvCell(title)
}

function exportMetaHeader(exportedBy?: string) {
  if (!exportedBy?.trim()) return ""
  const when = new Date().toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })
  return `${escCsvCell("Exported by")},${escCsvCell(exportedBy.trim())}\r\n${escCsvCell("Export time")},${escCsvCell(when)}\r\n\r\n`
}

function shortDate(value?: string | Date | null) {
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

function amt(n: number) {
  return Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })
}

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
    .join("\n")
}

function paymentLabel(order: Order) {
  if (order.status === "payment_added") return "Pend"
  if (order.status === "returned") return "Ret"
  if (hasOutstandingCredit(order)) return "Credit"
  if (!isOrderOnCredit(order) || getOrderCreditBalance(order) <= 0.004) return "Paid"
  return "Paid"
}

function paidWithDates(order: Order, dateFrom?: string, dateTo?: string) {
  const bounds = crmPeriodBounds(dateFrom, dateTo)
  if (bounds) {
    const lines = orderPeriodPaymentLines(order, bounds.start, bounds.end).map(
      (p) => `${amt(p.amount)} · ${shortDate(p.date)}`,
    )
    const paid = orderReceivedInPeriod(order, bounds.start, bounds.end)
    if (!lines.length) return paid > 0.004 ? amt(paid) : "0"
    if (lines.length === 1) return lines[0]
    return [`Total ${amt(paid)}`, ...lines].join("\n")
  }

  const paid = getOrderAmountPaid(order)
  const lines = getBalanceSubmittedPayments(order.payments, order.status)
    .filter((p) => (Number(p.amount) || 0) > 0.004)
    .map((p) => `${amt(p.amount)} · ${shortDate(p.date || p.createdAt)}`)

  if (!lines.length) return paid > 0.004 ? amt(paid) : "0"
  if (lines.length === 1) return lines[0]
  return [`Total ${amt(paid)}`, ...lines].join("\n")
}

export type OrdersExcelOpts = {
  exportedBy?: string
  salesAgentUserIds?: ReadonlySet<string>
  dateFrom?: string
  dateTo?: string
  clientName?: string
  clients?: CrmOrdersPdfClient[]
}

/** Clean CRM Orders report Excel — same layout as the PDF. */
export function downloadOrdersExcel(orders: Order[], opts?: OrdersExcelOpts | string, salesAgentUserIds?: ReadonlySet<string>) {
  const options: OrdersExcelOpts =
    typeof opts === "string"
      ? { exportedBy: opts, salesAgentUserIds }
      : { ...(opts || {}), salesAgentUserIds: opts?.salesAgentUserIds ?? salesAgentUserIds }

  const money = crmOrdersReportMoney(orders, options.dateFrom, options.dateTo)
  const bounds = crmPeriodBounds(options.dateFrom, options.dateTo)
  const totalQty = orders.reduce((sum, order) => sum + getCrmItemsTotalQty(order.items), 0)
  const moneyReceived = money.moneyReceived
  const outstanding = money.outstanding
  const orderValue = money.orderValue
  const range = dateRangeLabel(options.dateFrom || "", options.dateTo || "")
  const clients = (options.clients || []).filter((c) => c.name?.trim())
  const clientLabel =
    clients.length > 1
      ? `${clients.length} clients`
      : clients[0]?.name || options.clientName || ""

  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const lines: string[] = []
  lines.push(escCsvCell("VOLTRIX BATTERIES PVT. LTD."))
  lines.push(escCsvCell("CRM ORDERS REPORT"))
  lines.push(blankLine())
  lines.push(kvRow("Period", range))
  lines.push(
    kvRow(
      "Scope",
      clientLabel
        ? `ERP orders only · ${clientLabel}${options.exportedBy ? ` · ${options.exportedBy}` : ""}`
        : `ERP orders only · Branch POS excluded${options.exportedBy ? ` · ${options.exportedBy}` : ""}`,
    ),
  )
  lines.push(
    kvRow(
      "Generated",
      money.periodScoped
        ? `${generated} (Pakistan time) · Received in period ${pkr(moneyReceived)} · Due ${pkr(outstanding)}`
        : `${generated} (Pakistan time) · Received ${pkr(moneyReceived)} · Due ${pkr(outstanding)}`,
    ),
  )
  lines.push(blankLine())

  if (clients.length > 0) {
    lines.push(sectionTitle(clients.length > 1 ? `Client details · ${clients.length} clients` : "Client details"))
    const detailRows: (string | number)[][] = []
    clients.forEach((client, index) => {
      if (clients.length > 1) detailRows.push([`Client ${index + 1}`, client.name || "—"])
      else detailRows.push(["Name", client.name || "—"])
      if (client.company?.trim()) detailRows.push(["Company", client.company.trim()])
      if (client.phone?.trim()) detailRows.push(["Phone", client.phone.trim()])
      if (client.email?.trim()) detailRows.push(["Email", client.email.trim()])
      if (client.ntn?.trim()) detailRows.push(["NTN", client.ntn.trim()])
      const place = [client.address, client.city].map((s) => String(s || "").trim()).filter(Boolean).join(", ")
      if (place) detailRows.push(["Address", place])
      if (clients.length > 1 && index < clients.length - 1) detailRows.push(["", ""])
    })
    lines.push(rowsToCsv(["Field", "Detail"], detailRows))
    lines.push(blankLine())
  } else if (options.clientName?.trim()) {
    lines.push(sectionTitle("Client details"))
    lines.push(rowsToCsv(["Field", "Detail"], [["Name", options.clientName.trim()]]))
    lines.push(blankLine())
  }

  lines.push(sectionTitle("Totals"))
  lines.push(
    rowsToCsv(
      ["Item", "Amount"],
      [
        ["Total order value", pkr(orderValue)],
        [money.periodScoped ? "Received in period" : "Received", pkr(moneyReceived)],
        ["Outstanding", pkr(outstanding)],
        ["Total order qty", `${totalQty} pcs`],
        ["Orders", String(orders.length)],
      ],
    ),
  )
  lines.push(blankLine())

  lines.push(sectionTitle(money.periodScoped ? "ERP client payments received" : "ERP client orders"))
  const orderHeaders = [
    "Date",
    "Order",
    "Client",
    "Items",
    "Pay",
    "Order total",
    money.periodScoped ? "Received" : "Paid",
    "Credit",
  ]
  const orderRows = orders.map((order) => {
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
      paidWithDates(order, options.dateFrom, options.dateTo),
      amt(getOrderCreditBalance(order)),
    ]
  })
  orderRows.push([
    "",
    "",
    "",
    String(orders.length),
    "",
    amt(orderValue),
    amt(moneyReceived),
    amt(outstanding),
  ])
  lines.push(rowsToCsv(orderHeaders, orderRows))
  lines.push(blankLine())
  lines.push(escCsvCell("Voltrix Batteries Pvt. Ltd."))

  const from = options.dateFrom || "all"
  const to = options.dateTo || "all"
  downloadCsv(`crm-orders-${from}-to-${to}.csv`, lines.join("\r\n"))
}

export function downloadQuotationsExcel(quotations: Quotation[], exportedBy?: string) {
  const headers = [
    "Quotation #",
    "Client",
    "Client ID",
    "Line Count",
    "Total Qty",
    "Line Items",
    "Subtotal",
    "Tax %",
    "Tax",
    "Transport",
    "Other Cost",
    "Discount",
    "Total (PKR)",
    "Status",
    "Valid Until",
    "Date",
    "Created By",
    "Sales Agent ID",
    "Delivery Address",
    "Notes",
    "Converted Order ID",
  ]
  const rows = quotations.map(q => [
    q.quotationNumber,
    q.clientName,
    q.clientId,
    q.items?.length ?? 0,
    getCrmItemsTotalQty(q.items),
    formatItemsLine(q.items),
    q.subtotal ?? 0,
    q.taxPercent ?? 0,
    q.tax ?? 0,
    q.transportCostValue ?? q.transportCost ?? 0,
    q.otherCostValue ?? q.otherCost ?? 0,
    q.discountValue ?? q.discount ?? 0,
    q.total ?? 0,
    QUOTATION_STATUS_LABELS[q.status] || q.status,
    formatDate(q.validUntil),
    formatDate(q.createdAt),
    q.createdBy,
    q.ownerUserId ?? "",
    q.deliveryAddress ?? "",
    q.notes ?? "",
    q.convertedToOrderId ?? "",
  ])
  const csv = exportMetaHeader(exportedBy) + rowsToCsv(headers, rows)
  downloadCsv(`quotations-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

const CLIENT_STATUS_LABELS: Record<Client["status"], string> = {
  active: "Active",
  pending_approval: "Pending Approval",
  rejected: "Rejected",
}

export type ClientSalesExportMeta = {
  totalSales?: number
  orderCount?: number
  salesRank?: number
}

function slugClientName(name: string): string {
  return name.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "client"
}

function clientProfileRows(c: Client, sales?: ClientSalesExportMeta): (string | number)[][] {
  const rows: (string | number)[][] = [
    ["Name", c.name],
    ["Company", c.company],
    ["Email", c.email],
    ["Phone", c.phone],
    ["Contact Person", c.contactPerson],
    ["Address", c.address],
    ["City", c.city],
    ["Country", c.country],
    ["Website", c.website],
    ["Tax ID", c.taxId],
    ["NTN", c.ntn],
    ["Industry", c.industry],
    ["Status", CLIENT_STATUS_LABELS[c.status] || c.status],
    ["Notes", c.notes],
    ["Created By", c.createdBy],
    ["Sales Agent ID", c.ownerUserId ?? ""],
    ["Created Date", formatDate(c.createdAt)],
  ]
  if (sales) {
    rows.push(
      ["Sales Rank", sales.salesRank ? `#${sales.salesRank}` : "—"],
      ["Delivered Orders", sales.orderCount ?? 0],
      ["Total Sales (PKR)", sales.totalSales ?? 0],
    )
  }
  return rows
}

function clientOrdersSection(orders: Order[]): string {
  if (!orders.length) return `${escCsvCell("Delivered Orders")},${escCsvCell("None")}\r\n`
  const headers = ["Order #", "Delivered", "Items", "Line Items", "Total (PKR)", "Dispatcher", "Notes"]
  const rows = orders.map((o) => [
    o.orderNumber,
    formatDate(o.fulfillmentDate || o.deliveryDate || o.createdAt),
    getCrmItemsTotalQty(o.items),
    formatItemsLine(o.items),
    o.total ?? 0,
    o.dispatcher || o.fulfillmentDispatcher || "",
    o.notes ?? "",
  ])
  return `\r\n${rowsToCsv(headers, rows)}\r\n`
}

export function downloadClientsExcel(
  clients: Client[],
  exportedBy?: string,
  salesByClientId?: Map<string, ClientSalesExportMeta>,
) {
  const headers = [
    "Sales Rank",
    "Name",
    "Company",
    "Email",
    "Phone",
    "Delivered Orders",
    "Total Sales (PKR)",
    "Contact Person",
    "Address",
    "City",
    "Country",
    "Website",
    "Tax ID",
    "NTN",
    "Industry",
    "Status",
    "Notes",
    "Created By",
    "Sales Agent ID",
    "Created Date",
  ]
  const rows = clients.map((c) => {
    const sales = salesByClientId?.get(c.id)
    return [
      sales?.salesRank ? `#${sales.salesRank}` : "—",
      c.name,
      c.company,
      c.email,
      c.phone,
      sales?.orderCount ?? 0,
      sales?.totalSales ?? 0,
      c.contactPerson,
      c.address,
      c.city,
      c.country,
      c.website,
      c.taxId,
      c.ntn,
      c.industry,
      CLIENT_STATUS_LABELS[c.status] || c.status,
      c.notes,
      c.createdBy,
      c.ownerUserId ?? "",
      formatDate(c.createdAt),
    ]
  })
  const csv = exportMetaHeader(exportedBy) + rowsToCsv(headers, rows)
  downloadCsv(`clients-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export function downloadClientDetailExcel(
  client: Client,
  orders: Order[],
  exportedBy?: string,
  sales?: ClientSalesExportMeta,
) {
  let csv = exportMetaHeader(exportedBy)
  csv += `${escCsvCell("Client Detail Export")},${escCsvCell(client.name)}\r\n\r\n`
  csv += rowsToCsv(["Field", "Value"], clientProfileRows(client, sales))
  csv += clientOrdersSection(orders)
  downloadCsv(`client-${slugClientName(client.name)}-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export function downloadAllClientsDetailExcel(
  clients: Client[],
  orders: Order[],
  exportedBy?: string,
  salesByClientId?: Map<string, ClientSalesExportMeta>,
) {
  let csv = exportMetaHeader(exportedBy)
  csv += `${escCsvCell("All Clients Detail Export")},${escCsvCell(String(clients.length))} clients\r\n\r\n`

  for (const client of clients) {
    const clientOrders = orders.filter((o) => o.clientId === client.id && o.status === "delivered")
    const sales = salesByClientId?.get(client.id)
    csv += `${escCsvCell("CLIENT")},${escCsvCell(client.name)}\r\n`
    csv += rowsToCsv(["Field", "Value"], clientProfileRows(client, sales))
    csv += clientOrdersSection(clientOrders)
    csv += "\r\n"
  }

  downloadCsv(`all-clients-detail-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export function downloadLeadsExcel(leads: CrmLeadRow[], meta?: LeadsExportMeta) {
  const csv = buildLeadsExportCsv(leads, meta)
  downloadCsv(`leads-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export function downloadClientLedgerExcel(payload: ClientLedgerPayload) {
  const { client, stats } = payload
  const lines: string[] = []
  lines.push(exportMetaHeader(payload.generatedBy).trimEnd())
  lines.push("")
  const combined = (payload.clients?.length || 0) > 1
  lines.push([escCsvCell(combined ? "COMBINED CLIENT LEDGER" : "CLIENT LEDGER"), escCsvCell(client.name)].join(","))
  lines.push([escCsvCell("Generated"), escCsvCell(payload.generatedAt)].join(","))
  lines.push("")
  lines.push(
    rowsToCsv(
      ["Field", "Value"],
      combined
        ? [
            ["Clients", payload.clients.length],
            ["Names", payload.clients.map((c) => c.name).join(" · ")],
          ]
        : [
            ["Name", client.name],
            ["Company", client.company],
            ["Contact person", client.contactPerson],
            ["Phone", client.phone],
            ["Email", client.email],
            ["NTN", client.ntn],
            ["Address", [client.address, client.city, client.country].filter(Boolean).join(", ")],
          ],
    ),
  )
  lines.push("")
  lines.push(
    rowsToCsv(
      ["Summary", "Amount / count"],
      [
        ["Orders", payload.orders.length],
        ["Billed (PKR)", stats.totalOrderValue],
        ["Paid / received (PKR)", stats.totalReceived],
        ["Outstanding (PKR)", stats.totalOutstanding],
        ["Fully paid orders", payload.fullyPaidCount],
        ["Partial orders", payload.partialCount],
        ["Returned orders", stats.returnedCount],
        ["Partial received (PKR)", stats.partialPaymentsReceived],
        ["Still owed (PKR)", stats.creditOutstanding],
        ["Refunds (PKR)", stats.returnedRefundAmount],
        ["Cashback (PKR)", stats.cashbackAmount],
      ],
    ),
  )
  lines.push("")
  lines.push(
    rowsToCsv(
      combined
        ? ["Order #", "Date", "Client", "Status", "Qty", "Items", "Total (PKR)", "Paid (PKR)", "Balance (PKR)", "Payment", "Created by", "Notes"]
        : ["Order #", "Date", "Status", "Qty", "Items", "Total (PKR)", "Paid (PKR)", "Balance (PKR)", "Payment", "Created by", "Notes"],
      payload.orders.map((row) =>
        combined
          ? [
              row.orderNumber,
              row.date,
              row.clientName,
              row.status,
              row.qtyLabel,
              row.items,
              row.billed,
              row.paid,
              row.balance,
              row.paymentLabel,
              row.createdBy,
              row.notes,
            ]
          : [
              row.orderNumber,
              row.date,
              row.status,
              row.qtyLabel,
              row.items,
              row.billed,
              row.paid,
              row.balance,
              row.paymentLabel,
              row.createdBy,
              row.notes,
            ],
      ),
    ),
  )
  lines.push("")
  lines.push(
    rowsToCsv(
      ["Date", "Order #", "Type", "Method", "Amount (PKR)", "Status", "Notes"],
      payload.payments.length
        ? payload.payments.map((row) => [
            row.date,
            row.orderNumber,
            row.type,
            row.method,
            row.amount,
            row.status,
            row.notes,
          ])
        : [["—", "", "No payments recorded", "", "", "", ""]],
    ),
  )
  const fileLabel = combined ? `combined-${payload.clients.length}` : slugClientName(client.name)
  downloadCsv(`client-ledger-${fileLabel}-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\r\n"))
}
