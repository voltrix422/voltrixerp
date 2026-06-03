import { NextRequest, NextResponse } from "next/server"
import {
  approveBranchTransferRequest,
  listBranchTransferRequests,
  rejectBranchTransferRequest,
} from "@/lib/branch-transfer-request-ops"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") || "pending"
  const branchId = searchParams.get("branchId") || undefined

  const requests = await listBranchTransferRequests({ status, branchId })
  return NextResponse.json(requests)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, action, reviewedBy, reviewNote } = body as {
    id: string
    action: "approve" | "reject"
    reviewedBy?: string
    reviewNote?: string
  }

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 })
  }

  const reviewer = reviewedBy?.trim() || "Super admin"

  try {
    if (action === "approve") {
      const { request, result } = await approveBranchTransferRequest(id, reviewer)
      return NextResponse.json({ ok: true, request, result })
    }
    if (action === "reject") {
      const request = await rejectBranchTransferRequest(id, reviewer, reviewNote)
      return NextResponse.json({ ok: true, request })
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Review failed" },
      { status: 400 },
    )
  }
}
