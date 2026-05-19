import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/db"
import { buildLeadPhoneLookupFromCsv } from "@/lib/csv-leads"

const DEFAULT_CSV = path.join(
  process.cwd(),
  "public",
  "Voltrix installers Leads 19 May 2026.csv",
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const importBatchId = String(body.importBatchId ?? "").trim()
    if (!importBatchId) {
      return NextResponse.json({ error: "importBatchId required" }, { status: 400 })
    }

    let csvText = typeof body.csvText === "string" ? body.csvText : ""
    if (!csvText.trim()) {
      try {
        csvText = await fs.readFile(DEFAULT_CSV, "utf-8")
      } catch {
        return NextResponse.json(
          { error: "csvText required (or place installers CSV in public/)" },
          { status: 400 },
        )
      }
    }

    const lookup = buildLeadPhoneLookupFromCsv(csvText)
    if (lookup.size === 0) {
      return NextResponse.json({ error: "No phone numbers found in CSV" }, { status: 400 })
    }

    const leads = await prisma.crmLead.findMany({
      where: { importBatchId },
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
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Repair failed" }, { status: 500 })
  }
}
