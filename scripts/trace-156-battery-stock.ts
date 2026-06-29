import {
  auditManualInventoryStock,
  correctManualInventoryAvailable,
} from "@/lib/manual-inventory-reconcile"

const MODELS = ["MAN-15-6-KWH-BATTERY-STORAGE", "HSLD15KW", "15.6 KWh Battery Storage"]

async function main() {
  const args = process.argv.slice(2)
  const shouldFix = args.includes("--fix")
  const targetArg = args.find((a) => a.startsWith("--target="))
  const targetAvailable = targetArg ? Number(targetArg.split("=")[1]) : undefined

  let audit = null
  for (const model of MODELS) {
    audit = await auditManualInventoryStock(model)
    if (audit) break
  }

  if (!audit) {
    console.error("15.6 KWh battery manual inventory not found. Tried:", MODELS.join(", "))
    process.exit(1)
  }

  const bs = audit.businessSummary
  const fixTarget = Number.isFinite(targetAvailable)
    ? targetAvailable!
    : bs.recommendedAvailable

  console.log("=== 15.6 KWh BATTERY STOCK AUDIT ===")
  console.log("Name:", audit.name)
  console.log("Model:", audit.model)
  console.log("Total units:", audit.totalQty)
  console.log("In warehouse (available):", audit.currentAvailable)
  console.log("Out (branches + delivered):", audit.totalQty - audit.currentAvailable)

  console.log("\n=== WAREHOUSE MATH ===")
  console.log(`  Total units:              ${audit.totalQty}`)
  console.log(`  − Delivered orders:       ${bs.deliveredOrderQty}`)
  console.log(`  − At branches:            ${bs.branchHoldingQty}`)
  console.log(`  = Should be in warehouse: ${bs.calculatedWarehouseAvailable}`)
  console.log(`  Current in warehouse:     ${audit.currentAvailable}`)
  console.log(`  Gap:                      ${bs.gapVsCurrent}`)

  console.log("\n=== BRANCH HOLDINGS ===")
  if (audit.branchAssignments.length === 0) {
    console.log("  (none)")
  }
  for (const row of audit.branchAssignments) {
    console.log(`  ${row.quantity} pcs | ${row.productDescription} | branch ${row.branchId}`)
  }

  console.log("\n=== DELIVERED ORDERS ===")
  const delivered = audit.orderLines.filter((l) => l.status === "delivered")
  if (delivered.length === 0) console.log("  (none)")
  for (const line of delivered) {
    console.log(`  ${line.orderNumber} | qty ${line.qty} | deducted: ${line.inventoryDeductedAt ? "yes" : "no"}`)
  }

  if (!shouldFix) {
    if (bs.gapVsCurrent !== 0) {
      console.log(`\nTo correct warehouse stock, run:`)
      console.log(`  npx tsx scripts/trace-156-battery-stock.ts --fix --target=${fixTarget}`)
    }
    return
  }

  const result = await correctManualInventoryAvailable({
    model: audit.model,
    targetAvailable: fixTarget,
    correctedBy: "trace-156-battery-stock script",
    reason: `Reconcile ${audit.name}: ${audit.totalQty} total − ${bs.deliveredOrderQty} delivered − ${bs.branchHoldingQty} branches`,
  })

  console.log("\n=== FIX RESULT ===")
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
