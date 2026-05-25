import { prisma } from "@/lib/db"

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export async function getPostedLines(from?: Date, to?: Date) {
  const moves = await prisma.acctMove.findMany({
    where: {
      state: "posted",
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    include: { lines: true },
  })
  return moves.flatMap(m =>
    m.lines.map(l => ({
      ...l,
      moveName: m.name,
      moveDate: m.date,
      partnerId: l.partnerId || m.partnerId,
    }))
  )
}

export async function profitAndLoss(from?: Date, to?: Date) {
  const accounts = await prisma.acctAccount.findMany({
    where: { accountType: { in: ["income", "expense"] } },
  })
  const lines = await getPostedLines(from, to)
  const byAccount: Record<string, { code: string; name: string; type: string; balance: number }> = {}

  for (const acc of accounts) {
    byAccount[acc.id] = { code: acc.code, name: acc.name, type: acc.accountType, balance: 0 }
  }
  for (const l of lines) {
    if (!byAccount[l.accountId]) continue
    const acc = accounts.find(a => a.id === l.accountId)!
    if (acc.accountType === "income") {
      byAccount[l.accountId].balance += l.credit - l.debit
    } else {
      byAccount[l.accountId].balance += l.debit - l.credit
    }
  }

  const rows = Object.values(byAccount).filter(r => Math.abs(r.balance) > 0.001)
  const income = rows.filter(r => r.type === "income").reduce((s, r) => s + r.balance, 0)
  const expense = rows.filter(r => r.type === "expense").reduce((s, r) => s + r.balance, 0)
  return {
    rows: rows.map(r => ({ ...r, balance: round2(r.balance) })),
    totalIncome: round2(income),
    totalExpense: round2(expense),
    netProfit: round2(income - expense),
  }
}

export async function balanceSheet(asOf?: Date) {
  const types = ["asset", "liability", "equity", "receivable", "payable", "bank", "cash"]
  const accounts = await prisma.acctAccount.findMany({
    where: { accountType: { in: types } },
  })
  const to = asOf ?? new Date()
  const lines = await getPostedLines(undefined, to)

  const rows = accounts.map(acc => {
    let balance = 0
    for (const l of lines.filter(x => x.accountId === acc.id)) {
      if (["asset", "receivable", "bank", "cash", "expense"].includes(acc.accountType)) {
        balance += l.debit - l.credit
      } else {
        balance += l.credit - l.debit
      }
    }
    return { code: acc.code, name: acc.name, type: acc.accountType, balance: round2(balance) }
  }).filter(r => Math.abs(r.balance) > 0.001)

  const assets = rows.filter(r => ["asset", "receivable", "bank", "cash"].includes(r.type))
  const liabilities = rows.filter(r => ["liability", "payable"].includes(r.type))
  const equity = rows.filter(r => r.type === "equity")

  return {
    assets,
    liabilities,
    equity,
    totalAssets: round2(assets.reduce((s, r) => s + r.balance, 0)),
    totalLiabilities: round2(liabilities.reduce((s, r) => s + r.balance, 0)),
    totalEquity: round2(equity.reduce((s, r) => s + r.balance, 0)),
  }
}

export async function generalLedger(accountId?: string, from?: Date, to?: Date) {
  const lines = await getPostedLines(from, to)
  const filtered = accountId ? lines.filter(l => l.accountId === accountId) : lines
  const accounts = await prisma.acctAccount.findMany()
  const accMap = Object.fromEntries(accounts.map(a => [a.id, a]))

  return filtered
    .sort((a, b) => new Date(a.moveDate).getTime() - new Date(b.moveDate).getTime())
    .map(l => ({
      date: l.moveDate,
      moveName: l.moveName,
      accountCode: accMap[l.accountId]?.code ?? "",
      accountName: accMap[l.accountId]?.name ?? "",
      label: l.name,
      debit: l.debit,
      credit: l.credit,
      balance: round2(l.debit - l.credit),
    }))
}

export async function agedBalances(type: "receivable" | "payable") {
  const invoiceTypes = type === "receivable" ? ["out_invoice"] : ["in_invoice"]
  const invoices = await prisma.acctInvoice.findMany({
    where: {
      invoiceType: { in: invoiceTypes },
      state: { in: ["posted", "paid"] },
      amountResidual: { gt: 0.01 },
    },
    include: { lines: true },
  })
  const partners = await prisma.acctPartner.findMany()
  const partnerMap = Object.fromEntries(partners.map(p => [p.id, p.name]))
  const now = new Date()

  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 }
  const details: Array<{ partner: string; invoice: string; due: Date; days: number; amount: number }> = []

  for (const inv of invoices) {
    const days = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)
    const amt = inv.amountResidual
    if (days <= 0) buckets.current += amt
    else if (days <= 30) buckets.d30 += amt
    else if (days <= 60) buckets.d60 += amt
    else if (days <= 90) buckets.d90 += amt
    else buckets.older += amt
    details.push({
      partner: partnerMap[inv.partnerId] ?? "Unknown",
      invoice: inv.number,
      due: inv.dueDate,
      days: Math.max(0, days),
      amount: round2(amt),
    })
  }

  return {
    buckets: {
      current: round2(buckets.current),
      d30: round2(buckets.d30),
      d60: round2(buckets.d60),
      d90: round2(buckets.d90),
      older: round2(buckets.older),
      total: round2(Object.values(buckets).reduce((a, b) => a + b, 0)),
    },
    details,
  }
}

export async function dashboardStats() {
  const [invoices, bills, payments, moves, partners] = await Promise.all([
    prisma.acctInvoice.count({ where: { invoiceType: "out_invoice", state: "posted" } }),
    prisma.acctInvoice.count({ where: { invoiceType: "in_invoice", state: "posted" } }),
    prisma.acctPayment.count({ where: { state: "posted" } }),
    prisma.acctMove.count({ where: { state: "posted" } }),
    prisma.acctPartner.count(),
  ])

  const ar = await prisma.acctInvoice.aggregate({
    where: { invoiceType: "out_invoice", amountResidual: { gt: 0 } },
    _sum: { amountResidual: true },
  })
  const ap = await prisma.acctInvoice.aggregate({
    where: { invoiceType: "in_invoice", amountResidual: { gt: 0 } },
    _sum: { amountResidual: true },
  })

  const pnl = await profitAndLoss()
  const bank = await prisma.acctBankAccount.findMany()

  return {
    customerInvoices: invoices,
    vendorBills: bills,
    postedPayments: payments,
    journalEntries: moves,
    partners,
    receivableOutstanding: round2(ar._sum.amountResidual ?? 0),
    payableOutstanding: round2(ap._sum.amountResidual ?? 0),
    netProfit: pnl.netProfit,
    bankBalances: bank.map(b => ({ name: b.name, balance: b.balance })),
  }
}
