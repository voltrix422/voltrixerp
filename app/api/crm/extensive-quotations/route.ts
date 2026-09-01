import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const rows = await prisma.crmExtensiveQuotation.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("[extensive-quotations GET]", error)
    return NextResponse.json({ error: "Failed to load quotations" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const id = String(data.id ?? "").trim() || `${Date.now()}`
    const quotationNumber = String(data.quotationNumber ?? "").trim()
    if (!quotationNumber) {
      return NextResponse.json({ error: "Quotation number is required" }, { status: 400 })
    }
    const recipientName = String(data.recipientName ?? "").trim()
    if (!recipientName) {
      return NextResponse.json({ error: "Recipient name is required" }, { status: 400 })
    }

    const payload = {
      quotationNumber,
      recipientName,
      recipientCompany: String(data.recipientCompany ?? "").trim(),
      recipientAddress: String(data.recipientAddress ?? "").trim(),
      quoteDate: String(data.quoteDate ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      validUntil: String(data.validUntil ?? "").slice(0, 10),
      notes: String(data.notes ?? ""),
      showBranding: data.showBranding !== false,
      items: (data.items ?? []) as Prisma.InputJsonValue,
      terms: (data.terms ?? []) as Prisma.InputJsonValue,
      subtotal: Number(data.subtotal) || 0,
      total: Number(data.total) || 0,
      status: String(data.status ?? "draft") || "draft",
      createdBy: String(data.createdBy ?? "").trim() || "CRM",
      ownerUserId: data.ownerUserId ? String(data.ownerUserId) : null,
    }

    const row = await prisma.crmExtensiveQuotation.upsert({
      where: { id },
      update: payload,
      create: { id, ...payload },
    })
    return NextResponse.json(row)
  } catch (error) {
    console.error("[extensive-quotations POST]", error)
    return NextResponse.json({ error: "Failed to save quotation" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    await prisma.crmExtensiveQuotation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[extensive-quotations DELETE]", error)
    return NextResponse.json({ error: "Failed to delete quotation" }, { status: 500 })
  }
}
