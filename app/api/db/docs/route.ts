import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const docs = await prisma.erpDoc.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest) {
  const d = await req.json()
  const record = await prisma.erpDoc.upsert({
    where: { id: d.id ?? "__new__" },
    update: { name: d.name, category: d.category, fileUrl: d.file_url, fileType: d.file_type, fileSize: d.file_size, description: d.description, createdBy: d.created_by },
    create: { id: d.id, name: d.name, category: d.category, fileUrl: d.file_url, fileType: d.file_type, fileSize: d.file_size, description: d.description, createdBy: d.created_by, createdAt: d.created_at ? new Date(d.created_at) : undefined },
  })
  return NextResponse.json(record)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpDoc.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
