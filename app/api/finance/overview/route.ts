import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { Order } from "@/lib/orders"
import {
  parseOrderPayments,
  parseOrderCashbackPayments,
  approvedBalancePaymentAmount,
  isFinanceRelevantOrder,
  type FinanceOverviewAction,
  type FinanceOverviewActivity,
} from "@/lib/finance-overview"
import {
  getPaymentSubmissionStatus,
  getOrderCreditBalance,
  hasOutstandingCredit,
  reconcileDeliveredOrderPayments,
} from "@/lib/orders"
import {
  aggregateOrderPaymentStats,
  aggregateOrderPaymentsInPeriod,
  aggregateClientRefundsInPeriod,
  buildOrderPaymentReconciliation,
  isCrmErpOrderForPaymentStats,
  type OrderPaymentStatsOrder,
} from "@/lib/order-payment-stats"
import {
  purchaseLedgerPaidSplitInPeriod,
  sumJsonPaymentsInPeriod,
} from "@/lib/finance-purchase-outflows"
import { sumApprovedReceiptsInPeriod } from "@/lib/petty-cash-display"
import {
  buildCashbackDetails,
  buildClientRefundDetails,
  buildImportChargeStepDetails,
  buildImportCombinedDetails,
  buildImportPswDetails,
  buildPettyCashApprovedDetails,
} from "@/lib/finance-money-out-details"
import { importChargesSplitInPeriod } from "@/lib/finance-import-outflows"
import {
  buildLoanOutDetails,
  isLoanCategory,
  summarizeLoans,
} from "@/lib/finance-loans"
import {
  buildExpenseReport,
  buildOrderReport,
  buildPettyCashReport,
  buildPosSalesReport,
  buildPurchaseReport,
} from "@/lib/finance-report-details"

const PK_OFFSET = "+05:00"
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function pkTodayParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)?.value || 0)
  return { y: num("year"), m: num("month"), d: num("day") }
}

function pkDayStart(y: number, m: number, d: number) {
  return new Date(`${y}-${pad2(m)}-${pad2(d)}T00:00:00${PK_OFFSET}`)
}

function pkDayEnd(y: number, m: number, d: number) {
  return new Date(`${y}-${pad2(m)}-${pad2(d)}T23:59:59.999${PK_OFFSET}`)
}

function parseIsoDay(iso: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!iso || !DATE_ONLY.test(iso)) return null
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

function periodRange(period: string, fromStr?: string | null, toStr?: string | null) {
  const pretty = (iso: string) => {
    const [y, m, d] = iso.split("-")
    return y && m && d ? `${d}/${m}/${y}` : iso
  }
  if (fromStr || toStr) {
    const from = parseIsoDay(fromStr) || { y: 2000, m: 1, d: 1 }
    const to = parseIsoDay(toStr) || pkTodayParts()
    const start = pkDayStart(from.y, from.m, from.d)
    const end = pkDayEnd(to.y, to.m, to.d)
    const fromIso = fromStr && DATE_ONLY.test(fromStr) ? fromStr : `${from.y}-${pad2(from.m)}-${pad2(from.d)}`
    const toIso = toStr && DATE_ONLY.test(toStr) ? toStr : `${to.y}-${pad2(to.m)}-${pad2(to.d)}`
    const label =
      fromStr && toStr
        ? `${pretty(fromIso)} – ${pretty(toIso)}`
        : fromStr
          ? `From ${pretty(fromIso)}`
          : `Until ${pretty(toIso)}`
    return { start, end, label }
  }
  const { y, m, d } = pkTodayParts()
  if (period === "last_month") {
    const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
    const lastDay = new Date(Date.UTC(prev.y, prev.m, 0)).getUTCDate()
    return {
      start: pkDayStart(prev.y, prev.m, 1),
      end: pkDayEnd(prev.y, prev.m, lastDay),
      label: "Last month",
    }
  }
  if (period === "year") {
    return { start: pkDayStart(y, 1, 1), end: pkDayEnd(y, m, d), label: "This year" }
  }
  return { start: pkDayStart(y, m, 1), end: pkDayEnd(y, m, d), label: "This month" }
}

