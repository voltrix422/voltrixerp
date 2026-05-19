import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import { prisma } from "@/lib/db"
import { buildLeadPhoneLookupFromCsv, parseLeadImportCsv } from "@/lib/csv-leads"
import {
  getVoltrixInstallersLeadsCsvPath,
  VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME,
  VOLTRIX_INSTALLERS_LEADS_IMPORT_BATCH_ID,
  VOLTRIX_INSTALLERS_LEADS_IMPORTER_NAME,
} from "@/lib/voltrix-installers-leads-csv"

async function readInstallersCsv(): Promise<string> {
  return fs.readFile(getVoltrixInstallersLeadsCsvPath(), "utf-8")
}

async function repairPhonesFromLookup(
  lookup: Map<string, string>,
  where?: { importBatchId?: string },
) {
  const leads = await prisma.crmLead.findMany({
    where: where?.importBatchId ? { importBatchId: where.importBatchId } : undefined,
    select: { id: true, name: true, company: true, phone: true },
  })

  let updated = 0
  let alreadyHad = 0
  let notMatched = 0

  for (const lead of leads) {
    const key = `${lead.name.trim().toLowerCase()}|||${lead.company.trim().toLowerCase()}`
    const altKey = `${lead.company.trim().toLowerCase()}|||${lead.name.trim().toLowerCase()}`
    const phone = lookup.get(key) ?? lookup.get(altKey)
    if (!phone) {
      notMatched += 1
      continue
    }
    if (lead.phone?.trim()) {
      alreadyHad += 1
      continue
    }
    await prisma.crmLead.update({ where: { id: lead.id }, data: { phone } })
    updated += 1
  }

  return { total: leads.length, updated, alreadyHad, notMatched }
}

/** Import or refresh phones from the hardcoded installers CSV in public/. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const createdBy = String(body.createdBy ?? "admin").trim()
    const createdById = body.createdById ? String(body.createdById) : null
    const repairAll = Boolean(body.repairAll)

    const csvText = await readInstallersCsv()
    const rows = parseLeadImportCsv(csvText)
    if (rows.length === 0) {
      return NextResponse.json({ error: "No leads parsed from installers CSV" }, { status: 400 })
    }

    const lookup = buildLeadPhoneLookupFromCsv(csvText)
    const batchId = VOLTRIX_INSTALLERS_LEADS_IMPORT_BATCH_ID

    const existingInBatch = await prisma.crmLead.count({ where: { importBatchId: batchId } })

    if (existingInBatch === 0) {
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
        importUploaderName: VOLTRIX_INSTALLERS_LEADS_IMPORTER_NAME,
        csvFile: VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME,
      })
    }

    const batchRepair = await repairPhonesFromLookup(lookup, { importBatchId: batchId })
    const allRepair = repairAll
      ? await repairPhonesFromLookup(lookup)
      : { total: 0, updated: 0, alreadyHad: 0, notMatched: 0 }

    return NextResponse.json({
      success: true,
      mode: "repair",
      importBatchId: batchId,
      existingInBatch,
      batchRepair,
      allRepair: repairAll ? allRepair : undefined,
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
