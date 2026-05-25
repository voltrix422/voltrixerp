import { prisma } from "@/lib/db"

const CHART: Array<{ code: string; name: string; accountType: string; parentCode?: string; reconcile?: boolean }> = [
  { code: "1000", name: "Assets", accountType: "asset" },
  { code: "1010", name: "Cash", accountType: "cash", parentCode: "1000" },
  { code: "1020", name: "Bank", accountType: "bank", parentCode: "1000", reconcile: true },
  { code: "1100", name: "Accounts Receivable", accountType: "receivable", parentCode: "1000", reconcile: true },
  { code: "1200", name: "Inventory", accountType: "asset", parentCode: "1000" },
  { code: "1510", name: "Fixed Assets", accountType: "asset", parentCode: "1000" },
  { code: "2000", name: "Liabilities", accountType: "liability" },
  { code: "2010", name: "Accounts Payable", accountType: "payable", parentCode: "2000", reconcile: true },
  { code: "2100", name: "Tax Payable", accountType: "liability", parentCode: "2000" },
  { code: "2200", name: "Salaries Payable", accountType: "liability", parentCode: "2000" },
  { code: "3000", name: "Equity", accountType: "equity" },
  { code: "3100", name: "Retained Earnings", accountType: "equity", parentCode: "3000" },
  { code: "4000", name: "Revenue", accountType: "income" },
  { code: "4100", name: "Product Sales", accountType: "income", parentCode: "4000" },
  { code: "4200", name: "Service Revenue", accountType: "income", parentCode: "4000" },
  { code: "5000", name: "Expenses", accountType: "expense" },
  { code: "5100", name: "Cost of Goods Sold", accountType: "expense", parentCode: "5000" },
  { code: "5200", name: "Operating Expenses", accountType: "expense", parentCode: "5000" },
  { code: "5300", name: "Salaries Expense", accountType: "expense", parentCode: "5000" },
  { code: "5400", name: "Rent Expense", accountType: "expense", parentCode: "5000" },
  { code: "5610", name: "Depreciation Expense", accountType: "expense", parentCode: "5000" },
]

export async function isAccountingSeeded() {
  const settings = await prisma.acctSettings.findUnique({ where: { id: "default" } })
  return Boolean(settings?.seededAt)
}

export async function seedAccountingModule() {
  if (await isAccountingSeeded()) return { alreadySeeded: true }

  await prisma.acctSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      companyName: "Voltrix Batteries",
      currency: "PKR",
      fiscalYearStart: 7,
      invoiceTerms: "Payment due within terms. Bank transfer preferred.",
      seededAt: new Date(),
    },
    update: { seededAt: new Date() },
  })

  for (const a of CHART) {
    await prisma.acctAccount.upsert({
      where: { code: a.code },
      create: {
        code: a.code,
        name: a.name,
        accountType: a.accountType,
        parentCode: a.parentCode ?? "",
        reconcile: a.reconcile ?? false,
      },
      update: {},
    })
  }

  const bankAcc = await prisma.acctAccount.findUnique({ where: { code: "1020" } })
  const cashAcc = await prisma.acctAccount.findUnique({ where: { code: "1010" } })
  const arAcc = await prisma.acctAccount.findUnique({ where: { code: "1100" } })

  const journals = [
    { code: "INV", name: "Customer Invoices", journalType: "sale", sequencePrefix: "INV", defaultAccountId: arAcc?.id ?? "" },
    { code: "BILL", name: "Vendor Bills", journalType: "purchase", sequencePrefix: "BILL", defaultAccountId: "" },
    { code: "BNK1", name: "Bank", journalType: "bank", sequencePrefix: "BNK", defaultAccountId: bankAcc?.id ?? "" },
    { code: "CSH1", name: "Cash", journalType: "cash", sequencePrefix: "CSH", defaultAccountId: cashAcc?.id ?? "" },
    { code: "MISC", name: "Miscellaneous", journalType: "general", sequencePrefix: "MISC", defaultAccountId: "" },
  ]
  for (const j of journals) {
    await prisma.acctJournal.upsert({
      where: { code: j.code },
      create: j,
      update: {},
    })
  }

  await prisma.acctTax.createMany({
    data: [
      { name: "GST 17%", rate: 17, taxType: "sale", accountCode: "2100" },
      { name: "GST 17% Purchase", rate: 17, taxType: "purchase", accountCode: "2100" },
      { name: "Exempt 0%", rate: 0, taxType: "sale", accountCode: "" },
    ],
    skipDuplicates: true,
  })

  await prisma.acctPaymentTerm.createMany({
    data: [
      { name: "Immediate", lines: [{ days: 0, percent: 100 }] },
      { name: "15 Days", lines: [{ days: 15, percent: 100 }] },
      { name: "30 Days", lines: [{ days: 30, percent: 100 }] },
      { name: "50% Now, 50% in 30 Days", lines: [{ days: 0, percent: 50 }, { days: 30, percent: 50 }] },
    ],
    skipDuplicates: true,
  })

  await prisma.acctAnalyticAccount.createMany({
    data: [
      { code: "OPS", name: "Operations", plan: "Departments" },
      { code: "SALES", name: "Sales", plan: "Departments" },
      { code: "WH", name: "Warehouse", plan: "Departments" },
      { code: "PRJ-001", name: "Solar Installation Project", plan: "Projects" },
    ],
    skipDuplicates: true,
  })

  const bnkJournal = await prisma.acctJournal.findUnique({ where: { code: "BNK1" } })
  if (bnkJournal) {
    await prisma.acctBankAccount.create({
      data: {
        name: "Main Operating Account",
        accountNumber: "PK00VOLT001",
        bankName: "HBL",
        journalId: bnkJournal.id,
        balance: 0,
      },
    }).catch(() => {})
  }

  const samplePartners = [
    { name: "Walk-in Customer", partnerType: "customer", email: "", phone: "" },
    { name: "ABC Solar Pvt Ltd", partnerType: "customer", email: "accounts@abcsolar.pk", phone: "+92-300-0000001" },
    { name: "Battery Supplier Co", partnerType: "vendor", email: "ap@batterysupplier.com", phone: "" },
    { name: "Office Landlord", partnerType: "vendor", email: "", phone: "" },
  ]
  for (const p of samplePartners) {
    const exists = await prisma.acctPartner.findFirst({ where: { name: p.name } })
    if (!exists) await prisma.acctPartner.create({ data: p })
  }

  const sequences = [
    { id: "move_misc", prefix: "MISC", nextNum: 1 },
    { id: "invoice_out", prefix: "INV", nextNum: 1 },
    { id: "invoice_in", prefix: "BILL", nextNum: 1 },
    { id: "payment", prefix: "PAY", nextNum: 1 },
  ]
  for (const s of sequences) {
    await prisma.acctSequence.upsert({
      where: { id: s.id },
      create: s,
      update: {},
    })
  }

  return { seeded: true }
}
