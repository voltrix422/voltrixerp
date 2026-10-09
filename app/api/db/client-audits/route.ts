import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  buildClientStockSnapshot,
  mapAuditRow,
  recomputeLine,
  summarizeAuditLines,
  type ClientAuditLine,
} from "@/lib/client-audit"
import type { Order, OrderItem, OrderPayment } from "@/lib/orders"

function asOrders(rows: Array<Record<string, unknown>>): Order[] {
  return rows.map((r) => ({
    id: String(r.id),
    orderNumber: String(r.orderNumber || ""),
    clientId: String(r.clientId || ""),
    clientName: String(r.clientName || ""),
    items: (Array.isArray(r.items) ? r.items : []) as OrderItem[],
    subtotal: Number(r.subtotal) || 0,
    taxPercent: Number(r.taxPercent) || 0,
    tax: Number(r.tax) || 0,
    transportCost: Number(r.transportCost) || 0,
    transportLabel: String(r.transportLabel || "Transport"),
    otherCost: Number(r.otherCost) || 0,
    otherCostLabel: String(r.otherCostLabel || "Other"),
    shipping: Number(r.shipping) || 0,
    discount: Number(r.discount) || 0,
    total: Number(r.total) || 0,
    status: r.status as Order["status"],
    notes: String(r.notes || ""),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || ""),
    createdBy: String(r.createdBy || ""),
    deliveryAddress: String(r.deliveryAddress || ""),
    deliveryDate: String(r.deliveryDate || ""),
    payments: (Array.isArray(r.payments) ? r.payments : []) as OrderPayment[],
    source: r.source ? String(r.source) : null,
    returnedAt: r.returnedAt ? String(r.returnedAt) : null,
    fulfillmentDate: r.fulfillmentDate ? String(r.fulfillmentDate) : null,
  })) as Order[]
}

function parseLines(raw: unknown): ClientAuditLine[] {
  if (!Array.isArray(raw)) return []
  return raw.map((l) => recomputeLine(l as ClientAuditLine))
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const clientId = String(sp.get("clientId") || "").trim()
  const id = String(sp.get("id") || "").trim()
  const mode = String(sp.get("mode") || "").trim()

  try {
    if (id) {
      const row = await prisma.erpClientAudit.findUnique({ where: { id } })
      if (!row) return NextResponse.json({ error: "Audit not found" }, { status: 404 })
      return NextResponse.json(mapAuditRow(row))
    }

    if (clientId && mode === "snapshot") {
      const client = await prisma.erpClient.findUnique({ where: { id: clientId } })
      if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

      const [ordersRaw, prevRaw] = await Promise.all([
        prisma.erpOrder.findMany({
          where: { clientId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.erpClientAudit.findFirst({
          where: { clientId, status: "finalized" },
          orderBy: { auditDate: "desc" },
        }),
      ])

      const previousAudit = prevRaw ? mapAuditRow(prevRaw) : null
      const snapshot = buildClientStockSnapshot({
        clientId,
        clientName: client.name,
        orders: asOrders(ordersRaw as unknown as Array<Record<string, unknown>>),
        previousAudit,
      })
      return NextResponse.json(snapshot)
    }

    if (clientId) {
      const rows = await prisma.erpClientAudit.findMany({
        where: { clientId },
        orderBy: { auditDate: "desc" },
        take: 50,
      })
      return NextResponse.json(rows.map(mapAuditRow))
    }

    const rows = await prisma.erpClientAudit.findMany({
      orderBy: { auditDate: "desc" },
      take: 40,
    })
    return NextResponse.json(rows.map(mapAuditRow))
  } catch (e) {
    console.error("client-audits GET", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load audits" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const clientId = String(body.clientId || "").trim()
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 })

    const client = await prisma.erpClient.findUnique({ where: { id: clientId } })
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

    const lines = parseLines(body.lines)
    const totals = summarizeAuditLines(lines)
    const status = body.status === "finalized" ? "finalized" : "draft"
    const auditDate = body.auditDate ? new Date(body.auditDate) : new Date()
    if (Number.isNaN(auditDate.getTime())) {
      return NextResponse.json({ error: "Invalid auditDate" }, { status: 400 })
    }

    const prev = await prisma.erpClientAudit.findFirst({
      where: { clientId, status: "finalized" },
      orderBy: { auditDate: "desc" },
      select: { id: true },
    })

    const orderIds = Array.isArray(body.orderIds)
      ? body.orderIds.map((x: unknown) => String(x))
      : []

    const row = await prisma.erpClientAudit.create({
      data: {
        clientId,
        clientName: client.name,
        auditDate,
        status,
        notes: String(body.notes || ""),
        signedByName: String(body.signedByName || ""),
        signatureDataUrl: body.signatureDataUrl ? String(body.signatureDataUrl) : null,
        createdBy: String(body.createdBy || ""),
        createdByUserId: body.createdByUserId ? String(body.createdByUserId) : null,
        lines: lines as unknown as Prisma.InputJsonValue,
        orderIds: orderIds as unknown as Prisma.InputJsonValue,
        stockGivenQty: totals.stockGivenQty,
        stockSoldQty: totals.stockSoldQty,
        stockLeftQty: totals.stockLeftQty,
        soldAmount: totals.soldAmount,
        leftAmount: totals.leftAmount,
        creditAmount: Number(body.creditAmount) || 0,
        previousAuditId: prev?.id || null,
      },
    })

    return NextResponse.json(mapAuditRow(row))
  } catch (e) {
    console.error("client-audits POST", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save audit" },
      { status: 500 },
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body.id || "").trim()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const existing = await prisma.erpClientAudit.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Audit not found" }, { status: 404 })
    if (existing.status === "finalized" && body.status !== "finalized") {
      // allow updating signature notes on finalized? keep finalized immutable except notes
    }
    if (existing.status === "finalized") {
      return NextResponse.json({ error: "Finalized audits cannot be edited" }, { status: 400 })
    }

    const lines = body.lines != null ? parseLines(body.lines) : mapAuditRow(existing).lines
    const totals = summarizeAuditLines(lines)
    const status = body.status === "finalized" ? "finalized" : "draft"

    const row = await prisma.erpClientAudit.update({
      where: { id },
      data: {
        status,
        notes: body.notes != null ? String(body.notes) : undefined,
        signedByName: body.signedByName != null ? String(body.signedByName) : undefined,
        signatureDataUrl:
          body.signatureDataUrl !== undefined
            ? body.signatureDataUrl
              ? String(body.signatureDataUrl)
              : null
            : undefined,
        lines: lines as unknown as Prisma.InputJsonValue,
        stockGivenQty: totals.stockGivenQty,
        stockSoldQty: totals.stockSoldQty,
        stockLeftQty: totals.stockLeftQty,
        soldAmount: totals.soldAmount,
        leftAmount: totals.leftAmount,
        creditAmount: body.creditAmount != null ? Number(body.creditAmount) || 0 : undefined,
        auditDate: body.auditDate ? new Date(body.auditDate) : undefined,
      },
    })

    return NextResponse.json(mapAuditRow(row))
  } catch (e) {
    console.error("client-audits PUT", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update audit" },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = String(req.nextUrl.searchParams.get("id") || "").trim()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    const existing = await prisma.erpClientAudit.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (existing.status === "finalized") {
      return NextResponse.json({ error: "Cannot delete a finalized audit" }, { status: 400 })
    }
    await prisma.erpClientAudit.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("client-audits DELETE", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete" },
      { status: 500 },
    )
  }
}
