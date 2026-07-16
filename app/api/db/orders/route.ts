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
import {
  deductBranchStockForPosOrder,
  isBranchPosOrderSource,
  restoreBranchStockForPosOrder,
} from "@/lib/branch-pos-order-stock-server"
import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"
import { generateNextOrderNumber } from "@/lib/order-number-server"
import { notifyOnOrderStatusChange } from "@/lib/notifications-server"
import {
  APPROVED_ORDER_STATUSES,
  PENDING_APPROVAL_STATUS,
} from "@/lib/order-approval-statuses"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const statusGroup = searchParams.get("statusGroup")
  const branchId = searchParams.get("branchId")
  const source = searchParams.get("source")

  let where: Record<string, unknown> | undefined
  if (status) {
    where = { status }
  } else if (statusGroup === "pending") {
    where = { status: PENDING_APPROVAL_STATUS }
  } else if (statusGroup === "approved") {
    where = { status: { in: [...APPROVED_ORDER_STATUSES] } }
  }
  if (branchId) {
    where = { ...(where || {}), branchId }
  }
  if (source) {
    where = { ...(where || {}), source }
  }

  const orders = await prisma.erpOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: statusGroup === "approved" ? 150 : undefined,
  })
  return NextResponse.json(orders)
}

function toOrderDeductInput(record: {
  id: string
  orderNumber: string
  clientName: string
  createdBy: string | null
  status: string
  dispatcher: string | null
  fulfillmentDispatcher: string | null
  inventoryDeductedAt: string | null
  source?: string | null
  branchId?: string | null
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
    source: record.source ?? null,
    branchId: record.branchId ?? null,
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

export async function POST(req: NextRequest) {
  const o = await req.json()
  const fulfillment = fulfillmentData(o)
  const orderId = String(o.id ?? "").trim()
  const existing = orderId
    ? await prisma.erpOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          inventoryDeductedAt: true,
          inventoryReturnedAt: true,
          source: true,
          branchId: true,
        },
      })
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

  const branchId = (o.branchId as string | undefined)?.trim() || existing?.branchId || null
  const source =
    (o.source as string | undefined)?.trim() ||
    existing?.source ||
    null

  const needsBranchPosDeduct =
    isBranchPosOrderSource(source) &&
    !!branchId &&
    String(o.status || "").toLowerCase() === "delivered" &&
    !existing?.inventoryDeductedAt

  const becomingReturned =
    String(o.status || "").toLowerCase() === "returned" &&
    !!existing &&
    existing.status !== "returned" &&
    !existing.inventoryReturnedAt

  // Restore stock before marking returned so a failed restore never leaves a half-saved return.
  if (becomingReturned) {
    const fullExisting = await prisma.erpOrder.findUnique({ where: { id: orderId } })
    if (fullExisting) {
      const deductInput = toOrderDeductInput(fullExisting)
      try {
        if (isBranchPosOrderSource(fullExisting.source) && fullExisting.branchId) {
          await restoreBranchStockForPosOrder({
            id: fullExisting.id,
            orderNumber: fullExisting.orderNumber,
            clientName: fullExisting.clientName,
            createdBy: fullExisting.createdBy ?? undefined,
            branchId: fullExisting.branchId,
            items: Array.isArray(fullExisting.items)
              ? (fullExisting.items as OrderDeductInput["items"])
              : [],
          })
        } else if (orderMayNeedInventoryRestore(deductInput)) {
          await restoreInventoryForOrderServer(deductInput, {
            historyNotes: `Returned from order · ${fullExisting.clientName} · stock restored`,
          })
        }
        o.inventoryReturnedAt = o.inventoryReturnedAt || new Date().toISOString()
        o.inventoryDeductedAt = null
        fulfillment.inventoryDeductedAt = null
      } catch (err) {
        console.error("[orders POST] inventory restore on return failed:", err)
        return NextResponse.json(
          { error: "Could not restore inventory for this return. Order was not marked returned." },
          { status: 500 },
        )
      }
    }
  }

  try {
    const record = await prisma.$transaction(async (tx) => {
      const saved = await tx.erpOrder.upsert({
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
          returnedAt: o.returnedAt ?? null,
          returnedBy: o.returnedBy ?? null,
          returnReason: o.returnReason ?? "",
          inventoryReturnedAt: o.inventoryReturnedAt ?? null,
          returnPayments: o.returnPayments ?? [],
          branchId,
          source,
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
          returnedAt: o.returnedAt ?? null,
          returnedBy: o.returnedBy ?? null,
          returnReason: o.returnReason ?? "",
          inventoryReturnedAt: o.inventoryReturnedAt ?? null,
          returnPayments: o.returnPayments ?? [],
          branchId,
          source,
          ...fulfillment,
        },
      })

      // Branch POS: deduct stock only when delivered (not on create).
      if (needsBranchPosDeduct && !saved.inventoryDeductedAt) {
        const { deductedAt } = await deductBranchStockForPosOrder(
          {
            id: saved.id,
            orderNumber: saved.orderNumber,
            clientName: saved.clientName,
            createdBy: saved.createdBy,
            branchId: branchId!,
            items: Array.isArray(o.items) ? o.items : [],
          },
          tx,
        )
        return tx.erpOrder.update({
          where: { id: saved.id },
          data: { inventoryDeductedAt: deductedAt },
        })
      }

      return saved
    })

    let responseRecord = record

    // Warehouse deduct only for non–branch-POS orders on deliver.
    if (record.status === "delivered" && !isBranchPosOrderSource(record.source)) {
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

    if (existing?.status !== responseRecord.status) {
      void notifyOnOrderStatusChange(
        responseRecord.id,
        responseRecord.orderNumber,
        responseRecord.clientName,
        existing?.status,
        responseRecord.status,
        responseRecord.ownerUserId,
      )
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save order"
    console.error("[orders POST]", err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const record = await prisma.erpOrder.findUnique({ where: { id } })
  if (record) {
    const order = toOrderDeductInput(record)
    if (orderMayNeedInventoryRestore(order)) {
      try {
        if (isBranchPosOrderSource(record.source) && record.branchId) {
          await restoreBranchStockForPosOrder({
            id: record.id,
            orderNumber: record.orderNumber,
            clientName: record.clientName,
            createdBy: record.createdBy ?? undefined,
            branchId: record.branchId,
            items: Array.isArray(record.items) ? (record.items as OrderDeductInput["items"]) : [],
          })
        } else {
          await restoreInventoryForOrderServer(order)
        }
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
