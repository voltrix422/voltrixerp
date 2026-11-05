import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { readProductsCatalog } from "@/lib/products-catalog-server"
import { isBranchPosOrderHiddenFromErp } from "@/lib/branch-pos"
import { parseOrderPayments } from "@/lib/finance-overview"
import {
  getPaymentSubmissionStatus,
  paymentCountsTowardBalance,
  type Order,
} from "@/lib/orders"

const PK_OFFSET = "+05:00"
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function parseDay(raw: string | Date | null | undefined, fallback: Date): Date {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw
  const s = String(raw || "").trim()
  if (!s) return fallback
  if (DATE_ONLY.test(s)) return new Date(`${s}T12:00:00${PK_OFFSET}`)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? fallback : d
}

function dayKeyLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fmtDay(key: string) {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function parseDays(raw: string | null) {
  const n = Number(raw ?? 14)
  if (n === 7 || n === 14 || n === 30) return n
  return 14
}

function orderDeliveredAt(row: {
  fulfillmentDate: string | null
  deliveryDate: string | null
  createdAt: Date
}): Date {
  return parseDay(row.fulfillmentDate || row.deliveryDate || null, row.createdAt)
}

export async function GET(req: NextRequest) {
  try {
    const days = parseDays(new URL(req.url).searchParams.get("days"))
    const now = new Date()
    const rangeStart = new Date(now)
    rangeStart.setHours(0, 0, 0, 0)
    rangeStart.setDate(rangeStart.getDate() - (days - 1))
    const rangeEnd = new Date(now)
    rangeEnd.setHours(23, 59, 59, 999)

    const [
      staff,
      clients,
      quotations,
      ordersCount,
      inventoryItems,
      financeAgg,
      poItems,
      orders,
      ticketRows,
      pettyAllocations,
    ] = await Promise.all([
      prisma.erpStaff.count(),
      prisma.erpClient.count(),
      prisma.erpQuotation.count(),
      prisma.erpOrder.count(),
      prisma.erpInventoryStock.count(),
      prisma.erpFinanceRecord.aggregate({
        where: { createdAt: { gte: rangeStart } },
        _sum: { amount: true },
      }),
      prisma.erpPurchaseOrder.findMany({ select: { items: true } }),
      prisma.erpOrder.findMany({
        select: {
          orderNumber: true,
          status: true,
          total: true,
          payments: true,
          fulfillmentDate: true,
          deliveryDate: true,
          createdAt: true,
          source: true,
          notes: true,
          branchId: true,
        },
      }),
      prisma.erpTicket.findMany({
        where: {
          OR: [
            { createdAt: { gte: rangeStart } },
            { closedAt: { gte: rangeStart } },
          ],
        },
        select: { createdAt: true, closedAt: true },
      }),
      prisma.erpPettyCashAllocation.findMany({
        where: { allocatedAt: { gte: rangeStart, lte: rangeEnd } },
        select: { employeeName: true, employeeRole: true, amount: true },
      }),
    ])

    let products = 0
    try {
      const productsCatalog = await readProductsCatalog()
      if (productsCatalog.ok) products = productsCatalog.products.length
    } catch {
      products = 0
    }

    let totalPOValue = 0
    for (const po of poItems) {
      const items = Array.isArray(po.items) ? (po.items as { totalPrice?: number }[]) : []
      totalPOValue += items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0)
    }

    const receivedDayMap = new Map<string, { amount: number; orderIds: string[] }>()
    const ticketDayMap = new Map<string, { opened: number; closed: number }>()

    for (let i = 0; i < days; i++) {
      const d = new Date(rangeStart)
      d.setDate(rangeStart.getDate() + i)
      const key = dayKeyLocal(d)
      receivedDayMap.set(key, { amount: 0, orderIds: [] })
      ticketDayMap.set(key, { opened: 0, closed: 0 })
    }

    let deliveredValue = 0
    let deliveredCount = 0
    let receivedTotal = 0
    let receivedCount = 0
    let receivedPending = 0

    for (const order of orders) {
      if (isBranchPosOrderHiddenFromErp(order)) continue
      const status = order.status as Order["status"]

      if (status === "delivered") {
        const deliveredAt = orderDeliveredAt(order)
        if (deliveredAt >= rangeStart && deliveredAt <= rangeEnd) {
          deliveredValue += Number(order.total) || 0
          deliveredCount += 1
        }
      }

      const payments = parseOrderPayments(order.payments)
      for (const payment of payments) {
        if (!paymentCountsTowardBalance(payment, status)) continue
        const submission = getPaymentSubmissionStatus(payment, status)
        if (submission !== "approved" && submission !== "pending_approval") continue
        const amount = Number(payment.amount) || 0
        if (amount <= 0) continue
        const paidAt = parseDay(payment.date || payment.createdAt, order.createdAt)
        if (paidAt < rangeStart || paidAt > rangeEnd) continue
        const key = dayKeyLocal(paidAt)
        const bucket = receivedDayMap.get(key)
        if (!bucket) continue
        bucket.amount += amount
        const id = String(order.orderNumber || "")
        if (id && !bucket.orderIds.includes(id)) bucket.orderIds.push(id)
        receivedTotal += amount
        receivedCount += 1
        if (submission === "pending_approval") receivedPending += amount
      }
    }

    for (const ticket of ticketRows) {
      const createdKey = dayKeyLocal(new Date(ticket.createdAt))
      if (ticketDayMap.has(createdKey)) {
        ticketDayMap.get(createdKey)!.opened += 1
      }
      if (ticket.closedAt) {
        const closedKey = dayKeyLocal(new Date(ticket.closedAt))
        if (ticketDayMap.has(closedKey)) {
          ticketDayMap.get(closedKey)!.closed += 1
        }
      }
    }

    const employeeMap = new Map<string, { amount: number; role: string }>()
    for (const row of pettyAllocations) {
      const key = String(row.employeeName || "Unknown")
      const prev = employeeMap.get(key) ?? { amount: 0, role: String(row.employeeRole || "—") }
      employeeMap.set(key, {
        amount: prev.amount + (Number(row.amount) || 0),
        role: prev.role,
      })
    }

    const deliveredTrend = Array.from(receivedDayMap.entries()).map(([key, value]) => ({
      day: fmtDay(key),
      amount: value.amount,
      orderIds: value.orderIds,
    }))

    const ticketTrend = Array.from(ticketDayMap.entries()).map(([key, value]) => ({
      day: fmtDay(key),
      opened: value.opened,
      closed: value.closed,
    }))

    const ticketOpened = ticketTrend.reduce((s, r) => s + r.opened, 0)
    const ticketClosed = ticketTrend.reduce((s, r) => s + r.closed, 0)

    const pettyCashByEmployee = Array.from(employeeMap.entries())
      .map(([name, val]) => ({ name, amount: val.amount, role: val.role }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)

    const pettyTotal = pettyCashByEmployee.reduce((s, r) => s + r.amount, 0)

    return NextResponse.json({
      stats: {
        staff,
        clients,
        products,
        quotations,
        orders: ordersCount,
        inventoryItems,
        financeTotal: Number(financeAgg._sum.amount) || 0,
        totalPOValue,
        /** Approved payments received in the selected range (by payment date). */
        deliveredValue: receivedTotal,
        deliveredCount: receivedCount,
        /** Orders marked delivered in the selected range (by fulfillment/delivery date). */
        deliveredOrdersValue: deliveredValue,
        deliveredOrdersCount: deliveredCount,
      },
      charts: {
        deliveredTrend,
        ticketTrend,
        pettyCashByEmployee,
        deliveredTotal: receivedTotal,
        receivedCount,
        receivedPending,
        deliveredOrdersCount: deliveredCount,
        ticketOpened,
        ticketClosed,
        pettyTotal,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
