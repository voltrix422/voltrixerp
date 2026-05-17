import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const rows = await prisma.erpInventoryModelLabel.findMany({
      orderBy: { model: "asc" },
    })
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([])
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const model = String(body.model ?? "").trim()
  const displayName = String(body.displayName ?? "").trim()

  if (!model) {
    return NextResponse.json({ error: "Model code is required" }, { status: 400 })
  }

  try {
    const row = await prisma.erpInventoryModelLabel.upsert({
      where: { model },
      create: { model, displayName },
      update: { displayName },
    })

    if (displayName) {
      await prisma.erpInventorySerialUnit.updateMany({
        where: { model },
        data: { productName: displayName },
      })
    }

    return NextResponse.json(row)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Could not save model name" }, { status: 500 })
  }
}
