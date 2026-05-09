import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const epc = String(body.epc ?? "").trim().toUpperCase()
  const gateName = body.gate_name ? String(body.gate_name) : "MAIN_GATE"
  const scannedBy = body.scanned_by ? String(body.scanned_by) : "system"

  if (!epc) {
    return NextResponse.json({ error: "epc is required" }, { status: 400 })
  }

  const tag = await prisma.erpRfidTag.findUnique({ where: { epc } })
  let decision: "ALLOW" | "BLOCK" = "BLOCK"
  let triggerAlarm = true
  let reason = "Tag not registered"

  if (tag) {
    const now = new Date()
    const validStatus = tag.status === "AUTHORIZED_OUT"
    const withinWindow = !tag.authorizedUntil || tag.authorizedUntil >= now

    if (validStatus && withinWindow) {
      decision = "ALLOW"
      triggerAlarm = false
      reason = "Authorized dispatch and invoice found"

      await prisma.erpRfidTag.update({
        where: { epc },
        data: {
          status: "EXITED",
          exitedAt: now,
          updatedBy: scannedBy,
        },
      })
    } else if (tag.status !== "AUTHORIZED_OUT") {
      reason = `Tag status is ${tag.status}. Dispatch authorization required`
    } else {
      reason = "Dispatch authorization expired"
    }
  }

  await prisma.erpRfidGateEvent.create({
    data: {
      epc,
      gateName,
      decision,
      triggerAlarm,
      reason,
      dispatchId: tag?.dispatchId || null,
      orderId: tag?.orderId || null,
      invoiceNumber: tag?.invoiceNumber || null,
      scannedBy,
    },
  })

  return NextResponse.json({
    epc,
    decision,
    triggerAlarm,
    reason,
    tag_status: tag?.status || null,
    dispatch_id: tag?.dispatchId || null,
    order_id: tag?.orderId || null,
    invoice_number: tag?.invoiceNumber || null,
  })
}
