import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function fulfillmentData(o: Record<string, unknown>) {
  return {
    fulfillmentDispatcher: (o.fulfillmentDispatcher as string | undefined) ?? null,
    fulfillmentReceiverName: (o.fulfillmentReceiverName as string | undefined) ?? null,
    fulfillmentReceiverCnic: (o.fulfillmentReceiverCnic as string | undefined) ?? null,
    fulfillmentVehicleNumber: (o.fulfillmentVehicleNumber as string | undefined) ?? null,
    fulfillmentDate: (o.fulfillmentDate as string | undefined) ?? null,
    fulfillmentReceiverImageUrl: (o.fulfillmentReceiverImageUrl as string | undefined) ?? null,
    fulfillmentReceiverCnicImageUrl: (o.fulfillmentReceiverCnicImageUrl as string | undefined) ?? null,
    fulfillmentVehicleImageUrl: (o.fulfillmentVehicleImageUrl as string | undefined) ?? null,
    fulfillmentProductImageUrls: (o.fulfillmentProductImageUrls as string[] | undefined) ?? [],
  }
}

export async function GET() {
  const orders = await prisma.erpOrder.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const o = await req.json()
  const fulfillment = fulfillmentData(o)
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
      dispatcher: o.dispatcher, pdfUrl: o.pdfUrl, payments: o.payments, ownerUserId: o.ownerUserId,
      ...fulfillment,
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
      dispatcher: o.dispatcher, pdfUrl: o.pdfUrl, payments: o.payments, ownerUserId: o.ownerUserId,
      ...fulfillment,
    },
  })

  return NextResponse.json({
    ...record,
    discountIsPercentage: o.discountIsPercentage,
    discountValue: o.discountValue,
    transportIsPercentage: o.transportIsPercentage,
    transportCostValue: o.transportCostValue,
    otherCostIsPercentage: o.otherCostIsPercentage,
    otherCostValue: o.otherCostValue,
  })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpOrder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
