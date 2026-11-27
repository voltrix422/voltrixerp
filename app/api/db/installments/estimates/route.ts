import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { canAccessInstallmentsPortal, canWriteInstallments } from "@/lib/auth"

type EstimateLine = { name: string; rate: number; amount: number }

async function loadActor(userId: unknown) {
  const id = String(userId ?? "").trim()
  if (!id) return null
  return prisma.erpUser.findUnique({
    where: { id },
    select: { id: true, name: true, role: true },
  })
}

function parseLines(raw: unknown): EstimateLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      const name = String((row as { name?: unknown })?.name ?? "").trim()
      const rate = Number((row as { rate?: unknown })?.rate)
      const amount = Number((row as { amount?: unknown })?.amount)
      return {
        name,
        rate: Number.isFinite(rate) ? rate : 0,
        amount: Number.isFinite(amount) ? amount : 0,
      }
    })
    .filter((row) => row.name)
}

function lineAmount(rate: number, kw: number, factor: number) {
  return Math.round(rate * kw * factor * 100) / 100
}

export async function GET(req: NextRequest) {
  try {
    const actor = await loadActor(req.nextUrl.searchParams.get("actorUserId"))
    if (!actor || !canAccessInstallmentsPortal(actor.role)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 })
    }
    const id = String(req.nextUrl.searchParams.get("id") || "").trim()
    if (id) {
      const row = await prisma.installmentEstimate.findUnique({ where: { id } })
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json(row)
    }
    const rows = await prisma.installmentEstimate.findMany({
      orderBy: { updatedAt: "desc" },
    })
    return NextResponse.json(rows)
  } catch (err) {
    console.error("installment estimates GET", err)
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const actor = await loadActor(body.actorUserId)
    if (!actor || !canWriteInstallments(actor.role)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 })
    }

    const systemKw = Number(body.systemKw)
    if (!Number.isFinite(systemKw) || systemKw <= 0) {
      return NextResponse.json({ error: "System kW required" }, { status: 400 })
    }
    const factorRaw = Number(body.factor)
    const factor = Number.isFinite(factorRaw) && factorRaw > 0 ? factorRaw : 1.5
    const linesIn = parseLines(body.lines)
    if (linesIn.length === 0) {
      return NextResponse.json({ error: "Add at least one cost line" }, { status: 400 })
    }
    const lines = linesIn.map((line) => ({
      name: line.name,
      rate: line.rate,
      amount: lineAmount(line.rate, systemKw, factor),
    }))
    const totalAmount = Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100

    const data = {
      title: String(body.title || "").trim() || `${systemKw} kW estimate`,
      clientName: String(body.clientName || "").trim(),
      systemKw,
      factor,
      lines: lines as unknown as Prisma.InputJsonValue,
      totalAmount,
      notes: String(body.notes || "").trim(),
      updatedBy: actor.name || "",
      updatedById: actor.id,
    }

    const id = String(body.id || "").trim()
    if (id) {
      const row = await prisma.installmentEstimate.update({ where: { id }, data })
      return NextResponse.json(row)
    }

    const row = await prisma.installmentEstimate.create({
      data: {
        ...data,
        createdBy: actor.name || "",
        createdById: actor.id,
      },
    })
    return NextResponse.json(row)
  } catch (err) {
    console.error("installment estimates POST", err)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const actor = await loadActor(body.actorUserId)
    if (!actor || !canWriteInstallments(actor.role)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 })
    }
    const id = String(body.id || "").trim()
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    await prisma.installmentEstimate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("installment estimates DELETE", err)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
