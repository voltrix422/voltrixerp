import { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { allocationId } = req.query
      
      let receipts
      if (allocationId) {
        receipts = await prisma.erpPettyCashReceipt.findMany({
          where: { allocationId: allocationId as string },
          orderBy: { submittedAt: 'desc' }
        })
      } else {
        receipts = await prisma.erpPettyCashReceipt.findMany({
          orderBy: { submittedAt: 'desc' }
        })
      }
      
      return res.status(200).json(receipts)
    }

    if (req.method === 'POST') {
      const {
        allocationId,
        employeeName,
        description,
        amount,
        receiptProof,
        receiptProofName,
        notes,
        selfSubmit,
        submittedBy,
      } = req.body

      if (!allocationId || !employeeName || !description || !amount) {
        return res.status(400).json({ error: 'Missing required fields' })
      }
      const parsedAmount = parseFloat(amount)
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' })
      }

      const allocation = await prisma.erpPettyCashAllocation.findUnique({
        where: { id: allocationId }
      })
      if (!allocation) {
        return res.status(404).json({ error: 'Allocation not found' })
      }
      if (allocation.status !== 'active') {
        return res.status(400).json({ error: 'Allocation is not active' })
      }

      const existing = await prisma.erpPettyCashReceipt.findMany({
        where: {
          allocationId,
          status: { in: ['pending', 'approved'] }
        }
      })
      const usedAmount = existing.reduce((sum, item) => sum + item.amount, 0)
      if (usedAmount + parsedAmount > allocation.amount) {
        const remaining = Math.max(allocation.amount - usedAmount, 0)
        return res.status(400).json({ error: `Settlement exceeds remaining balance. Remaining: PKR ${remaining.toLocaleString()}` })
      }

      const autoApprove = selfSubmit === true
      const reviewer = String(submittedBy || employeeName || '').trim()

      const receipt = await prisma.erpPettyCashReceipt.create({
        data: {
          allocationId,
          employeeName,
          description,
          amount: parsedAmount,
          receiptProof,
          receiptProofName,
          notes: notes || '',
          status: autoApprove ? 'approved' : 'pending',
          reviewedBy: autoApprove ? reviewer || employeeName : null,
          reviewedAt: autoApprove ? new Date() : null,
        }
      })

      if (autoApprove) {
        const approvedRows = await prisma.erpPettyCashReceipt.findMany({
          where: { allocationId, status: 'approved' },
        })
        const approvedTotal = approvedRows.reduce((sum, item) => sum + item.amount, 0)
        if (approvedTotal >= allocation.amount - 0.004) {
          await prisma.erpPettyCashAllocation.update({
            where: { id: allocationId },
            data: { status: 'settled', settledAt: new Date() },
          })
        }
      }

      return res.status(201).json(receipt)
    }

    if (req.method === 'PUT') {
      const { id, status, reviewedBy, reviewNotes } = req.body

      if (!id || !status || !reviewedBy) {
        return res.status(400).json({ error: 'Missing required fields' })
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
        const approvedReceipts = await prisma.erpPettyCashReceipt.findMany({
          where: {
            allocationId: existingReceipt.allocationId,
            status: 'approved',
            id: { not: id }
          }
        })
        const approvedAmount = approvedReceipts.reduce((sum, item) => sum + item.amount, 0)
        if (approvedAmount + existingReceipt.amount > allocation.amount) {
          const remaining = Math.max(allocation.amount - approvedAmount, 0)
          return res.status(400).json({ error: `Approval exceeds allocation. Remaining approvable: PKR ${remaining.toLocaleString()}` })
        }
      }

      const receipt = await prisma.erpPettyCashReceipt.update({
        where: { id },
        data: {
          status,
          reviewedBy,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null
        }
      })

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
