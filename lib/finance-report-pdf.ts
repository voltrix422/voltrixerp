import type {
  FinanceExpenseByPerson,
  FinanceExpenseLine,
  FinanceOrderRow,
  FinancePdfItem,
  FinancePosRow,
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
  expensesByCategory?: { category: string; amount: number }[]
  expensesByPerson?: FinanceExpenseByPerson[]
  expenseLines?: FinanceExpenseLine[]
  posSales?: FinancePosRow[]
  orders?: FinanceOrderRow[]
  paymentMethods?: { method: string; amount: number }[]
  topOutstandingClients?: { name: string; orderNumber: string; remaining: number }[]
  recentActivity?: { date: string; label: string; amount: number; category: string; source: string }[]
}

const MONEY_IN_LABELS: Record<string, string> = {
  clientPayments: "Client payments (CRM orders)",
  posSales: "POS sales (counter + branch)",
  incomeRecords: "Income records",
  loans: "Loans in (received + recovered)",
  loansReceived: "Loans received from people",
  loanRecoveries: "Loan amounts returned to us",
}

const MONEY_OUT_LABELS: Record<string, string> = {
  expenses: "Expenses (records)",
  loansGiven: "Loans given / repaid by us",
  salaries: "Salaries (payroll)",
  localPurchases: "Local purchase orders",
  purchaseLedger: "Purchase ledger",
  purchaseLedgerPurchases: "Purchases (ledger)",
  purchaseLedgerRents: "Rents (ledger)",
  importedPurchases: "Imported purchase orders",
  importShipments: "Import shipment payments",
  importPsw: "Import PSW / customs duties",
  importCharges: "Import landing charges",
  importChargesCombined: "Import PSW + charges",
  pettyCash: "Petty cash (approved receipts)",
  advances: "Advances",
  supplierAdvances: "Supplier advances",
  salaryAdvances: "Salary advances",
  cashback: "Cashback paid to clients",
  clientRefunds: "Client refunds (returns)",
  fuelPetrol: "Petrol / fuel",
}

