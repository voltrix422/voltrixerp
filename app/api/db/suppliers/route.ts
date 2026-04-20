import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const suppliers = await prisma.erpSupplier.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(suppliers)
}

export async function POST(req: NextRequest) {
  const s = await req.json()
  const supplier = await prisma.erpSupplier.upsert({
    where: { id: s.id ?? "__new__" },
    update: { name: s.name, type: s.type, contact: s.contact, email: s.email, address: s.address, company: s.company, bankAccountName: s.bankAccountName, bankIban: s.bankIban, image: s.image ?? "" },
    create: { id: s.id, name: s.name, type: s.type, contact: s.contact, email: s.email, address: s.address, company: s.company, bankAccountName: s.bankAccountName, bankIban: s.bankIban, image: s.image ?? "" },
  })
  return NextResponse.json(supplier)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpSupplier.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
