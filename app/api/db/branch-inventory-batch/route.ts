import { NextRequest, NextResponse } from "next/server"
import {
  executeBatchBranchInventoryTransfer,
  type BatchTransferRequestBody,
} from "@/lib/branch-inventory-batch-execute"
import { createPendingBranchTransferRequest } from "@/lib/branch-transfer-request-ops"

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BatchTransferRequestBody & {
    requesterRole?: string
  }

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
    requesterRole,
  } = body

  if (!toBranchId || !mode || !Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json(
      { error: "Missing toBranchId, mode, or lines" },
      { status: 400 },
    )
  }

  const actor = assignedBy || "system"
  const isSuperAdmin = requesterRole === "superadmin" || requesterRole === "admin"

  if (!isSuperAdmin) {
    const pending = await createPendingBranchTransferRequest(
      {
        mode,
        toBranchId,
        fromBranchId,
        fromBranchName,
        fromBranchCode,
        destinationBranchCode,
        assignedBy: actor,
        systemNotes,
        lines,
      },
      actor,
    )
    return NextResponse.json({
      ok: true,
      pendingApproval: true,
      requestId: pending.id,
      request: pending,
    })
  }

  try {
    const result = await executeBatchBranchInventoryTransfer({
      mode,
      toBranchId,
      fromBranchId,
      fromBranchName,
      fromBranchCode,
      destinationBranchCode,
      assignedBy: actor,
      systemNotes,
      lines,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Batch transfer failed" },
      { status: 500 },
    )
  }
}
