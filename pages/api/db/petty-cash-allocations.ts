import { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const allocations = await prisma.erpPettyCashAllocation.findMany({
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
        notes,
        allocatedBy
      } = req.body

      if (!employeeId || !employeeName || !employeeRole || !amount || !purpose || !allocatedBy) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const allocation = await prisma.erpPettyCashAllocation.create({
        data: {
          employeeId,
          employeeName,
          employeeRole,
          amount: parseFloat(amount),
          purpose,
          paymentProof,
          paymentProofName,
          notes: notes || '',
          allocatedBy
        }
      })

      return res.status(201).json(allocation)
    }

    if (req.method === 'PUT') {
      const { id, status, settledAt } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Missing allocation ID' })
      }

      const allocation = await prisma.erpPettyCashAllocation.update({
        where: { id },
        data: {
          status,
          settledAt: settledAt ? new Date(settledAt) : null
        }
      })

      return res.status(200).json(allocation)
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT'])
    return res.status(405).end('Method Not Allowed')
  } catch (error) {
    console.error('Petty Cash API Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
