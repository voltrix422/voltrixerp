import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function mapAgent(row: {
  id: string
  name: string
  email: string
  role: string
  managerId: string | null
  location: string
  jobTitle: string
  baseSalary: number
  commissionPercent: number
  modules: unknown
  createdAt: Date
}, managerName?: string) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    managerId: row.managerId,
    managerName,
    location: row.location,
    jobTitle: row.jobTitle,
    baseSalary: row.baseSalary,
    commissionPercent: row.commissionPercent,
    modules: Array.isArray(row.modules) ? row.modules : [],
    createdAt: row.createdAt.toISOString(),
  }
}

async function buildAgentStats(agentId: string) {
  const [clients, quotations, orders] = await Promise.all([
    prisma.erpClient.findMany({ where: { ownerUserId: agentId } }),
    prisma.crmQuotation.findMany({ where: { ownerUserId: agentId } }),
    prisma.erpOrder.findMany({ where: { ownerUserId: agentId } }),
  ])

  const delivered = orders.filter(o => o.status === "delivered")
  const pending = orders.filter(o => o.status === "pending_approval")
  const totalSales = delivered.reduce((s, o) => s + o.total, 0)
  const commissionEarned = delivered.reduce(
    (s, o) => s + (o.salesAgentCommissionAmount ?? 0),
    0
  )
  const activeOrders = orders.filter(
    o => o.status !== "cancelled" && o.status !== "rejected"
  )
  const commissionPending = activeOrders
    .filter(o => o.status !== "delivered")
    .reduce((s, o) => s + o.total, 0)
  const quotationsValue = quotations.reduce((s, q) => s + q.total, 0)
  const ordersValue = activeOrders.reduce((s, o) => s + o.total, 0)

  return {
    clients: clients.length,
    quotations: quotations.length,
    quotationsValue,
    orders: orders.length,
    ordersValue,
    pendingOrders: pending.length,
    deliveredOrders: delivered.length,
    totalSales,
    commissionEarned,
    commissionPending,
  }
}

export async function GET(req: NextRequest) {
  const managerId = req.nextUrl.searchParams.get("managerId")
  const withStats = req.nextUrl.searchParams.get("stats") === "1"

  const agents = await prisma.erpUser.findMany({
    where: {
      role: "sales_agent",
      ...(managerId ? { managerId } : {}),
    },
    orderBy: { name: "asc" },
  })

  const managers = await prisma.erpUser.findMany({
    where: { role: { in: ["sales_manager", "superadmin"] } },
    select: { id: true, name: true },
  })
  const managerMap = new Map(managers.map(m => [m.id, m.name]))

  const result = await Promise.all(
    agents.map(async agent => {
      const base = mapAgent(agent, agent.managerId ? managerMap.get(agent.managerId) : undefined)
      if (!withStats) return base
      const stats = await buildAgentStats(agent.id)
      return { ...base, stats }
    })
  )

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, password, managerId, location, jobTitle, baseSalary, commissionPercent } = body

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 })
  }

  const existing = await prisma.erpUser.findUnique({ where: { email: email.trim() } })
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 400 })
  }

  const salary = Number(baseSalary ?? 25000)
  const commission = Number(commissionPercent ?? 0.5)

  const user = await prisma.erpUser.create({
    data: {
      name: name.trim(),
      email: email.trim(),
      password: password,
      role: "sales_agent",
      modules: ["crm"],
      managerId: managerId || null,
      location: (location || "").trim(),
      jobTitle: jobTitle || "field_sales_officer",
      baseSalary: salary,
      commissionPercent: commission,
    },
  })

  await prisma.erpSalesAgentCompensationHistory.create({
    data: {
      userId: user.id,
      baseSalary: salary,
      commissionPercent: commission,
      note: "Initial compensation",
      createdBy: body.createdBy || "Admin",
    },
  })

  return NextResponse.json(mapAgent(user))
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, compensationNote, updatedBy, ...updates } = body
  if (!id) return NextResponse.json({ error: "Missing agent id" }, { status: 400 })

  const existing = await prisma.erpUser.findUnique({ where: { id } })
  if (!existing || existing.role !== "sales_agent") {
    return NextResponse.json({ error: "Sales agent not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (updates.name !== undefined) data.name = String(updates.name).trim()
  if (updates.email !== undefined) data.email = String(updates.email).trim()
  if (updates.password !== undefined && updates.password) data.password = updates.password
  if (updates.managerId !== undefined) data.managerId = updates.managerId || null
  if (updates.location !== undefined) data.location = String(updates.location).trim()
  if (updates.jobTitle !== undefined) data.jobTitle = updates.jobTitle
  if (updates.baseSalary !== undefined) data.baseSalary = Number(updates.baseSalary)
  if (updates.commissionPercent !== undefined) data.commissionPercent = Number(updates.commissionPercent)

  const salaryChanged =
    updates.baseSalary !== undefined && Number(updates.baseSalary) !== existing.baseSalary
  const commissionChanged =
    updates.commissionPercent !== undefined &&
    Number(updates.commissionPercent) !== existing.commissionPercent

  const user = await prisma.erpUser.update({ where: { id }, data: data as never })

  if (salaryChanged || commissionChanged) {
    await prisma.erpSalesAgentCompensationHistory.create({
      data: {
        userId: id,
        baseSalary: user.baseSalary,
        commissionPercent: user.commissionPercent,
        note: compensationNote || "Rate updated",
        createdBy: updatedBy || "Admin",
      },
    })
  }

  return NextResponse.json(mapAgent(user))
}
