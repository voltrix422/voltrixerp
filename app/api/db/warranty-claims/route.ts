import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const serialNumber = searchParams.get("serialNumber")
  const unitId = searchParams.get("unitId")

  const claims = await prisma.erpWarrantyClaim.findMany({
    where: {
      ...(serialNumber ? { serialNumber } : {}),
      ...(unitId ? { unitId } : {}),
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(claims)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { unitId, serialNumber, claimReason, notes, claimedBy } = body

  if (!unitId || !serialNumber || !claimReason) {
    return NextResponse.json({ error: "Missing claim details" }, { status: 400 })
  }

  const claim = await prisma.erpWarrantyClaim.create({
    data: {
      unitId,
      serialNumber,
      claimReason,
      notes: notes || "",
      claimedBy: claimedBy || "system",
      status: "pending",
    },
  })

  await prisma.erpInventorySerialUnit.update({
    where: { id: unitId },
    data: { status: "claim_pending" },
  })

  return NextResponse.json(claim, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, status, reviewedBy, notes } = body

  if (!id || !status) {
    return NextResponse.json({ error: "Missing claim review details" }, { status: 400 })
  }

  const claim = await prisma.erpWarrantyClaim.update({
    where: { id },
    data: {
      status,
      reviewedBy,
      reviewedAt: new Date(),
      notes,
    },
  })

  await prisma.erpInventorySerialUnit.update({
    where: { id: claim.unitId },
    data: {
      status: status === "approved" ? "claim_approved" : status === "rejected" ? "in_stock" : "claim_closed",
    },
  })

  return NextResponse.json(claim)
}
