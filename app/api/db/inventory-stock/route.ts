import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const descriptions = searchParams.get("descriptions")

  if (descriptions) {
    const list = descriptions.split(",")
    const items = await prisma.erpInventoryStock.findMany({
      where: { description: { in: list } },
      select: { description: true, availableQty: true },
    })
    return NextResponse.json(items)
  }

  const items = await prisma.erpInventoryStock.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.action === "insert") {
    const item = await prisma.erpInventoryStock.create({ data: body.data })
    return NextResponse.json(item)
  }

  if (body.action === "update") {
    const item = await prisma.erpInventoryStock.update({
      where: { id: body.id },
      data: body.data,
    })
    return NextResponse.json(item)
  }

  if (body.action === "delete") {
    const item = await prisma.erpInventoryStock.delete({
      where: { id: body.data.itemId },
    })
    return NextResponse.json(item)
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
