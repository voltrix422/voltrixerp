import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const managers = await prisma.erpUser.findMany({
    where: { role: { in: ["sales_manager", "superadmin", "admin"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  })
  return NextResponse.json(managers)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, password } = body

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 })
  }

  const existing = await prisma.erpUser.findUnique({ where: { email: email.trim() } })
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 400 })
  }

  const user = await prisma.erpUser.create({
    data: {
      name: name.trim(),
      email: email.trim(),
      password: password,
      role: "sales_manager",
      modules: ["crm"],
      jobTitle: "sales_manager",
    },
  })

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const existing = await prisma.erpUser.findUnique({ where: { id: userId } })
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const user = await prisma.erpUser.update({
    where: { id: userId },
    data: {
      role: "sales_manager",
      modules: ["crm"],
      jobTitle: existing.jobTitle === "field_sales_officer" ? "sales_manager" : existing.jobTitle,
    },
  })

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role })
}
