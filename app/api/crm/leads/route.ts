import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { mapLeadRow } from "@/lib/crm-lead-status"

export async function GET(req: NextRequest) {
  try {
    const assignedToUserId = req.nextUrl.searchParams.get("assignedToUserId")?.trim() || ""

    const leads = await prisma.crmLead.findMany({
      where: assignedToUserId ? { assignedToUserId } : undefined,
      orderBy: { importedAt: "desc" },
      include: {
        _count: { select: { contacts: true } },
        contacts: { orderBy: { contactedAt: "desc" }, take: 1 },
      },
    })

    return NextResponse.json(leads.map(mapLeadRow))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to list leads" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.name || !b.createdBy) {
      return NextResponse.json({ error: "name and createdBy required" }, { status: 400 })
    }
    const lead = await prisma.crmLead.create({
      data: {
        name: String(b.name),
        company: String(b.company ?? ""),
        city: String(b.city ?? ""),
        address: String(b.address ?? ""),
        email: String(b.email ?? ""),
        phone: String(b.phone ?? ""),
        notes: String(b.notes ?? ""),
        source: "manual",
        status: String(b.status ?? "new"),
        createdBy: String(b.createdBy),
        createdById: b.createdById ? String(b.createdById) : null,
        assignedToUserId: b.assignedToUserId ? String(b.assignedToUserId) : null,
        assignedToName: String(b.assignedToName ?? ""),
      },
    })
    return NextResponse.json(lead)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const id = body?.id ? String(body.id) : ""
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    const data: {
      status?: string
      followUpAt?: Date | null
      followUpNotes?: string
      assignedToUserId?: string | null
      assignedToName?: string
    } = {}

    if (body.status != null) {
      data.status = String(body.status)
    }
    if (body.followUpAt !== undefined) {
      const raw = body.followUpAt
      data.followUpAt = raw == null || raw === "" ? null : new Date(String(raw))
      if (data.followUpAt && Number.isNaN(data.followUpAt.getTime())) {
        return NextResponse.json({ error: "Invalid followUpAt" }, { status: 400 })
      }
    }
    if (body.followUpNotes !== undefined) {
      data.followUpNotes = String(body.followUpNotes ?? "")
    }
    if (body.assignedToUserId !== undefined) {
      const userId = body.assignedToUserId == null || body.assignedToUserId === ""
        ? null
        : String(body.assignedToUserId)
      data.assignedToUserId = userId
      data.assignedToName = userId ? String(body.assignedToName ?? "") : ""
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const lead = await prisma.crmLead.update({
      where: { id },
      data,
    })
    return NextResponse.json({
      id: lead.id,
      status: lead.status,
      followUpAt: lead.followUpAt?.toISOString() ?? null,
      followUpNotes: lead.followUpNotes,
      assignedToUserId: lead.assignedToUserId,
      assignedToName: lead.assignedToName,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const batch = body?.importBatchId != null ? String(body.importBatchId).trim() : ""
    if (batch) {
      const result = await prisma.crmLead.deleteMany({
        where: { importBatchId: batch },
      })
      return NextResponse.json({ ok: true, deleted: result.count })
    }
    const id = body?.id
    if (!id) return NextResponse.json({ error: "id or importBatchId required" }, { status: 400 })
    await prisma.crmLead.delete({ where: { id: String(id) } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 })
  }
}
