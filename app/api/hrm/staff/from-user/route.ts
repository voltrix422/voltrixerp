import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

/**
 * Link an ERP login user to an existing HRM staff profile.
 * Does NOT auto-create staff — Manage Users ≠ Staff.
 * Admin must add the person under HRM → Staff first.
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

  return NextResponse.json(
    {
      error:
        "No HRM staff profile for this user. Add them under HRM → Staff first (system users are not staff).",
    },
    { status: 404 }
  )
}
