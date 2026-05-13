import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")

  if (!branchId) {
    return NextResponse.json({ error: "Missing branchId" }, { status: 400 })
  }

  const transfers = await prisma.erpBranchInventoryTransfer.findMany({
    where: {
      OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
    },
    orderBy: { transferredAt: "desc" },
  })

  return NextResponse.json(transfers)
}
