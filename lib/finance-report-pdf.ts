import type {
  FinanceExpenseByPerson,
  FinanceExpenseLine,
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
  expensesByCategory?: { category: string; amount: number }[]
  expensesByPerson?: FinanceExpenseByPerson[]
  expenseLines?: FinanceExpenseLine[]
  posSales?: FinancePosRow[]
  orders?: FinanceOrderRow[]
  pettyCashLines?: FinancePettyCashLine[]
  pettyCashByPerson?: FinanceExpenseByPerson[]
  localPurchases?: FinancePurchaseRow[]
  importedPurchases?: FinancePurchaseRow[]
  paymentMethods?: { method: string; amount: number }[]
  topOutstandingClients?: { name: string; orderNumber: string; remaining: number }[]
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
  expenses: "Expenses (finance records)",
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

function qtyBlock(item: { qty: number; unit?: string }) {
  return `${item.qty} ${item.unit || "pcs"}`
}

function purchaseTables(title: string, note: string, rows: FinancePurchaseRow[]): PlainTable[] {
  if (!rows.length) return []
  const paid = rows.reduce((s, r) => s + r.paidInPeriod, 0)
  const itemCount = rows.reduce((s, r) => s + r.items.length, 0)
  const tables: PlainTable[] = [
    {
      title,
      note,
      newPage: true,
      columns: [
        { header: "Date", width: 22 },
        { header: "PO no.", width: 28 },
        { header: "Supplier", width: 42 },
        { header: "Status", width: 28 },
        { header: "By", width: 26 },
        { header: "Paid in range", align: "right", width: 40 },
      ],
      rows: rows.map((r) => [
        r.date,
        r.poNumber,
        r.supplier,
        prettyStatus(r.status),
        r.createdBy,
        pkr(r.paidInPeriod),
      ]),
      foot: ["", "", "", "", `${rows.length} POs`, pkr(paid)],
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
      note: `${itemCount} product lines on the purchase orders above.`,
      columns: [
        { header: "PO no.", width: 28 },
        { header: "Supplier", width: 36 },
        { header: "Product", width: 58 },
        { header: "Qty", width: 20 },
        { header: "Unit price", align: "right", width: 22 },
        { header: "Line total", align: "right", width: 22 },
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

  const expenses = data.expenseLines || []
  const byPerson = data.expensesByPerson || []
  const byCategory = data.expensesByCategory || []
  const posSales = data.posSales || []
  const orders = data.orders || []
  const pettyLines = data.pettyCashLines || []
  const pettyByPerson = data.pettyCashByPerson || []
  const localPurchases = data.localPurchases || []
  const importedPurchases = data.importedPurchases || []
  const methods = data.paymentMethods || []
  const outstanding = data.topOutstandingClients || []

  const expenseTotal = expenses.reduce((sum, r) => sum + r.amount, 0)
  const pettyTotal = pettyLines.reduce((sum, r) => sum + r.amount, 0)
  const localPaid = localPurchases.reduce((sum, r) => sum + r.paidInPeriod, 0)
  const importedPaid = importedPurchases.reduce((sum, r) => sum + r.paidInPeriod, 0)
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
      note: "Totals for the selected period only. Outstanding balances later are not part of net cash.",
      columns: [
        { header: "Figure", width: 42 },
        { header: "What it means", width: 100 },
        { header: "Amount", align: "right", width: 44 },
      ],
      rows: [
        ["Money in", "Cash received (clients, POS, loans, income)", pkr(moneyIn)],
        ["Money out", "Cash leaving (expenses, petty cash, purchases, payroll)", pkr(moneyOut)],
        [
          net >= 0 ? "Net surplus" : "Net deficit",
          net >= 0 ? "Money in minus money out" : "Money out is higher than money in",
          pkr(net),
        ],
      ],
    },
    {
      title: "What this report contains",
      note:
        expenseTotal <= 0 && pettyTotal + localPaid + importedPaid > 0
          ? "Finance-record expenses are 0 in this range. Day-to-day spend is under Petty cash and Purchases."
          : "Each section below is limited to the selected date range unless noted.",
      columns: [
        { header: "Section", width: 52 },
        { header: "Count", align: "right", width: 22 },
        { header: "Amount / note", width: 112 },
      ],
      rows: [
        [
          "Finance expenses",
          String(expenses.length),
          expenseTotal > 0
            ? `${pkr(expenseTotal)}  ·  ${byPerson.length} people`
            : "None recorded in this range",
        ],
        [
          "Petty cash (approved)",
          String(pettyLines.length),
          pettyTotal > 0
            ? `${pkr(pettyTotal)}  ·  ${pettyByPerson.length} people`
            : "None approved in this range",
        ],
        [
          "Local purchases",
          String(localPurchases.length),
          localPurchases.length ? `${pkr(localPaid)} paid in range` : "None in this range",
        ],
        [
          "Imported purchases",
          String(importedPurchases.length),
          importedPurchases.length ? `${pkr(importedPaid)} paid in range` : "None in this range",
        ],
        ["POS sales", String(posSales.length), `${pkr(posTotal)}  ·  ${posItemCount} products`],
        [
          "Orders",
          String(orders.length),
          `${pkr(orderReceived)} received of ${pkr(orderTotal)}  ·  ${orderItemCount} items`,
        ],
        ["Outstanding clients", String(outstanding.length), pkr(outstandingTotal)],
      ],
    },
  ]

  if (inRows.length) {
    tables.push({
      title: "Money in — by source",
      note: "Share is that line as a percent of money in.",
      columns: [
        { header: "Source", width: 110 },
        { header: "Amount", align: "right", width: 42 },
        { header: "Share", align: "right", width: 34 },
      ],
      rows: inRows,
      foot: ["Total money in", pkr(moneyIn), "100%"],
    })
  }

  if (outRows.length) {
    tables.push({
      title: "Money out — by source",
      note: "Share is that line as a percent of money out.",
      columns: [
        { header: "Source", width: 110 },
        { header: "Amount", align: "right", width: 42 },
        { header: "Share", align: "right", width: 34 },
      ],
      rows: outRows,
      foot: ["Total money out", pkr(moneyOut), "100%"],
    })
  }

  if (byPerson.length) {
    tables.push({
      title: "Finance expenses — who entered them",
      note: "ERP users who saved an Expense, Payment, Tax, Salary, or Other record.",
      columns: [
        { header: "Entered by", width: 70 },
        { header: "Entries", align: "right", width: 24 },
        { header: "Amount", align: "right", width: 46 },
        { header: "Share", align: "right", width: 46 },
      ],
      rows: byPerson.map((r) => [r.name, String(r.count), pkr(r.amount), pct(r.amount, expenseTotal)]),
      foot: ["All people", String(byPerson.reduce((n, r) => n + r.count, 0)), pkr(expenseTotal), "100%"],
    })
  }

  if (byCategory.length && expenses.length) {
    const catTotal = byCategory.reduce((n, r) => n + r.amount, 0)
    tables.push({
      title: "Finance expenses — by category",
      columns: [
        { header: "Category", width: 100 },
        { header: "Amount", align: "right", width: 46 },
        { header: "Share", align: "right", width: 40 },
      ],
      rows: byCategory.map((r) => [r.category, pkr(r.amount), pct(r.amount, catTotal)]),
      foot: ["All categories", pkr(catTotal), "100%"],
    })
  }

  tables.push({
    title: "All finance expense entries",
    note:
      expenses.length > 0
        ? "Expense, Payment, Tax, Salary, and Other records in this date range."
        : "No finance records in this range. See Petty cash (approved) and Purchases for cash that left.",
    newPage: expenses.length > 8,
    columns: [
      { header: "Date", width: 22 },
      { header: "Entered by", width: 32 },
      { header: "Receipt from", width: 30 },
      { header: "Description", width: 52 },
      { header: "Type", width: 20 },
      { header: "Amount", align: "right", width: 30 },
    ],
    rows: expenses.map((r) => [
      r.date,
      r.createdBy || "—",
      r.receiptPerson || "—",
      r.title,
      r.category,
      pkr(r.amount),
    ]),
    foot: expenses.length ? ["", "", "", `Total · ${expenses.length}`, "", pkr(expenseTotal)] : undefined,
  })

  if (pettyByPerson.length) {
    tables.push({
      title: "Petty cash — who spent (approved)",
      note: "Approved receipts only. Pending receipts are not included.",
      newPage: true,
      columns: [
        { header: "Employee", width: 70 },
        { header: "Receipts", align: "right", width: 24 },
        { header: "Amount", align: "right", width: 46 },
        { header: "Share", align: "right", width: 46 },
      ],
      rows: pettyByPerson.map((r) => [r.name, String(r.count), pkr(r.amount), pct(r.amount, pettyTotal)]),
      foot: ["All people", String(pettyLines.length), pkr(pettyTotal), "100%"],
    })
  }

  tables.push({
    title: "All approved petty cash",
    note:
      pettyLines.length > 0
        ? "Each approved receipt in the date range (approval date, else submitted date)."
        : "No approved petty cash receipts in this date range.",
    columns: [
      { header: "Date", width: 22 },
      { header: "Employee", width: 40 },
      { header: "Category", width: 28 },
      { header: "Description", width: 60 },
      { header: "Amount", align: "right", width: 36 },
    ],
    rows: pettyLines.map((r) => [r.date, r.employee, r.category, r.description, pkr(r.amount)]),
    foot: pettyLines.length ? ["", "", "", `Total · ${pettyLines.length}`, pkr(pettyTotal)] : undefined,
  })

  tables.push(...purchaseTables(
    "Local purchases",
    "Local purchase orders created or paid in this date range. Paid in range is cash that left.",
    localPurchases,
  ))
  tables.push(...purchaseTables(
    "Imported purchases",
    "Imported purchase orders created or paid in this date range, with product lines.",
    importedPurchases,
  ))

  if (posSales.length) {
    tables.push({
      title: "POS sales",
      note: "Counter receipts and branch POS orders created in this period.",
      newPage: true,
      columns: [
        { header: "Date", width: 22 },
        { header: "Sale no.", width: 30 },
        { header: "Type", width: 24 },
        { header: "Customer", width: 34 },
        { header: "Cashier", width: 28 },
        { header: "Pay", width: 18 },
        { header: "Amount", align: "right", width: 30 },
      ],
      rows: posSales.map((r) => [
        r.date,
        r.number,
        r.kind,
        r.customer,
        r.cashier,
        prettyMethod(r.method),
        pkr(r.total),
      ]),
      foot: ["", "", "", "", "", String(posSales.length), pkr(posTotal)],
    })

    const posItems = posSales.flatMap((r) =>
      r.items.map((item) => [
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
        columns: [
          { header: "Sale no.", width: 28 },
          { header: "Customer", width: 32 },
          { header: "Product / stock", width: 62 },
          { header: "Qty", width: 18 },
          { header: "Unit price", align: "right", width: 22 },
          { header: "Line total", align: "right", width: 24 },
        ],
        rows: posItems,
      })
    }
  }

  if (orders.length) {
    tables.push({
      title: "Client orders",
      note: "Received is cash taken inside the date range, not always the full order total.",
      newPage: true,
      columns: [
        { header: "Date", width: 22 },
        { header: "Order no.", width: 28 },
        { header: "Client", width: 40 },
        { header: "Status", width: 24 },
        { header: "By", width: 24 },
        { header: "Total", align: "right", width: 24 },
        { header: "Received", align: "right", width: 24 },
      ],
      rows: orders.map((r) => [
        r.date,
        r.orderNumber,
        r.clientName,
        prettyStatus(r.status),
        r.createdBy,
        pkr(r.total),
        pkr(r.receivedInPeriod),
      ]),
      foot: ["", "", "", "", String(orderItemCount), pkr(orderTotal), pkr(orderReceived)],
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
        columns: [
          { header: "Order no.", width: 28 },
          { header: "Client", width: 32 },
          { header: "Product / model / stock", width: 62 },
          { header: "Qty", width: 18 },
          { header: "Unit price", align: "right", width: 22 },
          { header: "Line total", align: "right", width: 24 },
        ],
        rows: orderItems,
      })
    }
  }

  if (methods.length) {
    const methodTotal = methods.reduce((n, r) => n + r.amount, 0)
    tables.push({
      title: "Client payments by method",
      columns: [
        { header: "Payment method", width: 100 },
        { header: "Amount", align: "right", width: 46 },
        { header: "Share", align: "right", width: 40 },
      ],
      rows: methods.map((r) => [prettyMethod(r.method), pkr(r.amount), pct(r.amount, methodTotal)]),
      foot: ["All methods", pkr(methodTotal), "100%"],
    })
  }

  if (outstanding.length) {
    tables.push({
      title: "Outstanding client balances",
      note: "Current credit still due — not limited to the date range.",
      columns: [
        { header: "Client", width: 80 },
        { header: "Order no.", width: 46 },
        { header: "Still due", align: "right", width: 60 },
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
  })
}
