import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const item = searchParams.get("item")

  const where = item ? { itemDescription: item } : {}
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
