import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { notifyOnClientPendingApproval } from "@/lib/notifications-server"

export async function GET() {
  const clients = await prisma.erpClient.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const c = await req.json()
  const existing = c.id
    ? await prisma.erpClient.findUnique({
        where: { id: c.id },
        select: { status: true },
      })
    : null
  const record = await prisma.erpClient.upsert({
    where: { id: c.id ?? "__new__" },
    update: {
      name: c.name, company: c.company, email: c.email, phone: c.phone,
      address: c.address, city: c.city, country: c.country, website: c.website,
      taxId: c.taxId, ntn: c.ntn ?? "", industry: c.industry, contactPerson: c.contactPerson,
      imageUrl: c.imageUrl, notes: c.notes, createdBy: c.createdBy, ownerUserId: c.ownerUserId, status: c.status ?? "active",
    },
    create: {
      id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone,
      address: c.address, city: c.city, country: c.country, website: c.website,
      taxId: c.taxId, ntn: c.ntn ?? "", industry: c.industry, contactPerson: c.contactPerson,
      imageUrl: c.imageUrl, notes: c.notes, createdBy: c.createdBy, ownerUserId: c.ownerUserId, status: c.status ?? "active",
      createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
    },
  })

  // Keep denormalized client names in sync (name only — no other fields touched).
  if (record.id && typeof record.name === "string" && record.name.trim()) {
    const name = record.name.trim()
    await Promise.all([
      prisma.erpOrder.updateMany({
        where: { clientId: record.id },
        data: { clientName: name },
      }),
      prisma.crmQuotation.updateMany({
        where: { clientId: record.id },
        data: { clientName: name },
      }),
    ])
  }

  const newStatus = c.status ?? "active"
  if (
    newStatus === "pending_approval" &&
    existing?.status !== "pending_approval" &&
    c.ownerUserId
  ) {
    void notifyOnClientPendingApproval(c.name, c.ownerUserId)
  }

  return NextResponse.json(record)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpClient.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
