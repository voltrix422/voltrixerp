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
  try {
    const body = await req.json()
    console.log('HRM PUT request body:', body)
    
    const { id, ...data } = body
    if (!id) {
      console.error('Missing id in PUT request')
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    console.log('Updating staff with id:', id, 'data:', data)

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
    
    console.log('Successfully updated staff:', staff)
    return NextResponse.json(staff)
  } catch (error) {
    console.error('Error in HRM PUT endpoint:', error)
    return NextResponse.json({ 
      error: 'Failed to update staff member', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.erpStaff.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
