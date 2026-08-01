/**
 * One-time repair: subtract returned qty from order items and recalculate totals
 * for orders that have returnLines but returnMerchandiseApplied = false.
 *
 * Run on VPS: node scripts/repair-return-merchandise.mjs
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const DEFAULT_GST = 18

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function splitGstInclusiveAmount(amount, gstPercent) {
  const safeAmount = Math.max(0, amount)
  const rate = Math.max(0, gstPercent) / 100
  if (rate <= 0 || safeAmount <= 0) {
    return { base: safeAmount, gst: 0, total: safeAmount }
  }
  const base = roundMoney(safeAmount / (1 + rate))
  const gst = roundMoney(safeAmount - base)
  return { base, gst, total: safeAmount }
}

function recalculate(order, items) {
  const liveItems = items.filter((i) => Math.max(0, Math.floor(Number(i.qty) || 0)) > 0)
  const subtotal = liveItems.reduce(
    (sum, i) => sum + (Number(i.unitPrice) || 0) * Math.max(0, Number(i.qty) || 0),
    0,
  )
  const taxPercent = Number(order.taxPercent) || DEFAULT_GST
  const { base, gst } = splitGstInclusiveAmount(subtotal, taxPercent)
  const transport = Number(order.transportCost) || 0
  const other = Number(order.otherCost) || 0
  const shipping = Number(order.shipping) || 0
  const discount = Number(order.discount) || 0
  // Match app default: treat discount <= 100 as percent of base when no flag stored
  const discountOnBase =
    discount > 0 && discount <= 100 ? roundMoney(base * (discount / 100)) : roundMoney(discount)
  const discountedBase = roundMoney(Math.max(0, base - discountOnBase))
  const discountedSubtotal = roundMoney(discountedBase + gst)
  const total = roundMoney(discountedSubtotal + transport + other + shipping)
  return {
    items: liveItems,
    subtotal,
    tax: gst,
    taxPercent,
    total,
  }
}

async function main() {
  const orders = await prisma.erpOrder.findMany({
    where: { returnMerchandiseApplied: false },
  })

  let fixed = 0
  for (const order of orders) {
    const returnLines = Array.isArray(order.returnLines) ? order.returnLines : []
    if (returnLines.length === 0) continue

    const reduceBy = new Map()
    for (const line of returnLines) {
      const itemId = String(line?.orderItemId || "").trim()
      const qty = Math.max(0, Math.floor(Number(line?.qty) || 0))
      if (!itemId || qty <= 0) continue
      reduceBy.set(itemId, (reduceBy.get(itemId) || 0) + qty)
    }
    if (reduceBy.size === 0) continue

    const items = Array.isArray(order.items) ? structuredClone(order.items) : []
    const nextItems = items
      .map((item) => {
        const cut = reduceBy.get(item.id) || 0
        if (cut <= 0) return item
        return { ...item, qty: Math.max(0, Math.floor(Number(item.qty) || 0) - cut) }
      })
      .filter((item) => Math.floor(Number(item.qty) || 0) > 0)

    const money = recalculate(order, nextItems)
    const remainingQty = money.items.reduce(
      (sum, i) => sum + Math.max(0, Math.floor(Number(i.qty) || 0)),
      0,
    )
    const status = remainingQty <= 0 ? "returned" : order.status === "returned" ? "returned" : "delivered"

    await prisma.erpOrder.update({
      where: { id: order.id },
      data: {
        items: money.items,
        subtotal: money.subtotal,
        tax: money.tax,
        taxPercent: money.taxPercent,
        total: money.total,
        returnMerchandiseApplied: true,
        status,
        inventoryReturnedAt:
          status === "returned"
            ? order.inventoryReturnedAt || new Date().toISOString()
            : order.inventoryReturnedAt,
        inventoryDeductedAt: status === "returned" ? null : order.inventoryDeductedAt,
      },
    })

    fixed += 1
    console.log(
      `Fixed ${order.orderNumber}: items ${items.length} → ${money.items.length}, total ${order.total} → ${money.total}, status=${status}`,
    )
  }

  console.log(`Done. Repaired ${fixed} order(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
