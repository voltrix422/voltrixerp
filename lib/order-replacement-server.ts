import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import {
  countInStockSerialsForModel,
  ensureInventoryStockForModel,
  findStockByModel,
} from "@/lib/ensure-model-stock-link"
import {
  decrementManualInventoryByModel,
  resolveManualInventoryForOrderLine,
  restoreManualInventoryByModel,
} from "@/lib/manual-inventory-server"
import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"
import type { OrderReplacementDisposition, OrderReplacementLine } from "@/lib/orders"
import { resolveOrderItemModel } from "@/lib/orders"

export type ReplaceOrderItemInput = {
  orderId: string
  orderItemId: string
  oldSerialNumber?: string
  newSerialNumber?: string
  disposition: OrderReplacementDisposition
  reason: string
  photoUrls?: string[]
  replacedBy: string
}

function orderUnitTag(orderId: string) {
  return `order:${orderId}`
}

function addYears(date: Date, years: number) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

async function ensureWarrantyForReplacementSerial(params: {
  serialNumber: string
  model: string
  productName: string
  orderNumber: string
  clientName: string
  createdBy: string
}) {
  const sn = params.serialNumber.trim()
  if (!sn) return
  const soldDate = new Date()
  const placeholderEnd = addYears(soldDate, 5)
  const dispatchNote = `Replacement on order ${params.orderNumber}. Pending: scan QR at branch or voltrixbatteries.com/warranty to start warranty.`

  const bySerial = await prisma.erpWarranty.findFirst({
    where: { serialNumber: { equals: sn, mode: "insensitive" } },
  })
  if (bySerial) {
    await prisma.erpWarranty.update({
      where: { id: bySerial.id },
      data: {
        customerName: params.clientName,
        soldDate,
        warrantyStartDate: soldDate,
        warrantyEndDate: placeholderEnd,
        activatedAt: null,
        notes: dispatchNote,
        productName: params.model || params.productName || bySerial.productName,
        serialNumber: sn,
      },
    })
    return
  }

  await prisma.erpWarranty.create({
    data: {
      serialNumber: sn,
      productName: params.model || params.productName || sn,
      soldDate,
      warrantyStartDate: soldDate,
      warrantyEndDate: placeholderEnd,
      activatedAt: null,
      customerName: params.clientName,
      notes: dispatchNote,
      createdBy: params.createdBy || "system",
    },
  })
}

async function syncStockForModel(model: string, stockId?: string | null) {
  const trimmed = model.trim()
  if (!trimmed) return
  const remaining = await countInStockSerialsForModel(trimmed)
  const faultyCount = await prisma.erpInventorySerialUnit.count({
    where: { model: trimmed, status: "faulty" },
  })
  const stock =
    (stockId ? await prisma.erpInventoryStock.findUnique({ where: { id: stockId } }) : null) ??
    (await findStockByModel(trimmed))
  if (!stock) return

  const manual = await prisma.erpManualInventoryItem.findFirst({ where: { model: trimmed } })
  await prisma.erpInventoryStock.update({
    where: { id: stock.id },
    data: {
      availableQty: manual ? Number(manual.availableQty) || 0 : remaining,
      faultyQty: manual ? Number(manual.faultyQty) || 0 : Math.max(Number(stock.faultyQty) || 0, faultyCount),
    },
  })
}

