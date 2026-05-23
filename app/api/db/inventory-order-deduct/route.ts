import { NextRequest, NextResponse } from "next/server"
import {
  deductInventoryForOrderServer,
  orderNeedsInventoryDeductionServer,
  restoreInventoryForOrderServer,
  type OrderDeductInput,
} from "@/lib/inventory-order-deduct-server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body?.action === "restore" ? "restore" : body?.action === "check" ? "check" : "deduct"
    const order = body?.order as OrderDeductInput | undefined

    if (!order?.id || !Array.isArray(order.items)) {
      return NextResponse.json({ error: "Invalid order payload" }, { status: 400 })
    }

    if (action === "restore") {
      await restoreInventoryForOrderServer(order)
      return NextResponse.json({ ok: true })
    }

    if (action === "check") {
      const needsDeduction = await orderNeedsInventoryDeductionServer(order)
      return NextResponse.json({ needsDeduction })
    }

    const result = await deductInventoryForOrderServer(order)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[inventory-order-deduct]", err)
    return NextResponse.json({ error: "Inventory deduction failed" }, { status: 500 })
  }
}
