import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const staff = await prisma.erpStaff.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(staff)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const staff = await prisma.erpStaff.create({ data: body })
  return NextResponse.json(staff)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...data } = body
  const staff = await prisma.erpStaff.update({ 
    where: { id }, 
    data: {
      ...data,
      // Handle points, warnings, and lastReset fields properly
      ...(data.points !== undefined && { points: data.points }),
      ...(data.warnings !== undefined && { warnings: data.warnings }),
      ...(data.lastReset !== undefined && { lastReset: data.lastReset ? new Date(data.lastReset) : null })
    }
  })
  return NextResponse.json(staff)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.erpStaff.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
