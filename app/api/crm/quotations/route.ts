import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const quotations = await prisma.crmQuotation.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(quotations)
  } catch (error) {
    console.error("Error fetching quotations:", error)
    return NextResponse.json({ error: "Failed to fetch quotations" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const quotation = await prisma.crmQuotation.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    })
    return NextResponse.json(quotation)
  } catch (error) {
    console.error("Error saving quotation:", error)
    return NextResponse.json({ error: "Failed to save quotation" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await prisma.crmQuotation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting quotation:", error)
    return NextResponse.json({ error: "Failed to delete quotation" }, { status: 500 })
  }
}
