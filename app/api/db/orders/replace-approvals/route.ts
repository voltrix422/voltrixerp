import { NextResponse } from "next/server"
import { listPendingReplacementApprovalsServer } from "@/lib/order-replacement-server"

export async function GET() {
  try {
    const pending = await listPendingReplacementApprovalsServer()
    return NextResponse.json({ pending })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load approvals" },
      { status: 500 },
    )
  }
}
