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
    })),
  )
}
