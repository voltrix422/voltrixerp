import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const rows = await prisma.erpSalesAgentCompensationHistory.findMany({
    where: { userId },
    orderBy: { effectiveFrom: "desc" },
  })

  return NextResponse.json(
    rows.map(r => ({
      id: r.id,
      userId: r.userId,
      baseSalary: r.baseSalary,
      commissionPercent: r.commissionPercent,
      effectiveFrom: r.effectiveFrom.toISOString(),
      note: r.note,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    }))
  )
}
