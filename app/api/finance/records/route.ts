import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const records = await prisma.erpFinanceRecord.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    petty_cash_allocation_id: pettyCashAllocationId = '',
    ...recordData
  } = body as Record<string, unknown> & { petty_cash_allocation_id?: string }

  let petty_cash_receipt_id = ''
  let petty_cash_label = ''

  if (pettyCashAllocationId) {
    const allocation = await prisma.erpPettyCashAllocation.findUnique({
      where: { id: pettyCashAllocationId },
    })

    if (!allocation) {
      return NextResponse.json({ error: 'Petty cash allocation not found' }, { status: 404 })
    }
    if (allocation.status !== 'active') {
      return NextResponse.json({ error: 'Selected petty cash is not active' }, { status: 400 })
    }

    const parsedAmount = Number(recordData.amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const existing = await prisma.erpPettyCashReceipt.findMany({
      where: {
        allocationId: pettyCashAllocationId,
        status: { in: ['pending', 'approved'] },
      },
    })
    const usedAmount = existing.reduce((sum, item) => sum + item.amount, 0)
    const remaining = allocation.amount - usedAmount

    if (parsedAmount > remaining + 0.004) {
      return NextResponse.json(
        { error: `Amount exceeds petty cash remaining (PKR ${Math.max(0, remaining).toLocaleString()})` },
        { status: 400 }
      )
    }

    const createdBy = String(recordData.created_by || 'Finance')
    const description = String(recordData.title || recordData.purpose || 'Finance record')

    const receipt = await prisma.erpPettyCashReceipt.create({
      data: {
        allocationId: pettyCashAllocationId,
        employeeName: allocation.employeeName,
        description,
        amount: parsedAmount,
        receiptProof: String(recordData.proof_url || '') || null,
        receiptProofName: String(recordData.proof_name || '') || null,
        notes: String(recordData.notes || ''),
        status: 'approved',
        reviewedBy: createdBy,
        reviewedAt: new Date(),
      },
    })

    petty_cash_receipt_id = receipt.id
    petty_cash_label = `${allocation.employeeName} — ${allocation.purpose}`

    const newUsed = usedAmount + parsedAmount
    if (newUsed >= allocation.amount - 0.004) {
      await prisma.erpPettyCashAllocation.update({
        where: { id: pettyCashAllocationId },
        data: { status: 'settled', settledAt: new Date() },
      })
    }
  }

  const record = await prisma.erpFinanceRecord.create({
    data: {
      title: String(recordData.title),
      amount: Number(recordData.amount),
      currency: String(recordData.currency),
      purpose: String(recordData.purpose || ''),
      category: String(recordData.category),
      tag: String(recordData.tag || ''),
      supplier_name: String(recordData.supplier_name || ''),
      receipt_person_name: String(recordData.receipt_person_name || ''),
      petty_cash_allocation_id: pettyCashAllocationId,
      petty_cash_receipt_id,
      petty_cash_label,
      proof_url: String(recordData.proof_url || ''),
      proof_name: String(recordData.proof_name || ''),
      notes: String(recordData.notes || ''),
      created_by: String(recordData.created_by || 'Unknown'),
    },
  })

  return NextResponse.json(record)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.erpFinanceRecord.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
