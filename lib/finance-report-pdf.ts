import { dateRangeLabel, downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"

type OverviewLike = {
  periodLabel?: string
  summary?: Record<string, number | undefined> & {
    breakdown?: {
      moneyIn?: Record<string, number | undefined>
      moneyOut?: Record<string, number | undefined>
    }
  }
  expensesByCategory?: { category: string; amount: number }[]
  paymentMethods?: { method: string; amount: number }[]
  topOutstandingClients?: { name: string; orderNumber: string; remaining: number }[]
  recentActivity?: { date: string; label: string; amount: number; category: string; source: string }[]
}

function moneyRows(obj: Record<string, number | undefined> | undefined): [string, string][] {
  if (!obj) return []
  const labels: Record<string, string> = {
    clientPayments: "Client payments",
    posSales: "POS sales",
    incomeRecords: "Income records",
    loans: "Loans (in)",
    loansReceived: "Loans received",
    loanRecoveries: "Returned to us",
    expenses: "Expenses",
    loansGiven: "Loans given",
    salaries: "Salaries",
    localPurchases: "Local purchases",
    purchaseLedger: "Purchase ledger",
    purchaseLedgerPurchases: "Purchases (ledger)",
    purchaseLedgerRents: "Rents (ledger)",
    importedPurchases: "Imported purchases",
    importShipments: "Import shipments",
    importPsw: "Import PSW",
    importCharges: "Import charges",
    importChargesCombined: "Import charges combined",
    pettyCash: "Petty cash (approved)",
    advances: "Advances",
    supplierAdvances: "Supplier advances",
    salaryAdvances: "Salary advances",
    cashback: "Cashback",
    clientRefunds: "Client refunds",
    fuelPetrol: "Petrol / fuel",
  }
  return Object.entries(obj)
    .filter(([, n]) => typeof n === "number" && Math.abs(n) > 0.004)
    .map(([k, n]) => [labels[k] || k, pkr(n as number)])
}

export async function downloadFinanceOverviewPdf(
  data: OverviewLike,
  opts?: { dateFrom?: string; dateTo?: string },
) {
  const s = data.summary || {}
  const inRows = moneyRows(s.breakdown?.moneyIn)
  const outRows = moneyRows(s.breakdown?.moneyOut)
  const range =
    opts?.dateFrom || opts?.dateTo
      ? dateRangeLabel(opts.dateFrom || "", opts.dateTo || "")
      : data.periodLabel || "Selected period"

  const tables: PlainTable[] = [
    {
      title: "Summary",
      columns: [
        { header: "Item" },
        { header: "Amount", align: "right" },
      ],
      rows: [
        ["Money in", pkr(Number(s.moneyIn) || 0)],
        ["Money out", pkr(Number(s.moneyOut) || 0)],
        ["Net cash flow", pkr(Number(s.netCashFlow) || 0)],
      ],
    },
  ]

  if (inRows.length) {
    tables.push({
      title: "Money in",
      columns: [
        { header: "Source" },
        { header: "Amount", align: "right" },
      ],
      rows: inRows,
    })
  }
  if (outRows.length) {
    tables.push({
      title: "Money out",
      columns: [
        { header: "Source" },
        { header: "Amount", align: "right" },
      ],
      rows: outRows,
    })
  }
  if (data.expensesByCategory?.length) {
    tables.push({
      title: "Expenses by category",
      columns: [
        { header: "Category" },
        { header: "Amount", align: "right" },
      ],
      rows: data.expensesByCategory.map((r) => [r.category, pkr(r.amount)]),
    })
  }
  if (data.paymentMethods?.length) {
    tables.push({
      title: "Client payments by method",
      columns: [
        { header: "Method" },
        { header: "Amount", align: "right" },
      ],
      rows: data.paymentMethods.map((r) => [r.method, pkr(r.amount)]),
    })
  }
  if (data.topOutstandingClients?.length) {
    tables.push({
      title: "Outstanding clients",
      columns: [
        { header: "Client" },
        { header: "Order" },
        { header: "Remaining", align: "right" },
      ],
      rows: data.topOutstandingClients.map((r) => [r.name, r.orderNumber, pkr(r.remaining)]),
    })
  }
  if (data.recentActivity?.length) {
    tables.push({
      title: "Activity",
      columns: [
        { header: "Date" },
        { header: "Description" },
        { header: "Type" },
        { header: "Source" },
        { header: "Amount", align: "right" },
      ],
      rows: data.recentActivity.map((a) => [
        new Date(a.date).toLocaleDateString("en-GB"),
        a.label,
        a.category,
        a.source,
        pkr(a.amount),
      ]),
    })
  }

  await downloadPlainReportPdf({
    title: "Finance report",
    subtitle: range,
    meta: [`Generated ${new Date().toLocaleString("en-PK")}`],
    filename: `finance-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    tables,
  })
}
