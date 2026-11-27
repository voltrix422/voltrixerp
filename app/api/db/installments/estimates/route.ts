import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { canAccessInstallmentsPortal, canWriteInstallments } from "@/lib/auth"
import {
  DEFAULT_ADVANCE_PERCENT,
  DEFAULT_BOS_RS_PER_WATT,
  DEFAULT_FACTOR,
  DEFAULT_INSTALLATION_RS_PER_WATT,
  DEFAULT_MONTHS,
  DEFAULT_PANEL_RS_PER_WATT,
  DEFAULT_PANEL_WATT,
  DEFAULT_RAISED_MAX_FT,
  DEFAULT_RAISED_RS_PER_WATT,
  DEFAULT_STRUCTURE_RS_PER_WATT,
  DEFAULT_STRUCTURE_UNIT_PRICE,
  calcInstallmentBreakdown,
} from "@/lib/installment-estimate"

type EstimateLine = {
  name: string
  amount: number
  kind?: string
  productId?: string
  model?: string
  qty?: number
  unitPrice?: number
}

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
      const r = row as Record<string, unknown>
      const name = String(r?.name ?? "").trim()
      const amountRaw = Number(r?.amount)
      // Legacy rate×kw×factor rows may only have `amount` already computed, or `rate`.
      const legacyRate = Number(r?.rate)
      const amount = Number.isFinite(amountRaw)
        ? amountRaw
        : Number.isFinite(legacyRate)
          ? legacyRate
          : 0
      const kind = String(r?.kind ?? "").trim()
      const productId = String(r?.productId ?? "").trim()
      const model = String(r?.model ?? "").trim()
      const qtyRaw = Number(r?.qty)
      const unitRaw = Number(r?.unitPrice)
      return {
        name,
        amount: Number.isFinite(amount) ? amount : 0,
        ...(kind ? { kind } : {}),
        ...(productId ? { productId } : {}),
        ...(model ? { model } : {}),
        ...(Number.isFinite(qtyRaw) && qtyRaw > 0 ? { qty: qtyRaw } : {}),
        ...(Number.isFinite(unitRaw) && unitRaw >= 0 ? { unitPrice: unitRaw } : {}),
      }
    })
    .filter((row) => row.name)
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
    const factor = Number.isFinite(factorRaw) && factorRaw > 0 ? factorRaw : DEFAULT_FACTOR
    const advanceRaw = Number(body.advancePercent)
    const advancePercent =
      Number.isFinite(advanceRaw) && advanceRaw > 0 ? advanceRaw : DEFAULT_ADVANCE_PERCENT
    const monthsRaw = Number(body.months)
    const months =
      Number.isFinite(monthsRaw) && monthsRaw > 0
        ? Math.floor(monthsRaw)
        : DEFAULT_MONTHS

    const panelWatt = Number(body.panelWatt) || DEFAULT_PANEL_WATT
    const panelRsRaw = Number(body.panelRsPerWatt)
    const panelRsPerWatt =
      Number.isFinite(panelRsRaw) && panelRsRaw >= 0
        ? panelRsRaw
        : DEFAULT_PANEL_RS_PER_WATT
    const bosRsRaw = Number(body.bosRsPerWatt)
    const bosRsPerWatt =
      Number.isFinite(bosRsRaw) && bosRsRaw >= 0 ? bosRsRaw : DEFAULT_BOS_RS_PER_WATT
    const installRsRaw = Number(body.installationRsPerWatt)
    const installationRsPerWatt =
      Number.isFinite(installRsRaw) && installRsRaw >= 0
        ? installRsRaw
        : DEFAULT_INSTALLATION_RS_PER_WATT
    const structureUnitPrice =
      Number(body.structureUnitPrice) || DEFAULT_STRUCTURE_UNIT_PRICE
    const structureRsPerWatt =
      Number(body.structureRsPerWatt) || DEFAULT_STRUCTURE_RS_PER_WATT
    const raisedRsPerWatt = Number(body.raisedRsPerWatt) || DEFAULT_RAISED_RS_PER_WATT
    const raisedMaxFt = Number(body.raisedMaxFt) || DEFAULT_RAISED_MAX_FT

    const lines = parseLines(body.lines)
    if (lines.length === 0) {
      return NextResponse.json({ error: "Add at least one cost line" }, { status: 400 })
    }

    const breakdown = calcInstallmentBreakdown({
      systemKw,
      panelWatt,
      panelRsPerWatt,
      bosRsPerWatt,
      installationRsPerWatt,
      structureUnitPrice,
      structureRsPerWatt,
      raisedRsPerWatt,
      advancePercent,
      factor,
      months,
      lines,
    })

    const worksheet = {
      panelWatt,
      panelRsPerWatt,
      bosRsPerWatt,
      installationRsPerWatt,
      structureUnitPrice,
      structureRsPerWatt,
      raisedRsPerWatt,
      raisedMaxFt,
      advancePercent,
      months,
      breakdown: {
        systemWatts: breakdown.systemWatts,
        panelCount: breakdown.panelCount,
        panelAmount: breakdown.panelAmount,
        bosAmount: breakdown.bosAmount,
        installationAmount: breakdown.installationAmount,
        structureCount: breakdown.structureCount,
        cost: breakdown.cost,
        advance: breakdown.advance,
        remainingY: breakdown.remainingY,
        financedAmount: breakdown.financedAmount,
        actualCost: breakdown.actualCost,
        monthlyInstallment: breakdown.monthlyInstallment,
      },
    }

    const data = {
      title: String(body.title || "").trim() || `${systemKw} kW estimate`,
      clientName: String(body.clientName || "").trim(),
      systemKw,
      factor,
      lines: lines as unknown as Prisma.InputJsonValue,
      worksheet: worksheet as unknown as Prisma.InputJsonValue,
      totalAmount: breakdown.actualCost,
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
