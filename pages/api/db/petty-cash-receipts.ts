import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/db'
import {
  PERSONAL_LEDGER_MARKER,
  PERSONAL_LEDGER_PURPOSE,
  isPersonalLedgerAllocation,
} from '@/lib/petty-cash-personal'
import {
  normalizePettyCashReceiptStatus,
  resolvePettyCashReviewer,
} from '@/lib/petty-cash-receipt-review'
import {
  notifyOnPettyCashPending,
  notifyOnPettyCashReviewed,
} from '@/lib/notifications-server'

function isPersonalLedger(allocation: { notes: string; purpose: string }) {
  return (
    allocation.notes?.includes(PERSONAL_LEDGER_MARKER) ||
    allocation.purpose === PERSONAL_LEDGER_PURPOSE
  )
}

async function ensurePersonalLedger(data: {
  employeeId: string
  employeeName: string
  employeeRole?: string
}) {
  const existing = await prisma.erpPettyCashAllocation.findMany({
    where: { employeeId: data.employeeId, status: 'active' },
  })
  const ledger = existing.find(isPersonalLedger)
  if (ledger) return ledger

  return prisma.erpPettyCashAllocation.create({
    data: {
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      employeeRole: data.employeeRole || 'Employee',
      amount: 0,
      purpose: PERSONAL_LEDGER_PURPOSE,
      notes: PERSONAL_LEDGER_MARKER,
      allocatedBy: data.employeeName,
      status: 'active',
    },
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { allocationId } = req.query

      const listSelect = {
        id: true,
        allocationId: true,
        employeeName: true,
        description: true,
        category: true,
        amount: true,
        receiptProof: true,
        receiptProofName: true,
        notes: true,
        status: true,
        submittedAt: true,
        reviewedBy: true,
        reviewedAt: true,
        reviewNotes: true,
      } as const

      let receipts
      if (allocationId) {
        receipts = await prisma.erpPettyCashReceipt.findMany({
          where: { allocationId: allocationId as string },
          orderBy: { submittedAt: 'desc' },
        })
      } else {
        receipts = await prisma.erpPettyCashReceipt.findMany({
          select: listSelect,
          orderBy: { submittedAt: 'desc' },
        })
      }

      return res.status(200).json(receipts)
    }

    if (req.method === 'POST') {
      const {
        allocationId: bodyAllocationId,
        employeeId,
        employeeName,
        employeeRole,
        description,
        category,
        amount,
        receiptProof,
        receiptProofName,
        notes,
      } = req.body

      if (!employeeName || !description || amount === undefined || amount === null) {
        return res.status(400).json({ error: 'Missing required fields' })
      }
      const expenseCategory =
        typeof category === 'string' && category.trim() ? category.trim() : 'Other'
      const parsedAmount = parseFloat(amount)
      if (!Number.isFinite(parsedAmount) || Math.abs(parsedAmount) < 0.004) {
        return res.status(400).json({ error: 'Amount must be non-zero' })
      }

      let allocation
      if (bodyAllocationId) {
        allocation = await prisma.erpPettyCashAllocation.findUnique({
          where: { id: bodyAllocationId },
        })
        if (!allocation) {
          return res.status(404).json({ error: 'Allocation not found' })
        }
      } else {
        if (!employeeId) {
          return res.status(400).json({ error: 'Employee id is required' })
        }
        allocation = await ensurePersonalLedger({
          employeeId,
          employeeName,
          employeeRole,
        })
      }

      const allocationId = allocation.id

      const acceptsReceipts =
        allocation.status === 'active' ||
        (isPersonalLedgerAllocation(allocation) && allocation.status === 'settled')

      if (!acceptsReceipts) {
        return res.status(400).json({ error: 'This allocation is not accepting new receipts' })
      }

      const receipt = await prisma.erpPettyCashReceipt.create({
        data: {
          allocationId,
          employeeName,
          description,
          category: expenseCategory,
          amount: parsedAmount,
          receiptProof,
          receiptProofName,
          notes: notes || '',
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
        }
      })

      if (receipt.status === 'pending') {
        void notifyOnPettyCashPending(
          employeeName,
          parsedAmount,
          description,
          'receipt',
        )
      }

      return res.status(201).json(receipt)
    }

    if (req.method === 'PUT') {
      const { id, reviewedBy, reviewedById, reviewNotes } = req.body
      const status = normalizePettyCashReceiptStatus(req.body.status)

      if (!id || !status) {
        return res.status(400).json({ error: 'Missing receipt id or valid status' })
      }

      const reviewer = await resolvePettyCashReviewer(reviewedById, reviewedBy)
      if (!reviewer) {
        return res.status(403).json({ error: 'Only admin can approve or reject receipts' })
      }

      if (status === 'approved') {
        const existingReceipt = await prisma.erpPettyCashReceipt.findUnique({ where: { id } })
        if (!existingReceipt) {
          return res.status(404).json({ error: 'Receipt not found' })
        }
        const allocation = await prisma.erpPettyCashAllocation.findUnique({
          where: { id: existingReceipt.allocationId }
        })
        if (!allocation) {
          return res.status(404).json({ error: 'Allocation not found' })
        }
        // Admin may approve into negative balance — employee is owed reimbursement.
      }

      const beforeReceipt = await prisma.erpPettyCashReceipt.findUnique({
        where: { id },
      })

      const receipt = await prisma.erpPettyCashReceipt.update({
        where: { id },
        data: {
          status,
          reviewedBy: status === 'pending' ? null : reviewer.name || reviewedBy || null,
          reviewedAt: status === 'pending' ? null : new Date(),
          reviewNotes: status === 'pending' ? null : reviewNotes || null,
        }
      })

      if (beforeReceipt?.status === 'pending' && (status === 'approved' || status === 'rejected')) {
        const allocation = await prisma.erpPettyCashAllocation.findUnique({
          where: { id: beforeReceipt.allocationId },
          select: { employeeId: true },
        })
        if (allocation?.employeeId) {
          void notifyOnPettyCashReviewed(allocation.employeeId, status === 'approved', 'receipt')
        }
      }

      return res.status(200).json(receipt)
    }

    if (req.method === 'DELETE') {
      const id = req.query.id as string | undefined
      if (!id) {
        return res.status(400).json({ error: 'Missing receipt id' })
      }

      const receipt = await prisma.erpPettyCashReceipt.findUnique({ where: { id } })
      if (!receipt) {
        return res.status(404).json({ error: 'Settlement not found' })
      }

      const allocation = await prisma.erpPettyCashAllocation.findUnique({
        where: { id: receipt.allocationId },
      })
      if (!allocation) {
        return res.status(404).json({ error: 'Allocation not found' })
      }

      await prisma.erpFinanceRecord.updateMany({
        where: { petty_cash_receipt_id: id },
        data: {
          petty_cash_receipt_id: '',
          petty_cash_allocation_id: '',
          petty_cash_label: '',
        },
      })

      await prisma.erpPettyCashReceipt.delete({ where: { id } })

      const remainingReceipts = await prisma.erpPettyCashReceipt.findMany({
        where: {
          allocationId: receipt.allocationId,
          status: { in: ['pending', 'approved'] },
        },
      })
      const approvedTotal = remainingReceipts
        .filter(r => r.status === 'approved')
        .reduce((sum, item) => sum + item.amount, 0)

      let allocationStatus = allocation.status
      let settledAt: Date | null = allocation.settledAt

      if (allocation.status === 'settled' && approvedTotal < allocation.amount - 0.004) {
        allocationStatus = 'active'
        settledAt = null
      } else if (allocation.status === 'active' && approvedTotal >= allocation.amount - 0.004) {
        allocationStatus = 'settled'
        settledAt = new Date()
      }

      if (allocationStatus !== allocation.status || settledAt !== allocation.settledAt) {
        await prisma.erpPettyCashAllocation.update({
          where: { id: receipt.allocationId },
          data: { status: allocationStatus, settledAt },
        })
      }

      return res.status(200).json({
        ok: true,
        allocationId: receipt.allocationId,
        restoredAmount: receipt.status === 'approved' ? receipt.amount : 0,
        allocationStatus,
      })
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
    return res.status(405).end('Method Not Allowed')
  } catch (error) {
    console.error('Petty Cash Receipts API Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
