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
 * Find an existing HRM staff row for an ERP login (by user id or email).
 * Does not create staff — HRM Staff is only people added in HRM.
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

  return NextResponse.json(
    { error: "No HRM staff profile. Add this person in HRM Staff first." },
    { status: 404 },
  )
}
