import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const epcs = Array.isArray(body.epcs)
    ? body.epcs.map((v: unknown) => String(v).trim().toUpperCase()).filter(Boolean)
    : []

  if (epcs.length === 0) {
    return NextResponse.json({ error: "epcs array is required" }, { status: 400 })
  }

  const dispatchId = body.dispatch_id ? String(body.dispatch_id) : null
  const orderId = body.order_id ? String(body.order_id) : null
  const invoiceNumber = body.invoice_number ? String(body.invoice_number) : null
  const authorizedBy = body.authorized_by ? String(body.authorized_by) : "system"
  const validMinutesRaw = Number(body.valid_minutes ?? 120)
  const validMinutes = Number.isFinite(validMinutesRaw) && validMinutesRaw > 0 ? validMinutesRaw : 120
  const now = new Date()
  const authorizedUntil = new Date(now.getTime() + validMinutes * 60 * 1000)

  const updates = await Promise.all(
    epcs.map(async (epc: string) =>
      prisma.erpRfidTag.upsert({
        where: { epc },
        update: {
          status: "AUTHORIZED_OUT",
          dispatchId,
          orderId,
          invoiceNumber,
          authorizedAt: now,
          authorizedUntil,
          updatedBy: authorizedBy,
        },
        create: {
          epc,
          status: "AUTHORIZED_OUT",
          dispatchId,
          orderId,
          invoiceNumber,
          authorizedAt: now,
          authorizedUntil,
          updatedBy: authorizedBy,
        },
      }),
    ),
  )

  return NextResponse.json({
    ok: true,
    authorized_count: updates.length,
    authorized_until: authorizedUntil.toISOString(),
  })
}
