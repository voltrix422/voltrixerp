import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const salarySlip = await prisma.erpSalarySlip.create({
      data: {
        staffName:        body.staffName,
        staffRole:        body.staffRole,
        staffDepartment:  body.staffDepartment,
        month:            body.month,
        baseSalary:       body.baseSalary,
        currency:         body.currency || 'PKR',
        adjustments:      body.adjustments || [],
        netSalary:        body.netSalary,
        generatedDate:    new Date(body.generatedDate),
        bankName:         body.bankName || '',
        bankAccountNumber: body.bankAccountNumber || '',
        bankAccountTitle: body.bankAccountTitle || '',
      }
    })

    return NextResponse.json(salarySlip)
  } catch (error) {
    console.error('Error saving salary slip:', error)
    return NextResponse.json({
      error: 'Failed to save salary slip',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const staffName = searchParams.get('staffName')

    const salarySlips = await prisma.erpSalarySlip.findMany({
      where: staffName ? { staffName } : undefined,
      orderBy: { month: 'desc' }
    })

    return NextResponse.json(salarySlips)
  } catch (error) {
    console.error('Error fetching salary slips:', error)
    return NextResponse.json({
      error: 'Failed to fetch salary slips',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
