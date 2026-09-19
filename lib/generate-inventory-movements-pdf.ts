import type { InventoryMovementRow } from "@/lib/inventory-movement-display"
import { getTrackEventKind, summarizeMovementsByProduct } from "@/lib/inventory-movement-display"
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

function qty(m: InventoryMovementRow) {
  return `${m.is_inbound ? "+" : "-"}${m.abs_quantity}`
}

function productName(m: InventoryMovementRow) {
  const name = String(m.item_description || "Item").replace(/\s+/g, " ").trim()
  if (name.length <= 32) return name
  const beforeParen = name.split("(")[0].trim()
  return beforeParen.length >= 8 && beforeParen.length <= 32 ? beforeParen : name.slice(0, 32)
}

function movementKind(m: InventoryMovementRow) {
  const dest = `${m.destination || ""} ${m.reference_number || ""}`
  if (/AUDIT/i.test(dest)) return "Audit"
  const kind = getTrackEventKind(m)
  if (kind === "Client order") return "Order"
  if (kind === "Order return" || kind === "Return") return "Return"
  if (kind === "Transfer") return "Transfer"
  if (kind === "POS sale") return "POS"
  if (kind === "POS receive" || kind === "POS restore") return "POS in"
  if (kind === "POS removed") return "POS out"
  if (kind === "Stock / units added") return "Manual in"
  if (kind === "Stock / units removed") return "Manual out"
  if (kind === "Damaged / Faulty") return "Faulty"
  if (kind === "Restored from damage") return "Faulty in"
  if (kind === "Purchase receive") return "Purchase"
  if (kind === "Order replacement") return "Replace"
  return kind
}

function orderCell(m: InventoryMovementRow) {
  const parts = [m.order_number, m.client_name].filter(Boolean)
  return parts.join(" · ") || "—"
}

function compactOrders(orders: string[]) {
  if (!orders.length) return "—"
  return orders.join(" · ")
}

function ofKind(movements: InventoryMovementRow[], kind: string) {
  return movements.filter((m) => movementKind(m) === kind)
}

function qtySum(rows: InventoryMovementRow[]) {
  return rows.reduce((s, m) => s + (m.is_inbound ? m.abs_quantity : -m.abs_quantity), 0)
}

function pcs(rows: InventoryMovementRow[]) {
  return rows.reduce((s, m) => s + m.abs_quantity, 0)
}

