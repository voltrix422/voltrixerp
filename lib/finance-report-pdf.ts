import type {
  FinanceExpenseByPerson,
  FinanceLedgerLine,
  FinanceOrderRow,
  FinancePdfItem,
  FinancePettyCashLine,
  FinancePosRow,
  FinancePurchaseRow,
} from "@/lib/finance-report-details"
import { dateRangeLabel, downloadPlainReportPdf, pct, pkr, type PlainTable } from "@/lib/plain-report-pdf"

type OverviewLike = {
  periodLabel?: string
  summary?: Record<string, number | undefined> & {
    breakdown?: {
      moneyIn?: Record<string, number | undefined>
      moneyOut?: Record<string, number | undefined>
    }
  }
  posSales?: FinancePosRow[]
  orders?: FinanceOrderRow[]
  pettyCashLines?: FinancePettyCashLine[]
  pettyCashByPerson?: FinanceExpenseByPerson[]
  localPurchases?: FinancePurchaseRow[]
  importedPurchases?: FinancePurchaseRow[]
  ledgerLines?: FinanceLedgerLine[]
  ledgerByPerson?: FinanceExpenseByPerson[]
  ledgerTotals?: { count: number; purchases: number; rents: number; total: number; paid: number; due: number }
  paymentMethods?: { method: string; amount: number }[]
}

const MONEY_IN_LABELS: Record<string, string> = {
  clientPayments: "Client payments",
  posSales: "POS sales",
  incomeRecords: "Income records",
  loans: "Loans in",
  loansReceived: "Loans received",
  loanRecoveries: "Loan recoveries",
}

const MONEY_OUT_LABELS: Record<string, string> = {
  expenses: "Finance record expenses",
  loansGiven: "Loans given",
  salaries: "Salaries",
  localPurchases: "Local purchase orders",
  purchaseLedger: "Purchase ledger — office bills",
  purchaseLedgerPurchases: "Purchase ledger — office bills",
  purchaseLedgerRents: "Purchase ledger — rents",
  importedPurchases: "Imported purchase orders",
  importShipments: "Import shipment payments",
  importPsw: "Import PSW / customs",
  importCharges: "Import landing charges",
  importChargesCombined: "Import PSW + charges",
  pettyCash: "Petty cash",
  advances: "Advances",
  supplierAdvances: "Supplier advances",
  salaryAdvances: "Salary advances",
  cashback: "Cashback",
  clientRefunds: "Client refunds",
  fuelPetrol: "Petrol / fuel",
}

const HIDE_IF_CHILD: Record<string, string[]> = {
  loans: ["loansReceived", "loanRecoveries"],
  purchaseLedger: ["purchaseLedgerPurchases", "purchaseLedgerRents"],
  importPsw: ["importChargesCombined"],
  importCharges: ["importChargesCombined"],
}

function moneyRows(
  obj: Record<string, number | undefined> | undefined,
  labels: Record<string, string>,
  total: number,
): (string | number)[][] {
  if (!obj) return []
  return Object.entries(obj)
    .filter(([k, n]) => {
      if (typeof n !== "number" || Math.abs(n) <= 0.004) return false
      const children = HIDE_IF_CHILD[k]
      if (!children) return true
      return !children.some((child) => Math.abs(Number(obj[child]) || 0) > 0.004)
    })
    .map(([k, n]) => [labels[k] || k, pkr(n as number), pct(n as number, total)])
}

