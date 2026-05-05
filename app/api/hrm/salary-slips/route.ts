import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('Saving salary slip:', body)
    
    const {
      staffName,
      staffRole,
      staffDepartment,
      month,
      baseSalary,
      currency,
      adjustments,
      netSalary,
      generatedDate
    } = body

    // Create salary slip record
    const salarySlip = await prisma.erpSalarySlip.create({
      data: {
        staffName,
        staffRole,
        staffDepartment,
        month,
        baseSalary,
        currency,
        adjustments: adjustments || [],
        netSalary,
        generatedDate: new Date(generatedDate),
        createdAt: new Date()
      }
    })
    
    console.log('Salary slip saved:', salarySlip)
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
    
    let salarySlips
    if (staffName) {
      salarySlips = await prisma.erpSalarySlip.findMany({
        where: { staffName },
        orderBy: { month: 'desc' }
      })
    } else {
      salarySlips = await prisma.erpSalarySlip.findMany({
        orderBy: { month: 'desc' }
      })
    }
    
    return NextResponse.json(salarySlips)
  } catch (error) {
    console.error('Error fetching salary slips:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch salary slips', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
