import { NextRequest, NextResponse } from "next/server"
import { permanentlyDeleteAllBranchInventory } from "@/lib/branch-inventory-permanent-delete"
import {
  clearBranchTransferHistory,
  resetAllBranchTransfersAndInventory,
  returnBranchInventoryToMain,
} from "@/lib/branch-inventory-reset"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    branchId,
    returnToMain = true,
    clearHistory = true,
    all = false,
  } = body as {
    branchId?: string
    returnToMain?: boolean
    clearHistory?: boolean
    all?: boolean
  }

  if (all) {
    const result = await resetAllBranchTransfersAndInventory()
    return NextResponse.json({ ok: true, ...result })
  }

  const inventory = returnToMain
    ? await returnBranchInventoryToMain(branchId)
    : await permanentlyDeleteAllBranchInventory(branchId)
  const history = clearHistory
    ? await clearBranchTransferHistory(branchId)
    : null

  return NextResponse.json({ ok: true, inventory, history })
}
