import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function normalizeTag(row: any) {
  return {
    id: row.id,
    epc: row.epc,
    item_id: row.itemId,
    sku: row.sku,
    item_description: row.itemDescription,
    status: row.status,
    warehouse: row.warehouse,
    dispatch_id: row.dispatchId,
    order_id: row.orderId,
    invoice_number: row.invoiceNumber,
    authorized_at: row.authorizedAt ? row.authorizedAt.toISOString() : null,
    authorized_until: row.authorizedUntil ? row.authorizedUntil.toISOString() : null,
    exited_at: row.exitedAt ? row.exitedAt.toISOString() : null,
    updated_by: row.updatedBy,
    created_at: row.createdAt ? row.createdAt.toISOString() : "",
    updated_at: row.updatedAt ? row.updatedAt.toISOString() : "",
  }
}

export async function GET() {
  const tags = await prisma.erpRfidTag.findMany({ orderBy: { createdAt: "desc" }, take: 200 })
  return NextResponse.json(tags.map(normalizeTag))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const epc = String(body.epc ?? "").trim().toUpperCase()

  if (!epc) {
    return NextResponse.json({ error: "epc is required" }, { status: 400 })
  }

  const saved = await prisma.erpRfidTag.upsert({
    where: { epc },
    update: {
      itemId: body.item_id || null,
      sku: body.sku || "",
      itemDescription: body.item_description || "",
      warehouse: body.warehouse || "",
      status: body.status || "IN_STOCK",
      updatedBy: body.updated_by || "system",
    },
    create: {
      epc,
      itemId: body.item_id || null,
      sku: body.sku || "",
      itemDescription: body.item_description || "",
      warehouse: body.warehouse || "",
      status: body.status || "IN_STOCK",
      updatedBy: body.updated_by || "system",
    },
  })

  return NextResponse.json(normalizeTag(saved))
}
