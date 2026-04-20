import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const pos = await prisma.erpPurchaseOrder.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(pos)
}

export async function POST(req: NextRequest) {
  try {
    const po = await req.json()
    console.log('📝 Saving PO:', po.id, 'with flowHistory length:', po.flowHistory?.length)
    console.log('📝 FlowHistory:', JSON.stringify(po.flowHistory, null, 2))
    
    const existing = await prisma.erpPurchaseOrder.findUnique({ where: { id: po.id } })
    console.log('🔍 Existing PO found:', !!existing, 'current flowHistory length:', existing?.flowHistory ? (existing.flowHistory as any).length : 0)
    
    let record
    if (existing) {
      console.log('🔄 Updating existing PO')
      record = await prisma.erpPurchaseOrder.update({
        where: { id: po.id },
        data: {
          poNumber: po.poNumber, type: po.type, supplierIds: po.supplierIds,
          supplierNames: po.supplierNames, items: po.items, notes: po.notes,
          status: po.status, createdBy: po.createdBy, adminNote: po.adminNote,
          sentToSupplier: po.sentToSupplier, deliveryDate: po.deliveryDate,
          receivingLocation: po.receivingLocation, suppliersSent: po.suppliersSent,
          quotes: po.quotes, finalizedSupplierId: po.finalizedSupplierId,
          payments: po.payments, paymentAmount: po.paymentAmount,
          paymentMethod: po.paymentMethod, paymentDate: po.paymentDate,
          paymentProof: po.paymentProof, paymentNotes: po.paymentNotes,
          adminDocuments: po.adminDocuments, financeDocuments1: po.financeDocuments1,
          purchaseDocuments: po.purchaseDocuments, financeDocuments2: po.financeDocuments2,
          pssid: po.pssid, importedSupplierName: po.importedSupplierName,
          importedItems: po.importedItems, flowHistory: po.flowHistory,
        },
      })
    } else {
      console.log('➕ Creating new PO')
      record = await prisma.erpPurchaseOrder.create({
        data: {
          id: po.id, poNumber: po.poNumber, type: po.type, supplierIds: po.supplierIds,
          supplierNames: po.supplierNames, items: po.items, notes: po.notes,
          status: po.status, createdBy: po.createdBy,
          createdAt: po.createdAt ? new Date(po.createdAt) : undefined,
          adminNote: po.adminNote, sentToSupplier: po.sentToSupplier,
          deliveryDate: po.deliveryDate, receivingLocation: po.receivingLocation,
          suppliersSent: po.suppliersSent, quotes: po.quotes,
          finalizedSupplierId: po.finalizedSupplierId, payments: po.payments,
          paymentAmount: po.paymentAmount, paymentMethod: po.paymentMethod,
          paymentDate: po.paymentDate, paymentProof: po.paymentProof,
          paymentNotes: po.paymentNotes, adminDocuments: po.adminDocuments,
          financeDocuments1: po.financeDocuments1, purchaseDocuments: po.purchaseDocuments,
          financeDocuments2: po.financeDocuments2, pssid: po.pssid,
          importedSupplierName: po.importedSupplierName, importedItems: po.importedItems,
          flowHistory: po.flowHistory,
        },
      })
    }
    
    console.log('✅ PO saved, returned flowHistory length:', record.flowHistory ? (record.flowHistory as any).length : 0)
    return NextResponse.json(record)
  } catch (error) {
    console.error('❌ Error saving PO:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  
  // Get the PO to find its poNumber
  const po = await prisma.erpPurchaseOrder.findUnique({ where: { id } })
  if (!po) {
    return NextResponse.json({ error: "PO not found" }, { status: 404 })
  }
  
  // Delete all inventory items with this poNumber
  await prisma.erpInventoryStock.deleteMany({
    where: { poNumber: po.poNumber }
  })
  
  // Delete the PO
  await prisma.erpPurchaseOrder.delete({ where: { id } })
  
  return NextResponse.json({ ok: true })
}
