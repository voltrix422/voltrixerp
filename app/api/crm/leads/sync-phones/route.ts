import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { syncPhonesFromCsv } from "@/lib/sync-phones-from-csv"
import { readInstallersLeadsCsv } from "@/lib/sync-installers-phones"

/** Fill phones from uploaded Facebook CSV text or the bundled installers file. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const importBatchId = body.importBatchId ? String(body.importBatchId).trim() : undefined
    let csvText = typeof body.csvText === "string" ? body.csvText : ""

    if (!csvText.trim()) {
      try {
        csvText = await readInstallersLeadsCsv()
      } catch {
        return NextResponse.json({ error: "csvText required (or deploy installers CSV in public/)" }, { status: 400 })
      }
    }

    const result = await syncPhonesFromCsv(prisma, csvText, importBatchId ? { importBatchId } : undefined)
    if (result.lookupSize === 0) {
      return NextResponse.json(
        {
          error:
            "No phone numbers found in CSV (expected Facebook columns FULL_NAME and PHONE).",
          ...result,
        },
        { status: 400 },
      )
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Sync phones failed" }, { status: 500 })
  }
}
