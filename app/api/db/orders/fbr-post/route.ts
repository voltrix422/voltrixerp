import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { isBranchPosOrderSource } from "@/lib/branch-pos-order-stock-server"
import { postBranchPosOrderToFbr } from "@/lib/fbr-pos-order"
import { normalizeFbrStatus } from "@/lib/fbr-status"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const orderId = String(body.orderId ?? "").trim()
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }

    const existing = await prisma.erpOrder.findUnique({
      where: { id: orderId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    const existingFbr = existing as unknown as {
      source: string | null
      fbrStatus?: string
      fbrInvoiceNumber?: string
    }
    if (!isBranchPosOrderSource(existingFbr.source)) {
      return NextResponse.json(
        { error: "FBR posting is only enabled for Branch POS orders." },
        { status: 400 },
      )
    }
    if (normalizeFbrStatus(existingFbr.fbrStatus) === "sent" && existingFbr.fbrInvoiceNumber) {
      return NextResponse.json(existing)
    }

    const order = await postBranchPosOrderToFbr(orderId)
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    return NextResponse.json(order)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not post invoice to FBR"
    console.error("[orders/fbr-post]", err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