function moneyRows(
  obj: Record<string, number | undefined> | undefined,
  labels: Record<string, string>,
  total: number,
): (string | number)[][] {
  if (!obj) return []
  return Object.entries(obj)
    .filter(([, n]) => typeof n === "number" && Math.abs(n as number) > 0.004)
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

function productBlock(item: FinancePdfItem) {
  const lines = [item.description || "Item"]
  if (item.model) lines.push(`Model: ${item.model}`)
  if (item.inventory) lines.push(`Stock: ${item.inventory}`)
  return lines.join("\n")
}

function qtyBlock(item: FinancePdfItem) {
  return `${item.qty} ${item.unit || "pcs"}`
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

  const expenses = data.expenseLines || []
  const byPerson = data.expensesByPerson || []
  const byCategory = data.expensesByCategory || []
  const posSales = data.posSales || []
  const orders = data.orders || []
  const methods = data.paymentMethods || []
  const outstanding = data.topOutstandingClients || []

  const expenseTotal = expenses.reduce((sum, r) => sum + r.amount, 0)
  const posTotal = posSales.reduce((sum, r) => sum + r.total, 0)
  const posItemCount = posSales.reduce((sum, r) => sum + r.items.length, 0)
  const orderTotal = orders.reduce((sum, r) => sum + r.total, 0)
  const orderReceived = orders.reduce((sum, r) => sum + r.receivedInPeriod, 0)
  const orderItemCount = orders.reduce((sum, r) => sum + r.items.length, 0)
  const outstandingTotal = outstanding.reduce((sum, r) => sum + r.remaining, 0)

  const inRows = moneyRows(s.breakdown?.moneyIn, MONEY_IN_LABELS, moneyIn)
  const outRows = moneyRows(s.breakdown?.moneyOut, MONEY_OUT_LABELS, moneyOut)

  const tables: PlainTable[] = [
    {
      title: "Cash snapshot",
      note: "Totals for the selected period only. Outstanding and all-time balances are listed later and are not part of net cash.",
      columns: [
        { header: "Figure", width: 95 },
        { header: "What it means", width: 110 },
        { header: "Amount", align: "right", width: 68 },
      ],
      rows: [
        ["Money in", "Cash received in this period (clients, POS, loans, income)", pkr(moneyIn)],
        ["Money out", "Cash leaving in this period (expenses, payroll, imports, refunds)", pkr(moneyOut)],
        [
          net >= 0 ? "Net surplus" : "Net deficit",
          net >= 0 ? "Money in minus money out" : "Money out is higher than money in",
          pkr(net),
        ],
      ],
    },
    {
      title: "What this report contains",
      note: "Use the sections below for the full working. Empty sections are omitted.",
      columns: [
        { header: "Section", width: 70 },
        { header: "Count", align: "right", width: 28 },
        { header: "Amount / note", width: 175 },
      ],
      rows: [
        ["Expenses", String(expenses.length), `${pkr(expenseTotal)}  ·  ${byPerson.length} people`],
        ["POS sales", String(posSales.length), `${pkr(posTotal)}  ·  ${posItemCount} products`],
        ["Orders", String(orders.length), `${pkr(orderReceived)} received of ${pkr(orderTotal)}  ·  ${orderItemCount} items`],
        ["Outstanding clients", String(outstanding.length), pkr(outstandingTotal)],
      ],
    },
  ]

  if (inRows.length) {
    tables.push({
      title: "Money in — by source",
      note: "Each line is already included in Money in above. Share is that line as a percent of money in.",
      columns: [
        { header: "Source", width: 160 },
        { header: "Amount", align: "right", width: 65 },
        { header: "Share", align: "right", width: 48 },
      ],
      rows: inRows,
      foot: ["Total money in", pkr(moneyIn), "100%"],
    })
  }

  if (outRows.length) {
    tables.push({
      title: "Money out — by source",
      note: "Each line is already included in Money out above. Share is that line as a percent of money out.",
      columns: [
        { header: "Source", width: 160 },
        { header: "Amount", align: "right", width: 65 },
        { header: "Share", align: "right", width: 48 },
      ],
      rows: outRows,
      foot: ["Total money out", pkr(moneyOut), "100%"],
    })
  }

  if (byPerson.length) {
    tables.push({
      title: "Expenses — who entered them",
      note: "Grouped by the ERP user who recorded the expense. Receipt person, if different, is on the next table.",
      columns: [
        { header: "Entered by", width: 110 },
        { header: "Entries", align: "right", width: 32 },
        { header: "Amount", align: "right", width: 65 },
        { header: "Share", align: "right", width: 66 },
      ],
      rows: byPerson.map((r) => [r.name, String(r.count), pkr(r.amount), pct(r.amount, expenseTotal)]),
      foot: ["All people", String(byPerson.reduce((n, r) => n + r.count, 0)), pkr(expenseTotal), "100%"],
    })
  }

  if (byCategory.length) {
    const catTotal = byCategory.reduce((n, r) => n + r.amount, 0)
    tables.push({
      title: "Expenses — by category",
      note: "Same expense records, grouped by category.",
      columns: [
        { header: "Category", width: 142 },
        { header: "Amount", align: "right", width: 65 },
        { header: "Share", align: "right", width: 66 },
      ],
      rows: byCategory.map((r) => [r.category, pkr(r.amount), pct(r.amount, catTotal)]),
      foot: ["All categories", pkr(catTotal), "100%"],
    })
  }

  if (expenses.length) {
    tables.push({
      title: "All expense entries",
      note: "Every expense, payment, tax, or other cash-out record in the date range.",
      newPage: true,
      columns: [
        { header: "Date", width: 24 },
        { header: "Entered by", width: 38 },
        { header: "Receipt from", width: 36 },
        { header: "Description", width: 95 },
        { header: "Category", width: 28 },
        { header: "Amount", align: "right", width: 52 },
      ],
      rows: expenses.map((r) => [
        r.date,
        r.createdBy || "—",
        r.receiptPerson || "—",
        r.title,
        r.category,
        pkr(r.amount),
      ]),
      foot: ["", "", "", `Total · ${expenses.length} entries`, "", pkr(expenseTotal)],
    })
  }

  if (posSales.length) {
    tables.push({
      title: "POS sales",
      note: "Counter receipts and branch POS orders created in this period. Product lines follow.",
      newPage: true,
      columns: [
        { header: "Date", width: 24 },
        { header: "Sale no.", width: 36 },
        { header: "Type", width: 28 },
        { header: "Customer", width: 42 },
        { header: "Cashier", width: 36 },
        { header: "Pay", width: 22 },
        { header: "Products", width: 33 },
        { header: "Amount", align: "right", width: 52 },
      ],
      rows: posSales.map((r) => [
        r.date,
        r.number,
        r.kind,
        r.customer,
        r.cashier,
        prettyMethod(r.method),
        String(r.items.length),
        pkr(r.total),
      ]),
      foot: ["", "", "", "", "", "", String(posItemCount), pkr(posTotal)],
    })

    const posItems = posSales.flatMap((r) =>
      r.items.map((item) => [
        r.date,
        r.number,
        r.customer,
        productBlock(item),
        qtyBlock(item),
        pkr(item.unitPrice),
        pkr(item.lineTotal),
      ]),
    )
    if (posItems.length) {
      tables.push({
        title: "POS products sold",
        note: "Each inventory / POS line sold on the receipts above.",
        columns: [
          { header: "Date", width: 24 },
          { header: "Sale no.", width: 34 },
          { header: "Customer", width: 40 },
          { header: "Product / stock", width: 88 },
          { header: "Qty", width: 22 },
          { header: "Unit price", align: "right", width: 32 },
          { header: "Line total", align: "right", width: 33 },
        ],
        rows: posItems,
      })
    }
  }

  if (orders.length) {
    tables.push({
      title: "Client orders",
      note: "CRM orders created or paid in this period. Received is cash taken inside the date range, not the full order unless it was paid here.",
      newPage: true,
      columns: [
        { header: "Date", width: 24 },
        { header: "Order no.", width: 32 },
        { header: "Client", width: 48 },
        { header: "Status", width: 28 },
        { header: "Created by", width: 32 },
        { header: "Items", width: 18 },
        { header: "Order total", align: "right", width: 42 },
        { header: "Received here", align: "right", width: 49 },
      ],
      rows: orders.map((r) => [
        r.date,
        r.orderNumber,
        r.clientName,
        prettyStatus(r.status),
        r.createdBy,
        String(r.items.length),
        pkr(r.total),
        pkr(r.receivedInPeriod),
      ]),
      foot: ["", "", "", "", "", String(orderItemCount), pkr(orderTotal), pkr(orderReceived)],
    })

    const orderItems = orders.flatMap((r) =>
      r.items.map((item) => [
        r.orderNumber,
        r.clientName,
        productBlock(item),
        qtyBlock(item),
        pkr(item.unitPrice),
        pkr(item.lineTotal),
      ]),
    )
    if (orderItems.length) {
      tables.push({
        title: "Order inventory items",
        note: "Product, model, and stock reference for every line on the orders above.",
        columns: [
          { header: "Order no.", width: 32 },
          { header: "Client", width: 44 },
          { header: "Product / model / stock", width: 102 },
          { header: "Qty", width: 22 },
          { header: "Unit price", align: "right", width: 36 },
          { header: "Line total", align: "right", width: 37 },
        ],
        rows: orderItems,
      })
    }
  }

  if (methods.length) {
    const methodTotal = methods.reduce((n, r) => n + r.amount, 0)
    tables.push({
      title: "Client payments by method",
      note: "Approved CRM payments received in this period, split by how the client paid.",
      columns: [
        { header: "Payment method", width: 142 },
        { header: "Amount", align: "right", width: 65 },
        { header: "Share", align: "right", width: 66 },
      ],
      rows: methods.map((r) => [prettyMethod(r.method), pkr(r.amount), pct(r.amount, methodTotal)]),
      foot: ["All methods", pkr(methodTotal), "100%"],
    })
  }

  if (outstanding.length) {
    tables.push({
      title: "Outstanding client balances",
      note: "Open credit still due. This is a current balance, not limited to the date range.",
      columns: [
        { header: "Client", width: 90 },
        { header: "Order no.", width: 50 },
        { header: "Still due", align: "right", width: 133 },
      ],
      rows: outstanding.map((r) => [r.name, r.orderNumber, pkr(r.remaining)]),
      foot: [`${outstanding.length} orders`, "", pkr(outstandingTotal)],
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
      `Currency  PKR     ·     Generated  ${generated}  (Pakistan time)`,
      `Money in  ${pkr(moneyIn)}     ·     Money out  ${pkr(moneyOut)}     ·     Net  ${pkr(net)}`,
    ],
    filename: `finance-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    tables,
    landscape: true,
  })
}
