import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const descriptions = searchParams.get("descriptions")

  if (descriptions) {
    const list = descriptions
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)

    // Case-insensitive matching so deduction works even if text casing differs.
    const orConditions = list.map((description) => ({
      description: { equals: description, mode: "insensitive" as const },
    }))

    const items = await prisma.erpInventoryStock.findMany({
      where: orConditions.length > 0 ? { OR: orConditions } : undefined,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        description: true,
        availableQty: true,
        poNumber: true,
        createdAt: true,
      },
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
