import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const leads = await prisma.crmLead.findMany({
      orderBy: { importedAt: "desc" },
      include: {
        _count: { select: { contacts: true } },
        contacts: { orderBy: { contactedAt: "desc" }, take: 1 },
      },
    })
    const mapped = leads.map((l) => ({
      id: l.id,
      name: l.name,
      company: l.company,
      city: l.city,
      address: l.address,
      email: l.email,
      phone: l.phone,
      notes: l.notes,
      source: l.source,
      status: l.status,
      importedAt: l.importedAt.toISOString(),
      createdBy: l.createdBy,
      createdById: l.createdById,
      importBatchId: l.importBatchId,
      importUploaderName: l.importUploaderName,
      contactCount: l._count.contacts,
      lastContactedAt: l.contacts[0]?.contactedAt.toISOString() ?? null,
      lastResponseSnippet: l.contacts[0]?.leadResponse
        ? String(l.contacts[0].leadResponse).slice(0, 160)
        : null,
    }))
    return NextResponse.json(mapped)
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
    const { id, status } = await req.json()
    if (!id || !status) {
      return NextResponse.json({ error: "id and status required" }, { status: 400 })
    }
    const lead = await prisma.crmLead.update({
      where: { id: String(id) },
      data: { status: String(status) },
    })
    return NextResponse.json(lead)
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
