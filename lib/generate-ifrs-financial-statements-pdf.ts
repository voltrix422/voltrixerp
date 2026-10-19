import { dateRangeLabel, downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"

function n(v: unknown) {
  return Number(v) || 0
}

function rangeLabel(periodLabel: string, dateFrom?: string, dateTo?: string) {
  if (dateFrom || dateTo) return dateRangeLabel(dateFrom || "", dateTo || "")
  return periodLabel || "Selected period"
}

type Metrics = {
  revenueCustomers: number
  clientCollections: number
  posCollections: number
  otherIncome: number
  totalIncome: number
  employeeBenefits: number
  materials: number
  occupancy: number
  fuel: number
  adminPetty: number
  otherOpex: number
  selling: number
  refunds: number
  operatingExpenses: number
  profit: number
  oci: number
  totalComprehensive: number
  cashFromCustomers: number
  cashOperating: number
  loansReceived: number
  loansRecovered: number
  loansGiven: number
  loansRepaid: number
  cashFinancing: number
  netCash: number
  tradeReceivables: number
  otherReceivables: number
  totalCurrentAssets: number
  totalAssets: number
  tradePayables: number
  borrowings: number
  totalCurrentLiabilities: number
  totalLiabilities: number
  retainedEarnings: number
  totalEquity: number
}

function metricsFromOverview(data: Record<string, unknown> | null | undefined): Metrics {
  const empty = data == null
  const summary = ((data?.summary || {}) as Record<string, unknown>)
  const breakdown = (summary.breakdown || {}) as {
    moneyIn?: Record<string, number>
    moneyOut?: Record<string, number>
  }
  const mi = breakdown.moneyIn || {}
  const mo = breakdown.moneyOut || {}
  const orderPayments = (data?.orderPayments || {}) as { allTime?: { totalOutstanding?: number } }
  const loans = (summary.loans || {}) as Record<string, number>
  const ledgerTotals = (data?.ledgerTotals || {}) as { due?: number }

  const clientCollections = empty ? 0 : n(mi.clientPayments)
  const posCollections = empty ? 0 : n(mi.posSales)
  const revenueCustomers = clientCollections + posCollections
  const otherIncome = empty ? 0 : n(mi.incomeRecords)
  const totalIncome = revenueCustomers + otherIncome
  const employeeBenefits = empty ? 0 : n(mo.salaries) + n(mo.salaryAdvances)
  const materials = empty
    ? 0
    : n(mo.purchaseLedgerPurchases ?? mo.purchaseLedger) + n(mo.importChargesCombined ?? mo.importCharges)
  const occupancy = empty ? 0 : n(mo.purchaseLedgerRents)
  const fuel = empty ? 0 : n(mo.fuelPetrol)
  const adminPetty = empty ? 0 : n(mo.pettyCash)
  const otherOpex = empty ? 0 : n(mo.expenses)
  const selling = empty ? 0 : n(mo.cashback)
  const refunds = empty ? 0 : n(mo.clientRefunds)
  const operatingExpenses =
    employeeBenefits + materials + occupancy + fuel + adminPetty + otherOpex + selling + refunds
  const profit = totalIncome - operatingExpenses
  const oci = 0
  const totalComprehensive = profit + oci

  const loansReceived = empty ? 0 : n(loans.receivedInPeriod ?? mi.loansReceived ?? mi.loans)
  const loansRecovered = empty ? 0 : n(loans.recoveredInPeriod ?? mi.loanRecoveries)
  const loansGiven = empty ? 0 : n(loans.givenInPeriod ?? mo.loansGiven)
  const loansRepaid = empty ? 0 : n(loans.repaidInPeriod)
  const cashFromCustomers = revenueCustomers + otherIncome
  const cashOperating = cashFromCustomers - operatingExpenses
  const cashFinancing = loansReceived + loansRecovered - loansGiven - loansRepaid
  const netCash = cashOperating + cashFinancing

  const tradeReceivables = empty ? 0 : n(orderPayments.allTime?.totalOutstanding ?? summary.clientOutstanding)
  const otherReceivables = empty ? 0 : n(loans.theyOwe)
  const totalCurrentAssets = tradeReceivables + otherReceivables
  const totalAssets = totalCurrentAssets
  const tradePayables = empty ? 0 : n(ledgerTotals.due)
  const borrowings = empty ? 0 : n(loans.weOwe)
  const totalCurrentLiabilities = tradePayables + borrowings
  const totalLiabilities = totalCurrentLiabilities
  const retainedEarnings = profit
  const totalEquity = totalAssets - totalLiabilities

  return {
    revenueCustomers,
    clientCollections,
    posCollections,
    otherIncome,
    totalIncome,
    employeeBenefits,
    materials,
    occupancy,
    fuel,
    adminPetty,
    otherOpex,
    selling,
    refunds,
    operatingExpenses,
    profit,
    oci,
    totalComprehensive,
    cashFromCustomers,
    cashOperating,
    loansReceived,
    loansRecovered,
    loansGiven,
    loansRepaid,
    cashFinancing,
    netCash,
    tradeReceivables,
    otherReceivables,
    totalCurrentAssets,
    totalAssets,
    tradePayables,
    borrowings,
    totalCurrentLiabilities,
    totalLiabilities,
    retainedEarnings,
    totalEquity,
  }
}

function dual(
  label: string,
  note: string,
  cur: number | null,
  prior: number | null,
): (string | number)[] {
  return [
    label,
    note,
    cur == null ? "" : pkr(cur),
    prior == null ? "" : pkr(prior),
  ]
}

export async function downloadIfrsFinancialStatementsPdf(
  data: Record<string, unknown>,
  opts: {
    dateFrom?: string
    dateTo?: string
    exportedBy?: string
    priorData?: Record<string, unknown> | null
    priorPeriodLabel?: string
  } = {},
) {
  const cur = metricsFromOverview(data)
  const hasPrior = Boolean(opts.priorData)
  const prior = metricsFromOverview(opts.priorData)
  const periodLabel = String(data.periodLabel || "Selected period")
  const period = rangeLabel(periodLabel, opts.dateFrom, opts.dateTo)
  const priorHeading = opts.priorPeriodLabel || "Prior period"
  const stamp = new Date().toISOString().slice(0, 10)
  const issued = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })

  const cols = [
    { header: "", width: 92 },
    { header: "Note", width: 14, align: "center" as const },
    { header: period, align: "right" as const, width: 32 },
    { header: priorHeading, align: "right" as const, width: 32 },
  ]

  const p = (c: number, pr: number) => (hasPrior ? pr : null)

  const tables: PlainTable[] = [
    {
      title: "Contents — complete set of financial statements (IAS 1.10)",
      note: "Each primary statement is presented with equal prominence. The notes form an integral part of these financial statements.",
      columns: [
        { header: "Page / statement", width: 100 },
        { header: "Standard", width: 70 },
      ],
      rows: [
        ["Statement of financial position as at the end of the period", "IAS 1.10(a)"],
        ["Statement of profit or loss and other comprehensive income", "IAS 1.10(b) / 10A"],
        ["Statement of changes in equity", "IAS 1.10(c)"],
        ["Statement of cash flows", "IAS 1.10(d) / IAS 7"],
        ["Notes, comprising material accounting policy information", "IAS 1.10(e)"],
        ["Comparative information for the preceding period", hasPrior ? "IAS 1.38 / 38A" : "IAS 1.38 — prior column shown when available"],
      ],
    },
    {
      sectionStart: "Statement of financial position",
      title: "As at the end of the reporting period",
      note: "The notes on the following pages form an integral part of these financial statements. Amounts in Pakistani Rupee (PKR).",
      columns: cols,
      rows: [
        dual("ASSETS", "", null, null),
        dual("Current assets", "", null, null),
        dual("Trade receivables", "5", cur.tradeReceivables, p(cur.tradeReceivables, prior.tradeReceivables)),
        dual("Other receivables", "6", cur.otherReceivables, p(cur.otherReceivables, prior.otherReceivables)),
        dual("Total current assets", "", cur.totalCurrentAssets, p(cur.totalCurrentAssets, prior.totalCurrentAssets)),
        dual("Non-current assets", "4", null, null),
        dual("Not separately identified in this ERP extract", "4", null, null),
        dual("Total assets", "", cur.totalAssets, p(cur.totalAssets, prior.totalAssets)),
        dual("EQUITY AND LIABILITIES", "", null, null),
        dual("Equity", "", null, null),
        dual("Retained earnings / accumulated (deficit) — period result as equity plug", "4,8", cur.totalEquity, p(cur.totalEquity, prior.totalEquity)),
        dual("Total equity", "", cur.totalEquity, p(cur.totalEquity, prior.totalEquity)),
        dual("Current liabilities", "", null, null),
        dual("Trade and other payables", "7", cur.tradePayables, p(cur.tradePayables, prior.tradePayables)),
        dual("Borrowings", "6", cur.borrowings, p(cur.borrowings, prior.borrowings)),
        dual("Total current liabilities", "", cur.totalCurrentLiabilities, p(cur.totalCurrentLiabilities, prior.totalCurrentLiabilities)),
        dual("Total liabilities", "", cur.totalLiabilities, p(cur.totalLiabilities, prior.totalLiabilities)),
        dual("Total equity and liabilities", "", cur.totalEquity + cur.totalLiabilities, p(cur.totalEquity + cur.totalLiabilities, prior.totalEquity + prior.totalLiabilities)),
      ],
    },
    {
      sectionStart: "Statement of profit or loss and other comprehensive income",
      title: "For the reporting period · expenses by nature (IAS 1.102)",
      note: "A single statement is presented (IAS 1.10A). Other comprehensive income is nil. Amounts in PKR.",
      columns: cols,
      rows: [
        dual("Revenue from contracts with customers", "1", cur.revenueCustomers, p(cur.revenueCustomers, prior.revenueCustomers)),
        dual("  CRM collections", "1", cur.clientCollections, p(cur.clientCollections, prior.clientCollections)),
        dual("  Point-of-sale collections", "1", cur.posCollections, p(cur.posCollections, prior.posCollections)),
        dual("Other income", "1", cur.otherIncome, p(cur.otherIncome, prior.otherIncome)),
        dual("Total income", "", cur.totalIncome, p(cur.totalIncome, prior.totalIncome)),
        dual("Employee benefits expense", "2", cur.employeeBenefits, p(cur.employeeBenefits, prior.employeeBenefits)),
        dual("Raw materials, purchases and import charges", "2", cur.materials, p(cur.materials, prior.materials)),
        dual("Occupancy / short-term rent", "2", cur.occupancy, p(cur.occupancy, prior.occupancy)),
        dual("Fuel", "2", cur.fuel, p(cur.fuel, prior.fuel)),
        dual("Administrative expenses — petty cash", "2", cur.adminPetty, p(cur.adminPetty, prior.adminPetty)),
        dual("Other operating expenses", "2", cur.otherOpex, p(cur.otherOpex, prior.otherOpex)),
        dual("Selling expenses — cashback", "2", cur.selling, p(cur.selling, prior.selling)),
        dual("Customer refunds", "1", cur.refunds, p(cur.refunds, prior.refunds)),
        dual("Total expenses", "", cur.operatingExpenses, p(cur.operatingExpenses, prior.operatingExpenses)),
        dual("Profit / (loss) for the period", "3", cur.profit, p(cur.profit, prior.profit)),
        dual("Other comprehensive income", "9", cur.oci, p(cur.oci, prior.oci)),
        dual("  Items that will not be reclassified to profit or loss", "9", 0, hasPrior ? 0 : null),
        dual("  Items that may be reclassified subsequently to profit or loss", "9", 0, hasPrior ? 0 : null),
        dual("Total comprehensive income for the period", "3", cur.totalComprehensive, p(cur.totalComprehensive, prior.totalComprehensive)),
      ],
    },
    {
      sectionStart: "Statement of changes in equity",
      title: "For the reporting period (IAS 1.106)",
      note: "Share capital is not maintained as a separate ledger in this extract. The equity column is the residual of recognised assets less liabilities.",
      columns: [
        { header: "", width: 70 },
        { header: "Share capital", align: "right" as const, width: 32 },
        { header: "Retained earnings", align: "right" as const, width: 36 },
        { header: "Total equity", align: "right" as const, width: 32 },
      ],
      rows: [
        ["Balance at beginning of period (not separately stored)", "—", "—", "—"],
        ["Profit / (loss) for the period", "—", pkr(cur.profit), pkr(cur.profit)],
        ["Other comprehensive income", "—", pkr(0), pkr(0)],
        ["Total comprehensive income", "—", pkr(cur.totalComprehensive), pkr(cur.totalComprehensive)],
        ["Transactions with owners (none recorded)", "—", "—", "—"],
        ["Balance at end of period (recognised residual)", "—", pkr(cur.totalEquity), pkr(cur.totalEquity)],
      ],
    },
    {
      sectionStart: "Statement of cash flows",
      title: "For the reporting period · direct method (IAS 7)",
      note: "Cash and cash equivalents are not a complete bank-reconciliation figure in this extract — see Note 4.",
      columns: cols,
      rows: [
        dual("Cash flows from operating activities", "", null, null),
        dual("Receipts from customers", "1", cur.cashFromCustomers, p(cur.cashFromCustomers, prior.cashFromCustomers)),
        dual("Payments to suppliers and employees", "2", -cur.operatingExpenses, p(-cur.operatingExpenses, -prior.operatingExpenses)),
        dual("Net cash from / (used in) operating activities", "3", cur.cashOperating, p(cur.cashOperating, prior.cashOperating)),
        dual("Cash flows from investing activities", "", null, null),
        dual("No investing cash flows separately identified", "4", null, null),
        dual("Net cash from / (used in) investing activities", "4", 0, hasPrior ? 0 : null),
        dual("Cash flows from financing activities", "", null, null),
        dual("Proceeds from borrowings", "6", cur.loansReceived, p(cur.loansReceived, prior.loansReceived)),
        dual("Repayments of borrowings", "6", -cur.loansRepaid, p(-cur.loansRepaid, -prior.loansRepaid)),
        dual("Loans advanced", "6", -cur.loansGiven, p(-cur.loansGiven, -prior.loansGiven)),
        dual("Loan recoveries received", "6", cur.loansRecovered, p(cur.loansRecovered, prior.loansRecovered)),
        dual("Net cash from / (used in) financing activities", "6", cur.cashFinancing, p(cur.cashFinancing, prior.cashFinancing)),
        dual("Net increase / (decrease) in cash and cash equivalents", "3", cur.netCash, p(cur.netCash, prior.netCash)),
        dual("Cash and cash equivalents at beginning of period", "4", null, null),
        dual("Cash and cash equivalents at end of period", "4", null, null),
      ],
    },
    {
      sectionStart: "Notes to the financial statements",
      title: "Material accounting policy information and other explanatory information (IAS 1.10(e), IAS 1.117)",
      columns: [
        { header: "Note", width: 14, align: "center" },
        { header: "Disclosure", width: 152 },
      ],
      rows: [
        [
          "General",
          "Voltrix Batteries Pvt. Ltd. These financial statements are IFRS-presented management accounts prepared from Voltrix ERP for the reporting period shown. They use the titles and complete-set structure in IAS 1.10. They are not a full statutory IFRS annual report (no independent audit opinion is attached).",
        ],
        [
          "1",
          "Revenue (IFRS 15): cash collections from contracts with customers in the period (CRM receipts and POS takings). Performance obligations, contract assets and variable consideration are not re-measured in this extract. Customer refunds are presented separately and reduce net collections.",
        ],
        [
          "2",
          "Expenses are classified by nature (IAS 1.102): employee benefits (IAS 19 — salaries and salary advances), purchases and import charges, occupancy/rent, fuel, petty cash, other operating records, and cashback. Loan principal is not an expense (see Note 6).",
        ],
        [
          "3",
          "Profit or loss is total income less operating expenses. Total comprehensive income equals profit or loss because other comprehensive income is nil (Note 9). Loan receipts and repayments are financing cash flows under IAS 7, not profit.",
        ],
        [
          "4",
          "Going concern and completeness: cash at bank, inventories (IAS 2) and property, plant and equipment (IAS 16) are not fully recognised in this ERP extract. Comparative information is included when a prior-period extract is available (IAS 1.38). Tax (IAS 12) is not computed in this pack.",
        ],
        [
          "5",
          "Trade receivables (IFRS 9): remaining credit on CRM orders at the reporting date, used as an approximation of amortised-cost carrying amount. No expected-credit-loss allowance is modelled in this extract.",
        ],
        [
          "6",
          "Borrowings and other receivables: loan-centre outstanding amounts (loans payable; loans receivable). Period movements (proceeds, repayments, advances, recoveries) are classified as financing cash flows (IAS 7).",
        ],
        [
          "7",
          "Trade and other payables: amounts still due on purchase-ledger entries in the selected period filters. Other purchase orders may exist outside this total.",
        ],
        [
          "8",
          "Equity: share capital is not a separate ERP ledger. End-of-period equity is the residual of recognised assets less recognised liabilities (accounting equation). The statement of changes in equity shows the period profit as the movement (IAS 1.106).",
        ],
        [
          "9",
          "Other comprehensive income: none identified (no revaluation surplus, no FVOCI financial assets, no foreign-operation translation). Functional and presentation currency is PKR (IAS 21).",
        ],
        [
          "10",
          `Authorised for issue: these management accounts are generated ${issued}. They may be issued when signed by those charged with governance.`,
        ],
      ],
    },
  ]

  await downloadPlainReportPdf({
    title: "Financial statements",
    subtitle: period,
    meta: [
      "Prepared using IFRS Accounting Standards presentation (IAS 1, IAS 7, IFRS 15, IFRS 9, IAS 19)",
      "Voltrix Batteries Pvt. Ltd. · Functional and presentation currency: Pakistani Rupee (PKR)",
      `Reporting period: ${period}`,
      hasPrior ? `Comparative column: ${priorHeading}` : "Comparative figures: prior period included when a matching extract is available (IAS 1.38)",
      `Generated ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`,
      opts.exportedBy ? `Prepared by ${opts.exportedBy}` : "",
    ].filter(Boolean),
    filename: `voltrix-ifrs-financial-statements-${stamp}.pdf`,
    tables,
    compact: true,
    signatures: [
      { name: "Sir Mustafa Ali", role: "Authorised for issue" },
      { name: "Sir Ejaz", role: "Authorised for issue" },
    ],
  })
}
