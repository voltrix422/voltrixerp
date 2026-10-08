import type { FinanceOrderRow, FinancePosRow } from "@/lib/finance-report-details"
import { dateRangeLabel, downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"

export type FinanceSalesReportOptions = {
  includeCrm: boolean
  includePos: boolean
  periodLabel: string
  dateFrom?: string
  dateTo?: string
  exportedBy?: string
}

function creditOf(total: number, paid: number) {
  return Math.max(0, (Number(total) || 0) - (Number(paid) || 0))
}

function shortItems(items: FinanceOrderRow["items"] | FinancePosRow["items"]) {
  if (!items?.length) return "—"
  return items
    .slice(0, 4)
    .map((i) => {
      const qty = i.qty > 0 ? `${i.qty}× ` : ""
      return `${qty}${i.description || "Item"}`
    })
    .join("; ")
    .slice(0, 80)
}

/** Clean Finance sales PDF — pick CRM and/or POS, with received + credit. */
export async function downloadFinanceSalesReportPdf(
  orders: FinanceOrderRow[],
  posSales: FinancePosRow[],
  opts: FinanceSalesReportOptions,
) {
  if (!opts.includeCrm && !opts.includePos) {
    throw new Error("Select at least one source (CRM or POS).")
  }

  const crm = opts.includeCrm ? orders : []
  const pos = opts.includePos ? posSales : []

  const crmTotal = crm.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const crmReceived = crm.reduce(
    (s, r) => s + (Number(r.receivedInPeriod) || Number(r.paidTotal) || 0),
    0,
  )
  const crmCredit = crm.reduce((s, r) => s + creditOf(r.total, r.paidTotal), 0)

  const posTotal = pos.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const posReceived = pos.reduce((s, r) => s + (Number(r.paidTotal ?? r.total) || 0), 0)
  const posCredit = pos.reduce((s, r) => s + creditOf(r.total, r.paidTotal ?? r.total), 0)

  const sources = [
    opts.includeCrm ? "CRM orders" : null,
    opts.includePos ? "POS sales" : null,
  ]
    .filter(Boolean)
    .join(" + ")

  const range =
    opts.dateFrom || opts.dateTo
      ? dateRangeLabel(opts.dateFrom || "", opts.dateTo || "")
      : opts.periodLabel || "Selected period"

  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const tables: PlainTable[] = [
    {
      title: "Sales overview",
      columns: [
        { header: "Metric", width: 90 },
        { header: "Amount", align: "right", width: 50 },
      ],
      rows: [
        ...(opts.includeCrm
          ? [
              ["CRM · order value", pkr(crmTotal)],
              ["CRM · received", pkr(crmReceived)],
              ["CRM · credit / outstanding", pkr(crmCredit)],
              ["CRM · orders", String(crm.length)],
            ]
          : []),
        ...(opts.includePos
          ? [
              ["POS · sale value", pkr(posTotal)],
              ["POS · received", pkr(posReceived)],
              ["POS · credit / outstanding", pkr(posCredit)],
              ["POS · sales", String(pos.length)],
            ]
          : []),
        [
          "Combined · sale value",
          pkr((opts.includeCrm ? crmTotal : 0) + (opts.includePos ? posTotal : 0)),
        ],
        [
          "Combined · received",
          pkr((opts.includeCrm ? crmReceived : 0) + (opts.includePos ? posReceived : 0)),
        ],
        [
          "Combined · credit",
          pkr((opts.includeCrm ? crmCredit : 0) + (opts.includePos ? posCredit : 0)),
        ],
      ],
    },
  ]

  if (opts.includeCrm) {
    tables.push({
      title: "CRM client orders",
      columns: [
        { header: "Date", width: 18 },
        { header: "Order", width: 20 },
        { header: "Client", width: 32 },
        { header: "Status", width: 18 },
        { header: "Items", width: 40, small: true },
        { header: "Total", align: "right", width: 22 },
        { header: "Received", align: "right", width: 22 },
        { header: "Credit", align: "right", width: 20 },
      ],
      rows: crm.length
        ? crm.map((r) => [
            r.date || "—",
            r.orderNumber || "—",
            r.clientName || "—",
            String(r.status || "—").replace(/_/g, " "),
            shortItems(r.items),
            pkr(r.total),
            pkr(r.receivedInPeriod || r.paidTotal),
            pkr(creditOf(r.total, r.paidTotal)),
          ])
        : [["No CRM orders in this period", "", "", "", "", "", "", ""]],
      foot: crm.length
        ? ["", "", String(crm.length), "", "", pkr(crmTotal), pkr(crmReceived), pkr(crmCredit)]
        : undefined,
    })
  }

  if (opts.includePos) {
    tables.push({
      title: "POS sales",
      columns: [
        { header: "Date", width: 18 },
        { header: "Sale no.", width: 22 },
        { header: "Customer", width: 28 },
        { header: "Kind", width: 18 },
        { header: "Items", width: 36, small: true },
        { header: "Total", align: "right", width: 22 },
        { header: "Received", align: "right", width: 22 },
        { header: "Credit", align: "right", width: 20 },
      ],
      rows: pos.length
        ? pos.map((r) => [
            r.date || "—",
            r.number || "—",
            r.customer || "—",
            r.kind || "POS",
            shortItems(r.items),
            pkr(r.total),
            pkr(r.paidTotal ?? r.total),
            pkr(creditOf(r.total, r.paidTotal ?? r.total)),
          ])
        : [["No POS sales in this period", "", "", "", "", "", "", ""]],
      foot: pos.length
        ? ["", "", String(pos.length), "", "", pkr(posTotal), pkr(posReceived), pkr(posCredit)]
        : undefined,
    })
  }

  const from = opts.dateFrom || "period"
  const to = opts.dateTo || "period"
  const slug = [opts.includeCrm ? "crm" : "", opts.includePos ? "pos" : ""].filter(Boolean).join("-")

  await downloadPlainReportPdf({
    title: "Sales report",
    subtitle: range,
    meta: [
      `${sources}${opts.exportedBy ? ` · ${opts.exportedBy}` : ""}`,
      `Generated  ${generated}  (Pakistan time)`,
    ],
    filename: `sales-report-${slug}-${from}-to-${to}.pdf`,
    compact: true,
    pagePerTable: false,
    tables,
  })
}
