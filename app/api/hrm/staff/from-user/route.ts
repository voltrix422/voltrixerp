import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const userId = String(body.userId || "").trim()
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const user = await prisma.erpUser.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const existingByUserId = await prisma.erpStaff.findFirst({
    where: { erpUserId: userId },
    select: { id: true },
  })
  if (existingByUserId) {
    return NextResponse.json({ id: existingByUserId.id, linked: true, existing: true })
  }

  const existingByEmail = await prisma.erpStaff.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" } },
    select: { id: true },
  })
  if (existingByEmail) {
    await prisma.erpStaff.update({
      where: { id: existingByEmail.id },
      data: { erpUserId: userId },
    })
    return NextResponse.json({ id: existingByEmail.id, linked: true })
  }

  const created = await prisma.erpStaff.create({
    data: {
      name: user.name || user.email.split("@")[0],
      role: user.jobTitle || user.role || "staff",
      department: "Operations",
      email: user.email || "",
      phone: "",
      address: "",
      salary: Number(user.baseSalary) || 0,
      currency: "PKR",
      joinDate: new Date().toISOString().slice(0, 10),
      status: "active",
      notes: "Auto-created from User Accounts for KPI assignment",
      createdBy: "system",
      erpUserId: user.id,
    },
    select: { id: true },
  })

  return NextResponse.json({ id: created.id, linked: true })
}
