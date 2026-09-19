import type { InventoryMovementRow } from "@/lib/inventory-movement-display"
import { summarizeMovementsByProduct } from "@/lib/inventory-movement-display"
import { dateRangeLabel, downloadPlainReportPdf, type PlainTable } from "@/lib/plain-report-pdf"

export type InventoryMovementsPdfOptions = {
  movements: InventoryMovementRow[]
  dateLabel: string
  dateFrom?: string
  dateTo?: string
  exportedBy?: string
}

function shortDate(iso: string) {
  const raw = String(iso || "").trim()
  if (!raw) return "—"
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  const dd = String(parsed.getDate()).padStart(2, "0")
  const mm = String(parsed.getMonth() + 1).padStart(2, "0")
  const yy = String(parsed.getFullYear()).slice(2)
  return `${dd}/${mm}/${yy}`
}

function compactOrders(orders: string[]) {
  if (!orders.length) return "—"
  return orders.join(" · ")
}

export async function downloadInventoryMovementsPDF(opts: InventoryMovementsPdfOptions) {
  const { movements, dateLabel, exportedBy } = opts
  const inbound = movements.filter((m) => m.is_inbound)
  const outbound = movements.filter((m) => !m.is_inbound)
  const qtyIn = inbound.reduce((s, m) => s + m.abs_quantity, 0)
  const qtyOut = outbound.reduce((s, m) => s + m.abs_quantity, 0)
  const orders = new Set(movements.filter((m) => m.order_number).map((m) => m.order_number))
  const clients = new Set(movements.filter((m) => m.client_name).map((m) => m.client_name))
  const byProduct = summarizeMovementsByProduct(movements)

  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const range =
    opts.dateFrom || opts.dateTo
      ? dateRangeLabel(opts.dateFrom || "", opts.dateTo || "")
      : dateLabel || "Selected period"

  const tables: PlainTable[] = [
    {
      title: "Summary",
      columns: [
        { header: "Item", width: 120 },
        { header: "Amount", align: "right", width: 66 },
      ],
      rows: [
        ["Movements", String(movements.length)],
        ["Stock in", `${inbound.length} · ${qtyIn} pcs`],
        ["Stock out", `${outbound.length} · ${qtyOut} pcs`],
        ["Net", String(qtyIn - qtyOut)],
        ["Orders", String(orders.size)],
        ["Clients", String(clients.size)],
        ["Products", String(byProduct.length)],
      ],
    },
    {
      title: "By product",
      columns: [
        { header: "Product", width: 52 },
        { header: "In", align: "right", width: 16 },
        { header: "Out", align: "right", width: 16 },
        { header: "Net", align: "right", width: 16 },
        { header: "Orders", width: 70, small: true },
      ],
      rows: byProduct.map((p) => [
        p.model ? `${p.name}\n${p.model}` : p.name,
        String(p.qtyIn),
        String(p.qtyOut),
        String(p.net),
        compactOrders(p.orders),
      ]),
    },
    {
      title: "Movements",
      newPage: true,
      columns: [
        { header: "Date", width: 16, minWidth: 16 },
        { header: "Product", width: 36 },
        { header: "Qty", width: 14, minWidth: 14 },
        { header: "From", width: 32, small: true },
        { header: "To", width: 36, small: true },
        { header: "Order", width: 34, small: true },
      ],
      rows: movements.map((m) => [
        shortDate(m.created_at),
        m.item_description,
        `${m.is_inbound ? "+" : "−"}${m.abs_quantity}`,
        m.source,
        m.destination,
        [m.order_number, m.client_name].filter(Boolean).join(" · ") || "—",
      ]),
      foot: ["", String(movements.length), `${qtyIn - qtyOut}`, "", "", `${orders.size} orders`],
    },
  ]

  const from = opts.dateFrom || "all"
  const to = opts.dateTo || "all"

  await downloadPlainReportPdf({
    title: "Inventory report",
    subtitle: range,
    meta: [
      exportedBy ? `Main warehouse movements · ${exportedBy}` : "Main warehouse movements",
      `Generated  ${generated}  (Pakistan time) · In ${qtyIn} · Out ${qtyOut} · Net ${qtyIn - qtyOut}`,
    ],
    filename: `inventory-report-${from}-to-${to}.pdf`,
    compact: true,
    pagePerTable: false,
    tables,
  })
}

export function formatDateLabel(from?: string, to?: string): string {
  if (from && to) return `${from} to ${to}`
  if (from) return `From ${from}`
  if (to) return `Until ${to}`
  return "All time"
}
