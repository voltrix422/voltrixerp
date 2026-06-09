import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const item = searchParams.get("item")
  const referenceId = searchParams.get("referenceId")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const type = searchParams.get("type")
  const referenceType = searchParams.get("referenceType")

  const where: Record<string, unknown> = {}
  if (item) where.itemDescription = item
  if (referenceId) {
    where.referenceId = referenceId
    where.referenceType = "order"
    where.transactionType = "out"
  }
  if (referenceType) where.referenceType = referenceType

  if (type === "in") {
    where.transactionType = "in"
  } else if (type === "out") {
    where.transactionType = { in: ["out", "assigned_to_branch", "branch_transfer"] }
  }

  if (from || to) {
    const createdAt: Record<string, Date> = {}
    if (from) {
      const start = new Date(from)
      start.setHours(0, 0, 0, 0)
      createdAt.gte = start
    }
    if (to) {
      const end = new Date(to)
      end.setHours(23, 59, 59, 999)
      createdAt.lte = end
    }
    where.createdAt = createdAt
  }

  const records = await prisma.erpInventoryHistory.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const t = await req.json()
  const record = await prisma.erpInventoryHistory.create({
    data: {
      id: t.id,
      itemDescription: t.item_description,
      transactionType: t.transaction_type,
      quantity: t.quantity,
      unit: t.unit,
      referenceType: t.reference_type,
      referenceId: t.reference_id,
      referenceNumber: t.reference_number,
      notes: t.notes,
      createdBy: t.created_by,
    },
  })
  return NextResponse.json(record)
}
