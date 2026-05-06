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
        notes
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

      const receipt = await prisma.erpPettyCashReceipt.create({
        data: {
          allocationId,
          employeeName,
          description,
          amount: parsedAmount,
          receiptProof,
          receiptProofName,
          notes: notes || ''
        }
      })

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

    res.setHeader('Allow', ['GET', 'POST', 'PUT'])
    return res.status(405).end('Method Not Allowed')
  } catch (error) {
    console.error('Petty Cash Receipts API Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
