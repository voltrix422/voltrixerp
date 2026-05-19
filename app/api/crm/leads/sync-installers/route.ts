import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { syncInstallersPhones } from "@/lib/sync-installers-phones"
import { VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME } from "@/lib/voltrix-installers-leads-csv"

/** Sync phones from hardcoded public/Voltrix installers Leads 19 May 2026.csv */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const importBatchId = body.importBatchId ? String(body.importBatchId).trim() : undefined

    const result = await syncInstallersPhones(prisma, importBatchId ? { importBatchId } : undefined)

    return NextResponse.json({
      success: true,
      csvFile: VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME,
      ...result,
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : ""
    if (msg.includes("ENOENT")) {
      return NextResponse.json(
        { error: `Missing public/${VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME} on server` },
        { status: 404 },
      )
    }
    return NextResponse.json({ error: "Sync installers phones failed" }, { status: 500 })
  }
}
