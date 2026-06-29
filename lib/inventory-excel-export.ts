import type { InventoryMovementRow } from "@/lib/inventory-movement-display"
import { formatMovementDate, getReferenceTypeLabel } from "@/lib/inventory-movement-display"
import type { InventorySerialUnit } from "@/lib/inventory-serial-units"
import type { UnifiedInventoryModelGroup } from "@/lib/unified-inventory-groups"
import type { Order } from "@/lib/orders"
import { STATUS_LABELS as ORDER_STATUS_LABELS } from "@/lib/orders"

export type ManualInventoryExportRow = {
  id: string
  name?: string
  description?: string
  poNumber?: string
  supplier?: string
  qty: number
  availableQty?: number
  unit: string
  unitPrice: number
  receivedAt: string
}

function escCsvCell(value: string | number | null | undefined): string {
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
    return iso ?? ""
  }
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

function productIdFromItemId(id: string) {
  const idHash = id.replace(/[^0-9]/g, "").slice(-6)
  return `P-${idHash}`
}

function itemLabel(item: { name?: string; description?: string }) {
  return item.name?.trim() || item.description?.trim() || "—"
}

function itemSecondary(item: { name?: string; description?: string }) {
  const name = item.name?.trim() || ""
  const description = item.description?.trim() || ""
  if (name && description && name !== description) return description
  return ""
}

