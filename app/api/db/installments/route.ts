import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessInstallmentsPortal, canWriteInstallments } from "@/lib/auth"

const DOC_LABELS = new Set(["agreement", "checklist", "other"])

async function loadActor(userId: unknown) {
  const id = String(userId ?? "").trim()
  if (!id) return null
  return prisma.erpUser.findUnique({
    where: { id },
    select: { id: true, name: true, role: true },
  })
}

function normalizeLabel(raw: unknown) {
  const value = String(raw ?? "").trim().toLowerCase()
  return DOC_LABELS.has(value) ? value : "other"
}

export async function GET(req: NextRequest) {
  try {
    const actorId = req.nextUrl.searchParams.get("actorUserId")
    const actor = await loadActor(actorId)
    if (!actor || !canAccessInstallmentsPortal(actor.role)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 })
    }

    const clientId = String(req.nextUrl.searchParams.get("id") || "").trim()
    if (clientId) {
      const row = await prisma.installmentClient.findUnique({
        where: { id: clientId },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      })
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json(row)
    }

    const q = String(req.nextUrl.searchParams.get("q") || "").trim()
    const rows = await prisma.installmentClient.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { cnic: { contains: q, mode: "insensitive" } },
              { product: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        documents: { orderBy: { createdAt: "desc" }, take: 6 },
        _count: { select: { documents: true } },
      },
      orderBy: { updatedAt: "desc" },
    })
    return NextResponse.json(rows)
  } catch (err) {
    console.error("installments GET", err)
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const actor = await loadActor(body.actorUserId)
    if (!actor || !canWriteInstallments(actor.role)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 })
    }

    const action = String(body.action || "upsert").trim()

    if (action === "add_document") {
      const clientId = String(body.clientId || "").trim()
      const fileUrl = String(body.fileUrl || "").trim()
      if (!clientId || !fileUrl) {
        return NextResponse.json({ error: "Client and file required" }, { status: 400 })
      }
      const exists = await prisma.installmentClient.findUnique({
        where: { id: clientId },
        select: { id: true },
      })
      if (!exists) return NextResponse.json({ error: "Client not found" }, { status: 404 })

      const doc = await prisma.installmentDocument.create({
        data: {
          clientId,
          label: normalizeLabel(body.label),
          customLabel: String(body.customLabel || "").trim(),
          fileName: String(body.fileName || "").trim(),
          fileUrl,
          uploadedBy: actor.name || "",
          uploadedById: actor.id,
        },
      })
      await prisma.installmentClient.update({
        where: { id: clientId },
        data: { updatedBy: actor.name || "", updatedById: actor.id },
      })
      return NextResponse.json(doc)
    }

    if (action === "delete_document") {
      const docId = String(body.documentId || "").trim()
      if (!docId) return NextResponse.json({ error: "Missing document id" }, { status: 400 })
      const existing = await prisma.installmentDocument.findUnique({
        where: { id: docId },
        select: { id: true, clientId: true },
      })
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
      await prisma.installmentDocument.delete({ where: { id: docId } })
      await prisma.installmentClient.update({
        where: { id: existing.clientId },
        data: { updatedBy: actor.name || "", updatedById: actor.id },
      })
      return NextResponse.json({ ok: true })
    }

    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })

    const data = {
      name,
      phone: String(body.phone || "").trim(),
      email: String(body.email || "").trim(),
      cnic: String(body.cnic || "").trim(),
      address: String(body.address || "").trim(),
      product: String(body.product || "").trim(),
      notes: String(body.notes || "").trim(),
      updatedBy: actor.name || "",
      updatedById: actor.id,
    }

    const id = String(body.id || "").trim()
    if (id) {
      const row = await prisma.installmentClient.update({
        where: { id },
        data,
        include: { documents: { orderBy: { createdAt: "desc" } } },
      })
      return NextResponse.json(row)
    }

    const row = await prisma.installmentClient.create({
      data: {
        ...data,
        createdBy: actor.name || "",
        createdById: actor.id,
      },
      include: { documents: { orderBy: { createdAt: "desc" } } },
    })
    return NextResponse.json(row)
  } catch (err) {
    console.error("installments POST", err)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const actor = await loadActor(body.actorUserId)
    if (!actor || !canWriteInstallments(actor.role)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 })
    }
    const id = String(body.id || "").trim()
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    await prisma.installmentClient.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("installments DELETE", err)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
