import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import {
  countInStockSerialsForModel,
  ensureInventoryStockForModel,
  findStockByModel,
} from "@/lib/ensure-model-stock-link"
import { findManualInventoryByAnyModelOrAlias } from "@/lib/inventory-model-aliases"
import {
  decrementManualInventoryByModel,
  resolveManualInventoryForOrderLine,
  restoreManualInventoryByModel,
} from "@/lib/manual-inventory-server"
import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"
import type { OrderReplacementDisposition, OrderReplacementLine } from "@/lib/orders"
import { resolveOrderItemModel } from "@/lib/orders"
import { parseProductQrPayload } from "@/lib/parse-product-qr"

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

function extractReplacementSerial(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    const parsed = parseProductQrPayload(trimmed)
    if (parsed.serialNumber?.trim()) return parsed.serialNumber.trim()
  } catch {
    // plain serial
  }
  return trimmed.split(/[\s,;]+/)[0]?.trim() ?? trimmed
}

function serialNotDispatchableMessage(serialNumber: string, status: string) {
  const sn = serialNumber.trim()
  const s = status.trim().toLowerCase()
  if (s === "at_branch") return `Serial ${sn} is at a branch, not in main warehouse`
  if (s === "faulty") return `Serial ${sn} is already in faulty stock`
  if (s === "delivered") return `Serial ${sn} is already delivered`
  return `Serial ${sn} cannot be dispatched (status: ${status || "unknown"})`
}

type OrderLineForStock = {
  id?: string
  description: string
  unit: string
  isCustom?: boolean
  model?: string
  inventoryItemId?: string
}

async function findSerialUnitByNumber(serialNumber: string) {
  const sn = serialNumber.trim()
  if (!sn) return null
  return prisma.erpInventorySerialUnit.findFirst({
    where: { serialNumber: { equals: sn, mode: "insensitive" } },
  })
}

async function warehouseHasReplacementStock(orderItem: OrderLineForStock) {
  const manual = await resolveManualInventoryForOrderLine(orderItem)
  if (manual && (Number(manual.availableQty) || 0) >= 1) return true
  const model = resolveOrderItemModel(orderItem as never)
  if (model) {
    const aliased = await findManualInventoryByAnyModelOrAlias(model)
    if (aliased && (Number(aliased.availableQty) || 0) >= 1) return true
    const stock = await findStockByModel(model)
    if (stock && (stock.availableQty ?? 0) >= 1) return true
  }
  const desc = orderItem.description?.trim()
  if (desc) {
    const byName = await findManualInventoryByAnyModelOrAlias(desc)
    if (byName && (Number(byName.availableQty) || 0) >= 1) return true
  }
  return false
}

