import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId")
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")

  const agents = await prisma.erpUser.findMany({
    where: {
      role: "sales_agent",
      ...(agentId ? { id: agentId } : {}),
    },
    orderBy: { name: "asc" },
  })

  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(to + "T23:59:59") : null

  const summaries = await Promise.all(
    agents.map(async agent => {
      const orders = await prisma.erpOrder.findMany({
        where: { ownerUserId: agent.id },
        orderBy: { createdAt: "desc" },
      })

      const filtered = orders.filter(o => {
        const d = new Date(o.createdAt)
        if (fromDate && d < fromDate) return false
        if (toDate && d > toDate) return false
        return true
      })

      const delivered = filtered.filter(o => o.status === "delivered")
      const totalSales = delivered.reduce((s, o) => s + o.total, 0)
      const commissionEarned = delivered.reduce(
        (s, o) => s + (o.salesAgentCommissionAmount ?? 0),
        0
      )

      return {
        agentId: agent.id,
        agentName: agent.name,
        baseSalary: agent.baseSalary,
        currentCommissionPercent: agent.commissionPercent,
        deliveredOrderCount: delivered.length,
        totalSales,
        commissionEarned,
        orders: filtered.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          clientName: o.clientName,
          total: o.total,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          commissionPercent: o.salesAgentCommissionPercent ?? undefined,
          commissionAmount: o.salesAgentCommissionAmount ?? undefined,
        })),
      }
    })
  )

  return NextResponse.json(summaries)
}
