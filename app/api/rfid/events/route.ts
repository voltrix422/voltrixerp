import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const events = await prisma.erpRfidGateEvent.findMany({
    orderBy: { scannedAt: "desc" },
    take: 200,
  })

  return NextResponse.json(
    events.map((event) => ({
      id: event.id,
      epc: event.epc,
      gate_name: event.gateName,
      decision: event.decision,
      trigger_alarm: event.triggerAlarm,
      reason: event.reason,
      dispatch_id: event.dispatchId,
      order_id: event.orderId,
      invoice_number: event.invoiceNumber,
      scanned_by: event.scannedBy,
      scanned_at: event.scannedAt.toISOString(),
    })),
  )
}