async function assertNewSerialCanDispatch(serialNumber: string, orderItem: OrderLineForStock) {
  const unit = await findSerialUnitByNumber(serialNumber)
  if (unit) {
    if (String(unit.status || "").toLowerCase() !== "in_stock") {
      throw new Error(serialNotDispatchableMessage(unit.serialNumber, unit.status))
    }
    return unit
  }
  if (await warehouseHasReplacementStock(orderItem)) return null
  throw new Error(
    `New serial ${serialNumber} is not in the warehouse register, and this product has no available stock`,
  )
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
  warrantyHolderName?: string
  createdBy: string
}) {
  const sn = params.serialNumber.trim()
  if (!sn) return
  const soldDate = new Date()
  const placeholderEnd = addYears(soldDate, 5)
  const dispatchNote = `Replacement on order ${params.orderNumber}. Pending: scan QR at branch or voltrixbatteries.com/warranty to start warranty.`
  const holderName = (params.warrantyHolderName || "").trim() || null

  const bySerial = await prisma.erpWarranty.findFirst({
    where: { serialNumber: { equals: sn, mode: "insensitive" } },
  })
  if (bySerial) {
    await prisma.erpWarranty.update({
      where: { id: bySerial.id },
      data: {
        customerName: holderName,
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
      customerName: holderName,
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
  orderItem?: OrderLineForStock
}) {
  const sn = params.serialNumber.trim()
  const unit = await findSerialUnitByNumber(sn)

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

  // Typed/scanned serial on the order with no warehouse serial row — restore qty
  // and register the returned unit so Faulty / main stock can show it.
  if (params.orderItem) {
    await restoreOldQtyUnit({
      orderItem: params.orderItem,
      orderNumber: params.orderNumber,
      disposition: params.disposition,
      replacedBy: params.replacedBy,
      reason: params.reason,
      photoUrls: params.photoUrls,
    })
    const model = resolveOrderItemModel(params.orderItem as never) || ""
    const manual = await resolveManualInventoryForOrderLine(params.orderItem)
    const stock = model ? await findStockByModel(model) : null
    await prisma.erpInventorySerialUnit.create({
      data: {
        serialNumber: sn,
        productName: params.orderItem.description || "",
        model: model || manual?.model || "",
        status: params.disposition === "faulty" ? "faulty" : "in_stock",
        notes: replaceNote,
        scannedBy: params.replacedBy,
        inventoryStockId: manual?.inventoryStockId || stock?.id || null,
      },
    })
  }

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
  warrantyHolderName?: string
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
    warrantyHolderName: params.warrantyHolderName,
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
    await syncStockForModel(existingUnit.model?.trim() || params.model, existingUnit.inventoryStockId)
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
    return existingUnit
  }

  const alreadyRegistered = await findSerialUnitByNumber(sn)
  if (alreadyRegistered) {
    throw new Error(serialNotDispatchableMessage(alreadyRegistered.serialNumber, alreadyRegistered.status))
  }

  const manual =
    (await resolveManualInventoryForOrderLine(params.orderItem)) ||
    (params.model ? await findManualInventoryByAnyModelOrAlias(params.model) : null) ||
    (params.orderItem.description
      ? await findManualInventoryByAnyModelOrAlias(params.orderItem.description)
      : null)
  let stockId: string | null = null
  if (manual) {
    if ((Number(manual.availableQty) || 0) < 1) {
      throw new Error(`Not enough warehouse stock to dispatch ${sn}`)
    }
    await decrementManualInventoryByModel(manual.model, 1)
    stockId = manual.inventoryStockId
  } else {
    const stock = await findStockByModel(params.model)
    if (!stock || (stock.availableQty ?? 0) < 1) {
      throw new Error(`Not enough stock for ${params.model || "this product"}`)
    }
    await prisma.erpInventoryStock.update({
      where: { id: stock.id },
      data: { availableQty: (stock.availableQty ?? 0) - 1 },
    })
    stockId = stock.id
  }

  const created = await prisma.erpInventorySerialUnit.create({
    data: {
      serialNumber: sn,
      productName: params.orderItem.description || "",
      model: params.model || manual?.model || "",
      specs: params.orderNumber,
      status: "delivered",
      notes: note,
      scannedBy: params.createdBy,
      inventoryStockId: stockId,
    },
  })

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

  return created
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
  const oldSn = extractReplacementSerial(input.oldSerialNumber || "")
  const newSn = extractReplacementSerial(input.newSerialNumber || "")
  const model = resolveOrderItemModel(orderItem as never) || lineAllocations[0]?.model?.trim() || ""
  const reason = input.reason?.trim() || "Item replacement"
  const photoUrls = (input.photoUrls || []).map((u) => u.trim()).filter(Boolean)
  const lineForStock: OrderLineForStock = {
    id: String(orderItem.id || ""),
    description: String(orderItem.description || ""),
    unit: String(orderItem.unit || "pcs"),
    isCustom: Boolean(orderItem.isCustom),
    model: typeof orderItem.model === "string" ? orderItem.model : undefined,
    inventoryItemId: typeof orderItem.inventoryItemId === "string" ? orderItem.inventoryItemId : undefined,
  }

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

    const registeredNew = await assertNewSerialCanDispatch(newSn, lineForStock)

    await restoreOldSerialUnit({
      orderId: order.id,
      orderNumber: order.orderNumber,
      serialNumber: oldSn,
      disposition: input.disposition,
      replacedBy: input.replacedBy,
      reason,
      photoUrls,
      orderItem: lineForStock,
    })

    const dispatched = await dispatchNewSerialUnit({
      orderId: order.id,
      orderNumber: order.orderNumber,
      clientName: order.clientName,
      warrantyHolderName: order.warrantyHolderName,
      createdBy: input.replacedBy,
      orderItem: orderItem as never,
      serialNumber: newSn,
      model: registeredNew?.model?.trim() || model || oldAlloc.model,
    })
    const dispatchModel = dispatched.model?.trim() || registeredNew?.model?.trim() || model || oldAlloc.model

    const nextAllocations = allocations
      .filter((a) => !(a.orderItemId === input.orderItemId && a.serialNumber.trim().toLowerCase() === oldSn.toLowerCase()))
      .concat([
        {
          orderItemId: input.orderItemId,
          model: dispatchModel,
          serialNumber: newSn,
          unitId: dispatched.id,
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
      model: dispatchModel,
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
  // Old unit received by qty; new unit can optionally be a scanned serial or plain qty
  const qtyReplace = lineAllocations.length === 0

  if (qtyReplace) {
    if (oldSn) {
      await restoreOldSerialUnit({
        orderId: order.id,
        orderNumber: order.orderNumber,
        serialNumber: oldSn,
        disposition: input.disposition,
        replacedBy: input.replacedBy,
        reason,
        photoUrls,
        orderItem: lineForStock,
      })
    } else {
      await restoreOldQtyUnit({
        orderItem: orderItem as never,
        orderNumber: order.orderNumber,
        disposition: input.disposition,
        replacedBy: input.replacedBy,
        reason,
        photoUrls,
      })
    }

    if (newSn) {
      const registeredNew = await assertNewSerialCanDispatch(newSn, lineForStock)
      const dispatched = await dispatchNewSerialUnit({
        orderId: order.id,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        warrantyHolderName: order.warrantyHolderName,
        createdBy: input.replacedBy,
        orderItem: orderItem as never,
        serialNumber: newSn,
        model: registeredNew?.model?.trim() || model,
      })
      const dispatchModel = dispatched.model?.trim() || registeredNew?.model?.trim() || model

      const nextAllocations = (() => {
        const lineQty = Math.max(0, Math.floor(Number(orderItem.qty) || 0))
        const other = allocations.filter((a) => a.orderItemId !== input.orderItemId)
        const line = allocations.filter((a) => a.orderItemId === input.orderItemId)
        const added = {
          orderItemId: input.orderItemId,
          model: dispatchModel,
          serialNumber: newSn,
          unitId: dispatched.id,
        }
        // Keep at most line qty serials for this item (drop oldest extras).
        const nextLine =
          lineQty > 0 && line.length >= lineQty
            ? [...line.slice(-(lineQty - 1)), added]
            : [...line, added]
        return [...other, ...nextLine]
      })()

      const replacement: OrderReplacementLine = {
        id: `repl-${Date.now()}`,
        orderItemId: input.orderItemId,
        oldSerialNumber: oldSn || undefined,
        newSerialNumber: newSn,
        qty: 1,
        disposition: input.disposition,
        reason,
        photoUrls,
        replacedAt: new Date().toISOString(),
        replacedBy: input.replacedBy,
        description: String(orderItem.description || ""),
        model: dispatchModel,
        unit: String(orderItem.unit || "pcs"),
      }

      const existingReplacements = Array.isArray(order.replacementLines)
        ? (order.replacementLines as unknown as OrderReplacementLine[])
        : []

      return prisma.erpOrder.update({
        where: { id: order.id },
        data: {
          fulfillmentSerialAllocations: nextAllocations as unknown as Prisma.InputJsonValue,
          replacementLines: [...existingReplacements, replacement] as unknown as Prisma.InputJsonValue,
        },
      })
    }

    // No new serial — plain qty swap (deduct 1 fresh unit from stock)
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
      oldSerialNumber: oldSn || undefined,
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