export async function downloadInventoryMovementsPDF(opts: InventoryMovementsPdfOptions) {
  const { movements, dateLabel, exportedBy } = opts
  const inbound = movements.filter((m) => m.is_inbound)
  const outbound = movements.filter((m) => !m.is_inbound)
  const qtyIn = inbound.reduce((s, m) => s + m.abs_quantity, 0)
  const qtyOut = outbound.reduce((s, m) => s + m.abs_quantity, 0)
  const orderNos = new Set(movements.filter((m) => m.order_number).map((m) => m.order_number))
  const clients = new Set(movements.filter((m) => m.client_name).map((m) => m.client_name))
  const byProduct = summarizeMovementsByProduct(movements)

  const kinds = [
    "Order",
    "Return",
    "Transfer",
    "POS",
    "POS in",
    "Manual in",
    "Manual out",
    "Faulty",
    "Faulty in",
    "Purchase",
    "Audit",
    "Replace",
  ]
  const grouped = new Map<string, InventoryMovementRow[]>()
  for (const m of movements) {
    const kind = movementKind(m)
    const list = grouped.get(kind) || []
    list.push(m)
    grouped.set(kind, list)
  }
  const extraKinds = [...grouped.keys()].filter((k) => !kinds.includes(k)).sort()
  const typeRows = [...kinds, ...extraKinds]
    .map((kind) => {
      const rows = grouped.get(kind) || []
      if (!rows.length) return null
      return [kind, String(rows.length), String(pcs(rows)), String(qtySum(rows))]
    })
    .filter((row): row is (string | number)[] => Boolean(row))

  const orders = ofKind(movements, "Order")
  const returns = ofKind(movements, "Return")
  const transfers = ofKind(movements, "Transfer")
  const pos = ofKind(movements, "POS")
  const manualIn = ofKind(movements, "Manual in")
  const manualOut = ofKind(movements, "Manual out")
  const faulty = [...ofKind(movements, "Faulty"), ...ofKind(movements, "Faulty in")]
  const other = movements.filter((m) =>
    !["Order", "Return", "Transfer", "POS", "Manual in", "Manual out", "Faulty", "Faulty in"].includes(
      movementKind(m),
    ),
  )

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
        ["Client orders", `${orders.length} · ${pcs(orders)} pcs`],
        ["Branch transfers", `${transfers.length} · ${pcs(transfers)} pcs`],
        ["POS sales", `${pos.length} · ${pcs(pos)} pcs`],
        ["Returns", `${returns.length} · ${pcs(returns)} pcs`],
        ["Manual / adjust", `${manualIn.length + manualOut.length} · ${pcs([...manualIn, ...manualOut])} pcs`],
        ["Faulty", `${faulty.length} · ${pcs(faulty)} pcs`],
        ["Orders", String(orderNos.size)],
        ["Clients", String(clients.size)],
        ["Products", String(byProduct.length)],
      ],
    },
    {
      title: "By type",
      columns: [
        { header: "Type", width: 70 },
        { header: "Rows", align: "right", width: 28 },
        { header: "Pcs", align: "right", width: 28 },
        { header: "Net", align: "right", width: 28 },
      ],
      rows: typeRows,
    },
    {
      title: "By product",
      newPage: true,
      columns: [
        { header: "Product", width: 52 },
        { header: "In", align: "right", width: 16 },
        { header: "Out", align: "right", width: 16 },
        { header: "Net", align: "right", width: 16 },
        { header: "Orders", width: 70, small: true },
      ],
      rows: byProduct.map((p) => [
        p.name,
        String(p.qtyIn),
        String(p.qtyOut),
        String(p.net),
        compactOrders(p.orders),
      ]),
    },
  ]

  if (orders.length) {
    tables.push({
      title: "Client orders",
      newPage: true,
      columns: [
        { header: "Date", width: 16, minWidth: 16 },
        { header: "Product", width: 44 },
        { header: "Qty", width: 12, minWidth: 12 },
        { header: "From", width: 36, small: true },
        { header: "Order", width: 50, small: true },
      ],
      rows: orders.map((m) => [
        shortDate(m.created_at),
        productName(m),
        qty(m),
        m.source,
        orderCell(m),
      ]),
      foot: ["", String(orders.length), String(pcs(orders)), "", `${orderNos.size} orders`],
    })
  }

  if (transfers.length) {
    tables.push({
      title: "Branch transfers",
      newPage: true,
      columns: [
        { header: "Date", width: 16, minWidth: 16 },
        { header: "Product", width: 44 },
        { header: "Qty", width: 12, minWidth: 12 },
        { header: "From", width: 46, small: true },
        { header: "To", width: 46, small: true },
      ],
      rows: transfers.map((m) => [
        shortDate(m.created_at),
        productName(m),
        qty(m),
        m.source,
        m.destination,
      ]),
      foot: ["", String(transfers.length), String(pcs(transfers)), "", ""],
    })
  }

  if (pos.length) {
    tables.push({
      title: "POS sales",
      newPage: true,
      columns: [
        { header: "Date", width: 16, minWidth: 16 },
        { header: "Product", width: 44 },
        { header: "Qty", width: 12, minWidth: 12 },
        { header: "Branch", width: 40, small: true },
        { header: "Order", width: 42, small: true },
      ],
      rows: pos.map((m) => [
        shortDate(m.created_at),
        productName(m),
        qty(m),
        m.source,
        m.order_number || m.reference_number || "—",
      ]),
      foot: ["", String(pos.length), String(pcs(pos)), "", ""],
    })
  }

  if (returns.length) {
    tables.push({
      title: "Returns",
      newPage: true,
      columns: [
        { header: "Date", width: 16, minWidth: 16 },
        { header: "Product", width: 40 },
        { header: "Qty", width: 12, minWidth: 12 },
        { header: "From", width: 36, small: true },
        { header: "To", width: 36, small: true },
        { header: "Order", width: 28, small: true },
      ],
      rows: returns.map((m) => [
        shortDate(m.created_at),
        productName(m),
        qty(m),
        m.source,
        m.destination,
        m.order_number || "—",
      ]),
      foot: ["", String(returns.length), String(pcs(returns)), "", "", ""],
    })
  }

  if (manualIn.length || manualOut.length || faulty.length || other.length) {
    const adjust = [...manualIn, ...manualOut, ...faulty, ...other].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    tables.push({
      title: "Manual, faulty and other",
      newPage: true,
      columns: [
        { header: "Date", width: 16, minWidth: 16 },
        { header: "Type", width: 20 },
        { header: "Product", width: 36 },
        { header: "Qty", width: 12, minWidth: 12 },
        { header: "From", width: 32, small: true },
        { header: "To", width: 32, small: true },
      ],
      rows: adjust.map((m) => [
        shortDate(m.created_at),
        movementKind(m),
        productName(m),
        qty(m),
        m.source,
        m.destination,
      ]),
      foot: ["", String(adjust.length), "", String(pcs(adjust)), "", ""],
    })
  }

  tables.push({
    title: "All movements",
    newPage: true,
    columns: [
      { header: "Date", width: 16, minWidth: 16 },
      { header: "Type", width: 18 },
      { header: "Product", width: 32 },
      { header: "Qty", width: 12, minWidth: 12 },
      { header: "From", width: 30, small: true },
      { header: "To", width: 32, small: true },
      { header: "Order", width: 28, small: true },
    ],
    rows: movements.map((m) => [
      shortDate(m.created_at),
      movementKind(m),
      productName(m),
      qty(m),
      m.source,
      m.destination,
      orderCell(m),
    ]),
    foot: ["", "", String(movements.length), String(qtyIn - qtyOut), "", "", `${orderNos.size} orders`],
  })

  const from = opts.dateFrom || "all"
  const to = opts.dateTo || "all"

  await downloadPlainReportPdf({
    title: "Inventory report",
    subtitle: range,
    meta: [
      exportedBy
        ? `Orders, transfers, POS, returns, manual · ${exportedBy}`
        : "Orders, transfers, POS, returns, manual",
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
