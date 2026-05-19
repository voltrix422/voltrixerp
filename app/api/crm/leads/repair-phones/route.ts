import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { syncInstallersPhones } from "@/lib/sync-installers-phones"
import { VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME } from "@/lib/voltrix-installers-leads-csv"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const importBatchId = String(body.importBatchId ?? "").trim()
    const repairAll = Boolean(body.repairAll) || !importBatchId

    const result = await syncInstallersPhones(
      prisma,
      !repairAll && importBatchId ? { importBatchId } : undefined,
    )

    return NextResponse.json({
      success: true,
      csvFile: VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME,
      repairAll,
      ...result,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Repair failed" }, { status: 500 })
  }
}
