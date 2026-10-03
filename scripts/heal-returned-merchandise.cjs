/**
 * Persist heal for fully returned orders whose items/total were never cleared
 * (phantom Credit = Total after full refund). Safe to re-run.
 *
 * Usage: node scripts/heal-returned-merchandise.cjs [ORD-00035]
 */
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

function applyReturnQtyDeltaToItems(items, delta) {
  const reduceBy = new Map()
  for (const line of delta) {
    const itemId = String(line.orderItemId || "").trim()
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
    if (!itemId || qty <= 0) continue
    reduceBy.set(itemId, (reduceBy.get(itemId) || 0) + qty)
  }
  if (reduceBy.size === 0) return items
  return items
    .map((item) => {
      const cut = reduceBy.get(item.id) || 0
      if (cut <= 0) return item
      return {
        ...item,
        qty: Math.max(0, Math.floor(Number(item.qty) || 0) - cut),
      }
    })
    .filter((item) => Math.floor(Number(item.qty) || 0) > 0)
}

function calcGstInclusiveTotals({
  subtotalInclGst,
  gstPercent,
  discount,
  discountIsPercentage,
  transportCost,
  transportIsPercentage,
  otherCost,
  otherCostIsPercentage,
}) {
  const taxPercent = Number(gstPercent) || 18
  const factor = 1 + taxPercent / 100
  const base = subtotalInclGst / factor
  const discountOnBase = discountIsPercentage
    ? (base * (Number(discount) || 0)) / 100
    : Number(discount) || 0
  const afterDiscountBase = Math.max(0, base - discountOnBase)
  const transportAmount = transportIsPercentage
    ? (afterDiscountBase * (Number(transportCost) || 0)) / 100
    : Number(transportCost) || 0
  const otherAmount = otherCostIsPercentage
    ? (afterDiscountBase * (Number(otherCost) || 0)) / 100
    : Number(otherCost) || 0
  const taxableBase = afterDiscountBase + transportAmount + otherAmount
  const taxAmount = taxableBase * (taxPercent / 100)
  const subtotalOut = taxableBase + taxAmount
  return {
    subtotalInclGst: subtotalOut,
    taxAmount,
    taxPercent,
    discountOnBase,
    transportAmount,
    otherAmount,
    total: subtotalOut,
  }
}

function recalculate(order, items) {
  const kept = items.filter((item) => Math.max(0, Math.floor(Number(item.qty) || 0)) > 0)
  const subtotal = kept.reduce(
    (sum, item) => sum + (Number(item.unitPrice) || 0) * Math.max(0, Number(item.qty) || 0),
    0,
  )
  const pricing = calcGstInclusiveTotals({
    subtotalInclGst: subtotal,
    gstPercent: Number(order.taxPercent) || 18,
    discount: Number(order.discount) || 0,
    discountIsPercentage: order.discountIsPercentage ?? true,
    transportCost: Number(order.transportCost) || 0,
    transportIsPercentage: order.transportIsPercentage ?? false,
    otherCost: Number(order.otherCost) || 0,
    otherCostIsPercentage: order.otherCostIsPercentage ?? false,
  })
  const shipping = Number(order.shipping) || 0
  return {
    items: kept,
    subtotal: pricing.subtotalInclGst,
    tax: pricing.taxAmount,
    taxPercent: pricing.taxPercent,
    total: pricing.total + shipping,
    returnMerchandiseApplied: true,
  }
}

async function main() {
  const only = process.argv[2] ? String(process.argv[2]).trim() : ""
  const where = {
    status: "returned",
    ...(only ? { orderNumber: only } : {}),
  }
  const rows = await prisma.erpOrder.findMany({ where })
  let fixed = 0
  for (const row of rows) {
    const total = Number(row.total) || 0
    const items = Array.isArray(row.items) ? row.items : []
    const returnLines = Array.isArray(row.returnLines) ? row.returnLines : []
    const hasItems = items.some((i) => Math.floor(Number(i.qty) || 0) > 0)
    if (total <= 0.004 && !hasItems) continue

    let nextItems = items
    if (returnLines.length > 0) {
      const agg = new Map()
      for (const line of returnLines) {
        const id = String(line.orderItemId || "").trim()
        const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
        if (!id || qty <= 0) continue
        agg.set(id, (agg.get(id) || 0) + qty)
      }
      const delta = [...agg.entries()].map(([orderItemId, qty]) => ({ orderItemId, qty }))
      // If merchandise was already applied, items are remaining — do not subtract again.
      if (!row.returnMerchandiseApplied) {
        nextItems = applyReturnQtyDeltaToItems(items, delta)
      } else if (hasItems && total > 0.004) {
        // Flag true but items/total still look full — force subtract from current items once.
        nextItems = applyReturnQtyDeltaToItems(items, delta)
      } else {
        continue
      }
    } else {
      nextItems = []
    }

    const patched = recalculate(row, nextItems)
    if (
      Math.abs((Number(row.total) || 0) - patched.total) < 0.01 &&
      items.length === patched.items.length &&
      row.returnMerchandiseApplied
    ) {
      continue
    }

    await prisma.erpOrder.update({
      where: { id: row.id },
      data: {
        items: patched.items,
        subtotal: patched.subtotal,
        tax: patched.tax,
        taxPercent: patched.taxPercent,
        total: patched.total,
        returnMerchandiseApplied: true,
      },
    })
    fixed++
    console.log(
      `Fixed ${row.orderNumber}: total ${total} → ${patched.total}, items ${items.length} → ${patched.items.length}`,
    )
  }
  console.log(`Done. Healed ${fixed} of ${rows.length} returned order(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
