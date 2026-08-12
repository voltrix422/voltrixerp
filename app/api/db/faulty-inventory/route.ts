import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  listFaultyInventoryGroups,
  markSerialUnitFaulty,
  moveManualQtyToFaulty,
  moveStockQtyToFaulty,
  restoreManualQtyFromFaulty,
  restoreSerialUnitFromFaulty,
  restoreStockQtyFromFaulty,
} from "@/lib/faulty-inventory-server"

export async function GET() {
  const labels = await prisma.erpInventoryModelLabel.findMany()
  const labelMap: Record<string, string> = {}
  for (const row of labels) {
    if (row.model && row.displayName) labelMap[row.model] = row.displayName
  }
  const groups = await listFaultyInventoryGroups(labelMap)
  const totalFaultyQty = groups.reduce((sum, g) => sum + g.faultyQty, 0)
  return NextResponse.json({ groups, totalFaultyQty })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const action = String(body.action ?? "")
  const actor = String(body.actor ?? "Inventory").trim() || "Inventory"
  const notes = String(body.notes ?? "").trim()

  try {
    if (action === "mark_serial_faulty") {
      const unitId = String(body.unitId ?? "").trim()
      if (!unitId) return NextResponse.json({ error: "unitId is required" }, { status: 400 })
      await markSerialUnitFaulty({ unitId, movedBy: actor, notes })
      return NextResponse.json({ ok: true })
    }

    if (action === "restore_serial") {
      const unitId = String(body.unitId ?? "").trim()
      if (!unitId) return NextResponse.json({ error: "unitId is required" }, { status: 400 })
      await restoreSerialUnitFromFaulty({ unitId, restoredBy: actor })
      return NextResponse.json({ ok: true })
    }

    if (action === "move_manual_to_faulty") {
      const manualId = String(body.manualId ?? "").trim()
      const qty = Number(body.qty)
      if (!manualId) return NextResponse.json({ error: "manualId is required" }, { status: 400 })
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 })
      }
      const result = await moveManualQtyToFaulty({ manualId, qty, movedBy: actor, notes })
      return NextResponse.json({ ok: true, ...result })
    }

    if (action === "restore_manual") {
      const manualId = String(body.manualId ?? "").trim()
      const qty = Number(body.qty)
      if (!manualId) return NextResponse.json({ error: "manualId is required" }, { status: 400 })
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 })
      }
      const result = await restoreManualQtyFromFaulty({ manualId, qty, restoredBy: actor, notes })
      return NextResponse.json({ ok: true, ...result })
    }

    if (action === "move_stock_to_faulty") {
      const stockId = String(body.stockId ?? "").trim()
      const qty = Number(body.qty)
      if (!stockId) return NextResponse.json({ error: "stockId is required" }, { status: 400 })
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 })
      }
      const result = await moveStockQtyToFaulty({ stockId, qty, movedBy: actor, notes })
      return NextResponse.json({ ok: true, ...result })
    }

    if (action === "restore_stock") {
      const stockId = String(body.stockId ?? "").trim()
      const qty = Number(body.qty)
      if (!stockId) return NextResponse.json({ error: "stockId is required" }, { status: 400 })
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 })
      }
      const result = await restoreStockQtyFromFaulty({ stockId, qty, restoredBy: actor, notes })
      return NextResponse.json({ ok: true, ...result })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Faulty inventory action failed" },
      { status: 400 },
    )
  }
}
