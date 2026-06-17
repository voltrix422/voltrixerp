import { NextRequest, NextResponse } from "next/server"
import {
  auditManualInventoryStock,
  correctManualInventoryAvailable,
} from "@/lib/manual-inventory-reconcile"

export async function GET(req: NextRequest) {
  const model = new URL(req.url).searchParams.get("model")?.trim()
  if (!model) {
    return NextResponse.json({ error: "model query param is required" }, { status: 400 })
  }

  const audit = await auditManualInventoryStock(model)
  if (!audit) {
    return NextResponse.json({ error: "Manual inventory item not found" }, { status: 404 })
  }

  return NextResponse.json(audit)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const model = String((body as { model?: string }).model || "").trim()
  const targetAvailable = Number((body as { targetAvailable?: number }).targetAvailable)
  const confirm = Boolean((body as { confirm?: boolean }).confirm)
  const correctedBy = String((body as { correctedBy?: string }).correctedBy || "Inventory reconcile")
  const reason = String((body as { reason?: string }).reason || "").trim()

  if (!model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 })
  }
  if (!confirm) {
    return NextResponse.json({ error: "Set confirm: true to apply correction" }, { status: 400 })
  }
  if (!Number.isFinite(targetAvailable)) {
    return NextResponse.json({ error: "targetAvailable is required" }, { status: 400 })
  }

  const audit = await auditManualInventoryStock(model)
  if (!audit) {
    return NextResponse.json({ error: "Manual inventory item not found" }, { status: 404 })
  }

  const result = await correctManualInventoryAvailable({
    model,
    targetAvailable,
    correctedBy,
    reason: reason || undefined,
  })

  return NextResponse.json({ audit, result })
}