function prettyStatus(value: string) {
  return String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function prettyMethod(value: string) {
  const v = String(value || "—").trim()
  if (!v) return "—"
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function qtyBlock(item: { qty: number; unit?: string }) {
  return `${item.qty} ${item.unit || "pcs"}`
}

function compactItems(items: FinancePdfItem[]) {
  if (!items.length) return "—"
  return items
    .map((item) => {
      const name = item.description || item.model || "Item"
      const qty = item.qty > 0 ? `${item.qty}× ` : ""
      return `${qty}${name}`
    })
    .join("\n")
}

function payLabel(total: number, paid: number, method?: string) {
  const due = Math.max(0, total - paid)
  const methodBit = method ? ` · ${prettyMethod(method)}` : ""
  if (total <= 0.004 && paid <= 0.004) return "—"
  if (paid <= 0.004) return `Credit · unpaid${methodBit}`
  if (due <= 0.5) return `Paid in full${methodBit}`
  return `Part paid ${pkr(paid)} · due ${pkr(due)}${methodBit}`
}

function purchaseOrderTables(title: string, rows: FinancePurchaseRow[]): PlainTable[] {
  if (!rows.length) return []
  const paid = rows.reduce((s, r) => s + r.paidInPeriod, 0)
  const tables: PlainTable[] = [
    {
      title,
      newPage: true,
      columns: [
        { header: "Date", width: 22 },
        { header: "PO no.", width: 28 },
        { header: "Supplier", width: 46 },
        { header: "Status", width: 26 },
        { header: "By", width: 26 },
        { header: "Paid", align: "right", width: 28 },
      ],
      rows: rows.map((r) => [
        r.date,
        r.poNumber,
        r.supplier,
        prettyStatus(r.status),
        r.createdBy,
        pkr(r.paidInPeriod),
      ]),
      foot: ["", "", "", "", `${rows.length}`, pkr(paid)],
    },
  ]
  const items = rows.flatMap((r) =>
    r.items.map((item) => [
      r.poNumber,
      r.supplier,
      item.description,
      qtyBlock(item),
      item.unitPrice > 0 ? pkr(item.unitPrice) : "—",
      item.lineTotal > 0 ? pkr(item.lineTotal) : "—",
    ]),
  )
  if (items.length) {
    tables.push({
      title: `${title} — items`,
      newPage: true,
      columns: [
        { header: "PO no.", width: 26 },
        { header: "Supplier", width: 36 },
        { header: "Product", width: 60 },
        { header: "Qty", width: 18 },
        { header: "Unit", align: "right", width: 22 },
        { header: "Total", align: "right", width: 24 },
      ],
      rows: items,
    })
  }
  return tables
}

export async function downloadFinanceOverviewPdf(
  data: OverviewLike,
  opts?: { dateFrom?: string; dateTo?: string },
) {
  const s = data.summary || {}
  const moneyIn = Number(s.moneyIn) || 0
  const moneyOut = Number(s.moneyOut) || 0
  const net = Number(s.netCashFlow) || moneyIn - moneyOut
  const range =
    opts?.dateFrom || opts?.dateTo
      ? dateRangeLabel(opts.dateFrom || "", opts.dateTo || "")
      : data.periodLabel || "Selected period"

  const posSales = data.posSales || []
  const orders = data.orders || []
  const pettyLines = data.pettyCashLines || []
  const pettyByPerson = data.pettyCashByPerson || []
  const localPurchases = data.localPurchases || []
  const importedPurchases = data.importedPurchases || []
  const ledgerLines = data.ledgerLines || []
  const ledgerByPerson = data.ledgerByPerson || []
  const methods = data.paymentMethods || []

  const pettyTotal = pettyLines.reduce((sum, r) => sum + r.amount, 0)
  const ledgerTotal = data.ledgerTotals?.total ?? ledgerLines.reduce((sum, r) => sum + r.total, 0)
  const ledgerPaid = data.ledgerTotals?.paid ?? ledgerLines.reduce((sum, r) => sum + r.paid, 0)
  const ledgerDue = data.ledgerTotals?.due ?? ledgerLines.reduce((sum, r) => sum + r.due, 0)
  const posTotal = posSales.reduce((sum, r) => sum + r.total, 0)
  const orderTotal = orders.reduce((sum, r) => sum + r.total, 0)

  const inRows = moneyRows(s.breakdown?.moneyIn, MONEY_IN_LABELS, moneyIn)
  const outRows = moneyRows(s.breakdown?.moneyOut, MONEY_OUT_LABELS, moneyOut)

  const tables: PlainTable[] = [
    {
      title: "Summary",
      columns: [
        { header: "Figure", width: 90 },
        { header: "Amount", align: "right", width: 96 },
      ],
      rows: [
        ["Money in", pkr(moneyIn)],
        ["Money out", pkr(moneyOut)],
        [net >= 0 ? "Net surplus" : "Net deficit", pkr(net)],
      ],
    },
  ]

  if (inRows.length) {
    tables.push({
      title: "Money in",
      newPage: true,
      columns: [
        { header: "Source", width: 120 },
        { header: "Amount", align: "right", width: 44 },
        { header: "%", align: "right", width: 18 },
      ],
      rows: inRows,
      foot: ["Total", pkr(moneyIn), "100%"],
    })
  }

  if (outRows.length) {
    tables.push({
      title: "Money out",
      newPage: true,
      columns: [
        { header: "Source", width: 120 },
        { header: "Amount", align: "right", width: 44 },
        { header: "%", align: "right", width: 18 },
      ],
      rows: outRows,
      foot: ["Total", pkr(moneyOut), "100%"],
    })
  }

  if (ledgerByPerson.length) {
    tables.push({
      title: "Purchase ledger — entered by",
      newPage: true,
      columns: [
        { header: "Entered by", width: 80 },
        { header: "Entries", align: "right", width: 28 },
        { header: "Paid", align: "right", width: 40 },
        { header: "%", align: "right", width: 38 },
      ],
      rows: ledgerByPerson.map((r) => [r.name, String(r.count), pkr(r.amount), pct(r.amount, ledgerPaid || ledgerTotal)]),
      foot: ["Total", String(ledgerLines.length), pkr(ledgerPaid || ledgerTotal), "100%"],
    })
  }

  if (ledgerLines.length) {
    tables.push({
      title: "Purchase ledger — Main Office bills",
      newPage: true,
      columns: [
        { header: "Date", width: 22 },
        { header: "Ledger", width: 22 },
        { header: "By", width: 24 },
        { header: "Supplier", width: 32 },
        { header: "Items", width: 34 },
        { header: "Total", align: "right", width: 18 },
        { header: "Paid", align: "right", width: 17 },
        { header: "Due", align: "right", width: 17 },
      ],
      rows: ledgerLines.map((r) => [
        r.date,
        r.ledgerNumber,
        r.createdBy,
        r.supplier,
        r.itemsLabel,
        pkr(r.total),
        pkr(r.paid),
        pkr(r.due),
      ]),
      foot: ["", "", "", "", `${ledgerLines.length}`, pkr(ledgerTotal), pkr(ledgerPaid), pkr(ledgerDue)],
    })

    const ledgerItems = ledgerLines.flatMap((r) =>
      r.itemLines.map((item) => [
        r.ledgerNumber,
        r.supplier,
        item.description,
        item.qty ? String(item.qty) : "—",
        item.unitPrice > 0 ? pkr(item.unitPrice) : "—",
        item.lineTotal > 0 ? pkr(item.lineTotal) : "—",
      ]),
    )
    if (ledgerItems.length) {
      tables.push({
        title: "Purchase ledger — bill items",
        newPage: true,
        columns: [
          { header: "Ledger", width: 24 },
          { header: "Supplier", width: 36 },
          { header: "Item", width: 62 },
          { header: "Qty", width: 16 },
          { header: "Unit", align: "right", width: 24 },
          { header: "Total", align: "right", width: 24 },
        ],
        rows: ledgerItems,
      })
    }
  }

  if (pettyByPerson.length) {
    tables.push({
      title: "Petty cash — by employee",
      newPage: true,
      columns: [
        { header: "Employee", width: 80 },
        { header: "Receipts", align: "right", width: 28 },
        { header: "Amount", align: "right", width: 40 },
        { header: "%", align: "right", width: 38 },
      ],
      rows: pettyByPerson.map((r) => [r.name, String(r.count), pkr(r.amount), pct(r.amount, pettyTotal)]),
      foot: ["Total", String(pettyLines.length), pkr(pettyTotal), "100%"],
    })
  }

  if (pettyLines.length) {
    tables.push({
      title: "Petty cash",
      newPage: true,
      columns: [
        { header: "Date", width: 22 },
        { header: "Employee", width: 40 },
        { header: "Category", width: 28 },
        { header: "Description", width: 60 },
        { header: "Amount", align: "right", width: 36 },
      ],
      rows: pettyLines.map((r) => [r.date, r.employee, r.category, r.description, pkr(r.amount)]),
      foot: ["", "", "", `${pettyLines.length}`, pkr(pettyTotal)],
    })
  }

  tables.push(...purchaseOrderTables("Local purchase orders", localPurchases))
  tables.push(...purchaseOrderTables("Imported purchase orders", importedPurchases))

  if (posSales.length) {
    tables.push({
      title: "POS sales",
      newPage: true,
      columns: [
        { header: "Date", width: 18 },
        { header: "Sale no.", width: 24 },
        { header: "Customer", width: 28 },
        { header: "Items", width: 48, small: true },
        { header: "Payment", width: 36, small: true },
        { header: "Amount", align: "right", width: 28 },
      ],
      rows: posSales.map((r) => [
        r.date,
        r.number,
        r.customer,
        compactItems(r.items),
        payLabel(r.total, r.paidTotal ?? r.total, r.method),
        pkr(r.total),
      ]),
      foot: ["", "", "", "", `${posSales.length}`, pkr(posTotal)],
    })
  }

  if (orders.length) {
    tables.push({
      title: "Client orders",
      newPage: true,
      columns: [
        { header: "Date", width: 18 },
        { header: "Order no.", width: 24 },
        { header: "Client", width: 28 },
        { header: "Items", width: 48, small: true },
        { header: "Payment", width: 36, small: true },
        { header: "Total", align: "right", width: 28 },
      ],
      rows: orders.map((r) => [
        r.date,
        r.orderNumber,
        r.clientName,
        compactItems(r.items),
        payLabel(r.total, r.paidTotal ?? r.receivedInPeriod),
        pkr(r.total),
      ]),
      foot: ["", "", "", "", `${orders.length}`, pkr(orderTotal)],
    })
  }

  if (methods.length) {
    const methodTotal = methods.reduce((n, r) => n + r.amount, 0)
    tables.push({
      title: "Payments by method",
      newPage: true,
      columns: [
        { header: "Method", width: 100 },
        { header: "Amount", align: "right", width: 46 },
        { header: "%", align: "right", width: 40 },
      ],
      rows: methods.map((r) => [prettyMethod(r.method), pkr(r.amount), pct(r.amount, methodTotal)]),
      foot: ["Total", pkr(methodTotal), "100%"],
    })
  }

  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  await downloadPlainReportPdf({
    title: "Finance report",
    subtitle: range,
    meta: [
      `Currency  PKR`,
      `Generated  ${generated}  (Pakistan time)`,
      `Money in  ${pkr(moneyIn)}      Money out  ${pkr(moneyOut)}      Net  ${pkr(net)}`,
    ],
    filename: `finance-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    pagePerTable: true,
    tables,
  })
}
