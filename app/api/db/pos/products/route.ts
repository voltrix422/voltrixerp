import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getBranchPosProducts } from "@/lib/branch-pos-products-server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const all = searchParams.get("all") === "1"
  const branchId = searchParams.get("branchId")?.trim()

  if (branchId) {
    const products = await getBranchPosProducts(branchId, { all })
    return NextResponse.json(
      products.map((row) => ({
        id: row.id,
        description: row.description,
        name: row.name,
        model: row.model,
        unit: row.unit,
        availableQty: row.availableQty,
        costPrice: row.costPrice,
        inventoryId: row.inventoryId,
        branchInventoryId: row.branchInventoryId,
        branchInventoryIds: row.branchInventoryIds,
        isManual: row.isManual,
      })),
    )
  }

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
