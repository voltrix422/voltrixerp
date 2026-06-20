import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

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
    const data = {
      name: String(body.name ?? "").trim(),
      city: String(body.city ?? "").trim(),
      address: String(body.address ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      email: String(body.email ?? "").trim(),
      contactPerson: String(body.contactPerson ?? "").trim(),
      openingHours: String(body.openingHours ?? "").trim(),
      mapUrl: String(body.mapUrl ?? "").trim(),
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
