import { NextRequest, NextResponse } from "next/server"
import { reviewReplacementReturnServer } from "@/lib/order-replacement-server"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const orderId = String(body.orderId ?? "").trim()
  const replacementId = String(body.replacementId ?? "").trim()
  const decision = String(body.decision ?? "").trim()
  const reviewedBy = String(body.reviewedBy ?? "Inventory").trim() || "Inventory"
  const note = body.note != null ? String(body.note) : undefined

  if (!orderId || !replacementId) {
    return NextResponse.json({ error: "orderId and replacementId are required" }, { status: 400 })
  }
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision must be approved or rejected" }, { status: 400 })
  }

  try {
    const order = await reviewReplacementReturnServer({
      orderId,
      replacementId,
      decision,
      reviewedBy,
      note,
    })
    return NextResponse.json({ ok: true, order })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Review failed" },
      { status: 400 },
    )
  }
}
