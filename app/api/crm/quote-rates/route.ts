import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const rows = await prisma.crmQuoteRate.findMany({
      orderBy: [{ itemName: "asc" }, { rateDate: "desc" }, { createdAt: "desc" }],
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("[quote-rates GET]", error)
    return NextResponse.json({ error: "Failed to load rates" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const itemName = String(data.itemName ?? "").trim()
    const supplier = String(data.supplier ?? "").trim()
    const rate = Number(data.rate)
    const rateDate = String(data.rateDate ?? "").slice(0, 10)
    const notes = String(data.notes ?? "").trim()
    const createdBy = String(data.createdBy ?? "").trim() || "CRM"
    const id = String(data.id ?? "").trim()

    if (!itemName) return NextResponse.json({ error: "Item name is required" }, { status: 400 })
    if (!supplier) return NextResponse.json({ error: "Supplier is required" }, { status: 400 })
    if (!Number.isFinite(rate) || rate < 0) {
      return NextResponse.json({ error: "Rate must be a valid amount" }, { status: 400 })
    }
    if (!rateDate) return NextResponse.json({ error: "Date is required" }, { status: 400 })

    const row = id
      ? await prisma.crmQuoteRate.update({
          where: { id },
          data: { itemName, supplier, rate, rateDate, notes },
        })
      : await prisma.crmQuoteRate.create({
          data: { itemName, supplier, rate, rateDate, notes, createdBy },
        })
    return NextResponse.json(row)
  } catch (error) {
    console.error("[quote-rates POST]", error)
    return NextResponse.json({ error: "Failed to save rate" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    await prisma.crmQuoteRate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[quote-rates DELETE]", error)
    return NextResponse.json({ error: "Failed to delete rate" }, { status: 500 })
  }
}
