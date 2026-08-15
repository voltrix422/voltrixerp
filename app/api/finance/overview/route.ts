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

function periodRange(period: string) {
  const now = new Date()
  if (period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    return { start, end, label: "Last month" }
  }
  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1)
    return { start, end: now, label: "This year" }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { start, end: now, label: "This month" }
}

function inRange(d: Date, start: Date, end: Date) {
  return d >= start && d <= end
}

export async function GET(req: NextRequest) {
  try {
    const period = new URL(req.url).searchParams.get("period") || "month"
    const { start, end, label: periodLabel } = periodRange(period)

    const [ordersRaw, pos, records, pettyAllocations, pettyReceipts, posSales, pettyPending, advanceAccounts, salaryAdvances, importShipments] = await Promise.all([
      prisma.erpOrder.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.erpPurchaseOrder.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.erpFinanceRecord.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.erpPettyCashAllocation.findMany({ where: { status: "active" } }),
      prisma.erpPettyCashReceipt.findMany({ where: { status: { in: ["pending", "approved"] } } }),
      prisma.erpPosSale.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.erpPettyCashReceipt.count({ where: { status: "pending" } }),
      prisma.erpAdvanceAccount.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.hrmSalaryAdvance.findMany({
        where: { status: { not: "cancelled" } },
        orderBy: { givenAt: "desc" },
        take: 500,
      }),
      prisma.erpImportShipment.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
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
            clientReceivedInPeriod += amount
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
      const payments = Array.isArray(sh.payments) ? (sh.payments as { amount: number; date?: string }[]) : []
      for (const p of payments) {
        const d = new Date(p.date || sh.createdAt)
        if (inRange(d, start, end)) importShipmentsPaidInPeriod += Number(p.amount) || 0
      }
    }

    const recordsInPeriod = records.filter(r => inRange(new Date(r.createdAt), start, end))
    const salariesInPeriod = recordsInPeriod
      .filter(r => r.category === "Salary")
      .reduce((s, r) => s + r.amount, 0)
    const expensesInPeriod = recordsInPeriod
      .filter(r => ["Expense", "Payment", "Tax", "Other"].includes(r.category))
      .reduce((s, r) => s + r.amount, 0)
    const incomeRecordsInPeriod = recordsInPeriod
      .filter(r => ["Invoice", "Refund"].includes(r.category))
      .reduce((s, r) => s + r.amount, 0)
    const loansInPeriod = recordsInPeriod
      .filter(r => r.category === "Loan")
      .reduce((s, r) => s + r.amount, 0)

    const expensesByCategory: Record<string, number> = {}
    for (const r of recordsInPeriod) {
      expensesByCategory[r.category] = (expensesByCategory[r.category] || 0) + r.amount
    }

    let posSalesInPeriod = 0
    let posTransactionsInPeriod = 0
    for (const sale of posSales) {
      const d = new Date(sale.createdAt)
      if (inRange(d, start, end)) {
        posSalesInPeriod += sale.total
        posTransactionsInPeriod++
      }
    }

    // Advances given (supplier/person deposits) + salary advances paid out
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
    const advancesInPeriod = supplierAdvancesInPeriod + salaryAdvancesInPeriod

    // Petty cash spent in period (approved + pending with activity date)
    const pettyUsed = pettyReceipts
      .filter(r => {
        const d = r.reviewedAt || r.submittedAt
        return d && inRange(new Date(d), start, end)
      })
      .reduce((s, r) => s + r.amount, 0)
    const pettyTotal = pettyAllocations.reduce((s, a) => s + a.amount, 0)
    const pettyRemaining = Math.max(0, pettyTotal - pettyReceipts.reduce((s, r) => s + r.amount, 0))

    const breakdown = {
      moneyIn: {
        clientPayments: clientReceivedInPeriod,
        posSales: posSalesInPeriod,
        incomeRecords: incomeRecordsInPeriod,
        loans: loansInPeriod,
      },
      moneyOut: {
        expenses: expensesInPeriod,
        salaries: salariesInPeriod,
        localPurchases: localPoPaidInPeriod,
        importedPurchases: importedPoPaidInPeriod,
        importShipments: importShipmentsPaidInPeriod,
        pettyCash: pettyUsed,
        advances: advancesInPeriod,
        supplierAdvances: supplierAdvancesInPeriod,
        salaryAdvances: salaryAdvancesInPeriod,
        cashback: cashbackInPeriod,
      },
    }

    // Default snapshot: exclude imported purchases & import shipments (toggleable in UI)
    const moneyIn =
      breakdown.moneyIn.clientPayments +
      breakdown.moneyIn.posSales +
      breakdown.moneyIn.incomeRecords +
      breakdown.moneyIn.loans
    const moneyOut =
      breakdown.moneyOut.expenses +
      breakdown.moneyOut.salaries +
      breakdown.moneyOut.localPurchases +
      breakdown.moneyOut.pettyCash +
      breakdown.moneyOut.advances +
      breakdown.moneyOut.cashback
    const netCashFlow = moneyIn - moneyOut

    // Last 6 months trend (default buckets: exclude imported)
    const monthlyTrend: { month: string; moneyIn: number; moneyOut: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(end.getFullYear(), end.getMonth() - i, 1)
      const mEnd = new Date(end.getFullYear(), end.getMonth() - i + 1, 0, 23, 59, 59)
      const monthLabel = mStart.toLocaleDateString(undefined, { month: "short", year: "2-digit" })

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
      }
      for (const sale of posSales) {
        const d = new Date(sale.createdAt)
        if (inRange(d, mStart, mEnd)) mi += sale.total
      }
      for (const r of records) {
        const d = new Date(r.createdAt)
        if (!inRange(d, mStart, mEnd)) continue
        if (["Expense", "Payment", "Tax", "Other"].includes(r.category)) mo += r.amount
        else if (r.category === "Salary") mo += r.amount
        else if (["Invoice", "Refund"].includes(r.category)) mi += r.amount
        else if (r.category === "Loan") mi += r.amount
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
      for (const r of pettyReceipts) {
        const d = r.reviewedAt || r.submittedAt
        if (d && inRange(new Date(d), mStart, mEnd)) mo += r.amount
      }
      for (const account of advanceAccounts) {
        const txns = Array.isArray(account.transactions)
          ? (account.transactions as { type?: string; amount?: number; date?: string; createdAt?: string }[])
          : []
        for (const t of txns) {
          if (t.type !== "deposit") continue
          const amount = Number(t.amount) || 0
          if (amount <= 0) continue
          const d = new Date(t.date || t.createdAt || account.createdAt)
          if (inRange(d, mStart, mEnd)) mo += amount
        }
      }
      for (const adv of salaryAdvances) {
        if (inRange(new Date(adv.givenAt), mStart, mEnd)) mo += Number(adv.amount) || 0
      }
      monthlyTrend.push({ month: monthLabel, moneyIn: mi, moneyOut: mo })
    }

    const activities: FinanceOverviewActivity[] = []

    for (const r of records.slice(0, 20)) {
      activities.push({
        id: `rec-${r.id}`,
        date: r.createdAt.toISOString(),
        label: r.title,
        amount: r.amount,
        category: r.category,
        source: "record",
      })
    }
    for (const sale of posSales.slice(0, 15)) {
      activities.push({
        id: `pos-${sale.id}`,
        date: sale.createdAt.toISOString(),
        label: `POS — ${sale.receiptNumber}${sale.customerName ? ` · ${sale.customerName}` : ""}`,
        amount: sale.total,
        category: sale.paymentMethod,
        source: "pos",
      })
    }
    for (const row of orders.slice(0, 40)) {
      const payments = parseOrderPayments(row.payments)
      const orderStatus = row.status as Order["status"]
      for (const p of payments) {
        const amount = approvedBalancePaymentAmount(p, orderStatus)
        if (amount <= 0) continue
        activities.push({
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
        activities.push({
          id: `cb-${cb.id}`,
          date: cb.date || row.createdAt.toISOString(),
          label: `Cashback — ${row.orderNumber} (${row.clientName})${cb.source === "other" ? " · bonus" : ""}`,
          amount: -amount,
          category: cb.method || "Cashback",
          source: "client",
        })
      }
    }
    for (const r of pettyReceipts.slice(0, 10)) {
      activities.push({
        id: `pc-${r.id}`,
        date: (r.submittedAt ?? new Date()).toISOString(),
        label: `Petty cash — ${r.description}`,
        amount: r.amount,
        category: r.status,
        source: "petty_cash",
      })
    }

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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
        expensesInPeriod,
        salariesInPeriod,
        loansInPeriod,
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
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
