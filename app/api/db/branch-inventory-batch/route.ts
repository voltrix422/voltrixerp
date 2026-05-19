import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  executeDispatchLine,
  executeTransferLine,
  saveCombinedBatchTransferRecord,
  type BatchTransferLineResult,
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
  const isMultiLineBatch = lines.length > 1
  const successfulLines: BatchTransferLineResult[] = []
  const results: Array<{
    ok: boolean
    productDescription?: string
    quantity?: number
    error?: string
    inventoryId?: string
    fromBranchInventoryId?: string
  }> = []

  const destinationBranch = await prisma.erpBranch.findUnique({
    where: { id: toBranchId },
  })
  if (!destinationBranch) {
    return NextResponse.json({ error: "Destination branch not found" }, { status: 404 })
  }

  for (const line of lines) {
    try {
      if (mode === "dispatch") {
        const dispatchLine = line as DispatchLineInput
        const hasTarget =
          (dispatchLine.inventoryId && !dispatchLine.inventoryId.startsWith("wh:")) ||
          dispatchLine.model
        if (!hasTarget || !dispatchLine.quantity || dispatchLine.quantity <= 0) {
          throw new Error("Invalid dispatch line")
        }
        const result = await executeDispatchLine({
          destinationBranchId: toBranchId,
          destinationBranchCode: destinationBranchCode || destinationBranch.code,
          fromBranchId,
          fromBranchName: fromBranchName || "Main warehouse",
          fromBranchCode: fromBranchCode || "MAIN",
          assignedBy: actor,
          systemNotes,
          line: dispatchLine,
          skipTransferHistory: isMultiLineBatch,
        })
        successfulLines.push({
          inventoryId: result.inventoryId,
          productDescription: result.productDescription,
          quantity: result.quantity,
          unit: result.unit,
          userNote: dispatchLine.userNote,
        })
        results.push({ ok: true, ...result })
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
          skipTransferHistory: isMultiLineBatch,
        })
        successfulLines.push({
          inventoryId: result.inventoryId,
          productDescription: result.productDescription,
          quantity: result.quantity,
          unit: result.unit,
          userNote: transferLine.userNote,
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

  if (isMultiLineBatch && successfulLines.length > 0) {
    const sourceBranch = fromBranchId
      ? await prisma.erpBranch.findUnique({ where: { id: fromBranchId } })
      : null
    await saveCombinedBatchTransferRecord({
      fromBranchId: fromBranchId || null,
      fromBranchName: sourceBranch?.name || fromBranchName || "Main warehouse",
      fromBranchCode: sourceBranch?.code || fromBranchCode || "MAIN",
      toBranchId: destinationBranch.id,
      toBranchName: destinationBranch.name,
      toBranchCode: destinationBranch.code,
      transferredBy: actor,
      systemNotes,
      lines: successfulLines,
    })
  }

  const succeeded = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)

  return NextResponse.json({
    ok: failed.length === 0,
    succeeded,
    failed: failed.length,
    results,
    batchRecorded: isMultiLineBatch && successfulLines.length > 0,
  })
}
