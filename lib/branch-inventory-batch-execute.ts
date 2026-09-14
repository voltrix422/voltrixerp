import { prisma } from "@/lib/db"
import {
  executeDispatchLine,
  executeTransferLine,
  saveCombinedBatchTransferRecord,
  type BatchTransferLineResult,
  type DispatchLineInput,
  type TransferLineInput,
} from "@/lib/branch-inventory-transfer-ops"

export type BatchTransferRequestBody = {
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

export async function executeBatchBranchInventoryTransfer(body: BatchTransferRequestBody) {
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
  } = body

  if (!toBranchId || !mode || !Array.isArray(lines) || lines.length === 0) {
    throw new Error("Missing toBranchId, mode, or lines")
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
    sourceBranchId?: string
  }> = []
  let inferredFromBranchId: string | null = fromBranchId || null

  const destinationBranch = await prisma.erpBranch.findUnique({
    where: { id: toBranchId },
  })
  if (!destinationBranch) {
    throw new Error("Destination branch not found")
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
        // Capture source branch before the line may delete the inventory row.
        if (!inferredFromBranchId) {
          const sourceRow = await prisma.erpBranchInventory.findUnique({
            where: { id: transferLine.fromBranchInventoryId },
            select: { branchId: true },
          })
          if (sourceRow?.branchId) inferredFromBranchId = sourceRow.branchId
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
          sourceBranchId: inferredFromBranchId || undefined,
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

  let transferBatchId: string | null = null

  if (isMultiLineBatch && successfulLines.length > 0) {
    let resolvedFromBranchId = inferredFromBranchId
    if (!resolvedFromBranchId && fromBranchCode) {
      const byCode = await prisma.erpBranch.findFirst({
        where: { code: fromBranchCode },
        select: { id: true },
      })
      resolvedFromBranchId = byCode?.id ?? null
    }

    const sourceBranch = resolvedFromBranchId
      ? await prisma.erpBranch.findUnique({ where: { id: resolvedFromBranchId } })
      : null
    transferBatchId = await saveCombinedBatchTransferRecord({
      fromBranchId: resolvedFromBranchId,
      fromBranchName: sourceBranch?.name || fromBranchName || "Main warehouse",
      fromBranchCode: sourceBranch?.code || fromBranchCode || "MAIN",
      toBranchId: destinationBranch.id,
      toBranchName: destinationBranch.name,
      toBranchCode: destinationBranch.code,
      transferredBy: actor,
      systemNotes,
      lines: successfulLines,
    })
  } else if (successfulLines.length === 1 && mode === "dispatch") {
    const latest = await prisma.erpBranchInventoryTransfer.findFirst({
      where: { toBranchId: destinationBranch.id },
      orderBy: { transferredAt: "desc" },
      select: { transferBatchId: true },
    })
    transferBatchId = latest?.transferBatchId ?? null
  }

  const succeeded = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)

  return {
    ok: failed.length === 0,
    succeeded,
    failed: failed.length,
    results,
    batchRecorded: isMultiLineBatch && successfulLines.length > 0,
    transferBatchId,
  }
}
