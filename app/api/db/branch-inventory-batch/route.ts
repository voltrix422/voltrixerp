import { NextRequest, NextResponse } from "next/server"
import {
  executeDispatchLine,
  executeTransferLine,
  type DispatchLineInput,
  type TransferLineInput,
} from "@/lib/branch-inventory-transfer-ops"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    mode,
    toBranchId,
    fromBranchId,
    fromBranchName,
    fromBranchCode,
    destinationBranchCode,
    assignedBy,
    systemNotes,
    lines,
  } = body as {
    mode: "dispatch" | "transfer"
    toBranchId: string
    fromBranchId?: string
    fromBranchName?: string
    fromBranchCode?: string
    destinationBranchCode?: string
    assignedBy?: string
    systemNotes?: string
    lines: Array<DispatchLineInput | TransferLineInput>
  }

  if (!toBranchId || !mode || !Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json(
      { error: "Missing toBranchId, mode, or lines" },
      { status: 400 },
    )
  }

  const actor = assignedBy || "system"
  const results: Array<{
    ok: boolean
    productDescription?: string
    quantity?: number
    error?: string
    inventoryId?: string
    fromBranchInventoryId?: string
  }> = []

  for (const line of lines) {
    try {
      if (mode === "dispatch") {
        const dispatchLine = line as DispatchLineInput
        if (!dispatchLine.inventoryId || !dispatchLine.quantity || dispatchLine.quantity <= 0) {
          throw new Error("Invalid dispatch line")
        }
        const result = await executeDispatchLine({
          destinationBranchId: toBranchId,
          destinationBranchCode: destinationBranchCode || "",
          fromBranchId,
          fromBranchName: fromBranchName || "Main warehouse",
          fromBranchCode: fromBranchCode || "MAIN",
          assignedBy: actor,
          systemNotes,
          line: dispatchLine,
        })
        results.push({
          ok: true,
          inventoryId: dispatchLine.inventoryId,
          ...result,
        })
      } else if (mode === "transfer") {
        const transferLine = line as TransferLineInput
        if (
          !transferLine.fromBranchInventoryId ||
          !transferLine.quantity ||
          transferLine.quantity <= 0
        ) {
          throw new Error("Invalid transfer line")
        }
        const result = await executeTransferLine({
          toBranchId,
          transferredBy: actor,
          line: transferLine,
        })
        results.push({
          ok: true,
          fromBranchInventoryId: transferLine.fromBranchInventoryId,
          ...result,
        })
      } else {
        throw new Error("Unknown mode")
      }
    } catch (err) {
      results.push({
        ok: false,
        error: err instanceof Error ? err.message : "Transfer failed",
        inventoryId: (line as DispatchLineInput).inventoryId,
        fromBranchInventoryId: (line as TransferLineInput).fromBranchInventoryId,
      })
    }
  }

  const succeeded = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)

  return NextResponse.json({
    ok: failed.length === 0,
    succeeded,
    failed: failed.length,
    results,
  })
}
