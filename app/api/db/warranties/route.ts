import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const warranties = await prisma.erpWarranty.findMany({ orderBy: { id: "asc" } })
  return NextResponse.json(warranties)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  
  try {
    if (body.id) {
      // Update existing warranty
      const warranty = await prisma.erpWarranty.update({
        where: { id: body.id },
        data: {
          productName: body.productName,
          soldDate: body.soldDate,
          warrantyStartDate: body.warrantyStartDate,
          warrantyEndDate: body.warrantyEndDate,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone,
          notes: body.notes,
        },
      })
      return NextResponse.json(warranty)
    } else {
      // Create new warranty
      const warranty = await prisma.erpWarranty.create({
        data: {
          productName: body.productName,
          soldDate: body.soldDate,
          warrantyStartDate: body.warrantyStartDate,
          warrantyEndDate: body.warrantyEndDate,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone,
          notes: body.notes,
        },
      })
      return NextResponse.json(warranty)
    }
  } catch (error) {
    console.error("Error saving warranty:", error)
    return NextResponse.json({ error: "Failed to save warranty", details: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpWarranty.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
