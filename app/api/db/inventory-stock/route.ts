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
  
  // Parse otherExpenses JSON string back to array for frontend
  const parsedItems = items.map(item => ({
    ...item,
    otherExpenses: (item as any).otherExpenses ? JSON.parse((item as any).otherExpenses) : [],
  }))
  
  return NextResponse.json(parsedItems)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.action === "insert") {
    // Serialize otherExpenses array to JSON string for storage
    const data = { ...body.data }
    if (data.otherExpenses && Array.isArray(data.otherExpenses)) {
      data.otherExpenses = JSON.stringify(data.otherExpenses)
    }
    
    const item = await prisma.erpInventoryStock.create({ data })
    return NextResponse.json({ ...item, otherExpenses: data.otherExpenses ? JSON.parse(data.otherExpenses) : [] })
  }

  if (body.action === "update") {
    // Serialize otherExpenses array to JSON string for storage
    const data = { ...body.data }
    if (data.otherExpenses && Array.isArray(data.otherExpenses)) {
      data.otherExpenses = JSON.stringify(data.otherExpenses)
    }
    
    const item = await prisma.erpInventoryStock.update({
      where: { id: body.id },
      data,
    })
    return NextResponse.json({ ...item, otherExpenses: data.otherExpenses ? JSON.parse(data.otherExpenses) : [] })
  }

  if (body.action === "delete") {
    const item = await prisma.erpInventoryStock.delete({
      where: { id: body.data.itemId },
    })
    return NextResponse.json(item)
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
