import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { staffId, erpUserId } = body
  if (!staffId) return NextResponse.json({ error: "staffId required" }, { status: 400 })

  const staff = await prisma.erpStaff.update({
    where: { id: staffId },
    data: { erpUserId: erpUserId || null },
    select: { id: true, name: true, email: true, erpUserId: true },
  })

  return NextResponse.json({
    id: staff.id,
    name: staff.name,
    email: staff.email,
    erpUserId: staff.erpUserId,
  })
}
