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
  } catch (error: any) {
    console.error("Error saving warranty:", error)
    console.error("Error details:", error.message)
    console.error("Error code:", error.code)
    return NextResponse.json({ 
      error: "Failed to save warranty", 
      details: error.message || String(error),
      code: error.code || "UNKNOWN"
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpWarranty.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
