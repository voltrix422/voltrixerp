import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const rows = await prisma.erpCrmProductPrice.findMany({
      orderBy: { model: "asc" },
    })
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([])
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const updatedById = String(body.updatedById ?? "").trim()
  const model = String(body.model ?? "").trim()
  const displayName = String(body.displayName ?? "").trim()
  const retailPrice = Number(body.retailPrice ?? 0)
  const wholesalePrice = Number(body.wholesalePrice ?? 0)
  const dealershipPrice = Number(body.dealershipPrice ?? 0)
  const updatedBy = String(body.updatedBy ?? "").trim()

  if (!updatedById) {
    return NextResponse.json({ error: "User required" }, { status: 400 })
  }

  const editor = await prisma.erpUser.findUnique({
    where: { id: updatedById },
    select: { role: true },
  })
  if (!editor || (editor.role !== "admin" && editor.role !== "superadmin")) {
    return NextResponse.json({ error: "Only admin can set product prices" }, { status: 403 })
  }

  if (!model) {
    return NextResponse.json({ error: "Model code is required" }, { status: 400 })
  }

  try {
    const row = await prisma.erpCrmProductPrice.upsert({
      where: { model },
      create: {
        model,
        displayName,
        retailPrice: Number.isFinite(retailPrice) ? retailPrice : 0,
        wholesalePrice: Number.isFinite(wholesalePrice) ? wholesalePrice : 0,
        dealershipPrice: Number.isFinite(dealershipPrice) ? dealershipPrice : 0,
        updatedBy,
      },
      update: {
        displayName,
        retailPrice: Number.isFinite(retailPrice) ? retailPrice : 0,
        wholesalePrice: Number.isFinite(wholesalePrice) ? wholesalePrice : 0,
        dealershipPrice: Number.isFinite(dealershipPrice) ? dealershipPrice : 0,
        updatedBy,
      },
    })
    return NextResponse.json(row)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Could not save product price" }, { status: 500 })
  }
}
