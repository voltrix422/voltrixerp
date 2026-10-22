import type { InventoryMovementRow } from "@/lib/inventory-movement-display"
import {
  formatMovementDate,
  getTrackEventKind,
  getTrackPlaceLabel,
  mainWarehouseDelta,
} from "@/lib/inventory-movement-display"
import { downloadPlainReportPdf, type PlainTable } from "@/lib/plain-report-pdf"

export type TrackProductPdfSummary = {
  starting: number
  mainNow: number
  faultyNow: number
  atBranches: number
  erpOrdersNet: number
  erpOrdersLine: number
  erpReturned: number
  erpReplaced: number
  transfers: number
  pos: number
  returns: number
  addedToWh: number
  leftWh: number
  unit: string
  mainWhOpening?: number
  historyGap?: number
  orders: Array<{ orderNumber: string; client: string; qty: number }>
  branchRows: Array<{ branchName: string; branchCode: string; quantity: number }>
  posRows: Array<{ branch: string; ref: string; qty: number }>
  transferRows: Array<{ route: string; count: number; qty: number }>
  returnsList: Array<{ orderNumber: string; clientName: string; qty: number }>
  replacementsList: Array<{
    orderNumber: string
    oldSerialNumber?: string
    newSerialNumber?: string
    qty: number
  }>
  faultyRows: Array<{ item: string; detail: string; qty: string }>
}

export type TrackProductPdfOptions = {
  displayName: string
  modelKey: string
  summary: TrackProductPdfSummary
  historyRows: InventoryMovementRow[]
  exportedBy?: string
}

function pcs(n: number, unit: string) {
  return `${n} ${unit}`
}