function inRange(d: Date, start: Date, end: Date) {
  return d >= start && d <= end
}

function salaryCashDate(slip: { paidAt?: Date | null; generatedDate: Date }) {
  return slip.paidAt || slip.generatedDate
}

function pkShiftedMonth(y: number, m: number, delta: number) {
  let mm = m + delta
  let yy = y
  while (mm <= 0) {
    mm += 12
    yy -= 1
  }
  while (mm > 12) {
    mm -= 12
    yy += 1
  }
  return { y: yy, m: mm }
}

function pkMonthBounds(y: number, m: number) {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: pkDayStart(y, m, 1), end: pkDayEnd(y, m, lastDay) }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const period = url.searchParams.get("period") || "month"
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")
    const { start, end, label: periodLabel } = periodRange(period, from, to)

    const [ordersRaw, pos, records, loanRecords, pettyAllocations, pettyReceipts, posSales, pettyPending, advanceAccounts, salaryAdvances, importShipments, purchaseLedger, payrollSalarySlips, fuelAllotments] = await Promise.all([
      prisma.erpOrder.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.erpPurchaseOrder.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.erpFinanceRecord.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.erpFinanceRecord.findMany({
        where: { category: { in: ["Loan", "Loan Given", "Loan Repayment", "Loan Recovery"] } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.erpPettyCashAllocation.findMany({ where: { status: "active" } }),
      prisma.erpPettyCashReceipt.findMany({ where: { status: "approved" } }),
      prisma.erpPosSale.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.erpPettyCashReceipt.count({ where: { status: "pending" } }),
      prisma.erpAdvanceAccount.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.hrmSalaryAdvance.findMany({
        where: { status: { not: "cancelled" } },
        orderBy: { givenAt: "desc" },
        take: 500,
      }),
      prisma.erpImportShipment.findMany({
        where: { archived: false },
        orderBy: { createdAt: "desc" },
      }),
      prisma.erpPurchaseLedger.findMany({
        select: {
          payments: true,
          createdAt: true,
          amountPaid: true,
          purchaseScopeId: true,
          transactionType: true,
          items: true,
          supplierGroups: true,
          productName: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.erpSalarySlip.findMany({
        where: { status: "finalized" },
        select: { netSalary: true, month: true, paidAt: true, generatedDate: true },
      }),
      prisma.erpFuelAllotment.findMany({
        select: { amountPkr: true, allottedAt: true, status: true },
        orderBy: { allottedAt: "desc" },
      }),
    ])

    const orders = [...ordersRaw]
    for (let i = 0; i < orders.length; i++) {
      const row = orders[i]
      if (row.status !== "delivered") continue
      const payments = parseOrderPayments(row.payments)
      const reconciled = reconcileDeliveredOrderPayments({
        status: row.status as Order["status"],
        total: row.total,
        payments,
      })
      if (JSON.stringify(payments) !== JSON.stringify(reconciled)) {
        await prisma.erpOrder.update({
          where: { id: row.id },
          data: { payments: reconciled as unknown as Prisma.InputJsonValue },
        })
        orders[i] = { ...row, payments: reconciled as unknown as typeof row.payments }
      }
    }

    let pendingClientPayments = 0
    let clientReceivedInPeriod = 0
    let clientOutstanding = 0
    let cashbackInPeriod = 0
    let ordersNeedingAction = 0
    let confirmedOrderValueInPeriod = 0
    let salesCommissionInPeriod = 0
    let ordersConfirmedInPeriod = 0
    const actions: FinanceOverviewAction[] = []
    const clientOutstandingList: { name: string; orderNumber: string; remaining: number; href: string }[] = []
    const paymentMethodTotals: Record<string, number> = {}

    for (const row of orders) {
      if (
        !isCrmErpOrderForPaymentStats({
          source: row.source,
          notes: row.notes,
          branchId: (row as { branchId?: string | null }).branchId,
        })
      ) {
        continue
      }

      const payments = parseOrderPayments(row.payments)
      const order = {
        status: row.status as Order["status"],
        payments,
        total: row.total,
        orderNumber: row.orderNumber,
        clientName: row.clientName,
        id: row.id,
        paymentTerms: (row.paymentTerms as Order["paymentTerms"]) ?? "full",
        creditApprovedAt: row.creditApprovedAt ?? undefined,
        returnPayments: Array.isArray(row.returnPayments)
          ? (row.returnPayments as unknown as Order["returnPayments"])
          : [],
        cashbackPayments: parseOrderCashbackPayments((row as { cashbackPayments?: unknown }).cashbackPayments),
      }

      const pending = payments.filter(
        p => getPaymentSubmissionStatus(p, order.status) === "pending_approval"
      )
      pendingClientPayments += pending.length
      if (pending.length > 0) {
        ordersNeedingAction++
        actions.push({
          id: `order-pending-${row.id}`,
          type: "client_payment",
          title: `Approve payments — ${row.orderNumber}`,
          subtitle: row.clientName,
          amount: pending.reduce((s, p) => s + p.amount, 0),
          href: "/finance?tab=client",
          priority: "high",
        })
      }

      if (isFinanceRelevantOrder(order)) {
        const remaining = getOrderCreditBalance(order)
        if (remaining > 0.01 && ["finalized", "payment_added", "approved", "confirmed", "processing", "shipped", "delivered"].includes(row.status)) {
          clientOutstanding += remaining
          clientOutstandingList.push({
            name: row.clientName,
            orderNumber: row.orderNumber,
            remaining,
            href: "/finance?tab=client",
          })
          if (hasOutstandingCredit(order) && ["confirmed", "processing", "shipped", "delivered"].includes(row.status)) {
            actions.push({
              id: `order-credit-${row.id}`,
              type: "client_balance",
              title: `Collect credit — ${row.orderNumber}`,
              subtitle: row.clientName,
              amount: remaining,
              href: "/finance?tab=client",
              priority: "medium",
            })
          }
        }
      }

      const confirmedStatuses = ["confirmed", "processing", "shipped", "delivered"]
      if (confirmedStatuses.includes(row.status)) {
        const created = new Date(row.createdAt)
        if (inRange(created, start, end)) {
          confirmedOrderValueInPeriod += row.total
          ordersConfirmedInPeriod++
          if (row.salesAgentCommissionAmount && row.salesAgentCommissionAmount > 0) {
            salesCommissionInPeriod += row.salesAgentCommissionAmount
          }
        }
      }

      for (const p of payments) {
        const st = getPaymentSubmissionStatus(p, order.status)
        if (st === "approved") {
          const amount = approvedBalancePaymentAmount(p, order.status)
          if (amount <= 0) continue
          const d = new Date(p.date || row.createdAt)
          if (inRange(d, start, end)) {
            const method = p.method || "Other"
            paymentMethodTotals[method] = (paymentMethodTotals[method] || 0) + amount
          }
        }
      }

      const cashbackPayments = parseOrderCashbackPayments((row as { cashbackPayments?: unknown }).cashbackPayments)
      for (const cb of cashbackPayments) {
        const amount = Number(cb.amount) || 0
        if (amount <= 0) continue
        const d = new Date(cb.date || row.createdAt)
        if (inRange(d, start, end)) cashbackInPeriod += amount
      }
    }

    clientOutstandingList.sort((a, b) => b.remaining - a.remaining)

    let poPaidInPeriod = 0
    let localPoPaidInPeriod = 0
    let importedPoPaidInPeriod = 0
    let importedAwaitingFinance = 0
    let openPoCount = 0
    for (const po of pos) {
      const payments = Array.isArray(po.payments) ? (po.payments as { amount: number; date?: string }[]) : []
      const poType = (po.type || "local").toLowerCase()
      let paidHere = 0
      for (const p of payments) {
        const d = new Date(p.date || po.createdAt)
        if (inRange(d, start, end)) paidHere += Number(p.amount) || 0
      }
      poPaidInPeriod += paidHere
      if (poType === "imported") importedPoPaidInPeriod += paidHere
      else localPoPaidInPeriod += paidHere

      if (po.status === "imp_finance_1" || po.status === "imp_finance_2") {
        importedAwaitingFinance++
        actions.push({
          id: `po-${po.id}`,
          type: "po_payment",
          title: `Imported PO — ${po.poNumber || po.id.slice(0, 8)}`,
          subtitle: po.status.replace(/_/g, " "),
          amount: Number(po.paymentAmount) || 0,
          href: "/finance?tab=purchase",
          priority: "high",
        })
      }
      if (["finalized", "direct", "imp_finance_2", "imp_purchase_final"].includes(po.status)) {
        openPoCount++
      }
    }

    let importShipmentsPaidInPeriod = 0
    for (const sh of importShipments) {
      importShipmentsPaidInPeriod += sumJsonPaymentsInPeriod(
        sh.payments,
        start,
        end,
        sh.createdAt,
      )
    }

    const importChargesSplit = importChargesSplitInPeriod(
      importShipments.map(sh => ({
        id: sh.id,
        shipmentNumber: sh.shipmentNumber,
        blNumber: sh.blNumber,
        supplierName: sh.supplierName,
        gdNumber: sh.gdNumber,
        gdDate: sh.gdDate,
        createdAt: sh.createdAt,
        updatedAt: sh.updatedAt,
        fxRate: sh.fxRate,
        currency: sh.currency,
        charges: sh.charges,
        customsDuties: sh.customsDuties,
      })),
      start,
      end,
    )
    const importPswInPeriod = importChargesSplit.pswPkr
    const importChargesInPeriod = importChargesSplit.chargesPkr
    const importChargesCombinedInPeriod = importChargesSplit.combinedPkr

    const purchaseLedgerPaidSplit = purchaseLedgerPaidSplitInPeriod(purchaseLedger, start, end, {
      purchaseScopeId: "P1",
    })
    const purchaseLedgerPaidInPeriodTotal = purchaseLedgerPaidSplit.combined

    let fuelPetrolInPeriod = 0
    for (const a of fuelAllotments) {
      const d = new Date(a.allottedAt)
      if (!inRange(d, start, end)) continue
      fuelPetrolInPeriod += Number(a.amountPkr) || 0
    }

    const recordsInPeriod = records.filter(r => inRange(new Date(r.createdAt), start, end))
    const salariesFromRecords = recordsInPeriod
      .filter(r => r.category === "Salary")
      .reduce((s, r) => s + r.amount, 0)
    const salariesFromSlips = payrollSalarySlips.reduce((s, slip) => {
      if (!inRange(salaryCashDate(slip), start, end)) return s
      return s + (Number(slip.netSalary) || 0)
    }, 0)
    const salariesInPeriod = salariesFromRecords + salariesFromSlips
    const expensesInPeriod = recordsInPeriod
      .filter(r => ["Expense", "Payment", "Tax", "Other"].includes(r.category))
      .reduce((s, r) => s + r.amount, 0)
    const incomeRecordsInPeriod = recordsInPeriod
      .filter(r => ["Invoice", "Refund"].includes(r.category))
      .reduce((s, r) => s + r.amount, 0)
    const loanSnapshot = summarizeLoans(loanRecords, start, end)
    const loansInPeriod = loanSnapshot.moneyIn
    const loansGivenInPeriod = loanSnapshot.moneyOut

    const expensesByCategory: Record<string, number> = {}
    for (const r of recordsInPeriod) {
      expensesByCategory[r.category] = (expensesByCategory[r.category] || 0) + r.amount
    }

    const posSalesReport = buildPosSalesReport(posSales, orders, start, end)
    const posSalesInPeriod = posSalesReport.total
    const posTransactionsInPeriod = posSalesReport.rows.length
    const expenseReport = buildExpenseReport(records, start, end)
    const orderReport = buildOrderReport(orders, start, end)
    const pettyCashReport = buildPettyCashReport(pettyReceipts, start, end)
    const purchaseReport = buildPurchaseReport(pos, start, end)

    // Supplier advances are already reflected in local purchase ledger payments — exclude from money-out.
    // Salary advances are recovered inside payroll, so exclude them from finance money-out totals.
    let supplierAdvancesInPeriod = 0
    for (const account of advanceAccounts) {
      const txns = Array.isArray(account.transactions)
        ? (account.transactions as { type?: string; amount?: number; date?: string; createdAt?: string }[])
        : []
      for (const t of txns) {
        if (t.type !== "deposit") continue
        const amount = Number(t.amount) || 0
        if (amount <= 0) continue
        const d = new Date(t.date || t.createdAt || account.createdAt)
        if (inRange(d, start, end)) supplierAdvancesInPeriod += amount
      }
    }
    let salaryAdvancesInPeriod = 0
    for (const adv of salaryAdvances) {
      if (!inRange(new Date(adv.givenAt), start, end)) continue
      salaryAdvancesInPeriod += Number(adv.amount) || 0
    }
    const advancesInPeriod = 0

    // Petty cash spent in period — approved receipts only (matches Petty Cash page logic)
    const pettyUsed = sumApprovedReceiptsInPeriod(pettyReceipts, start, end)
    const pettyTotal = pettyAllocations.reduce((s, a) => s + a.amount, 0)
    const pettyRemaining = Math.max(
      0,
      pettyTotal - pettyReceipts.reduce((s, r) => s + r.amount, 0),
    )

    const statsOrders: OrderPaymentStatsOrder[] = orders
      .filter(row =>
        isCrmErpOrderForPaymentStats({
          source: row.source,
          notes: row.notes,
          branchId: (row as { branchId?: string | null }).branchId,
        }),
      )
      .map(row => ({
        status: row.status as Order["status"],
        payments: parseOrderPayments(row.payments),
        total: row.total,
        paymentTerms: (row.paymentTerms as Order["paymentTerms"]) ?? "full",
        creditApprovedAt: row.creditApprovedAt ?? undefined,
        returnPayments: Array.isArray(row.returnPayments)
          ? (row.returnPayments as unknown as Order["returnPayments"])
          : [],
        cashbackPayments: parseOrderCashbackPayments((row as { cashbackPayments?: unknown }).cashbackPayments),
        items: row.items as unknown as Order["items"],
        returnLines: (row as { returnLines?: unknown }).returnLines as Order["returnLines"],
        taxPercent: row.taxPercent ?? undefined,
        createdAt: row.createdAt,
      }))

    const orderPaymentsAllTime = aggregateOrderPaymentStats(statsOrders)
    const orderPaymentsInPeriod = aggregateOrderPaymentsInPeriod(statsOrders, start, end)
    const clientRefundsInPeriod = aggregateClientRefundsInPeriod(statsOrders, start, end)
    const orderPaymentsReconciliation = buildOrderPaymentReconciliation(
      orderPaymentsAllTime,
      orderPaymentsInPeriod,
      periodLabel,
    )

    // Same CRM-aligned logic as orderPayments panel (excludes returned orders, Branch POS).
    clientReceivedInPeriod = orderPaymentsInPeriod.approvedInPeriod

    const breakdown = {
      moneyIn: {
        clientPayments: orderPaymentsInPeriod.approvedInPeriod,
        posSales: posSalesInPeriod,
        incomeRecords: incomeRecordsInPeriod,
        loans: loansInPeriod,
        loansReceived: loanSnapshot.receivedInPeriod,
        loanRecoveries: loanSnapshot.recoveredInPeriod,
      },
      moneyOut: {
        expenses: expensesInPeriod,
        loansGiven: loansGivenInPeriod,
        salaries: salariesInPeriod,
        localPurchases: localPoPaidInPeriod,
        purchaseLedger: purchaseLedgerPaidInPeriodTotal,
        purchaseLedgerPurchases: purchaseLedgerPaidSplit.purchases,
        purchaseLedgerRents: purchaseLedgerPaidSplit.rents,
        importedPurchases: importedPoPaidInPeriod,
        importShipments: importShipmentsPaidInPeriod,
        importPsw: importPswInPeriod,
        importCharges: importChargesInPeriod,
        importChargesCombined: importChargesCombinedInPeriod,
        pettyCash: pettyUsed,
        advances: 0,
        supplierAdvances: 0,
        salaryAdvances: salaryAdvancesInPeriod,
        cashback: cashbackInPeriod,
        clientRefunds: clientRefundsInPeriod,
        fuelPetrol: fuelPetrolInPeriod,
      },
    }

    // Default snapshot: exclude legacy imported PO payments; include import PSW + charges
    const moneyIn =
      breakdown.moneyIn.clientPayments +
      breakdown.moneyIn.posSales +
      breakdown.moneyIn.incomeRecords +
      breakdown.moneyIn.loans
    const moneyOut =
      breakdown.moneyOut.expenses +
      breakdown.moneyOut.loansGiven +
      breakdown.moneyOut.salaries +
      breakdown.moneyOut.purchaseLedger +
      breakdown.moneyOut.pettyCash +
      breakdown.moneyOut.importChargesCombined +
      breakdown.moneyOut.cashback +
      breakdown.moneyOut.clientRefunds +
      breakdown.moneyOut.fuelPetrol
    const netCashFlow = moneyIn - moneyOut

    // Last 6 months trend (default buckets: exclude imported)
    const monthlyTrend: { month: string; moneyIn: number; moneyOut: number }[] = []
    const endPk = pkTodayParts(end)
    for (let i = 5; i >= 0; i--) {
      const bucket = pkShiftedMonth(endPk.y, endPk.m, -i)
      const { start: mStart, end: mEnd } = pkMonthBounds(bucket.y, bucket.m)
      const monthLabel = mStart.toLocaleDateString("en-GB", {
        month: "short",
        year: "2-digit",
        timeZone: "Asia/Karachi",
      })

      let mi = 0
      let mo = 0
      for (const row of orders) {
        const payments = parseOrderPayments(row.payments)
        const orderStatus = row.status as Order["status"]
        for (const p of payments) {
          const amount = approvedBalancePaymentAmount(p, orderStatus)
          if (amount <= 0) continue
          const d = new Date(p.date || row.createdAt)
          if (inRange(d, mStart, mEnd)) mi += amount
        }
        const cashbackPayments = parseOrderCashbackPayments((row as { cashbackPayments?: unknown }).cashbackPayments)
        for (const cb of cashbackPayments) {
          const amount = Number(cb.amount) || 0
          if (amount <= 0) continue
          const d = new Date(cb.date || row.createdAt)
          if (inRange(d, mStart, mEnd)) mo += amount
        }
        const returnPayments = Array.isArray(row.returnPayments)
          ? (row.returnPayments as { amount?: number; date?: string; createdAt?: string }[])
          : []
        for (const rp of returnPayments) {
          const amount = Number(rp.amount) || 0
          if (amount <= 0) continue
          const d = new Date(rp.date || rp.createdAt || row.createdAt)
          if (inRange(d, mStart, mEnd)) mo += amount
        }
      }
      mi += buildPosSalesReport(posSales, orders, mStart, mEnd).total
      for (const r of records) {
        const d = new Date(r.createdAt)
        if (!inRange(d, mStart, mEnd)) continue
        if (isLoanCategory(r.category)) continue
        if (["Expense", "Payment", "Tax", "Other"].includes(r.category)) mo += r.amount
        else if (r.category === "Salary") mo += r.amount
        else if (["Invoice", "Refund"].includes(r.category)) mi += r.amount
      }
      for (const r of loanRecords) {
        const d = new Date(r.createdAt)
        if (!inRange(d, mStart, mEnd)) continue
        if (r.category === "Loan" || r.category === "Loan Recovery") mi += r.amount
        else if (r.category === "Loan Given" || r.category === "Loan Repayment") mo += r.amount
      }
      for (const slip of payrollSalarySlips) {
        if (inRange(salaryCashDate(slip), mStart, mEnd)) {
          mo += Number(slip.netSalary) || 0
        }
      }
      for (const po of pos) {
        const payments = Array.isArray(po.payments) ? (po.payments as { amount: number; date?: string }[]) : []
        const poType = (po.type || "local").toLowerCase()
        if (poType === "imported") continue
        for (const p of payments) {
          const d = new Date(p.date || po.createdAt)
          if (inRange(d, mStart, mEnd)) mo += Number(p.amount) || 0
        }
      }
      mo += sumApprovedReceiptsInPeriod(pettyReceipts, mStart, mEnd)
      const monthImportCharges = importChargesSplitInPeriod(
        importShipments.map(sh => ({
          id: sh.id,
          shipmentNumber: sh.shipmentNumber,
          blNumber: sh.blNumber,
          supplierName: sh.supplierName,
          gdNumber: sh.gdNumber,
          gdDate: sh.gdDate,
          createdAt: sh.createdAt,
          updatedAt: sh.updatedAt,
          fxRate: sh.fxRate,
          currency: sh.currency,
          charges: sh.charges,
          customsDuties: sh.customsDuties,
        })),
        mStart,
        mEnd,
      )
      mo += monthImportCharges.combinedPkr
      monthlyTrend.push({ month: monthLabel, moneyIn: mi, moneyOut: mo })
    }

    const activities: FinanceOverviewActivity[] = []
    const pushActivity = (a: FinanceOverviewActivity) => {
      if (!inRange(new Date(a.date), start, end)) return
      activities.push(a)
    }

    for (const r of records) {
      pushActivity({
        id: `rec-${r.id}`,
        date: r.createdAt.toISOString(),
        label: r.title,
        amount: r.amount,
        category: r.category,
        source: "record",
      })
    }
    for (const sale of posSales) {
      pushActivity({
        id: `pos-${sale.id}`,
        date: sale.createdAt.toISOString(),
        label: `POS — ${sale.receiptNumber}${sale.customerName ? ` · ${sale.customerName}` : ""}`,
        amount: sale.total,
        category: sale.paymentMethod,
        source: "pos",
      })
    }
    for (const row of orders) {
      const payments = parseOrderPayments(row.payments)
      const orderStatus = row.status as Order["status"]
      for (const p of payments) {
        const amount = approvedBalancePaymentAmount(p, orderStatus)
        if (amount <= 0) continue
        pushActivity({
          id: `pay-${p.id}`,
          date: p.date || row.createdAt.toISOString(),
          label: `Client — ${row.orderNumber} (${row.clientName})`,
          amount,
          category: p.method,
          source: "client",
        })
      }
      const cashbackPayments = parseOrderCashbackPayments((row as { cashbackPayments?: unknown }).cashbackPayments)
      for (const cb of cashbackPayments) {
        const amount = Number(cb.amount) || 0
        if (amount <= 0) continue
        pushActivity({
          id: `cb-${cb.id}`,
          date: cb.date || row.createdAt.toISOString(),
          label: `Cashback — ${row.orderNumber} (${row.clientName})${cb.source === "other" ? " · bonus" : ""}`,
          amount: -amount,
          category: cb.method || "Cashback",
          source: "client",
        })
      }
      const returnPayments = Array.isArray(row.returnPayments)
        ? (row.returnPayments as { id?: string; amount?: number; date?: string; createdAt?: string; method?: string }[])
        : []
      for (const rp of returnPayments) {
        const amount = Number(rp.amount) || 0
        if (amount <= 0) continue
        pushActivity({
          id: `ret-${rp.id || row.id}`,
          date: rp.date || rp.createdAt || row.createdAt.toISOString(),
          label: `Return refund — ${row.orderNumber} (${row.clientName})`,
          amount: -amount,
          category: rp.method || "Refund",
          source: "client",
        })
      }
    }
    for (const r of pettyReceipts) {
      pushActivity({
        id: `pc-${r.id}`,
        date: (r.submittedAt ?? new Date()).toISOString(),
        label: `Petty cash — ${r.description}`,
        amount: r.amount,
        category: r.status,
        source: "petty_cash",
      })
    }

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    activities.splice(40)

    const crmOrderRows = orders
      .filter(row =>
        isCrmErpOrderForPaymentStats({
          source: row.source,
          notes: row.notes,
          branchId: (row as { branchId?: string | null }).branchId,
        }),
      )
      .map(row => ({
        id: row.id,
        orderNumber: row.orderNumber,
        clientName: row.clientName,
        createdAt: row.createdAt,
        source: row.source,
        notes: row.notes,
        branchId: (row as { branchId?: string | null }).branchId,
        returnPayments: row.returnPayments,
        cashbackPayments: (row as { cashbackPayments?: unknown }).cashbackPayments,
      }))

    const moneyOutDetails = {
      clientRefunds: buildClientRefundDetails(crmOrderRows, start, end),
      cashback: buildCashbackDetails(crmOrderRows, start, end),
      importPsw: buildImportPswDetails(importChargesSplit.shipments),
      importCharges: buildImportChargeStepDetails(importChargesSplit.shipments),
      importChargesCombined: buildImportCombinedDetails(importChargesSplit.shipments),
      loansGiven: buildLoanOutDetails(loanRecords, start, end),
      pettyCash: buildPettyCashApprovedDetails(pettyReceipts, start, end),
      expenses: expenseReport.details,
    }
    const moneyInDetails = {
      posSales: posSalesReport.details,
      clientOrders: orderReport.details,
    }

    return NextResponse.json({
      periodLabel,
      summary: {
        pendingClientPayments,
        ordersNeedingAction,
        clientReceivedInPeriod,
        clientOutstanding,
        poPaidInPeriod,
        localPoPaidInPeriod,
        importedPoPaidInPeriod,
        importShipmentsPaidInPeriod,
        importPswInPeriod,
        importChargesInPeriod,
        importChargesCombinedInPeriod,
        expensesInPeriod,
        salariesInPeriod,
        loansInPeriod,
        loansGivenInPeriod,
        loans: loanSnapshot,
        advancesInPeriod,
        supplierAdvancesInPeriod,
        salaryAdvancesInPeriod,
        financeRecordsCount: records.length,
        importedAwaitingFinance,
        pettyCashActive: pettyAllocations.length,
        pettyCashRemaining: pettyRemaining,
        pettyCashPendingReceipts: pettyPending,
        pettyCashUsedInPeriod: pettyUsed,
        posSalesInPeriod,
        posTransactionsInPeriod,
        salesCommissionInPeriod,
        confirmedOrderValueInPeriod,
        ordersConfirmedInPeriod,
        openPoCount,
        cashbackInPeriod,
        incomeRecordsInPeriod,
        clientRefundsInPeriod,
        moneyIn,
        moneyOut,
        netCashFlow,
        breakdown,
      },
      expensesByCategory: Object.entries(expensesByCategory)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      paymentMethods: Object.entries(paymentMethodTotals)
        .map(([method, amount]) => ({ method, amount }))
        .sort((a, b) => b.amount - a.amount),
      topOutstandingClients: clientOutstandingList.slice(0, 8),
      monthlyTrend,
      actions: actions.slice(0, 15),
      recentActivity: activities.slice(0, 25),
      orderPayments: {
        allTime: orderPaymentsAllTime,
        inPeriod: orderPaymentsInPeriod,
        reconciliation: orderPaymentsReconciliation,
      },
      moneyOutDetails,
      moneyInDetails,
      expenseLines: expenseReport.lines,
      expensesByPerson: expenseReport.byPerson,
      posSales: posSalesReport.rows,
      orders: orderReport.rows,
      pettyCashLines: pettyCashReport.lines,
      pettyCashByPerson: pettyCashReport.byPerson,
      localPurchases: purchaseReport.local,
      importedPurchases: purchaseReport.imported,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
