import type { FinanceOrderRow, FinancePosRow } from "@/lib/finance-report-details"
import { crmRowCredit, splitCrmSalesRows } from "@/lib/finance-sales-crm-split"
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

  const crmAll = opts.includeCrm ? orders : []
  const crmSplit = splitCrmSalesRows(crmAll)
  const pos = opts.includePos ? posSales : []

  const crmTotal = crmSplit.activeTotal
  const crmReceived = crmSplit.activeReceived
  const crmCreditTotal = crmSplit.activeCredit

  const posTotal = pos.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const posReceived = pos.reduce((s, r) => s + (Number(r.paidTotal ?? r.total) || 0), 0)
  const posCredit = pos.reduce((s, r) => s + creditOf(r.total, r.paidTotal ?? r.total), 0)

  const combinedSale = (opts.includeCrm ? crmTotal : 0) + (opts.includePos ? posTotal : 0)
  const combinedReceived =
    (opts.includeCrm ? crmReceived : 0) + (opts.includePos ? posReceived : 0)
  const combinedCredit =
    (opts.includeCrm ? crmCreditTotal : 0) + (opts.includePos ? posCredit : 0)

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

  const overviewRows: string[][] = []
  if (opts.includeCrm) {
    overviewRows.push(
      ["CRM · order value (active)", pkr(crmTotal)],
      ["CRM · received (active)", pkr(crmReceived)],
      ["CRM · credit / outstanding (active)", pkr(crmCreditTotal)],
      ["CRM · active orders", String(crmSplit.activeCount)],
      ["CRM · check (value − received − credit)", pkr(crmSplit.activeCheck)],
    )
    if (crmSplit.returnedCount > 0) {
      overviewRows.push(
        ["CRM · returns · orders", String(crmSplit.returnedCount)],
        ["CRM · returns · cash received (on returned)", pkr(crmSplit.returnedReceived)],
        ["CRM · returns · refunds paid", pkr(crmSplit.returnedRefunds)],
      )
    }
    if (crmSplit.allCashback > 0.004) {
      overviewRows.push(["CRM · cashback (period)", pkr(crmSplit.allCashback)])
    }
  }
  if (opts.includePos) {
    overviewRows.push(
      ["POS · sale value", pkr(posTotal)],
      ["POS · received", pkr(posReceived)],
      ["POS · credit / outstanding", pkr(posCredit)],
      ["POS · sales", String(pos.length)],
    )
  }

  const tables: PlainTable[] = [
    {
      title: "Sales overview",
      columns: [
        { header: "Metric", width: 90 },
        { header: "Amount", align: "right", width: 50 },
      ],
      rows: overviewRows,
    },
  ]

  if (opts.includeCrm) {
    tables.push({
      title: "CRM active orders · by order created date (oldest first)",
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
      rows: crmSplit.active.length
        ? crmSplit.active.map((r) => [
            r.date || "—",
            r.orderNumber || "—",
            r.clientName || "—",
            String(r.status || "—").replace(/_/g, " "),
            shortItems(r.items),
            pkr(r.total),
            pkr(Number(r.receivedInPeriod) || 0),
            pkr(crmRowCredit(r)),
          ])
        : [["No active CRM orders in this period", "", "", "", "", "", "", ""]],
      foot: crmSplit.active.length
        ? [
            "",
            "",
            String(crmSplit.activeCount),
            "",
            "",
            pkr(crmTotal),
            pkr(crmReceived),
            pkr(crmCreditTotal),
          ]
        : undefined,
    })

    if (crmSplit.returnedCount > 0) {
      tables.push({
        title: "CRM returns · excluded from active order value / outstanding",
        columns: [
          { header: "Date", width: 18 },
          { header: "Order", width: 20 },
          { header: "Client", width: 32 },
          { header: "Status", width: 18 },
          { header: "Items", width: 36, small: true },
          { header: "Cash received", align: "right", width: 24 },
          { header: "Refunds", align: "right", width: 22 },
          { header: "Cashback", align: "right", width: 20 },
        ],
        rows: crmSplit.returned.map((r) => [
          r.date || "—",
          r.orderNumber || "—",
          r.clientName || "—",
          "returned",
          shortItems(r.items),
          pkr(Number(r.receivedInPeriod) || 0),
          pkr(Number(r.refundsInPeriod) || 0),
          pkr(Number(r.cashbackInPeriod) || 0),
        ]),
        foot: [
          "",
          "",
          String(crmSplit.returnedCount),
          "",
          "",
          pkr(crmSplit.returnedReceived),
          pkr(crmSplit.returnedRefunds),
          pkr(crmSplit.returnedCashback),
        ],
      })
    }

    if (crmSplit.allCashback > 0.004) {
      const cashbackRows = crmAll.filter((r) => (Number(r.cashbackInPeriod) || 0) > 0.004)
      tables.push({
        title: "CRM cashback · period (shown separately so active totals stay clear)",
        columns: [
          { header: "Date", width: 18 },
          { header: "Order", width: 22 },
          { header: "Client", width: 40 },
          { header: "Status", width: 22 },
          { header: "Cashback", align: "right", width: 28 },
        ],
        rows: cashbackRows.map((r) => [
          r.date || "—",
          r.orderNumber || "—",
          r.clientName || "—",
          String(r.status || "—").replace(/_/g, " "),
          pkr(Number(r.cashbackInPeriod) || 0),
        ]),
        foot: ["", "", String(cashbackRows.length), "", pkr(crmSplit.allCashback)],
      })
    }
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
      opts.includeCrm
        ? "CRM active totals exclude returned orders; returns & cashback listed separately."
        : "",
    ].filter(Boolean),
    filename: `sales-report-${slug}-${from}-to-${to}.pdf`,
    compact: true,
    pagePerTable: false,
    tables,
    closingBanner: {
      title: "Combined totals (active CRM + POS)",
      lines: [
        { label: "Combined · sale value", value: pkr(combinedSale) },
        { label: "Combined · received", value: pkr(combinedReceived) },
        { label: "Combined · credit", value: pkr(combinedCredit) },
      ],
    },
  })
}
