import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { normalizeDealership } from "@/lib/dealership-display"

export async function GET(req: NextRequest) {
  const publicOnly = req.nextUrl.searchParams.get("public") === "true"

  const dealerships = await prisma.erpWebsiteDealership.findMany({
    where: publicOnly ? { published: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(dealerships)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    const normalized = normalizeDealership({
      id: body.id ?? "",
      name: String(body.name ?? ""),
      city: String(body.city ?? ""),
      address: String(body.address ?? ""),
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      contactPerson: String(body.contactPerson ?? ""),
      openingHours: String(body.openingHours ?? ""),
      mapUrl: String(body.mapUrl ?? ""),
    })

    const data = {
      name: normalized.name,
      city: normalized.city,
      address: normalized.address,
      phone: normalized.phone,
      email: normalized.email,
      contactPerson: normalized.contactPerson,
      openingHours: normalized.openingHours,
      mapUrl: normalized.mapUrl,
      published: Boolean(body.published),
      sortOrder: Number(body.sortOrder) || 0,
    }

    if (!data.name) {
      return NextResponse.json({ error: "Dealership name is required" }, { status: 400 })
    }

    if (body.id) {
      const dealership = await prisma.erpWebsiteDealership.update({
        where: { id: body.id },
        data,
      })
      return NextResponse.json(dealership)
    }

    const dealership = await prisma.erpWebsiteDealership.create({
      data: {
        ...data,
        createdBy: body.createdBy ?? null,
      },
    })
    return NextResponse.json(dealership)
  } catch (error: unknown) {
    console.error("Error saving dealership:", error)
    const message = error instanceof Error ? error.message : "Failed to save dealership"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }
  await prisma.erpWebsiteDealership.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
