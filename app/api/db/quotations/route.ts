import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const quotes = await prisma.erpQuotation.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(quotes)
}

export async function POST(req: NextRequest) {
  const q = await req.json()
  const record = await prisma.erpQuotation.create({
    data: {
      id: q.id,
      productType: q.product_type,
      voltage: q.voltage,
      capacity: q.capacity,
      quantity: q.quantity,
      budget: q.budget,
      application: q.application,
      specifications: q.specifications,
      timeline: q.timeline,
      fullName: q.full_name,
      company: q.company,
      email: q.email,
      phone: q.phone,
      status: q.status ?? "new",
    },
  })
  return NextResponse.json(record)
}

export async function PATCH(req: NextRequest) {
  const { id, ...data } = await req.json()
  const record = await prisma.erpQuotation.update({
    where: { id },
    data,
  })
  return NextResponse.json(record)
}
