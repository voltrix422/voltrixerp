import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string") as string[]
  return []
}

function mapContact(c: {
  id: string
  leadId: string
  contactedAt: Date
  contactedBy: string
  contactedById: string | null
  screenshotUrls: unknown
  leadResponse: string
  notes: string
}) {
  return {
    id: c.id,
    leadId: c.leadId,
    contactedAt: c.contactedAt.toISOString(),
    contactedBy: c.contactedBy,
    contactedById: c.contactedById,
    screenshotUrls: asStringArray(c.screenshotUrls),
    leadResponse: c.leadResponse,
    notes: c.notes,
  }
}

export async function GET(req: NextRequest) {
  try {
    const leadId = new URL(req.url).searchParams.get("leadId")?.trim()
    if (!leadId) {
      return NextResponse.json({ error: "leadId query required" }, { status: 400 })
    }

    const contacts = await prisma.crmLeadContact.findMany({
      where: { leadId },
      orderBy: { contactedAt: "desc" },
    })

    return NextResponse.json({ contacts: contacts.map(mapContact) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to load outreach history" }, { status: 500 })
  }
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
        screenshotUrls: screenshotUrls.length > 0 ? screenshotUrls : [],
        leadResponse,
        notes,
      },
    })

    let status = lead.status
    const preserveStatus = new Set(["closed", "interested", "not_interested", "price_negotiable", "on_hold", "pending"])
    if (!preserveStatus.has(status)) {
      if (leadResponse.trim()) status = "responded"
      else if (status === "new" || status === "contacted") status = "not_responded"
    }

    const leadUpdate: {
      status: string
      followUpAt?: Date | null
      followUpNotes?: string
    } = { status }

    if (b.followUpAt !== undefined) {
      const raw = b.followUpAt
      leadUpdate.followUpAt = raw == null || raw === "" ? null : new Date(String(raw))
      if (leadUpdate.followUpAt && Number.isNaN(leadUpdate.followUpAt.getTime())) {
        return NextResponse.json({ error: "Invalid followUpAt" }, { status: 400 })
      }
    }
    if (b.followUpNotes !== undefined) {
      leadUpdate.followUpNotes = String(b.followUpNotes ?? "")
    }

    const updatedLead = await prisma.crmLead.update({
      where: { id: leadId },
      data: leadUpdate,
    })

    return NextResponse.json({
      ...mapContact(contact),
      followUpAt: updatedLead.followUpAt?.toISOString() ?? null,
      followUpNotes: updatedLead.followUpNotes,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to log contact" }, { status: 500 })
  }
}