async function restoreOldSerialUnit(params: {
  orderId: string
  orderNumber: string
  serialNumber: string
  disposition: OrderReplacementDisposition
  replacedBy: string
  reason: string
  photoUrls?: string[]
}) {
  const sn = params.serialNumber.trim()
  const unit = await prisma.erpInventorySerialUnit.findFirst({
    where: {
      serialNumber: { equals: sn, mode: "insensitive" },
      status: { in: ["delivered", "at_branch"] },
    },
  })

  const photoNote =
    params.photoUrls && params.photoUrls.length > 0
      ? `\nPhotos: ${params.photoUrls.join(", ")}`
      : ""
  const replaceNote = `Replaced from ${params.orderNumber}: ${params.reason}${photoNote}`

  if (unit) {
    if (params.disposition === "faulty") {
      const nextNotes = unit.notes?.trim() ? `${unit.notes.trim()}\n${replaceNote}` : replaceNote
      await prisma.erpInventorySerialUnit.update({
        where: { id: unit.id },
        data: { status: "faulty", notes: nextNotes },
      })
    } else {
      let notes = (unit.notes || "")
        .replace(orderUnitTag(params.orderId), "")
        .replace(params.orderNumber, "")
        .replace(/→/g, "")
        .trim()
      if (notes) notes = `${notes}\n${replaceNote}`
      else notes = replaceNote
      await prisma.erpInventorySerialUnit.update({
        where: { id: unit.id },
        data: { status: "in_stock", notes, specs: "" },
      })
    }
    if (unit.model?.trim()) {
      await ensureInventoryStockForModel(unit.model.trim())
      await syncStockForModel(unit.model, unit.inventoryStockId)
    }
    return
  }

  // Warranty-only dispatch scan with no inventory serial row
  const warranty = await prisma.erpWarranty.findFirst({
    where: { serialNumber: { equals: sn, mode: "insensitive" } },
  })
  if (warranty) {
    await prisma.erpWarranty.update({
      where: { id: warranty.id },
      data: {
        notes: `${warranty.notes || ""}\nReturned from replacement on ${params.orderNumber}.`.trim(),
      },
    })
  }
}

async function restoreOldQtyUnit(params: {
  orderItem: {
    id?: string
    description: string
    unit: string
    isCustom?: boolean
    model?: string
    inventoryItemId?: string
  }
  orderNumber: string
  disposition: OrderReplacementDisposition
  replacedBy: string
  reason: string
  photoUrls?: string[]
}) {
  const manual = await resolveManualInventoryForOrderLine(params.orderItem)
  const note = `Replacement return from ${params.orderNumber}: ${params.reason}`

  if (manual) {
    if (params.disposition === "faulty") {
      const nextFaulty = (Number(manual.faultyQty) || 0) + 1
      await prisma.erpManualInventoryItem.update({
        where: { id: manual.id },
        data: { faultyQty: nextFaulty },
      })
      if (manual.inventoryStockId) {
        await prisma.erpInventoryStock.update({
          where: { id: manual.inventoryStockId },
          data: { faultyQty: nextFaulty },
        })
      }
    } else {
      await restoreManualInventoryByModel(manual.model, 1)
    }
    await prisma.erpInventoryHistory.create({
      data: {
        itemDescription: manual.name,
        transactionType: "in",
        quantity: 1,
        unit: manual.unit || "pcs",
        referenceType: "order_replace",
        referenceId: manual.id,
        referenceNumber: params.orderNumber,
        notes: note,
        createdBy: params.replacedBy,
      },
    })
    return
  }

  const model = resolveOrderItemModel(params.orderItem)
  const stock = model ? await findStockByModel(model) : null
  if (!stock) throw new Error("Could not find stock row for this order line")

  if (params.disposition === "faulty") {
    const nextFaulty = (Number(stock.faultyQty) || 0) + 1
    await prisma.erpInventoryStock.update({
      where: { id: stock.id },
      data: { faultyQty: nextFaulty },
    })
  } else {
    await prisma.erpInventoryStock.update({
      where: { id: stock.id },
      data: { availableQty: (stock.availableQty ?? 0) + 1 },
    })
  }
  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: stock.description || stock.name,
      transactionType: "in",
      quantity: 1,
      unit: stock.unit || "pcs",
      referenceType: "order_replace",
      referenceId: params.orderItem.id || stock.id,
      referenceNumber: params.orderNumber,
      notes: note,
      createdBy: params.replacedBy,
    },
  })
}

