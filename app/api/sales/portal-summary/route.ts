import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function createdAtFilter(from: string | null, to: string | null) {
  if (!from && !to) return {}
  const createdAt: { gte?: Date; lte?: Date } = {}
  if (from) createdAt.gte = new Date(from)
  if (to) createdAt.lte = new Date(to + "T23:59:59")
  return { createdAt }
}

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId")
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")

  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 })
  }

  const agent = await prisma.erpUser.findUnique({ where: { id: agentId } })
  if (!agent || agent.role !== "sales_agent") {
    return NextResponse.json({ error: "Sales agent not found" }, { status: 404 })
  }

  const dateWhere = createdAtFilter(from, to)

  const [clients, quotations, orders] = await Promise.all([
    prisma.erpClient.findMany({ where: { ownerUserId: agentId, ...dateWhere } }),
    prisma.crmQuotation.findMany({ where: { ownerUserId: agentId, ...dateWhere } }),
    prisma.erpOrder.findMany({ where: { ownerUserId: agentId, ...dateWhere }, orderBy: { createdAt: "desc" } }),
  ])

  const delivered = orders.filter(o => o.status === "delivered")
  const pending = orders.filter(o => o.status === "pending_approval")
  const activeOrders = orders.filter(o => o.status !== "cancelled" && o.status !== "rejected")

  return NextResponse.json({
    agentId: agent.id,
    agentName: agent.name,
    location: agent.location,
    commissionPercent: agent.commissionPercent,
    dateFrom: from || null,
    dateTo: to || null,
    clients: clients.length,
    quotations: quotations.length,
    quotationsValue: quotations.reduce((s, q) => s + q.total, 0),
    orderCount: orders.length,
    ordersValue: activeOrders.reduce((s, o) => s + o.total, 0),
    pendingOrders: pending.length,
    deliveredOrders: delivered.length,
    totalSales: delivered.reduce((s, o) => s + o.total, 0),
    commissionEarned: delivered.reduce((s, o) => s + (o.salesAgentCommissionAmount ?? 0), 0),
    orderRows: orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      clientName: o.clientName,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      commissionPercent: o.salesAgentCommissionPercent ?? undefined,
      commissionAmount: o.salesAgentCommissionAmount ?? undefined,
    })),
  })
}