export async function downloadTrackProductPdf(opts: TrackProductPdfOptions) {
  const { displayName, modelKey, summary, historyRows, exportedBy } = opts
  const unit = summary.unit || "pcs"
  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const tables: PlainTable[] = []

  tables.push({
    title: "Stock summary",
    columns: [
      { header: "Metric", width: 55 },
      { header: "Value", width: 40, align: "right" },
      { header: "Note", width: 70, small: true },
    ],
    rows: [
      ["Starting units", pcs(summary.starting, unit), "Total recorded"],
      ["Main WH opening", pcs(summary.mainWhOpening ?? summary.starting, unit), "Before first movement"],
      ["Main WH now", pcs(summary.mainNow, unit), "Sellable main warehouse"],
      ["Branches now", pcs(summary.atBranches, unit), "Excludes main warehouse"],
      ["Faulty / damaged", pcs(summary.faultyNow, unit), "Excluded from sellable stock"],
      [
        "ERP net",
        pcs(summary.erpOrdersNet, unit),
        `${summary.erpOrdersLine}−${summary.erpReturned}−${summary.erpReplaced}`,
      ],
      ["POS sales", pcs(summary.pos, unit), ""],
      ["Transfers (qty moved)", pcs(summary.transfers, unit), ""],
      ["Returns", pcs(summary.returns, unit), ""],
      ["Main WH +/−", `+${summary.addedToWh}/−${summary.leftWh}`, "From movement trail"],
      ...(summary.historyGap
        ? ([
            [
              "History gap",
              `${summary.historyGap > 0 ? "+" : ""}${summary.historyGap} ${unit}`,
              "Trail vs live Main WH",
            ],
          ] as (string | number)[][])
        : []),
    ],
  })

  if (summary.orders.length) {
    tables.push({
      title: `ERP client orders · ${summary.erpOrdersNet} net · ${summary.erpOrdersLine}−${summary.erpReturned + summary.erpReplaced}`,
      columns: [
        { header: "Order", width: 28, minWidth: 22 },
        { header: "Client", width: 70 },
        { header: "Qty", width: 18, align: "right" },
      ],
      rows: summary.orders.map((o) => [o.orderNumber, o.client, String(o.qty)]),
      foot: ["", String(summary.orders.length), String(summary.erpOrdersLine)],
    })
  }

  if (summary.branchRows.length) {
    tables.push({
      title: `At branches now · ${summary.atBranches} ${unit}`,
      columns: [
        { header: "Branch", width: 70 },
        { header: "Code", width: 24 },
        { header: "Qty", width: 18, align: "right" },
      ],
      rows: summary.branchRows.map((b) => [b.branchName, b.branchCode, String(b.quantity)]),
      foot: ["", "", String(summary.atBranches)],
    })
  }

  if (summary.posRows.length) {
    tables.push({
      title: `POS sales · ${summary.pos} ${unit}`,
      columns: [
        { header: "Branch", width: 55 },
        { header: "Order", width: 40 },
        { header: "Qty", width: 18, align: "right" },
      ],
      rows: summary.posRows.map((p) => [p.branch, p.ref, String(p.qty)]),
      foot: ["", "", String(summary.pos)],
    })
  }

  if (summary.transferRows.length) {
    tables.push({
      title: `Branch transfers · ${summary.transfers} ${unit}`,
      columns: [
        { header: "Route", width: 95, small: true },
        { header: "Moves", width: 18, align: "right" },
        { header: "Qty", width: 18, align: "right" },
      ],
      rows: summary.transferRows.map((t) => [t.route, String(t.count), String(t.qty)]),
      foot: ["", "", String(summary.transfers)],
    })
  }

  const rrRows: (string | number)[][] = [
    ...summary.returnsList.map((r) => ["Return", `${r.orderNumber} · ${r.clientName}`, String(r.qty)]),
    ...summary.replacementsList.map((r) => [
      "Replaced",
      `${r.orderNumber}${r.oldSerialNumber ? ` · ${r.oldSerialNumber}→${r.newSerialNumber || "—"}` : ""}`,
      String(r.qty),
    ]),
  ]
  if (rrRows.length) {
    tables.push({
      title: `Returns & replacements · ${summary.erpReturned + summary.erpReplaced} ${unit}`,
      columns: [
        { header: "Type", width: 24 },
        { header: "Detail", width: 90, small: true },
        { header: "Qty", width: 18, align: "right" },
      ],
      rows: rrRows,
      foot: ["", "", String(summary.erpReturned + summary.erpReplaced)],
    })
  }

  if (summary.faultyRows.length) {
    tables.push({
      title: `Faulty / damaged · ${summary.faultyNow} ${unit}`,
      columns: [
        { header: "Item", width: 50 },
        { header: "Detail", width: 70, small: true },
        { header: "Qty", width: 18, align: "right" },
      ],
      rows: summary.faultyRows.map((r) => [r.item, r.detail, r.qty]),
      foot: ["", "", String(summary.faultyNow)],
    })
  }

  const historyBody: (string | number)[][] = [
    [
      "—",
      "Main WH opening",
      String(summary.mainWhOpening ?? summary.starting),
      String(summary.mainWhOpening ?? summary.starting),
      "Opening",
      "—",
      "System",
      `Opening = total recorded (${summary.starting}). Closing forced to live Main WH (${summary.mainNow})${
        summary.historyGap
          ? ` via book gap ${summary.historyGap > 0 ? "+" : ""}${summary.historyGap}`
          : ""
      }.`,
    ],
    ...historyRows.map((m) => {
      const delta = mainWarehouseDelta(m)
      const qtyLabel =
        delta === 0
          ? String(m.abs_quantity)
          : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`
      const bal =
        m.balance_before != null && m.balance_after != null
          ? `${m.balance_before}→${m.balance_after}`
          : "—"
      return [
        formatMovementDate(m.created_at),
        getTrackEventKind(m),
        qtyLabel,
        bal,
        getTrackPlaceLabel(m),
        m.order_number || m.reference_number || "—",
        m.created_by || "—",
        (m.notes || "—").replace(/\s+/g, " ").trim().slice(0, 120),
      ]
    }),
  ]

  tables.push({
    title: `Main WH movement history · opens ${summary.starting} · live ${summary.mainNow}${
      summary.historyGap ? ` · gap ${summary.historyGap > 0 ? "+" : ""}${summary.historyGap}` : ""
    }`,
    newPage: true,
    columns: [
      { header: "Date", width: 28, minWidth: 22, small: true },
      { header: "Event", width: 28, small: true },
      { header: "Qty", width: 14, align: "right", minWidth: 12 },
      { header: "Main WH", width: 18, align: "right", minWidth: 14 },
      { header: "Route", width: 36, small: true },
      { header: "Ref", width: 22, small: true, noWrap: true },
      { header: "By", width: 18, small: true },
      { header: "Notes", width: 40, small: true },
    ],
    rows: historyBody,
  })

  const safeName = displayName.replace(/[^\w.-]+/g, "-").slice(0, 40) || "product"
  await downloadPlainReportPdf({
    title: "Track product",
    subtitle: `${displayName} · ${modelKey}`,
    meta: [
      exportedBy
        ? `Main WH trail · Faulty excluded from sellable · ${exportedBy}`
        : "Main WH trail · Faulty excluded from sellable stock",
      `Generated  ${generated}  (Pakistan time) · Main WH now ${summary.mainNow} ${unit} · Faulty ${summary.faultyNow} ${unit}`,
    ],
    filename: `track-product-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`,
    compact: true,
    landscape: true,
    pagePerTable: false,
    tables,
  })
}
