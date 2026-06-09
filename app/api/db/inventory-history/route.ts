import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { attachStockSnapshots } from "@/lib/inventory-movement-stock"

function mapRecord(row: {
  id: string
  itemDescription: string
  transactionType: string
  quantity: number
  unit: string
  referenceType: string
  referenceId: string
  referenceNumber: string
  notes: string | null
  stockBefore: number | null
  stockAfter: number | null
  locationLabel: string | null
  createdAt: Date
  createdBy: string
}) {
  return {
    id: row.id,
    item_description: row.itemDescription,
    transaction_type: row.transactionType,
    quantity: row.quantity,
    unit: row.unit,
    reference_type: row.referenceType,
    reference_id: row.referenceId,
    reference_number: row.referenceNumber,
    notes: row.notes ?? undefined,
    stock_before: row.stockBefore,
    stock_after: row.stockAfter,
    location_label: row.locationLabel,
    created_at: row.createdAt.toISOString(),
    created_by: row.createdBy,
  }
}

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

  const mapped = records.map(mapRecord)

  const uniqueItems = [...new Set(mapped.map((r) => r.item_description).filter(Boolean))]
  let allForItems = mapped
  if (uniqueItems.length > 0 && uniqueItems.length <= 50) {
    const allRows = await prisma.erpInventoryHistory.findMany({
      where: { itemDescription: { in: uniqueItems } },
      orderBy: { createdAt: "asc" },
    })
    allForItems = allRows.map(mapRecord)
  }

  const enriched = attachStockSnapshots(mapped, allForItems)
  return NextResponse.json(enriched)
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
      stockBefore: t.stock_before ?? null,
      stockAfter: t.stock_after ?? null,
      locationLabel: t.location_label ?? null,
      createdBy: t.created_by,
    },
  })
  return NextResponse.json(mapRecord(record))
}