async function dispatchNewSerialUnit(params: {
  orderId: string
  orderNumber: string
  clientName: string
  createdBy: string
  orderItem: {
    id?: string
    description: string
    unit: string
    model?: string
    inventoryItemId?: string
  }
  serialNumber: string
  model: string
}) {
  const sn = params.serialNumber.trim()
  const tag = orderUnitTag(params.orderId)
  const note = `${tag} ${params.orderNumber} → ${params.clientName} (replacement)`

  await ensureWarrantyForReplacementSerial({
    serialNumber: sn,
    model: params.model,
    productName: params.orderItem.description,
    orderNumber: params.orderNumber,
    clientName: params.clientName,
    createdBy: params.createdBy,
  })

  const existingUnit = await prisma.erpInventorySerialUnit.findFirst({
    where: {
      serialNumber: { equals: sn, mode: "insensitive" },
      status: "in_stock",
    },
  })
  if (existingUnit) {
    await prisma.erpInventorySerialUnit.update({
      where: { id: existingUnit.id },
      data: {
        status: "delivered",
        notes: note,
        specs: params.orderNumber,
      },
    })
    await syncStockForModel(params.model, existingUnit.inventoryStockId)
  }

  const manual = await resolveManualInventoryForOrderLine(params.orderItem)
  if (manual) {
    await decrementManualInventoryByModel(manual.model, 1)
  } else {
    const stock = await findStockByModel(params.model)
    if (stock) {
      if ((stock.availableQty ?? 0) < 1) {
        throw new Error(`Not enough stock for ${params.model}`)
      }
      await prisma.erpInventoryStock.update({
        where: { id: stock.id },
        data: { availableQty: (stock.availableQty ?? 0) - 1 },
      })
    }
  }

  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: params.orderItem.description,
      transactionType: "out",
      quantity: 1,
      unit: params.orderItem.unit || "pcs",
      referenceType: "order_replace",
      referenceId: params.orderId,
      referenceNumber: params.orderNumber,
      notes: `Replacement dispatch SN ${sn} → ${params.clientName}`,
      createdBy: params.createdBy,
    },
  })
}

