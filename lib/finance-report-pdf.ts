import type {
  FinanceExpenseLine,
  FinanceLedgerLine,
  FinanceOrderRow,
  FinancePdfItem,
  FinancePettyCashLine,
  FinancePosRow,
  FinancePurchaseRow,
  FinanceExpenseByPerson,
} from "@/lib/finance-report-details"
import type { MoneyOutDetailLine } from "@/lib/finance-money-out-details"
import { dateRangeLabel, downloadPlainReportPdf, pct, pkr, type PlainTable } from "@/lib/plain-report-pdf"

type OverviewLike = {
  periodLabel?: string
  summary?: Record<string, number | undefined> & {
    breakdown?: {
      moneyIn?: Record<string, number | undefined>
      moneyOut?: Record<string, number | undefined>
    }
  }
  moneyOutDetails?: {
    salaryAdvances?: MoneyOutDetailLine[]
    expenses?: MoneyOutDetailLine[]
    salaries?: MoneyOutDetailLine[]
    fuelPetrol?: MoneyOutDetailLine[]
    loansGiven?: MoneyOutDetailLine[]
  }
  moneyInDetails?: {
    loans?: MoneyOutDetailLine[]
  }
  expenseLines?: FinanceExpenseLine[]
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

/** Same buckets as finance overview moneyOut (salary advances given in the period are cash out). */
const MONEY_OUT_COUNTED = new Set([
  "expenses",
  "loansGiven",
  "salaries",
  "purchaseLedger",
  "purchaseLedgerPurchases",
  "purchaseLedgerRents",
  "pettyCash",
  "importChargesCombined",
  "importPsw",
  "importCharges",
  "cashback",
  "clientRefunds",
  "fuelPetrol",
  "salaryAdvances",
])

function moneyRows(
  obj: Record<string, number | undefined> | undefined,
  labels: Record<string, string>,
  total: number,
  countedKeys?: Set<string>,
): (string | number)[][] {
  if (!obj) return []
  return Object.entries(obj)
    .filter(([k, n]) => {
      if (countedKeys && !countedKeys.has(k)) return false
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

function shortDate(value: string) {
  const raw = String(value || "").trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1].slice(2)}`
  const gb = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (gb) return `${gb[1]}/${gb[2]}/${gb[3].slice(2)}`
  return raw
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

function orderCashLabel(r: FinanceOrderRow) {
  const received = Number(r.receivedInPeriod) || 0
  const lifetime = payLabel(r.total, r.paidTotal ?? received)
  if (received <= 0.004) return lifetime
  if (Math.abs(received - r.total) <= 0.5) return lifetime
  return `Received ${pkr(received)} · order ${pkr(r.total)} · ${lifetime}`
}

function personDetailTable(
  title: string,
  lines: MoneyOutDetailLine[],
  personHeader = "Person",
): PlainTable | null {
  if (!lines.length) return null
  const total = lines.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  return {
    title,
    columns: [
      { header: "Date", width: 24 },
      { header: personHeader, width: 44 },
      { header: "Detail", width: 72, small: true },
      { header: "Amount", align: "right", width: 36 },
    ],
    rows: lines.map((r) => [
      r.date || "—",
      r.label || "—",
      r.sublabel || "—",
      pkr(r.amount),
    ]),
    foot: ["", "", String(lines.length), pkr(total)],
  }
}

function purchaseOrderTables(title: string, rows: FinancePurchaseRow[]): PlainTable[] {
  if (!rows.length) return []
  const paid = rows.reduce((s, r) => s + r.paidInPeriod, 0)
  const tables: PlainTable[] = [
    {
      title,
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
  const orders = (data.orders || []).filter((r) => (Number(r.receivedInPeriod) || 0) > 0.004)
  const expenseLines = data.expenseLines || []
  const pettyLines = data.pettyCashLines || []
  const pettyByPerson = data.pettyCashByPerson || []
  const localPurchases = data.localPurchases || []
  const importedPurchases = data.importedPurchases || []
  const ledgerLines = data.ledgerLines || []
  const ledgerByPerson = data.ledgerByPerson || []
  const methods = data.paymentMethods || []

  const pettyTotal = pettyLines.reduce((sum, r) => sum + r.amount, 0)
  const paidLedgerLines = ledgerLines.filter((r) => r.paid > 0.004)
  const ledgerPaid = data.ledgerTotals?.paid ?? paidLedgerLines.reduce((sum, r) => sum + r.paid, 0)
  const posTotal = posSales.reduce((sum, r) => sum + r.total, 0)
  const orderReceivedTotal = orders.reduce((sum, r) => sum + (Number(r.receivedInPeriod) || 0), 0)

  const inRows = moneyRows(s.breakdown?.moneyIn, MONEY_IN_LABELS, moneyIn)
  const outRows = moneyRows(s.breakdown?.moneyOut, MONEY_OUT_LABELS, moneyOut, MONEY_OUT_COUNTED)
  const methodTotal = methods.reduce((n, r) => n + r.amount, 0)

  const moneyInTables: PlainTable[] = []
  const moneyOutTables: PlainTable[] = []

  if (inRows.length) {
    moneyInTables.push({
      title: "Summary",
      sectionStart: "Money in",
      columns: [
        { header: "Source", width: 120 },
        { header: "Amount", align: "right", width: 44 },
        { header: "%", align: "right", width: 18 },
      ],
      rows: inRows,
      foot: ["Total", pkr(moneyIn), "100%"],
    })
  } else {
    moneyInTables.push({
      title: "Summary",
      sectionStart: "Money in",
      columns: [
        { header: "Source", width: 120 },
        { header: "Amount", align: "right", width: 44 },
        { header: "%", align: "right", width: 18 },
      ],
      rows: [["—", "—", "—"]],
    })
  }

  const loanInTable = personDetailTable(
    "Loans in — from whom",
    data.moneyInDetails?.loans || [],
    "From",
  )
  if (loanInTable) moneyInTables.push(loanInTable)

  if (orders.length) {
    const crmCreditTotal = orders.reduce(
      (s, r) => s + Math.max(0, (Number(r.total) || 0) - (Number(r.paidTotal) || 0)),
      0,
    )
    moneyInTables.push({
      title: "CRM client payments received",
      columns: [
        { header: "Date", width: 18, minWidth: 16 },
        { header: "Order no.", width: 20 },
        { header: "Client", width: 26 },
        { header: "Items", width: 32, small: true },
        { header: "Payment", width: 28, small: true },
        { header: "Total", align: "right", width: 20 },
        { header: "Received", align: "right", width: 22 },
        { header: "Credit", align: "right", width: 18 },
      ],
      rows: orders.map((r) => [
        shortDate(r.date),
        r.orderNumber,
        r.clientName,
        compactItems(r.items),
        orderCashLabel(r),
        pkr(r.total),
        pkr(r.receivedInPeriod),
        pkr(Math.max(0, (Number(r.total) || 0) - (Number(r.paidTotal) || 0))),
      ]),
      foot: ["", "", "", "", `${orders.length}`, "", pkr(orderReceivedTotal), pkr(crmCreditTotal)],
    })
  }

  if (methods.length) {
    moneyInTables.push({
      title: "CRM payments by method",
      columns: [
        { header: "Method", width: 100 },
        { header: "Amount", align: "right", width: 46 },
        { header: "%", align: "right", width: 40 },
      ],
      rows: methods.map((r) => [prettyMethod(r.method), pkr(r.amount), pct(r.amount, methodTotal)]),
      foot: ["Total", pkr(methodTotal), "100%"],
    })
  }

  if (posSales.length) {
    const posReceivedTotal = posSales.reduce((s, r) => s + (Number(r.paidTotal ?? r.total) || 0), 0)
    const posCreditTotal = posSales.reduce(
      (s, r) => s + Math.max(0, (Number(r.total) || 0) - (Number(r.paidTotal ?? r.total) || 0)),
      0,
    )
    moneyInTables.push({
      title: "POS sales",
      columns: [
        { header: "Date", width: 18, minWidth: 16 },
        { header: "Sale no.", width: 22 },
        { header: "Customer", width: 26 },
        { header: "Items", width: 36, small: true },
        { header: "Payment", width: 28, small: true },
        { header: "Total", align: "right", width: 20 },
        { header: "Received", align: "right", width: 22 },
        { header: "Credit", align: "right", width: 18 },
      ],
      rows: posSales.map((r) => [
        shortDate(r.date),
        r.number,
        r.customer,
        compactItems(r.items),
        payLabel(r.total, r.paidTotal ?? r.total, r.method),
        pkr(r.total),
        pkr(r.paidTotal ?? r.total),
        pkr(Math.max(0, (Number(r.total) || 0) - (Number(r.paidTotal ?? r.total) || 0))),
      ]),
      foot: ["", "", "", "", `${posSales.length}`, pkr(posTotal), pkr(posReceivedTotal), pkr(posCreditTotal)],
    })
  }

  if (outRows.length) {
    moneyOutTables.push({
      title: "Summary",
      sectionStart: "Money out",
      columns: [
        { header: "Source", width: 120 },
        { header: "Amount", align: "right", width: 44 },
        { header: "%", align: "right", width: 18 },
      ],
      rows: outRows,
      foot: ["Total", pkr(moneyOut), "100%"],
    })
  } else {
    moneyOutTables.push({
      title: "Summary",
      sectionStart: "Money out",
      columns: [
        { header: "Source", width: 120 },
        { header: "Amount", align: "right", width: 44 },
        { header: "%", align: "right", width: 18 },
      ],
      rows: [["—", "—", "—"]],
    })
  }

  if (expenseLines.length) {
    const expTotal = expenseLines.reduce((sum, r) => sum + r.amount, 0)
    moneyOutTables.push({
      title: "Expenses — paid to",
      columns: [
        { header: "Date", width: 22 },
        { header: "Paid to", width: 36 },
        { header: "Title", width: 48, small: true },
        { header: "Category", width: 28 },
        { header: "Amount", align: "right", width: 32 },
      ],
      rows: expenseLines.map((r) => [
        shortDate(r.date),
        r.paidTo || r.receiptPerson || "—",
        r.title,
        r.category,
        pkr(r.amount),
      ]),
      foot: ["", "", "", String(expenseLines.length), pkr(expTotal)],
    })
  } else {
    const expenseDetail = personDetailTable(
      "Expenses — paid to",
      data.moneyOutDetails?.expenses || [],
      "Paid to",
    )
    if (expenseDetail) moneyOutTables.push(expenseDetail)
  }

  const salaryTable = personDetailTable(
    "Salaries — paid to",
    data.moneyOutDetails?.salaries || [],
    "Staff",
  )
  if (salaryTable) moneyOutTables.push(salaryTable)

  const salaryAdvanceLines = data.moneyOutDetails?.salaryAdvances || []
  if (salaryAdvanceLines.length) {
    const advTotal = salaryAdvanceLines.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    moneyOutTables.push({
      title: "Salary advances — paid to",
      columns: [
        { header: "Date", width: 24 },
        { header: "Staff", width: 40 },
        { header: "Detail", width: 80, small: true },
        { header: "Amount", align: "right", width: 32 },
      ],
      rows: salaryAdvanceLines.map((r) => [
        r.date || "—",
        r.label,
        r.sublabel || "—",
        pkr(r.amount),
      ]),
      foot: ["", "", String(salaryAdvanceLines.length), pkr(advTotal)],
    })
  }

  const fuelTable = personDetailTable(
    "Petrol / fuel — allotted to",
    data.moneyOutDetails?.fuelPetrol || [],
    "Person",
  )
  if (fuelTable) moneyOutTables.push(fuelTable)

  const loansGivenTable = personDetailTable(
    "Loans given — to whom",
    data.moneyOutDetails?.loansGiven || [],
    "To",
  )
  if (loansGivenTable) moneyOutTables.push(loansGivenTable)

  if (ledgerByPerson.length) {
    const paidEntries = ledgerByPerson.reduce((n, r) => n + r.count, 0)
    moneyOutTables.push({
      title: "Purchase ledger — paid by",
      columns: [
        { header: "Entered by", width: 80 },
        { header: "Paid entries", align: "right", width: 28 },
        { header: "Paid", align: "right", width: 40 },
        { header: "%", align: "right", width: 38 },
      ],
      rows: ledgerByPerson.map((r) => [r.name, String(r.count), pkr(r.amount), pct(r.amount, ledgerPaid)]),
      foot: ["Total", String(paidEntries), pkr(ledgerPaid), "100%"],
    })
  }

  if (paidLedgerLines.length) {
    moneyOutTables.push({
      title: "Purchase ledger — Main Office bills",
      columns: [
        { header: "Date", width: 22, minWidth: 22 },
        { header: "Ledger", width: 22 },
        { header: "By", width: 24 },
        { header: "Supplier", width: 32 },
        { header: "Items", width: 46, small: true },
        { header: "Paid", align: "right", width: 32 },
      ],
      rows: paidLedgerLines.map((r) => [
        shortDate(r.date),
        r.ledgerNumber,
        r.createdBy,
        r.supplier,
        r.itemsLabel,
        pkr(r.paid),
      ]),
      foot: ["", "", "", "", `${paidLedgerLines.length}`, pkr(ledgerPaid)],
    })
  }

  if (pettyByPerson.length) {
    moneyOutTables.push({
      title: "Petty cash — by employee",
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
    moneyOutTables.push({
      title: "Petty cash",
      columns: [
        { header: "Date", width: 22 },
        { header: "Employee", width: 40 },
        { header: "Category", width: 28 },
        { header: "Description", width: 60 },
        { header: "Amount", align: "right", width: 36 },
      ],
      rows: pettyLines.map((r) => [shortDate(r.date), r.employee, r.category, r.description, pkr(r.amount)]),
      foot: ["", "", "", `${pettyLines.length}`, pkr(pettyTotal)],
    })
  }

  moneyOutTables.push(...purchaseOrderTables("Local purchase orders", localPurchases))
  moneyOutTables.push(...purchaseOrderTables("Imported purchase orders", importedPurchases))

  const tables: PlainTable[] = [...moneyInTables, ...moneyOutTables]

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
    pagePerTable: false,
    tables,
  })
}
