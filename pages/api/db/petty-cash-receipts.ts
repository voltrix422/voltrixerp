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

      const receipt = await prisma.erpPettyCashReceipt.create({
        data: {
          allocationId,
          employeeName,
          description,
          amount: parseFloat(amount),
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