export async function replaceOrderItemServer(input: ReplaceOrderItemInput) {
  const order = await prisma.erpOrder.findUnique({ where: { id: input.orderId } })
  if (!order) throw new Error("Order not found")
  if (order.status !== "delivered") throw new Error("Only delivered orders can be updated with replacements")
  if (String(order.source || "").trim().toLowerCase() === "branch_pos") {
    throw new Error("Branch POS orders use branch inventory — replace from Branch POS")
  }
  if (!order.inventoryDeductedAt) throw new Error("Inventory has not been deducted for this order yet")

  const items = Array.isArray(order.items) ? (order.items as Array<Record<string, unknown>>) : []
  const orderItem = items.find((item) => String(item.id || "") === input.orderItemId)
  if (!orderItem) throw new Error("Order line not found")
  if (Boolean(orderItem.isCustom)) throw new Error("Custom lines cannot be replaced through inventory")

  const allocations = Array.isArray(order.fulfillmentSerialAllocations)
    ? (order.fulfillmentSerialAllocations as unknown as OrderFulfillmentSerialAllocation[])
    : []
  const lineAllocations = allocations.filter((a) => a.orderItemId === input.orderItemId)
  const oldSn = input.oldSerialNumber?.trim() || ""
  const newSn = input.newSerialNumber?.trim() || ""
  const model = resolveOrderItemModel(orderItem as never) || lineAllocations[0]?.model?.trim() || ""
  const reason = input.reason?.trim() || "Item replacement"
  const photoUrls = (input.photoUrls || []).map((u) => u.trim()).filter(Boolean)

  if (lineAllocations.length > 0) {
    if (!oldSn) throw new Error("Scan or select the old serial number being returned")
    if (!newSn) throw new Error("Scan the new replacement serial number")
    const oldAlloc = lineAllocations.find(
      (a) => a.serialNumber.trim().toLowerCase() === oldSn.toLowerCase(),
    )
    if (!oldAlloc) throw new Error("Old serial is not linked to this order line")
    if (lineAllocations.some((a) => a.serialNumber.trim().toLowerCase() === newSn.toLowerCase())) {
      throw new Error("New serial is already on this order")
    }

    const newUnit = await prisma.erpInventorySerialUnit.findFirst({
      where: {
        serialNumber: { equals: newSn, mode: "insensitive" },
        status: "in_stock",
      },
    })
    if (!newUnit) throw new Error("New serial is not available in main inventory")

    await restoreOldSerialUnit({
      orderId: order.id,
      orderNumber: order.orderNumber,
      serialNumber: oldSn,
      disposition: input.disposition,
      replacedBy: input.replacedBy,
      reason,
      photoUrls,
    })

    await dispatchNewSerialUnit({
      orderId: order.id,
      orderNumber: order.orderNumber,
      clientName: order.clientName,
      createdBy: input.replacedBy,
      orderItem: orderItem as never,
      serialNumber: newSn,
      model: newUnit.model?.trim() || model || oldAlloc.model,
    })

    const nextAllocations = allocations
      .filter((a) => !(a.orderItemId === input.orderItemId && a.serialNumber.trim().toLowerCase() === oldSn.toLowerCase()))
      .concat([
        {
          orderItemId: input.orderItemId,
          model: newUnit.model?.trim() || model || oldAlloc.model,
          serialNumber: newSn,
          unitId: newUnit.id,
        },
      ])

    const replacement: OrderReplacementLine = {
      id: `repl-${Date.now()}`,
      orderItemId: input.orderItemId,
      oldSerialNumber: oldSn,
      newSerialNumber: newSn,
      qty: 1,
      disposition: input.disposition,
      reason,
      photoUrls,
      replacedAt: new Date().toISOString(),
      replacedBy: input.replacedBy,
      description: String(orderItem.description || ""),
      model: newUnit.model?.trim() || model,
      unit: String(orderItem.unit || "pcs"),
    }

    const existingReplacements = Array.isArray(order.replacementLines)
      ? (order.replacementLines as unknown as OrderReplacementLine[])
      : []

    const updated = await prisma.erpOrder.update({
      where: { id: order.id },
      data: {
        fulfillmentSerialAllocations: nextAllocations as unknown as Prisma.InputJsonValue,
        replacementLines: [...existingReplacements, replacement] as unknown as Prisma.InputJsonValue,
      },
    })

    return updated
  }

  // Qty-only line (no serial allocations)
  if (!oldSn && !newSn) {
    await restoreOldQtyUnit({
      orderItem: orderItem as never,
      orderNumber: order.orderNumber,
      disposition: input.disposition,
      replacedBy: input.replacedBy,
      reason,
      photoUrls,
    })

    const manual = await resolveManualInventoryForOrderLine(orderItem as never)
    if (manual) {
      await decrementManualInventoryByModel(manual.model, 1)
    } else if (model) {
      const stock = await findStockByModel(model)
      if (!stock || (stock.availableQty ?? 0) < 1) {
        throw new Error(`Not enough stock for replacement on ${model}`)
      }
      await prisma.erpInventoryStock.update({
        where: { id: stock.id },
        data: { availableQty: (stock.availableQty ?? 0) - 1 },
      })
    }

    const replacement: OrderReplacementLine = {
      id: `repl-${Date.now()}`,
      orderItemId: input.orderItemId,
      qty: 1,
      disposition: input.disposition,
      reason,
      photoUrls,
      replacedAt: new Date().toISOString(),
      replacedBy: input.replacedBy,
      description: String(orderItem.description || ""),
      model,
      unit: String(orderItem.unit || "pcs"),
    }

    const existingReplacements = Array.isArray(order.replacementLines)
      ? (order.replacementLines as unknown as OrderReplacementLine[])
      : []

    return prisma.erpOrder.update({
      where: { id: order.id },
      data: {
        replacementLines: [...existingReplacements, replacement] as unknown as Prisma.InputJsonValue,
      },
    })
  }

  throw new Error("This order line requires serial numbers for replacement")
}
