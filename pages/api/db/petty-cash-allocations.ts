import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/db'
import { appendPettyCashTopUpNote } from '@/lib/petty-cash-topup'
import { isPersonalLedgerAllocation } from '@/lib/petty-cash-personal'
import {
  notifyOnPettyCashPending,
  notifyOnPettyCashReviewed,
} from '@/lib/notifications-server'

const ALLOCATION_LIST_SELECT = {
  id: true,
  employeeId: true,
  employeeName: true,
  employeeRole: true,
  amount: true,
  purpose: true,
  payoutMethod: true,
  notes: true,
  status: true,
  allocatedBy: true,
  allocatedAt: true,
  settledAt: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNotes: true,
} as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const allocations = await prisma.erpPettyCashAllocation.findMany({
        select: ALLOCATION_LIST_SELECT,
        orderBy: { allocatedAt: 'desc' }
      })
      return res.status(200).json(allocations)
    }

    if (req.method === 'POST') {
      const {
        employeeId,
        employeeName,
        employeeRole,
        amount,
        purpose,
        paymentProof,
        paymentProofName,
        payoutMethod,
        notes,
        allocatedBy,
        status,
      } = req.body

      if (!employeeId || !employeeName || !employeeRole || !amount || !purpose || !allocatedBy) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const allocationStatus = status || 'active'
      const allocation = await prisma.erpPettyCashAllocation.create({
        data: {
          employeeId,
          employeeName,
          employeeRole,
          amount: parseFloat(amount),
          purpose,
          payoutMethod,
          paymentProof,
          paymentProofName,
          notes: notes || '',
          allocatedBy,
          status: allocationStatus,
        }
      })

      if (allocationStatus === 'pending') {
        void notifyOnPettyCashPending(
          employeeName,
          parseFloat(amount),
          purpose,
          'allocation',
        )
      }

      return res.status(201).json(allocation)
    }

    if (req.method === 'PUT') {
      const {
        id,
        status,
        settledAt,
        amount,
        paymentProof,
        paymentProofName,
        payoutMethod,
        notes,
        reviewedBy,
        reviewedAt,
        reviewNotes,
        topUpAmount,
        topUpBy,
        topUpNote,
        topUpProof,
        topUpProofName,
      } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Missing allocation ID' })
      }

      if (topUpAmount !== undefined) {
        const before = await prisma.erpPettyCashAllocation.findUnique({ where: { id } })
        if (!before) {
          return res.status(404).json({ error: 'Allocation not found' })
        }
        if (before.status !== 'active') {
          return res.status(400).json({ error: 'Can only add cash to an active petty cash allocation' })
        }

        const addAmount = parseFloat(String(topUpAmount))
        if (!Number.isFinite(addAmount) || addAmount <= 0) {
          return res.status(400).json({ error: 'Top-up amount must be greater than zero' })
        }

        const actor = String(topUpBy || 'Admin').trim() || 'Admin'
        const allocation = await prisma.erpPettyCashAllocation.update({
          where: { id },
          data: {
            amount: before.amount + addAmount,
            notes: appendPettyCashTopUpNote(before.notes || '', {
              at: new Date().toISOString(),
              amount: addAmount,
              by: actor,
              note: String(topUpNote || '').trim() || undefined,
              proofUrl: topUpProof || undefined,
              proofName: topUpProofName || undefined,
            }),
          },
        })

        return res.status(200).json(allocation)
      }

      const before = await prisma.erpPettyCashAllocation.findUnique({ where: { id } })

      const allocation = await prisma.erpPettyCashAllocation.update({
        where: { id },
        data: {
          status,
          settledAt: settledAt ? new Date(settledAt) : undefined,
          amount: amount !== undefined ? parseFloat(amount) : undefined,
          payoutMethod,
          paymentProof: paymentProof === undefined ? undefined : paymentProof,
          paymentProofName: paymentProofName === undefined ? undefined : paymentProofName,
          notes,
          reviewedBy,
          reviewedAt: reviewedAt ? new Date(reviewedAt) : undefined,
          reviewNotes,
        }
      })

      if (before && before.status === 'pending' && status === 'active') {
        void notifyOnPettyCashReviewed(before.employeeId, true, 'allocation')
      }
      if (before && before.status === 'pending' && status === 'rejected') {
        void notifyOnPettyCashReviewed(before.employeeId, false, 'allocation')
      }

      return res.status(200).json(allocation)
    }

    if (req.method === "DELETE") {
      const { id } = req.query
      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Missing allocation ID" })
      }

      await prisma.erpPettyCashReceipt.deleteMany({
        where: { allocationId: id }
      })

      await prisma.erpPettyCashAllocation.delete({
        where: { id }
      })

      return res.status(200).json({ success: true })
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
    return res.status(405).end('Method Not Allowed')
  } catch (error) {
    console.error('Petty Cash API Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
