import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get("type")
  const partners = await prisma.acctPartner.findMany({
    where: type ? { partnerType: { in: [type, "both"] } } : {},
    orderBy: { name: "asc" },
  })
  return NextResponse.json(partners)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const partner = await prisma.acctPartner.create({
    data: {
      name: String(body.name),
      partnerType: String(body.partnerType ?? "customer"),
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
      address: String(body.address ?? ""),
      taxId: String(body.taxId ?? ""),
      creditLimit: Number(body.creditLimit ?? 0),
    },
  })
  return NextResponse.json(partner)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const partner = await prisma.acctPartner.update({ where: { id }, data })
  return NextResponse.json(partner)
}
