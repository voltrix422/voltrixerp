import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  deductInventoryForOrderServer,
  orderNeedsInventoryDeductionServer,
  restoreInventoryForOrderServer,
  orderMayNeedInventoryRestore,
  type OrderDeductInput,
} from "@/lib/inventory-order-deduct-server"
import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"
import {
  generateNextOrderNumber,
  repairDuplicateOrderNumbers,
} from "@/lib/order-number-server"

function toOrderDeductInput(record: {
  id: string
  orderNumber: string
  clientName: string
  createdBy: string | null
  status: string
  dispatcher: string | null
  fulfillmentDispatcher: string | null
  inventoryDeductedAt: string | null
  fulfillmentSerialAllocations: unknown
  items: unknown
}): OrderDeductInput {
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    clientName: record.clientName,
    createdBy: record.createdBy ?? undefined,
    status: record.status,
    dispatcher: record.dispatcher,
    fulfillmentDispatcher: record.fulfillmentDispatcher,
    inventoryDeductedAt: record.inventoryDeductedAt,
    fulfillmentSerialAllocations: Array.isArray(record.fulfillmentSerialAllocations)
      ? (record.fulfillmentSerialAllocations as OrderFulfillmentSerialAllocation[])
      : [],
    items: Array.isArray(record.items) ? (record.items as OrderDeductInput["items"]) : [],
  }
}

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
    fulfillmentSerialAllocations:
      (o.fulfillmentSerialAllocations as Prisma.InputJsonValue | undefined) ?? [],
    inventoryDeductedAt: (o.inventoryDeductedAt as string | undefined) ?? null,
  }
}

export async function GET() {
  await repairDuplicateOrderNumbers()
  const orders = await prisma.erpOrder.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const o = await req.json()
  const fulfillment = fulfillmentData(o)
  const orderId = String(o.id ?? "").trim()
  const existing = orderId
    ? await prisma.erpOrder.findUnique({ where: { id: orderId }, select: { id: true } })
    : null

  let orderNumber = String(o.orderNumber ?? "").trim()
  if (!existing) {
    orderNumber = await generateNextOrderNumber()
  } else if (!orderNumber) {
    orderNumber = (await prisma.erpOrder.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    }))?.orderNumber ?? (await generateNextOrderNumber())
  }

  const record = await prisma.erpOrder.upsert({
    where: { id: orderId || "__new__" },
    update: {
      orderNumber, clientId: o.clientId, clientName: o.clientName,
      items: o.items, subtotal: o.subtotal, taxPercent: o.taxPercent, tax: o.tax,
      transportCost: o.transportCost, transportLabel: o.transportLabel,
      otherCost: o.otherCost, otherCostLabel: o.otherCostLabel,
      shipping: o.shipping, discount: o.discount, total: o.total,
      status: o.status, notes: o.notes, createdBy: o.createdBy,
      deliveryAddress: o.deliveryAddress, deliveryDate: o.deliveryDate,
      dispatcher: o.dispatcher, pdfUrl: o.pdfUrl, payments: o.payments, ownerUserId: o.ownerUserId,
      salesAgentCommissionPercent: o.salesAgentCommissionPercent ?? null,
      salesAgentCommissionAmount: o.salesAgentCommissionAmount ?? null,
      paymentTerms: o.paymentTerms ?? "full",
      creditApprovedAt: o.creditApprovedAt ?? null,
      creditApprovedBy: o.creditApprovedBy ?? null,
      creditNote: o.creditNote ?? null,
      ...fulfillment,
    },
    create: {
      id: o.id, orderNumber, clientId: o.clientId, clientName: o.clientName,
      items: o.items, subtotal: o.subtotal, taxPercent: o.taxPercent, tax: o.tax,
      transportCost: o.transportCost, transportLabel: o.transportLabel,
      otherCost: o.otherCost, otherCostLabel: o.otherCostLabel,
      shipping: o.shipping, discount: o.discount, total: o.total,
      status: o.status, notes: o.notes, createdBy: o.createdBy,
      createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
      deliveryAddress: o.deliveryAddress, deliveryDate: o.deliveryDate,
      dispatcher: o.dispatcher, pdfUrl: o.pdfUrl, payments: o.payments, ownerUserId: o.ownerUserId,
      salesAgentCommissionPercent: o.salesAgentCommissionPercent ?? null,
      salesAgentCommissionAmount: o.salesAgentCommissionAmount ?? null,
      paymentTerms: o.paymentTerms ?? "full",
      creditApprovedAt: o.creditApprovedAt ?? null,
      creditApprovedBy: o.creditApprovedBy ?? null,
      creditNote: o.creditNote ?? null,
      ...fulfillment,
    },
  })

  let responseRecord = record

  if (record.status === "delivered") {
    const deductInput = toOrderDeductInput(record)
    try {
      const needsDeduction = await orderNeedsInventoryDeductionServer(deductInput)
      if (needsDeduction) {
        const result = await deductInventoryForOrderServer(deductInput)
        if (result.success || result.alreadyDeducted) {
          const inventoryDeductedAt =
            record.inventoryDeductedAt ?? new Date().toISOString()
          responseRecord = await prisma.erpOrder.update({
            where: { id: record.id },
            data: { inventoryDeductedAt },
          })
        }
      }
    } catch (err) {
      console.error("[orders POST] inventory deduction failed:", err)
    }
  }

  return NextResponse.json({
    ...responseRecord,
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
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const record = await prisma.erpOrder.findUnique({ where: { id } })
  if (record) {
    const order: OrderDeductInput = {
      id: record.id,
      orderNumber: record.orderNumber,
      clientName: record.clientName,
      createdBy: record.createdBy ?? undefined,
      status: record.status,
      dispatcher: record.dispatcher,
      fulfillmentDispatcher: record.fulfillmentDispatcher,
      inventoryDeductedAt: record.inventoryDeductedAt,
      fulfillmentSerialAllocations: Array.isArray(record.fulfillmentSerialAllocations)
        ? (record.fulfillmentSerialAllocations as OrderFulfillmentSerialAllocation[])
        : [],
      items: Array.isArray(record.items)
        ? (record.items as OrderDeductInput["items"])
        : [],
    }
    if (orderMayNeedInventoryRestore(order)) {
      try {
        await restoreInventoryForOrderServer(order)
      } catch (err) {
        console.error("[orders DELETE] inventory restore failed:", err)
        return NextResponse.json(
          { error: "Could not restore inventory for this order. Order was not deleted." },
          { status: 500 },
        )
      }
    }
  }

  await prisma.erpOrder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
