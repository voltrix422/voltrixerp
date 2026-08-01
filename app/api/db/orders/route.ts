import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  deductInventoryForOrderServer,
  orderNeedsInventoryDeductionServer,
  restoreInventoryForOrderServer,
  orderMayNeedInventoryRestore,
  type OrderDeductInput,
  type OrderRestoreLineQty,
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
import {
  applyReturnMerchandiseToOrder,
  type Order,
  type OrderItem,
  type OrderReturnLine,
} from "@/lib/orders"

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
          returnLines: true,
          items: true,
          returnMerchandiseApplied: true,
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

  type ReturnLineRow = { id?: string; orderItemId?: string; qty?: number }
  function aggregateReturnQty(lines: unknown): Map<string, number> {
    const map = new Map<string, number>()
    if (!Array.isArray(lines)) return map
    for (const raw of lines as ReturnLineRow[]) {
      const itemId = String(raw?.orderItemId || "").trim()
      const qty = Math.max(0, Math.floor(Number(raw?.qty) || 0))
      if (!itemId || qty <= 0) continue
      map.set(itemId, (map.get(itemId) || 0) + qty)
    }
    return map
  }

  const prevReturnAgg = aggregateReturnQty(existing?.returnLines)
  const nextReturnAgg = aggregateReturnQty(o.returnLines)
  const restoreDelta: OrderRestoreLineQty[] = []
  for (const [itemId, qty] of nextReturnAgg) {
    const delta = qty - (prevReturnAgg.get(itemId) || 0)
    if (delta > 0) restoreDelta.push({ orderItemId: itemId, qty: delta })
  }
  // Reject attempts to decrease returned qty
  for (const [itemId, prevQty] of prevReturnAgg) {
    if ((nextReturnAgg.get(itemId) || 0) < prevQty) {
      return NextResponse.json(
        { error: "Cannot reduce previously returned quantities." },
        { status: 400 },
      )
    }
  }
  const becomingFullReturnedLegacy =
    String(o.status || "").toLowerCase() === "returned" &&
    !!existing &&
    existing.status !== "returned" &&
    !existing.inventoryReturnedAt &&
    restoreDelta.length === 0 &&
    nextReturnAgg.size === 0

  const hasNewReturnRestore = restoreDelta.length > 0 || becomingFullReturnedLegacy
  const needsMerchandiseRepair =
    !!existing &&
    !existing.returnMerchandiseApplied &&
    nextReturnAgg.size > 0

  // Cap new return qty against currently remaining (not already-returned) quantity
  if (restoreDelta.length > 0 && existing) {
    const baseItems = Array.isArray(existing.items)
      ? (existing.items as Array<{ id?: string; qty?: number }>)
      : []
    const merchandiseApplied = Boolean(existing.returnMerchandiseApplied)
    for (const delta of restoreDelta) {
      const item = baseItems.find((i) => i.id === delta.orderItemId)
      const currentQty = Math.max(0, Math.floor(Number(item?.qty) || 0))
      const remaining = merchandiseApplied
        ? currentQty
        : Math.max(0, currentQty - (prevReturnAgg.get(delta.orderItemId) || 0))
      if (delta.qty > remaining) {
        return NextResponse.json(
          {
            error: `Return qty exceeds remaining quantity on order (${remaining} left).`,
          },
          { status: 400 },
        )
      }
    }
  }

  // Restore stock before saving return so a failed restore never leaves a half-saved return.
  if (hasNewReturnRestore && existing) {
    const fullExisting = await prisma.erpOrder.findUnique({ where: { id: orderId } })
    if (fullExisting) {
      const deductInput = toOrderDeductInput(fullExisting)
      try {
        if (isBranchPosOrderSource(fullExisting.source) && fullExisting.branchId) {
          // Branch POS: only full restore path (CRM partial returns are blocked for POS)
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
          o.inventoryReturnedAt = o.inventoryReturnedAt || new Date().toISOString()
          o.inventoryDeductedAt = null
          fulfillment.inventoryDeductedAt = null
        } else if (orderMayNeedInventoryRestore(deductInput)) {
          const notes = becomingFullReturnedLegacy
            ? `Returned from order · ${fullExisting.clientName} · stock restored`
            : `Partial return · ${fullExisting.clientName} · stock restored`
          await restoreInventoryForOrderServer(deductInput, {
            historyNotes: notes,
            restoreLines: becomingFullReturnedLegacy ? undefined : restoreDelta,
          })
        }
      } catch (err) {
        console.error("[orders POST] inventory restore on return failed:", err)
        return NextResponse.json(
          { error: "Could not restore inventory for this return. Order was not updated." },
          { status: 500 },
        )
      }
    }
  }

  // Reduce order line qty + totals for returns (and repair older partial returns).
  if (existing && (hasNewReturnRestore || needsMerchandiseRepair)) {
    const fullExisting = await prisma.erpOrder.findUnique({ where: { id: orderId } })
    if (fullExisting) {
      const baseOrder = {
        ...(o as unknown as Order),
        id: fullExisting.id,
        items: (Array.isArray(fullExisting.items)
          ? (fullExisting.items as unknown as OrderItem[])
          : []) as OrderItem[],
        returnLines: (Array.isArray(o.returnLines)
          ? (o.returnLines as unknown as OrderReturnLine[])
          : Array.isArray(fullExisting.returnLines)
            ? (fullExisting.returnLines as unknown as OrderReturnLine[])
            : []) as OrderReturnLine[],
        returnMerchandiseApplied: Boolean(fullExisting.returnMerchandiseApplied),
        subtotal: Number(fullExisting.subtotal) || 0,
        tax: Number(fullExisting.tax) || 0,
        taxPercent: Number(fullExisting.taxPercent) || 18,
        discount: Number(fullExisting.discount) || 0,
        transportCost: Number(fullExisting.transportCost) || 0,
        otherCost: Number(fullExisting.otherCost) || 0,
        shipping: Number(fullExisting.shipping) || 0,
        total: Number(fullExisting.total) || 0,
        discountIsPercentage: o.discountIsPercentage,
        transportIsPercentage: o.transportIsPercentage,
        otherCostIsPercentage: o.otherCostIsPercentage,
      } as Order

      let adjusted: Order
      if (fullExisting.returnMerchandiseApplied && restoreDelta.length > 0) {
        adjusted = applyReturnMerchandiseToOrder(baseOrder, { deltaOnly: restoreDelta })
      } else if (!fullExisting.returnMerchandiseApplied && nextReturnAgg.size > 0) {
        // First-time apply (includes repairing ORD returns saved before qty/totals update)
        adjusted = applyReturnMerchandiseToOrder({
          ...baseOrder,
          returnMerchandiseApplied: false,
        })
      } else if (becomingFullReturnedLegacy) {
        adjusted = applyReturnMerchandiseToOrder({
          ...baseOrder,
          items: [],
          returnMerchandiseApplied: true,
        })
      } else {
        adjusted = baseOrder
      }

      o.items = adjusted.items
      o.subtotal = adjusted.subtotal
      o.tax = adjusted.tax
      o.taxPercent = adjusted.taxPercent
      o.total = adjusted.total
      o.discountValue = adjusted.discountValue
      o.transportCostValue = adjusted.transportCostValue
      o.otherCostValue = adjusted.otherCostValue
      o.returnMerchandiseApplied = true

      const remainingQty = (adjusted.items || []).reduce(
        (sum, item) => sum + Math.max(0, Math.floor(Number(item.qty) || 0)),
        0,
      )
      if (remainingQty <= 0 || becomingFullReturnedLegacy) {
        o.status = "returned"
        o.inventoryReturnedAt = o.inventoryReturnedAt || new Date().toISOString()
        o.inventoryDeductedAt = null
        fulfillment.inventoryDeductedAt = null
      } else if (hasNewReturnRestore || needsMerchandiseRepair) {
        o.status = "delivered"
        o.inventoryReturnedAt = null
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
          returnLines: o.returnLines ?? [],
          returnMerchandiseApplied: Boolean(o.returnMerchandiseApplied),
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
          returnLines: o.returnLines ?? [],
          returnMerchandiseApplied: Boolean(o.returnMerchandiseApplied),
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
