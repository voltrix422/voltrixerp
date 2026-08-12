import { NextRequest, NextResponse } from "next/server"
import { replaceOrderItemServer } from "@/lib/order-replacement-server"
import type { OrderReplacementDisposition } from "@/lib/orders"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const orderId = String(body.orderId ?? "").trim()
  const orderItemId = String(body.orderItemId ?? "").trim()
  const disposition = String(body.disposition ?? "main") as OrderReplacementDisposition

  if (!orderId || !orderItemId) {
    return NextResponse.json({ error: "orderId and orderItemId are required" }, { status: 400 })
  }
  if (disposition !== "main" && disposition !== "faulty") {
    return NextResponse.json({ error: "disposition must be main or faulty" }, { status: 400 })
  }

  try {
    const order = await replaceOrderItemServer({
      orderId,
      orderItemId,
      oldSerialNumber: body.oldSerialNumber ? String(body.oldSerialNumber) : undefined,
      newSerialNumber: body.newSerialNumber ? String(body.newSerialNumber) : undefined,
      disposition,
      reason: String(body.reason ?? "").trim() || "Item replacement",
      photoUrls: Array.isArray(body.photoUrls)
        ? body.photoUrls.map((u: unknown) => String(u ?? "").trim()).filter(Boolean)
        : [],
      replacedBy: String(body.replacedBy ?? "Inventory").trim() || "Inventory",
    })
    return NextResponse.json({ ok: true, order })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Replacement failed" },
      { status: 400 },
    )
  }
}
