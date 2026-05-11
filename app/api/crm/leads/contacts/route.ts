import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string") as string[]
  return []
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const leadId = b.leadId as string
    const contactedBy = b.contactedBy as string
    if (!leadId || !contactedBy) {
      return NextResponse.json({ error: "leadId and contactedBy required" }, { status: 400 })
    }

    const lead = await prisma.crmLead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    const screenshotUrls = asStringArray(b.screenshotUrls)
    const leadResponse = String(b.leadResponse ?? "")
    const notes = String(b.notes ?? "")
    const contactedAt = b.contactedAt ? new Date(String(b.contactedAt)) : new Date()

    const contact = await prisma.crmLeadContact.create({
      data: {
        leadId,
        contactedBy,
        contactedById: b.contactedById ? String(b.contactedById) : null,
        contactedAt,
        screenshotUrls,
        leadResponse,
        notes,
      },
    })

    let status = lead.status
    if (status !== "closed") {
      if (leadResponse.trim()) status = "responded"
      else if (status === "new") status = "contacted"
    }

    await prisma.crmLead.update({
      where: { id: leadId },
      data: { status },
    })

    return NextResponse.json({
      id: contact.id,
      leadId: contact.leadId,
      contactedAt: contact.contactedAt.toISOString(),
      contactedBy: contact.contactedBy,
      contactedById: contact.contactedById,
      screenshotUrls: asStringArray(contact.screenshotUrls as unknown),
      leadResponse: contact.leadResponse,
      notes: contact.notes,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to log contact" }, { status: 500 })
  }
}
