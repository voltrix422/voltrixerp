import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const all = new URL(req.url).searchParams.get("all") === "1"
  const rows = await prisma.erpInventoryStock.findMany({
    where: all ? undefined : { availableQty: { gt: 0 } },
    orderBy: { description: "asc" },
  })

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      description: row.description,
      name: row.name || row.description,
      unit: row.unit || "pcs",
      availableQty: row.availableQty,
      costPrice: row.costPrice,
      poNumber: row.poNumber,
    })),
  )
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: "Product id required" }, { status: 400 })
  }

  const stock = await prisma.erpInventoryStock.findUnique({ where: { id } })
  if (!stock) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const serials = await tx.erpInventorySerialUnit.findMany({
        where: { inventoryStockId: id, status: "in_stock" },
      })

      if (serials.length > 0) {
        await tx.erpInventorySerialUnit.deleteMany({
          where: { inventoryStockId: id },
        })
      }

      if (stock.availableQty > 0) {
        await tx.erpInventoryHistory.create({
          data: {
            itemDescription: stock.description,
            transactionType: "out",
            quantity: stock.availableQty,
            unit: stock.unit || "pcs",
            referenceType: "pos_remove",
            referenceId: id,
            referenceNumber: `POS-REMOVE-${id}`,
            notes: "Removed from POS inventory",
            createdBy: "POS",
          },
        })
      }

      await tx.erpInventoryStock.delete({ where: { id } })
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
