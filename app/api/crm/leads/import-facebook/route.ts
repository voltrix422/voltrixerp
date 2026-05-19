import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { isFacebookLeadAdsCsv, parseFacebookLeadAdsCsv } from "@/lib/facebook-lead-ads-csv"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const csvText = String(body.csvText ?? "")
    const createdBy = String(body.createdBy ?? "").trim()
    const createdById = body.createdById ? String(body.createdById) : null
    const importUploaderName = String(body.importUploaderName ?? "Facebook Lead Ads").trim()
    const importBatchId =
      String(body.importBatchId ?? "").trim() ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `fb-${Date.now()}`)

    if (!createdBy) {
      return NextResponse.json({ error: "createdBy required" }, { status: 400 })
    }
    if (!csvText.trim()) {
      return NextResponse.json({ error: "csvText required" }, { status: 400 })
    }
    if (!isFacebookLeadAdsCsv(csvText)) {
      return NextResponse.json(
        {
          error:
            "Not a Facebook Lead Ads CSV. Required columns include FULL_NAME, PHONE, COMPANY_NAME, City, Address.",
        },
        { status: 400 },
      )
    }

    const rows = parseFacebookLeadAdsCsv(csvText)
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid lead rows in file" }, { status: 400 })
    }

    const result = await prisma.crmLead.createMany({
      data: rows.map((l) => ({
        name: l.name,
        company: l.company,
        email: l.email,
        phone: l.phone,
        notes: l.notes,
        source: "facebook_lead_ads",
        createdBy,
        createdById,
        importBatchId,
        importUploaderName,
      })),
    })

    return NextResponse.json({
      success: true,
      created: result.count,
      importBatchId,
      importUploaderName,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Facebook leads import failed" }, { status: 500 })
  }
}
