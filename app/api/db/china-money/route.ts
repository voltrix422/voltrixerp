import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { canManageChinaMoney } from "@/lib/auth"

function parseUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((u) => String(u ?? "").trim()).filter(Boolean)
}

function asJsonUrls(value: unknown): Prisma.InputJsonValue {
  return parseUrls(value) as unknown as Prisma.InputJsonValue
}

async function loadActor(userId: unknown) {
  const id = String(userId ?? "").trim()
  if (!id) return null
  return prisma.erpUser.findUnique({
    where: { id },
    select: { id: true, name: true, role: true },
  })
}

function canWrite(role: string | undefined | null) {
  return canManageChinaMoney(role)
}

export async function GET() {
  try {
    const rows = await prisma.chinaMoneyTransfer.findMany({
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    })
    return NextResponse.json(rows)
  } catch (err) {
    console.error("china-money GET", err)
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const actor = await loadActor(body.createdById || body.actorUserId)
    if (!actor || !canWrite(actor.role)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 })
    }
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount required" }, { status: 400 })
    }
    const sentAt = String(body.sentAt || "").trim()
    if (!sentAt) {
      return NextResponse.json({ error: "Date required" }, { status: 400 })
    }
    const row = await prisma.chinaMoneyTransfer.create({
      data: {
        amount,
        currency: String(body.currency || "USD").trim() || "USD",
        sentAt,
        method: String(body.method || "").trim(),
        reference: String(body.reference || "").trim(),
        beneficiary: String(body.beneficiary || "").trim(),
        notes: String(body.notes || "").trim(),
        proofUrls: asJsonUrls(body.proofUrls),
        createdBy: String(body.createdBy || actor.name || "").trim(),
        createdById: actor.id,
      },
    })
    return NextResponse.json(row)
  } catch (err) {
    console.error("china-money POST", err)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const actor = await loadActor(body.actorUserId)
    if (!actor || !canWrite(actor.role)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 })
    }
    const id = String(body.id || "").trim()
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    await prisma.chinaMoneyTransfer.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("china-money DELETE", err)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
