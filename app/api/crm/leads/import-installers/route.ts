import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { parseLeadImportCsv } from "@/lib/csv-leads"
import { syncInstallersPhones, readInstallersLeadsCsv } from "@/lib/sync-installers-phones"
import {
  VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME,
  VOLTRIX_INSTALLERS_LEADS_IMPORT_BATCH_ID,
  VOLTRIX_INSTALLERS_LEADS_IMPORTER_NAME,
} from "@/lib/voltrix-installers-leads-csv"

/** Sync phones from hardcoded CSV; optionally create official batch if empty. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const createdBy = String(body.createdBy ?? "admin").trim()
    const createdById = body.createdById ? String(body.createdById) : null

    const allRepair = await syncInstallersPhones(prisma)

    const csvText = await readInstallersLeadsCsv()
    const rows = parseLeadImportCsv(csvText)
    const batchId = VOLTRIX_INSTALLERS_LEADS_IMPORT_BATCH_ID
    const existingInBatch = await prisma.crmLead.count({ where: { importBatchId: batchId } })

    if (existingInBatch === 0 && rows.length > 0 && Boolean(body.allowImport)) {
      const result = await prisma.crmLead.createMany({
        data: rows.map((l) => ({
          name: l.name,
          company: l.company,
          email: l.email,
          phone: l.phone,
          notes: l.notes,
          source: "csv",
          createdBy,
          createdById,
          importBatchId: batchId,
          importUploaderName: VOLTRIX_INSTALLERS_LEADS_IMPORTER_NAME,
        })),
      })
      return NextResponse.json({
        success: true,
        mode: "import",
        created: result.count,
        importBatchId: batchId,
        allRepair,
        csvFile: VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME,
      })
    }

    return NextResponse.json({
      success: true,
      mode: "sync",
      importBatchId: batchId,
      existingInBatch,
      allRepair,
      csvFile: VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME,
    })
  } catch (e) {
    console.error(e)
    const message = e instanceof Error ? e.message : "Import failed"
    if (String(message).includes("ENOENT")) {
      return NextResponse.json(
        {
          error: `Installers CSV not found at public/${VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME} — deploy the file from git.`,
        },
        { status: 404 },
      )
    }
    return NextResponse.json({ error: "Import installers failed" }, { status: 500 })
  }
}
