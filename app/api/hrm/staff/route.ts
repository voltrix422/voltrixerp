import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const AUTO_CREATED_NOTES = "Auto-created from User Accounts for KPI assignment"

export async function GET() {
  // Remove leftover auto-created rows (Manage Users used to spill into Staff).
  await prisma.erpStaff.deleteMany({
    where: {
      OR: [
        { notes: AUTO_CREATED_NOTES },
        { createdBy: "system", notes: { contains: "Auto-created from User Accounts" } },
      ],
    },
  })

  const staff = await prisma.erpStaff.findMany({
    where: {
      NOT: {
        OR: [
          { notes: AUTO_CREATED_NOTES },
          { createdBy: "system", notes: { contains: "Auto-created from User Accounts" } },
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(staff.map(mapToFrontend))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const staff = await (prisma.erpStaff.create as any)({ data: mapToDB(body) })
    return NextResponse.json(mapToFrontend(staff))
  } catch (error) {
    console.error('Error creating staff:', error)
    return NextResponse.json({ error: 'Failed to create staff', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const staff = await (prisma.erpStaff.update as any)({
      where: { id },
      data: mapToDB(rest),
    })
    return NextResponse.json(mapToFrontend(staff))
  } catch (error) {
    console.error('Error in HRM PUT endpoint:', error)
    return NextResponse.json({ error: 'Failed to update staff member', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.erpStaff.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// Map frontend/form keys → Prisma model keys
function mapToDB(data: Record<string, any>) {
  const mapped: Record<string, any> = {}

  if (data.name !== undefined)        mapped.name = data.name
  if (data.role !== undefined)        mapped.role = data.role
  if (data.department !== undefined)  mapped.department = data.department
  if (data.email !== undefined)       mapped.email = data.email ?? ''
  if (data.phone !== undefined)       mapped.phone = data.phone ?? ''
  if (data.address !== undefined)     mapped.address = data.address ?? ''
  if (data.salary !== undefined)      mapped.salary = parseFloat(data.salary) || 0
  const employmentType = data.employmentType ?? data.employment_type
  if (employmentType !== undefined)   mapped.employmentType = String(employmentType || "Permanent")
  const basicSalary = data.basicSalary ?? data.basic_salary
  if (basicSalary !== undefined)      mapped.basicSalary = parseFloat(basicSalary) || 0
  const medicalAllowance = data.medicalAllowance ?? data.medical_allowance
  if (medicalAllowance !== undefined) mapped.medicalAllowance = parseFloat(medicalAllowance) || 0
  const medicalEnabled = data.medicalEnabled ?? data.medical_enabled
  if (medicalEnabled !== undefined)   mapped.medicalEnabled = Boolean(medicalEnabled)
  const taxAmount = data.taxAmount ?? data.tax_amount
  if (taxAmount !== undefined)        mapped.taxAmount = parseFloat(taxAmount) || 0
  const taxEnabled = data.taxEnabled ?? data.tax_enabled
  if (taxEnabled !== undefined)       mapped.taxEnabled = Boolean(taxEnabled)
  const eobiAmount = data.eobiAmount ?? data.eobi_amount
  if (eobiAmount !== undefined)       mapped.eobiAmount = parseFloat(eobiAmount) || 0
  const eobiEnabled = data.eobiEnabled ?? data.eobi_enabled
  if (eobiEnabled !== undefined)      mapped.eobiEnabled = Boolean(eobiEnabled)
  const customAllowances = data.customAllowances ?? data.custom_allowances
  if (customAllowances !== undefined) mapped.customAllowances = Array.isArray(customAllowances) ? customAllowances : []
  const customDeductions = data.customDeductions ?? data.custom_deductions
  if (customDeductions !== undefined) mapped.customDeductions = Array.isArray(customDeductions) ? customDeductions : []
  if (data.currency !== undefined)    mapped.currency = data.currency
  if (data.status !== undefined)      mapped.status = data.status
  if (data.notes !== undefined)       mapped.notes = data.notes ?? ''
  if (data.points !== undefined)      mapped.points = data.points
  if (data.warnings !== undefined)    mapped.warnings = data.warnings

  // Join date — handle both camelCase and snake_case
  const joinDate = data.joinDate ?? data.join_date
  if (joinDate !== undefined) mapped.joinDate = joinDate ?? ''

  // Created by/at
  const createdBy = data.createdBy ?? data.created_by
  if (createdBy !== undefined) mapped.createdBy = createdBy

  const createdAt = data.createdAt ?? data.created_at
  if (createdAt !== undefined) mapped.createdAt = new Date(createdAt)

  // lastReset
  const lastReset = data.lastReset ?? data.last_reset
  if (lastReset !== undefined) mapped.lastReset = new Date(lastReset)

  // Bank details — handle both snake_case (from form) and camelCase
  const bankName = data.bankName ?? data.bank_name
  if (bankName !== undefined) mapped.bankName = bankName ?? ''

  const bankAccountNumber = data.bankAccountNumber ?? data.bank_account_number
  if (bankAccountNumber !== undefined) mapped.bankAccountNumber = bankAccountNumber ?? ''

  const bankAccountTitle = data.bankAccountTitle ?? data.bank_account_title
  if (bankAccountTitle !== undefined) mapped.bankAccountTitle = bankAccountTitle ?? ''

  const erpUserId = data.erpUserId ?? data.erp_user_id
  if (erpUserId !== undefined) mapped.erpUserId = erpUserId || null

  return mapped
}

// Map Prisma model → frontend snake_case keys (consistent with existing code)
function mapToFrontend(s: any) {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    department: s.department,
    email: s.email,
    phone: s.phone,
    address: s.address,
    salary: s.salary,
    employment_type: s.employmentType || "Permanent",
    basic_salary: s.basicSalary ?? 0,
    medical_allowance: s.medicalAllowance ?? 0,
    medical_enabled: Boolean(s.medicalEnabled),
    tax_amount: s.taxAmount ?? 0,
    tax_enabled: Boolean(s.taxEnabled),
    eobi_amount: s.eobiAmount ?? 0,
    eobi_enabled: Boolean(s.eobiEnabled),
    custom_allowances: Array.isArray(s.customAllowances) ? s.customAllowances : [],
    custom_deductions: Array.isArray(s.customDeductions) ? s.customDeductions : [],
    currency: s.currency,
    join_date: s.joinDate,
    status: s.status,
    notes: s.notes,
    points: s.points,
    warnings: s.warnings,
    last_reset: s.lastReset,
    created_by: s.createdBy,
    created_at: s.createdAt,
    bank_name: s.bankName ?? '',
    bank_account_number: s.bankAccountNumber ?? '',
    bank_account_title: s.bankAccountTitle ?? '',
    erp_user_id: s.erpUserId ?? null,
  }
}
