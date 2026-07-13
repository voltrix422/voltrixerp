import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const item = searchParams.get("item")
  const referenceId = searchParams.get("referenceId")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const type = searchParams.get("type")
  const referenceType = searchParams.get("referenceType")
  const referenceTypes = searchParams.get("referenceTypes")
  const locationLabel = searchParams.get("locationLabel")
  const branchId = searchParams.get("branchId")
  /** Branch POS outbound ledger: only stock leaving via POS order/sale */
  const posOutbound = searchParams.get("posOutbound") === "1"

  const where: Prisma.ErpInventoryHistoryWhereInput = {}
  if (item) where.itemDescription = item
  if (referenceId && !posOutbound) {
    where.referenceId = referenceId
    where.referenceType = "order"
    where.transactionType = "out"
  }

  if (posOutbound) {
    where.referenceType = { in: ["branch_pos_order", "pos_sale"] }
    where.transactionType = "out"
  } else if (referenceTypes) {
    const types = referenceTypes.split(",").map((t) => t.trim()).filter(Boolean)
    if (types.length === 1) where.referenceType = types[0]
    else if (types.length > 1) where.referenceType = { in: types }
  } else if (referenceType) {
    where.referenceType = referenceType
  }

  if (!posOutbound) {
    if (type === "in") {
      where.transactionType = "in"
    } else if (type === "out") {
      where.transactionType = { in: ["out", "assigned_to_branch", "branch_transfer"] }
    }
  }

  if (from || to) {
    const createdAt: { gte?: Date; lte?: Date } = {}
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

  // Branch POS location: prefer locationLabel (set on POS movements), fall back to notes.
  if (locationLabel || branchId) {
    const or: Prisma.ErpInventoryHistoryWhereInput[] = []
    if (locationLabel) {
      or.push({ locationLabel })
      or.push({ notes: { contains: locationLabel, mode: "insensitive" } })
    }
    if (branchId && !posOutbound) {
      or.push({ referenceId: branchId })
    }
    where.OR = or
  }

  const records = await prisma.erpInventoryHistory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
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
      stockBefore: t.stock_before ?? t.stockBefore ?? null,
      stockAfter: t.stock_after ?? t.stockAfter ?? null,
      locationLabel: t.location_label ?? t.locationLabel ?? null,
      createdBy: t.created_by,
    },
  })
  return NextResponse.json(record)
}

/** Delete ledger rows only (does not restore stock). */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  const clearPosOutbound = searchParams.get("clearPosOutbound") === "1"
  const locationLabel = searchParams.get("locationLabel")

  if (id) {
    const existing = await prisma.erpInventoryHistory.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "History entry not found" }, { status: 404 })
    }
    await prisma.erpInventoryHistory.delete({ where: { id } })
    return NextResponse.json({ ok: true, deleted: 1 })
  }

  if (clearPosOutbound) {
    if (!locationLabel) {
      return NextResponse.json({ error: "locationLabel is required to clear POS history" }, { status: 400 })
    }
    const result = await prisma.erpInventoryHistory.deleteMany({
      where: {
        referenceType: { in: ["branch_pos_order", "pos_sale"] },
        transactionType: "out",
        OR: [
          { locationLabel },
          { notes: { contains: locationLabel, mode: "insensitive" } },
        ],
      },
    })
    return NextResponse.json({ ok: true, deleted: result.count })
  }

  const body = await req.json().catch(() => null)
  const bodyIds =
    body && Array.isArray(body.ids)
      ? body.ids.map((x: unknown) => String(x)).filter(Boolean)
      : []

  if (bodyIds.length > 0) {
    const result = await prisma.erpInventoryHistory.deleteMany({
      where: { id: { in: bodyIds } },
    })
    return NextResponse.json({ ok: true, deleted: result.count })
  }

  return NextResponse.json(
    { error: "Provide id, ids, or clearPosOutbound=1 with locationLabel" },
    { status: 400 }
  )
}
