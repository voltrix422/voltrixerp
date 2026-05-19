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

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const all = searchParams.get("all") === "true"

  const { clearBranchTransferHistory } = await import("@/lib/branch-inventory-reset")

  if (all) {
    const result = await clearBranchTransferHistory()
    return NextResponse.json({ ok: true, ...result })
  }

  if (branchId) {
    const result = await clearBranchTransferHistory(branchId)
    return NextResponse.json({ ok: true, ...result })
  }

  return NextResponse.json(
    { error: "Provide branchId or all=true" },
    { status: 400 }
  )
}
