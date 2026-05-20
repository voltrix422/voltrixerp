import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { syncPhonesFromCsv } from "@/lib/sync-phones-from-csv"
import { readInstallersLeadsCsv } from "@/lib/sync-installers-phones"
import { VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME } from "@/lib/voltrix-installers-leads-csv"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const importBatchId = String(body.importBatchId ?? "").trim()
    const repairAll = Boolean(body.repairAll) || !importBatchId
    let csvText = typeof body.csvText === "string" ? body.csvText : ""
    if (!csvText.trim()) {
      try {
        csvText = await readInstallersLeadsCsv()
      } catch {
        return NextResponse.json(
          { error: "csvText required or deploy installers CSV in public/" },
          { status: 400 },
        )
      }
    }

    const result = await syncPhonesFromCsv(
      prisma,
      csvText,
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
