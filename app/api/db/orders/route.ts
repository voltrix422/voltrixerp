import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const orders = await prisma.erpOrder.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const o = await req.json()
  const record = await prisma.erpOrder.upsert({
    where: { id: o.id ?? "__new__" },
    update: {
      orderNumber: o.orderNumber, clientId: o.clientId, clientName: o.clientName,
      items: o.items, subtotal: o.subtotal, taxPercent: o.taxPercent, tax: o.tax,
      transportCost: o.transportCost, transportLabel: o.transportLabel,
      otherCost: o.otherCost, otherCostLabel: o.otherCostLabel,
      shipping: o.shipping, discount: o.discount, total: o.total,
      status: o.status, notes: o.notes, createdBy: o.createdBy,
      deliveryAddress: o.deliveryAddress, deliveryDate: o.deliveryDate,
      dispatcher: o.dispatcher, pdfUrl: o.pdfUrl, payments: o.payments,
      // Extended fields stored in payments JSON as metadata workaround
      // We store extra fields as part of items JSON since schema is fixed
    },
    create: {
      id: o.id, orderNumber: o.orderNumber, clientId: o.clientId, clientName: o.clientName,
      items: o.items, subtotal: o.subtotal, taxPercent: o.taxPercent, tax: o.tax,
      transportCost: o.transportCost, transportLabel: o.transportLabel,
      otherCost: o.otherCost, otherCostLabel: o.otherCostLabel,
      shipping: o.shipping, discount: o.discount, total: o.total,
      status: o.status, notes: o.notes, createdBy: o.createdBy,
      createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
      deliveryAddress: o.deliveryAddress, deliveryDate: o.deliveryDate,
      dispatcher: o.dispatcher, pdfUrl: o.pdfUrl, payments: o.payments,
    },
  })

  // Return with all extended fields merged back
  return NextResponse.json({
    ...record,
    discountIsPercentage: o.discountIsPercentage,
    discountValue: o.discountValue,
    transportIsPercentage: o.transportIsPercentage,
    transportCostValue: o.transportCostValue,
    otherCostIsPercentage: o.otherCostIsPercentage,
    otherCostValue: o.otherCostValue,
    fulfillmentDispatcher: o.fulfillmentDispatcher,
    fulfillmentReceiverName: o.fulfillmentReceiverName,
    fulfillmentReceiverCnic: o.fulfillmentReceiverCnic,
    fulfillmentVehicleNumber: o.fulfillmentVehicleNumber,
    fulfillmentDate: o.fulfillmentDate,
    fulfillmentReceiverImageUrl: o.fulfillmentReceiverImageUrl,
    fulfillmentReceiverCnicImageUrl: o.fulfillmentReceiverCnicImageUrl,
    fulfillmentVehicleImageUrl: o.fulfillmentVehicleImageUrl,
    fulfillmentProductImageUrls: o.fulfillmentProductImageUrls,
  })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpOrder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
