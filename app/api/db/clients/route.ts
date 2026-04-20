import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const clients = await prisma.erpClient.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const c = await req.json()
  const record = await prisma.erpClient.upsert({
    where: { id: c.id ?? "__new__" },
    update: {
      name: c.name, company: c.company, email: c.email, phone: c.phone,
      address: c.address, city: c.city, country: c.country, website: c.website,
      taxId: c.taxId, industry: c.industry, contactPerson: c.contactPerson,
      imageUrl: c.imageUrl, notes: c.notes, createdBy: c.createdBy,
    },
    create: {
      id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone,
      address: c.address, city: c.city, country: c.country, website: c.website,
      taxId: c.taxId, industry: c.industry, contactPerson: c.contactPerson,
      imageUrl: c.imageUrl, notes: c.notes, createdBy: c.createdBy,
      createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
    },
  })
  return NextResponse.json(record)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpClient.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
