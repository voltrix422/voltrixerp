import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { readProductsCatalog } from "@/lib/products-catalog-server"

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function parseDays(raw: string | null) {
  const n = Number(raw ?? 14)
  if (n === 7 || n === 14 || n === 30) return n
  return 14
}

export async function GET(req: NextRequest) {
  try {
    const days = parseDays(new URL(req.url).searchParams.get("days"))
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const rangeStart = new Date(now)
    rangeStart.setHours(0, 0, 0, 0)
    rangeStart.setDate(rangeStart.getDate() - (days - 1))

    const [
      staff,
      clients,
      quotations,
      orders,
      inventoryItems,
      financeAgg,
      deliveredAgg,
      poItems,
      deliveredOrders,
      inventoryRows,
      ticketRows,
      pettyAllocations,
    ] = await Promise.all([
      prisma.erpStaff.count(),
      prisma.erpClient.count(),
      prisma.erpQuotation.count(),
      prisma.erpOrder.count(),
      prisma.erpInventoryStock.count(),
      prisma.erpFinanceRecord.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.erpOrder.aggregate({
        where: { status: "delivered" },
        _sum: { total: true },
        _count: true,
      }),
      prisma.erpPurchaseOrder.findMany({ select: { items: true } }),
      prisma.erpOrder.findMany({
        where: { status: "delivered" },
        select: {
          total: true,
          orderNumber: true,
          fulfillmentDate: true,
          deliveryDate: true,
          createdAt: true,
        },
      }),
      prisma.erpInventoryStock.findMany({
        where: { createdAt: { gte: rangeStart } },
        select: {
          createdAt: true,
          receivedQty: true,
          availableQty: true,
          description: true,
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
        where: { allocatedAt: { gte: monthStart } },
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

    const deliveredDayMap = new Map<string, { amount: number; orderIds: string[] }>()
    const inventoryDayMap = new Map<string, { quantity: number; names: string[] }>()
    const ticketDayMap = new Map<string, { opened: number; closed: number }>()

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(rangeStart)
      d.setDate(rangeStart.getDate() + i)
      const key = dayKey(d)
      deliveredDayMap.set(key, { amount: 0, orderIds: [] })
      inventoryDayMap.set(key, { quantity: 0, names: [] })
      ticketDayMap.set(key, { opened: 0, closed: 0 })
    }

    for (const order of deliveredOrders) {
      const dateRaw = order.fulfillmentDate || order.deliveryDate || order.createdAt
      const d = new Date(dateRaw)
      if (Number.isNaN(d.getTime())) continue
      const key = dayKey(d)
      const bucket = deliveredDayMap.get(key)
      if (!bucket) continue
      bucket.amount += Number(order.total) || 0
      bucket.orderIds.push(String(order.orderNumber || ""))
    }

    for (const row of inventoryRows) {
      const key = dayKey(new Date(row.createdAt))
      const bucket = inventoryDayMap.get(key)
      if (!bucket) continue
      bucket.quantity += Number(row.receivedQty ?? row.availableQty ?? 0)
      if (row.description) bucket.names.push(String(row.description))
    }

    for (const ticket of ticketRows) {
      const createdKey = dayKey(new Date(ticket.createdAt))
      if (ticketDayMap.has(createdKey)) {
        ticketDayMap.get(createdKey)!.opened += 1
      }
      if (ticket.closedAt) {
        const closedKey = dayKey(new Date(ticket.closedAt))
        if (ticketDayMap.has(closedKey)) {
          ticketDayMap.get(closedKey)!.closed += 1
        }
      }
    }

    const employeeMap = new Map<string, { amount: number; role: string }>()
    for (const row of pettyAllocations) {
      const key = String(row.employeeName || "Unknown")
      const prev = employeeMap.get(key) ?? { amount: 0, role: String(row.employeeRole || "—") }
      employeeMap.set(key, { amount: prev.amount + (Number(row.amount) || 0), role: prev.role })
    }

    const fmtDay = (key: string) =>
      new Date(key).toLocaleDateString(undefined, { month: "short", day: "numeric" })

    const deliveredTrend = Array.from(deliveredDayMap.entries()).map(([key, value]) => ({
      day: fmtDay(key),
      amount: value.amount,
      orderIds: value.orderIds,
    }))

    const inventoryTrend = Array.from(inventoryDayMap.entries()).map(([key, value]) => ({
      day: fmtDay(key),
      quantity: value.quantity,
      names: value.names,
    }))

    const ticketTrend = Array.from(ticketDayMap.entries()).map(([key, value]) => ({
      day: fmtDay(key),
      opened: value.opened,
      closed: value.closed,
    }))

    const pettyCashByEmployee = Array.from(employeeMap.entries())
      .map(([name, val]) => ({ name, amount: val.amount, role: val.role }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)

    return NextResponse.json({
      stats: {
        staff,
        clients,
        products,
        quotations,
        orders,
        inventoryItems,
        financeTotal: Number(financeAgg._sum.amount) || 0,
        totalPOValue,
        deliveredValue: Number(deliveredAgg._sum.total) || 0,
        deliveredCount: deliveredAgg._count,
      },
      charts: {
        deliveredTrend,
        inventoryTrend,
        ticketTrend,
        pettyCashByEmployee,
        deliveredTotal: deliveredTrend.reduce((s, r) => s + r.amount, 0),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
