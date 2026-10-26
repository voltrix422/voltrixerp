import { NextRequest, NextResponse } from "next/server"
import {
  startAllPendingDispatchedWarranties,
  startWarrantiesForOrder,
} from "@/lib/order-warranty-start"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (body.confirm !== true) {
      return NextResponse.json({ error: "Confirmation is required to start warranties." }, { status: 400 })
    }

    const activatedBy = String(body.activatedBy ?? "").trim() || "ERP admin"

    if (body.startAllPending === true) {
      const result = await startAllPendingDispatchedWarranties({ activatedBy })
      return NextResponse.json({ ok: true, ...result })
    }

    const orderId = String(body.orderId ?? "").trim()
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }

    const result = await startWarrantiesForOrder({
      orderId,
      activatedBy,
      warrantyHolderName: body.warrantyHolderName
        ? String(body.warrantyHolderName)
        : undefined,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start warranties"
    console.error("[orders/start-warranties]", err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
