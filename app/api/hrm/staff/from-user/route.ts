import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  erpUserId: true,
} as const

/**
 * Ensure an ERP login user has an HRM staff profile for daily KPIs / My KPIs.
 * Links existing staff by erpUserId or email, or auto-creates a minimal profile.
 */
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
    select: STAFF_SELECT,
  })
  if (existingByUserId) {
    return NextResponse.json({ ...existingByUserId, linked: true, existing: true, created: false })
  }

  const existingByEmail = await prisma.erpStaff.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" } },
    select: STAFF_SELECT,
  })
  if (existingByEmail) {
    const linked = await prisma.erpStaff.update({
      where: { id: existingByEmail.id },
      data: { erpUserId: userId },
      select: STAFF_SELECT,
    })
    return NextResponse.json({ ...linked, linked: true, existing: true, created: false })
  }

  const today = new Date().toISOString().slice(0, 10)
  const roleLabel =
    user.role === "superadmin" || user.role === "admin"
      ? "Admin"
      : user.role === "sales_agent"
        ? "Sales Agent"
        : user.role === "sales_manager"
          ? "Sales Manager"
          : "Staff"

  const created = await prisma.erpStaff.create({
    data: {
      name: user.name || user.email,
      email: user.email,
      role: roleLabel,
      department: user.jobTitle || user.location || "General",
      phone: "",
      address: "",
      salary: Number(user.baseSalary) || 0,
      basicSalary: Number(user.baseSalary) || 0,
      currency: "PKR",
      joinDate: today,
      status: "Active",
      notes: "Auto-created for daily KPI reporting from login account",
      createdBy: "system",
      erpUserId: userId,
      employmentType: "Permanent",
    },
    select: STAFF_SELECT,
  })

  return NextResponse.json({ ...created, linked: true, existing: false, created: true })
}
