import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const accounts = await prisma.acctAccount.findMany({ orderBy: { code: "asc" } })
  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  try {
    const account = await prisma.acctAccount.create({
      data: {
        code: String(body.code),
        name: String(body.name),
        accountType: String(body.accountType),
        parentCode: String(body.parentCode ?? ""),
        reconcile: Boolean(body.reconcile),
        notes: String(body.notes ?? ""),
      },
    })
    return NextResponse.json(account)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const account = await prisma.acctAccount.update({ where: { id }, data })
  return NextResponse.json(account)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.acctAccount.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
