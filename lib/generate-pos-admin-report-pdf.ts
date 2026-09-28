import type {
  PosAdminBranchSummary,
  PosAdminCombined,
  PosAdminOrderBrief,
  PosAdminProductSummary,
  PosAdminReceiptBrief,
} from "@/lib/pos-admin"
import { dateRangeLabel, downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"

function prettyStatus(value: string) {
  return String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function shortWhen(iso: string) {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso || "—"
  return parsed.toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function orderRows(orders: PosAdminOrderBrief[], withBranch: boolean): (string | number)[][] {
  return orders.map((row) => {
    const cells: (string | number)[] = [
      row.orderNumber,
      shortWhen(row.createdAt),
    ]
    if (withBranch) cells.push(row.branchName || "—")
    cells.push(row.clientName || "—", prettyStatus(row.status), pkr(row.sellAmount), pkr(row.profit))
    return cells
  })
}

export async function downloadPosAdminReportPdf(opts: {
  from: string
  to: string
  scopeLabel: string
  combined: PosAdminCombined | PosAdminBranchSummary
  branches?: PosAdminBranchSummary[]
  orders: PosAdminOrderBrief[]
  receipts?: PosAdminReceiptBrief[]
  productSummary?: PosAdminProductSummary | null
  productFilter?: string
  exportedBy?: string
}) {
  const range = dateRangeLabel(opts.from, opts.to)
  const totals = opts.combined
  const withBranch = opts.orders.some((o) => Boolean(o.branchName)) && (opts.branches?.length || 0) > 1
  const tables: PlainTable[] = [
    {
      title: "Summary",
      columns: [
        { header: "Metric", width: 70 },
        { header: "Value", align: "right", width: 50 },
      ],
      rows: [
        ["Combined sales", pkr(totals.combinedSaleTotal)],
        [
          "Order sales",
          `${pkr(totals.orderSellTotal)}  (${totals.orderCount} order${totals.orderCount === 1 ? "" : "s"})`,
        ],
        ["Profit", pkr(totals.orderProfitTotal)],
        [
          "Receipts",
          `${pkr(totals.receiptTotal)}  (${totals.receiptCount} receipt${totals.receiptCount === 1 ? "" : "s"})`,
        ],
        ["Delivered / open", `${totals.deliveredCount} / ${totals.openCount}`],
        [
          "Stock",
          `${totals.stockQty.toLocaleString("en-PK")} pcs  (${totals.stockSkuCount} SKU${totals.stockSkuCount === 1 ? "" : "s"})`,
        ],
      ],
    },
  ]

  if (opts.branches && opts.branches.length > 0) {
    tables.push({
      title: "Sales by branch",
      columns: [
        { header: "Branch", width: 36 },
        { header: "Orders", align: "right", width: 16 },
        { header: "Order sales", align: "right", width: 28 },
        { header: "Profit", align: "right", width: 24 },
        { header: "Receipts", align: "right", width: 24 },
        { header: "Combined", align: "right", width: 28 },
        { header: "Stock", align: "right", width: 18 },
      ],
      rows: opts.branches.map((b) => [
        b.branchName,
        `${b.orderCount}  (${b.deliveredCount}d / ${b.openCount}o)`,
        pkr(b.orderSellTotal),
        pkr(b.orderProfitTotal),
        pkr(b.receiptTotal),
        pkr(b.combinedSaleTotal),
        `${b.stockQty.toLocaleString("en-PK")}`,
      ]),
      foot: [
        `${opts.branches.length} branches`,
        String(totals.orderCount),
        pkr(totals.orderSellTotal),
        pkr(totals.orderProfitTotal),
        pkr(totals.receiptTotal),
        pkr(totals.combinedSaleTotal),
        `${totals.stockQty.toLocaleString("en-PK")}`,
      ],
    })
  }

  if (opts.productSummary) {
    tables.push({
      title: `Product${opts.productFilter ? ` · ${opts.productFilter}` : ""}`,
      columns: [
        { header: "Metric", width: 70 },
        { header: "Value", align: "right", width: 50 },
      ],
      rows: [
        ["Sold qty", `${opts.productSummary.soldQty.toLocaleString("en-PK")} ${opts.productSummary.unit || "pcs"}`],
        ["Sale total", pkr(opts.productSummary.sellTotal)],
        ["Orders", String(opts.productSummary.orderCount)],
      ],
    })
  }

  const orderCols = withBranch
    ? [
        { header: "Order", width: 22 },
        { header: "Date", width: 28 },
        { header: "Branch", width: 28, small: true },
        { header: "Client", width: 40 },
        { header: "Status", width: 22 },
        { header: "Sale", align: "right" as const, width: 26 },
        { header: "Profit", align: "right" as const, width: 22 },
      ]
    : [
        { header: "Order", width: 24 },
        { header: "Date", width: 32 },
        { header: "Client", width: 48 },
        { header: "Status", width: 24 },
        { header: "Sale", align: "right" as const, width: 28 },
        { header: "Profit", align: "right" as const, width: 24 },
      ]

  const saleSum = opts.orders.reduce((s, o) => s + (Number(o.sellAmount) || 0), 0)
  const profitSum = opts.orders.reduce((s, o) => s + (Number(o.profit) || 0), 0)
  const orderFoot = withBranch
    ? ["", "", "", String(opts.orders.length), "", pkr(saleSum), pkr(profitSum)]
    : ["", "", String(opts.orders.length), "", pkr(saleSum), pkr(profitSum)]

  tables.push({
    title: `Orders · ${opts.scopeLabel}`,
    columns: orderCols,
    rows: opts.orders.length
      ? orderRows(opts.orders, withBranch)
      : [withBranch ? ["No orders", "", "", "", "", "", ""] : ["No orders", "", "", "", "", ""]],
    foot: opts.orders.length ? orderFoot : undefined,
  })

  if ((opts.receipts?.length || 0) > 0) {
    const receipts = opts.receipts || []
    tables.push({
      title: "Receipts",
      columns: [
        { header: "Receipt", width: 28 },
        { header: "Date", width: 28 },
        { header: "Counter", width: 28, small: true },
        { header: "Customer", width: 36 },
        { header: "Method", width: 22 },
        { header: "Amount", align: "right", width: 26 },
      ],
      rows: receipts.map((r) => [
        r.receiptNumber,
        shortWhen(r.createdAt),
        r.terminalName || "—",
        r.customerName || "—",
        r.paymentMethod || "—",
        pkr(r.total),
      ]),
      foot: ["", "", "", String(receipts.length), "", pkr(receipts.reduce((s, r) => s + (Number(r.total) || 0), 0))],
    })
  }

  const generated = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
  const slug = opts.scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all-pos"
  const productNote = opts.productFilter ? ` · ${opts.productFilter}` : ""

  await downloadPlainReportPdf({
    title: `POS · ${opts.scopeLabel}`,
    subtitle: range,
    meta: [
      `Branch POS only${productNote}${opts.exportedBy ? ` · ${opts.exportedBy}` : ""}`,
      `Generated  ${generated}  (Pakistan time) · Sales ${pkr(totals.combinedSaleTotal)} · Profit ${pkr(totals.orderProfitTotal)}`,
    ],
    filename: `pos-${slug}-${opts.from}-to-${opts.to}.pdf`,
    compact: true,
    pagePerTable: false,
    tables,
  })
}
