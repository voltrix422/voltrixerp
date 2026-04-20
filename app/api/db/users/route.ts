import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const users = await prisma.erpUser.findMany({ orderBy: { id: "asc" } })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const user = await prisma.erpUser.upsert({
    where: { id: body.id ?? "__new__" },
    update: { name: body.name, email: body.email, password: body.password, role: body.role, modules: body.modules },
    create: { id: body.id, name: body.name, email: body.email, password: body.password, role: body.role, modules: body.modules },
  })
  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpUser.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
