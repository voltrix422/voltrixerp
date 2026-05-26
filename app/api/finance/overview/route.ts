import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Order } from "@/lib/orders"
import {
  parseOrderPayments,
  orderPaidTotal,
  orderPendingPaymentCount,
  isFinanceRelevantOrder,
  type FinanceOverviewAction,
  type FinanceOverviewActivity,
} from "@/lib/finance-overview"
import { getPaymentSubmissionStatus } from "@/lib/orders"

function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export async function GET() {
  try {
    const [orders, pos, records, pettyAllocations, pettyReceipts] = await Promise.all([
      prisma.erpOrder.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.erpPurchaseOrder.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.erpFinanceRecord.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.erpPettyCashAllocation.findMany({ where: { status: "active" } }),
      prisma.erpPettyCashReceipt.findMany({
        where: { status: { in: ["pending", "approved"] } },
      }),
    ])

    const start = monthStart()
    let pendingClientPayments = 0
    let clientReceivedThisMonth = 0
    let clientOutstanding = 0
    let ordersNeedingAction = 0
    const actions: FinanceOverviewAction[] = []

    for (const row of orders) {
      const payments = parseOrderPayments(row.payments)
      const order = {
        status: row.status as Order["status"],
        payments,
        total: row.total,
        orderNumber: row.orderNumber,
        clientName: row.clientName,
        id: row.id,
      }

      if (!isFinanceRelevantOrder(order)) continue

      const pending = payments.filter(
        p => getPaymentSubmissionStatus(p, order.status) === "pending_approval"
      )
      pendingClientPayments += pending.length
      if (pending.length > 0) {
        ordersNeedingAction++
        const sum = pending.reduce((s, p) => s + p.amount, 0)
        actions.push({
          id: `order-pending-${row.id}`,
          type: "client_payment",
          title: `Approve payments — ${row.orderNumber}`,
          subtitle: row.clientName,
          amount: sum,
          href: "/finance?tab=client",
          priority: "high",
        })
      }

      const paid = orderPaidTotal(order)
      const remaining = Math.max(0, row.total - paid)
      if (remaining > 0.01 && ["finalized", "payment_added", "approved", "confirmed"].includes(row.status)) {
        clientOutstanding += remaining
        if (actions.length < 12) {
          actions.push({
            id: `order-balance-${row.id}`,
            type: "client_balance",
            title: `Outstanding — ${row.orderNumber}`,
            subtitle: `${row.clientName} · PKR ${remaining.toLocaleString()} due`,
            amount: remaining,
            href: "/finance?tab=client",
            priority: "medium",
          })
        }
      }

      for (const p of payments) {
        const st = getPaymentSubmissionStatus(p, order.status)
        if (st === "approved") {
          const d = new Date(p.date || row.createdAt)
          if (d >= start) clientReceivedThisMonth += p.amount
        }
      }
    }

    let poPaidThisMonth = 0
    let importedAwaitingFinance = 0
    for (const po of pos) {
      const payments = Array.isArray(po.payments) ? (po.payments as { amount: number; date?: string }[]) : []
      for (const p of payments) {
        const d = new Date(p.date || po.createdAt)
        if (d >= start) poPaidThisMonth += Number(p.amount) || 0
      }
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
    }

    const recordsThisMonth = records.filter(r => new Date(r.createdAt) >= start)
    const expensesThisMonth = recordsThisMonth
      .filter(r => ["Expense", "Payment", "Tax", "Salary"].includes(r.category))
      .reduce((s, r) => s + r.amount, 0)

    const pettyUsed = pettyReceipts.reduce((s, r) => s + r.amount, 0)
    const pettyTotal = pettyAllocations.reduce((s, a) => s + a.amount, 0)
    const pettyRemaining = Math.max(0, pettyTotal - pettyUsed)

    const activities: FinanceOverviewActivity[] = []

    for (const r of records.slice(0, 15)) {
      activities.push({
        id: `rec-${r.id}`,
        date: r.createdAt.toISOString(),
        label: r.title,
        amount: r.amount,
        category: r.category,
        source: "record",
      })
    }

    for (const row of orders.slice(0, 30)) {
      const payments = parseOrderPayments(row.payments)
      for (const p of payments) {
        if (getPaymentSubmissionStatus(p, row.status as Order["status"]) !== "approved") continue
        activities.push({
          id: `pay-${p.id}`,
          date: p.date || row.createdAt.toISOString(),
          label: `Client payment — ${row.orderNumber}`,
          amount: p.amount,
          category: p.method,
          source: "client",
        })
      }
    }

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      summary: {
        pendingClientPayments,
        ordersNeedingAction,
        clientReceivedThisMonth,
        clientOutstanding,
        poPaidThisMonth,
        expensesThisMonth,
        financeRecordsCount: records.length,
        importedAwaitingFinance,
        pettyCashActive: pettyAllocations.length,
        pettyCashRemaining: pettyRemaining,
      },
      actions: actions.slice(0, 15),
      recentActivity: activities.slice(0, 20),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
