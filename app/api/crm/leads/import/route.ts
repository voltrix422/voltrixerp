import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { enrichLeadRowsWithPhonesFromCsv } from "@/lib/csv-leads"
import { isFacebookLeadAdsCsv } from "@/lib/facebook-lead-ads-csv"
import { syncPhonesFromCsv } from "@/lib/sync-phones-from-csv"

type Incoming = {
  name: string
  company?: string
  city?: string
  address?: string
  email?: string
  phone?: string
  notes?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const csvText = typeof body.csvText === "string" ? body.csvText : ""
    let leads = body.leads as Incoming[]
    const createdBy = body.createdBy as string
    const createdById = body.createdById as string | undefined
    const source = (body.source as string) || "csv"

    if (!createdBy || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: "createdBy and non-empty leads[] required" }, { status: 400 })
    }

    if (csvText.trim() && isFacebookLeadAdsCsv(csvText)) {
      const { parseFacebookLeadAdsCsv } = await import("@/lib/facebook-lead-ads-csv")
      leads = enrichLeadRowsWithPhonesFromCsv(parseFacebookLeadAdsCsv(csvText), csvText)
    } else if (csvText.trim()) {
      leads = enrichLeadRowsWithPhonesFromCsv(
        leads.map((l) => ({
          name: String(l.name ?? ""),
          company: String(l.company ?? ""),
          city: String(l.city ?? ""),
          address: String(l.address ?? ""),
          email: String(l.email ?? ""),
          phone: String(l.phone ?? ""),
          notes: String(l.notes ?? ""),
        })),
        csvText,
      )
    }

    const data = leads
      .filter((l) => l && String(l.name || "").trim())
      .map((l) => ({
        name: String(l.name).trim(),
        company: String(l.company ?? "").trim(),
        city: String(l.city ?? "").trim(),
        address: String(l.address ?? "").trim(),
        email: String(l.email ?? "").trim(),
        phone: String(l.phone ?? "").trim(),
        notes: String(l.notes ?? "").trim(),
        source: String(source || "csv"),
        createdBy: String(createdBy),
        createdById: createdById ? String(createdById) : null,
        importBatchId: body.importBatchId ? String(body.importBatchId) : null,
        importUploaderName: body.importUploaderName ? String(body.importUploaderName).trim() : null,
      }))

    if (data.length === 0) {
      return NextResponse.json({ error: "No valid rows (each needs a name)" }, { status: 400 })
    }

    const isCsv = String(source || "csv") === "csv"
    if (isCsv) {
      const batchId = body.importBatchId as string | undefined
      const uploader = body.importUploaderName as string | undefined
      if (!batchId || !String(batchId).trim()) {
        return NextResponse.json({ error: "importBatchId required for CSV import" }, { status: 400 })
      }
      if (!uploader || !String(uploader).trim()) {
        return NextResponse.json({ error: "importUploaderName required (who is importing?)" }, { status: 400 })
      }
    }

    const result = await prisma.crmLead.createMany({ data })
    const batchId = body.importBatchId ? String(body.importBatchId).trim() : undefined
    let phonesSynced = 0
    if (csvText.trim() && batchId) {
      const sync = await syncPhonesFromCsv(prisma, csvText, { importBatchId: batchId })
      phonesSynced = sync.updated
    }
    return NextResponse.json({
      created: result.count,
      withPhone: data.filter((l) => l.phone).length,
      phonesSynced,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}
