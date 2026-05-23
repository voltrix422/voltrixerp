import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const branches = await prisma.erpBranch.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(branches)
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (b.type === "main_warehouse") {
      await prisma.erpBranch.updateMany({
        where: {
          type: "main_warehouse",
          id: { not: b.id },
        },
        data: { type: "warehouse" },
      })
    }
    const branch = await prisma.erpBranch.upsert({
      where: { id: b.id ?? "__new__" },
      update: {
        name: b.name,
        code: b.code,
        type: b.type,
        address: b.address ?? "",
        city: b.city ?? "",
        country: b.country ?? "",
        phone: b.phone ?? "",
        email: b.email ?? "",
        manager: b.manager ?? "",
        status: b.status ?? "active",
        notes: b.notes ?? "",
      },
      create: {
        id: b.id,
        name: b.name,
        code: b.code,
        type: b.type,
        address: b.address ?? "",
        city: b.city ?? "",
        country: b.country ?? "",
        phone: b.phone ?? "",
        email: b.email ?? "",
        manager: b.manager ?? "",
        status: b.status ?? "active",
        notes: b.notes ?? "",
        createdBy: b.createdBy || "system",
      },
    })
    return NextResponse.json(branch)
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Branch code already exists. Use a different code." },
        { status: 409 },
      )
    }
    console.error("[branches POST]", err)
    return NextResponse.json({ error: "Failed to save branch" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpBranch.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
