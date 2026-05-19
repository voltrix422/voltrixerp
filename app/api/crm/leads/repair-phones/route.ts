import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import { prisma } from "@/lib/db"
import { buildLeadPhoneLookupFromCsv } from "@/lib/csv-leads"
import { getVoltrixInstallersLeadsCsvPath } from "@/lib/voltrix-installers-leads-csv"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const importBatchId = String(body.importBatchId ?? "").trim()
    const repairAll = Boolean(body.repairAll)

    const csvText = await fs.readFile(getVoltrixInstallersLeadsCsvPath(), "utf-8")
    const lookup = buildLeadPhoneLookupFromCsv(csvText)
    if (lookup.size === 0) {
      return NextResponse.json({ error: "No phone numbers found in installers CSV" }, { status: 400 })
    }

    const leads = await prisma.crmLead.findMany({
      where: importBatchId && !repairAll ? { importBatchId } : undefined,
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
      await prisma.crmLead.update({
        where: { id: lead.id },
        data: { phone },
      })
      updated += 1
    }

    return NextResponse.json({
      success: true,
      total: leads.length,
      updated,
      alreadyHad,
      notMatched,
      repairAll: repairAll || !importBatchId,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Repair failed" }, { status: 500 })
  }
}
