import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string") as string[]
  return []
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(ctx.params)
    const lead = await prisma.crmLead.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { contactedAt: "desc" } },
        _count: { select: { contacts: true } },
      },
    })
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const contacts = lead.contacts.map((c) => ({
      id: c.id,
      leadId: c.leadId,
      contactedAt: c.contactedAt.toISOString(),
      contactedBy: c.contactedBy,
      contactedById: c.contactedById,
      screenshotUrls: asStringArray(c.screenshotUrls as unknown),
      leadResponse: c.leadResponse,
      notes: c.notes,
    }))

    return NextResponse.json({
      lead: {
        id: lead.id,
        name: lead.name,
        company: lead.company,
        city: lead.city,
        address: lead.address,
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes,
        source: lead.source,
        status: lead.status,
        followUpAt: lead.followUpAt?.toISOString() ?? null,
        followUpNotes: lead.followUpNotes,
        importedAt: lead.importedAt.toISOString(),
        createdBy: lead.createdBy,
        createdById: lead.createdById,
        importBatchId: lead.importBatchId,
        importUploaderName: lead.importUploaderName,
        contactCount: lead._count.contacts,
        lastContactedAt: contacts[0]?.contactedAt ?? null,
        lastResponseSnippet: contacts[0]?.leadResponse?.slice(0, 160) ?? null,
        contacts,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to load lead" }, { status: 500 })
  }
}
