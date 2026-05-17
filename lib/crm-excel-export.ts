import type { Client } from "@/lib/crm"
import type { CrmLeadRow } from "@/lib/crm-leads"
import { buildLeadsExportCsv, type LeadsExportMeta } from "@/lib/csv-leads"
import type { Order } from "@/lib/orders"
import { STATUS_LABELS as ORDER_STATUS_LABELS, getOrderSourcePdfLabel } from "@/lib/orders"
import type { Quotation } from "@/lib/quotations"
import { STATUS_LABELS as QUOTATION_STATUS_LABELS } from "@/lib/quotations"
import { getCrmItemsTotalQty } from "@/lib/crm-line-items-summary"

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

function exportMetaHeader(exportedBy?: string) {
  if (!exportedBy?.trim()) return ""
  const when = new Date().toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })
  return `${escCsvCell("Exported by")},${escCsvCell(exportedBy.trim())}\r\n${escCsvCell("Export time")},${escCsvCell(when)}\r\n\r\n`
}

export function downloadOrdersExcel(orders: Order[], exportedBy?: string) {
  const headers = [
    "Order #",
    "Source",
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
    "Shipping",
    "Discount",
    "Total (PKR)",
    "Status",
    "Date",
    "Created By",
    "Sales Agent ID",
    "Delivery Address",
    "Delivery Date",
    "Notes",
    "Dispatcher",
    "Payments Count",
  ]
  const rows = orders.map(o => [
    o.orderNumber,
    getOrderSourcePdfLabel(o),
    o.clientName,
    o.clientId,
    o.items?.length ?? 0,
    getCrmItemsTotalQty(o.items),
    formatItemsLine(o.items),
    o.subtotal ?? 0,
    o.taxPercent ?? 0,
    o.tax ?? 0,
    o.transportCostValue ?? o.transportCost ?? 0,
    o.otherCostValue ?? o.otherCost ?? 0,
    o.shipping ?? 0,
    o.discountValue ?? o.discount ?? 0,
    o.total ?? 0,
    ORDER_STATUS_LABELS[o.status] || o.status,
    formatDate(o.createdAt),
    o.createdBy,
    o.ownerUserId ?? "",
    o.deliveryAddress ?? "",
    o.deliveryDate ?? "",
    o.notes ?? "",
    o.dispatcher || o.fulfillmentDispatcher || "",
    (o.payments || []).length,
  ])
  const csv = exportMetaHeader(exportedBy) + rowsToCsv(headers, rows)
  downloadCsv(`orders-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
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

export function downloadClientsExcel(clients: Client[], exportedBy?: string) {
  const headers = [
    "Name",
    "Company",
    "Email",
    "Phone",
    "Contact Person",
    "Address",
    "City",
    "Country",
    "Website",
    "Tax ID",
    "Industry",
    "Status",
    "Notes",
    "Created By",
    "Sales Agent ID",
    "Created Date",
  ]
  const rows = clients.map(c => [
    c.name,
    c.company,
    c.email,
    c.phone,
    c.contactPerson,
    c.address,
    c.city,
    c.country,
    c.website,
    c.taxId,
    c.industry,
    CLIENT_STATUS_LABELS[c.status] || c.status,
    c.notes,
    c.createdBy,
    c.ownerUserId ?? "",
    formatDate(c.createdAt),
  ])
  const csv = exportMetaHeader(exportedBy) + rowsToCsv(headers, rows)
  downloadCsv(`clients-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export function downloadLeadsExcel(leads: CrmLeadRow[], meta?: LeadsExportMeta) {
  const csv = buildLeadsExportCsv(leads, meta)
  downloadCsv(`leads-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}
