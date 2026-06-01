import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase()
  const userId = req.nextUrl.searchParams.get("userId")?.trim()

  if (!email && !userId) {
    return NextResponse.json({ error: "email or userId required" }, { status: 400 })
  }

  const staff = userId
    ? await prisma.erpStaff.findFirst({
        where: { erpUserId: userId },
        select: { id: true, name: true, email: true, role: true, department: true, erpUserId: true },
      })
    : await prisma.erpStaff.findFirst({
        where: { email: { equals: email!, mode: "insensitive" } },
        select: { id: true, name: true, email: true, role: true, department: true, erpUserId: true },
      })

  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 })

  return NextResponse.json({
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    department: staff.department,
    erpUserId: staff.erpUserId,
  })
}
