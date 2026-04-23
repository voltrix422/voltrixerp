import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const warranties = await prisma.erpWarranty.findMany({ orderBy: { id: "asc" } })
  return NextResponse.json(warranties)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const warranty = await prisma.erpWarranty.upsert({
    where: { id: body.id ?? "__new__" },
    update: {
      productName: body.productName,
      soldDate: body.soldDate,
      warrantyStartDate: body.warrantyStartDate,
      warrantyEndDate: body.warrantyEndDate,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      notes: body.notes,
    },
    create: {
      id: body.id,
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

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpWarranty.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
