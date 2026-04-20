import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const branches = await prisma.erpBranch.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(branches)
}

export async function POST(req: NextRequest) {
  const b = await req.json()
  const branch = await prisma.erpBranch.upsert({
    where: { id: b.id ?? "__new__" },
    update: { 
      name: b.name, 
      code: b.code, 
      type: b.type, 
      address: b.address, 
      city: b.city, 
      country: b.country, 
      phone: b.phone, 
      email: b.email, 
      manager: b.manager, 
      status: b.status, 
      notes: b.notes 
    },
    create: { 
      id: b.id,
      name: b.name, 
      code: b.code, 
      type: b.type, 
      address: b.address, 
      city: b.city, 
      country: b.country, 
      phone: b.phone, 
      email: b.email, 
      manager: b.manager, 
      status: b.status, 
      notes: b.notes,
      createdBy: b.createdBy || "system"
    },
  })
  return NextResponse.json(branch)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpBranch.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
