import { NextRequest, NextResponse } from "next/server"
import {
  previewFinanceToPettyCashMigration,
  runFinanceToPettyCashMigration,
} from "@/lib/migrate-finance-records-to-petty-cash"

export async function GET() {
  const preview = await previewFinanceToPettyCashMigration()
  return NextResponse.json(preview)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const confirm = Boolean((body as { confirm?: boolean }).confirm)
  const allocatedBy = String((body as { allocatedBy?: string }).allocatedBy || "Finance migration")

  if (!confirm) {
    return NextResponse.json(
      { error: "Set confirm: true to run this one-time migration." },
      { status: 400 },
    )
  }

  const result = await runFinanceToPettyCashMigration(allocatedBy)
  return NextResponse.json(result)
}