export function downloadSerialUnitsExcel(units: InventorySerialUnit[], exportedBy?: string) {
  const headers = [
    "Model",
    "Custom Name",
    "Serial Number (SN)",
    "Product Name",
    "Specs",
    "Status",
    "Scanned Date",
    "Scanned By",
    "Notes",
  ]
  const rows = units.map((u) => [
    u.model || "",
    u.productName && u.productName !== u.model ? u.productName : "",
    u.serialNumber,
    u.productName || "",
    u.specs || "",
    u.status,
    formatDate(u.scannedAt),
    u.scannedBy || "",
    u.notes || "",
  ])
  const csv = exportMetaHeader(exportedBy) + rowsToCsv(headers, rows)
  downloadCsv(`inventory-qr-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export function downloadUnifiedInventoryExcel(
  groups: UnifiedInventoryModelGroup[],
  exportedBy?: string,
) {
  const headers = [
    "Model / Product",
    "Model Code",
    "Serial Number",
    "Stock (available)",
    "Total Units",
    "Unit",
    "Inventory Type",
    "Status",
    "Specs",
    "Scanned Date",
    "Scanned By",
    "Notes",
  ]

  const rows: (string | number)[][] = []

  for (const group of groups) {
    if (group.units.length > 0) {
      for (const unit of group.units) {
        rows.push([
          group.displayName || group.modelKey,
          group.modelKey,
          unit.serialNumber,
          unit.status === "in_stock" ? 1 : 0,
          "",
          "",
          "SN tracked",
          unit.status,
          unit.specs || "",
          formatDate(unit.scannedAt),
          unit.scannedBy || "",
          unit.notes || "",
        ])
      }
      continue
    }

    if (!group.stockOnly) continue

    rows.push([
      group.displayName || group.modelKey,
      group.modelKey,
      "",
      group.stockOnly.inStock,
      group.stockOnly.total,
      group.stockOnly.unit,
      group.stockOnly.isManual ? "Manual" : "Stock only",
      "",
      "",
      "",
      "",
      "",
    ])
  }

  const csv = exportMetaHeader(exportedBy) + rowsToCsv(headers, rows)
  downloadCsv(`inventory-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  return rows.length
}

export function downloadManualInventoryExcel(items: ManualInventoryExportRow[], exportedBy?: string) {
  const headers = [
    "Item Description",
    "Secondary Description",
    "Product ID",
    "PO",
    "Supplier",
    "Qty",
    "Unit",
    "Landed Cost/Unit (PKR)",
    "Total Value (PKR)",
    "Received Date",
  ]
  const rows = items.map(item => {
    const displayQty = typeof item.availableQty === "number" ? item.availableQty : item.qty
    return [
      itemLabel(item),
      itemSecondary(item),
      productIdFromItemId(item.id),
      item.poNumber ?? "",
      item.supplier ?? "",
      displayQty,
      item.unit,
      item.unitPrice ?? 0,
      (item.unitPrice ?? 0) * displayQty,
      formatDate(item.receivedAt),
    ]
  })
  const csv = exportMetaHeader(exportedBy) + rowsToCsv(headers, rows)
  downloadCsv(`manual-inventory-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

function orderHasCompleteFulfillmentProof(o: Order): boolean {
  const textOk =
    !!(o.fulfillmentReceiverName || "").trim() &&
    !!(o.fulfillmentReceiverCnic || "").trim() &&
    !!(o.fulfillmentVehicleNumber || "").trim()
  const imgOk =
    !!(o.fulfillmentReceiverImageUrl || "").trim() &&
    !!(o.fulfillmentReceiverCnicImageUrl || "").trim() &&
    !!(o.fulfillmentVehicleImageUrl || "").trim()
  const productsOk = Array.isArray(o.fulfillmentProductImageUrls) && o.fulfillmentProductImageUrls.length > 0
  return textOk && imgOk && productsOk
}

function dispatchInvoiceLabel(order: Order): string {
  if (order.status === "pending_approval") return "Invoice"
  if (order.dispatcher && !orderHasCompleteFulfillmentProof(order)) return "proof required"
  if (order.dispatcher) return "delivered"
  return "ready to fulfill"
}

export function downloadInventoryMovementsExcel(
  movements: InventoryMovementRow[],
  exportedBy?: string,
  dateLabel?: string,
) {
  const headers = [
    "Date & Time",
    "Movement",
    "Item",
    "Quantity",
    "Unit",
    "Main WH Before",
    "Main WH After",
    "Source (From)",
    "Destination (To)",
    "Order #",
    "Client",
    "Reference Type",
    "Reference #",
    "Notes",
    "Recorded By",
  ]
  const rows = movements.map((m) => [
    formatMovementDate(m.created_at),
    m.movement_label,
    m.item_description,
    m.abs_quantity,
    m.unit,
    m.balance_before ?? "",
    m.balance_after ?? "",
    m.source,
    m.destination,
    m.order_number || "",
    m.client_name || "",
    getReferenceTypeLabel(m.reference_type),
    m.reference_number,
    m.notes || "",
    m.created_by,
  ])
  let meta = exportMetaHeader(exportedBy)
  if (dateLabel) {
    meta = `${escCsvCell("Period")},${escCsvCell(dateLabel)}\r\n${meta}`
  }
  const csv = meta + rowsToCsv(headers, rows)
  downloadCsv(`inventory-movements-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export function downloadDispatchOrdersExcel(orders: Order[], exportedBy?: string) {
  const headers = [
    "Order #",
    "Client",
    "Item Count",
    "Line Items",
    "Total (PKR)",
    "Status",
    "Dispatcher",
    "Delivery Date",
    "Invoice / Fulfillment",
    "Delivery Address",
    "Notes",
  ]
  const rows = orders.map(o => [
    o.orderNumber,
    o.clientName,
    o.items?.length ?? 0,
    (o.items || []).map(i => `${i.description} (${i.qty} ${i.unit})`).join("; "),
    o.total ?? 0,
    ORDER_STATUS_LABELS[o.status] || o.status,
    o.dispatcher || "",
    o.deliveryDate ? formatDate(o.deliveryDate) : "",
    dispatchInvoiceLabel(o),
    o.deliveryAddress ?? "",
    o.notes ?? "",
  ])
  const csv = exportMetaHeader(exportedBy) + rowsToCsv(headers, rows)
  downloadCsv(`dispatch-orders-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}
