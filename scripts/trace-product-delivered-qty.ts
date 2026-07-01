/**
 * List delivered order lines for a product family (default: 15.6 KWh battery).
 * Run on VPS: npx tsx scripts/trace-product-delivered-qty.ts
 */
import { prisma } from "@/lib/db"
import {
  collectManualProductMatchTerms,
  findManualInventoryByAnyModelOrAlias,
  textMatchesAnyProductTerm,
} from "@/lib/inventory-model-aliases"

const PRODUCT = process.argv[2] || "15.6 KWh Battery Storage"

async function main() {
  const manual = await findManualInventoryByAnyModelOrAlias(PRODUCT)
  if (!manual) {
    console.error(`Product not found: ${PRODUCT}`)
    process.exit(1)
  }

  const matchTerms = await collectManualProductMatchTerms(manual)
  console.log(`Product: ${manual.name} (${manual.model})`)
  console.log(`Match terms: ${matchTerms.join(" | ")}\n`)

  const orders = await prisma.erpOrder.findMany({
    where: { status: { in: ["confirmed", "processing", "shipped", "delivered"] } },
    select: { orderNumber: true, status: true, items: true },
    orderBy: { orderNumber: "asc" },
  })

  let deliveredQty = 0
  let pendingQty = 0
  let orderCount = 0

  for (const order of orders) {
    const raw = order.items as unknown
    const items = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? JSON.parse(raw)
        : []

    const matched = items.filter((item: { description?: string; model?: string }) => {
      const description = String(item.description || item.model || "")
      const model = String(item.model || "")
      return (
        textMatchesAnyProductTerm(description, matchTerms) ||
        textMatchesAnyProductTerm(model, matchTerms)
      )
    })

    if (!matched.length) continue

    const qty = matched.reduce((sum: number, item: { qty?: number }) => sum + (Number(item.qty) || 0), 0)
    orderCount += 1
    if (order.status === "delivered") deliveredQty += qty
    else pendingQty += qty

    console.log(
      `${order.orderNumber} | ${order.status.padEnd(10)} | ${String(qty).padStart(2)} pcs | ${matched
        .map((i: { description?: string; qty?: number }) => `${i.description} x${i.qty}`)
        .join("; ")}`,
    )
  }

  console.log("\n=== SUMMARY ===")
  console.log(`Orders with product: ${orderCount}`)
  console.log(`Delivered qty:       ${deliveredQty}`)
  console.log(`Pending qty:         ${pendingQty}`)
  console.log(`Total qty:           ${deliveredQty + pendingQty}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
