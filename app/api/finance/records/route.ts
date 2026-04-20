import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const records = await prisma.erpFinanceRecord.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const record = await prisma.erpFinanceRecord.create({ data: body })
  return NextResponse.json(record)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.erpFinanceRecord.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
