import {
  auditManualInventoryStock,
  correctManualInventoryAvailable,
} from "@/lib/manual-inventory-reconcile"

const MODEL = "MAN-LITHIUM-IRON-PHOSPHATE-B"

async function main() {
  const args = process.argv.slice(2)
  const shouldFix = args.includes("--fix")
  const targetArg = args.find((a) => a.startsWith("--target="))
  const targetAvailable = targetArg ? Number(targetArg.split("=")[1]) : undefined

  const audit = await auditManualInventoryStock(MODEL)
  if (!audit) {
    console.error("Item not found:", MODEL)
    process.exit(1)
  }

  const bs = audit.businessSummary
  const fixTarget = Number.isFinite(targetAvailable)
    ? targetAvailable!
    : bs.recommendedAvailable

  console.log("=== MANUAL INVENTORY AUDIT ===")
  console.log("Name:", audit.name)
  console.log("Model:", audit.model)
  console.log("Total qty:", audit.totalQty)
  console.log("Current available:", audit.currentAvailable)

  console.log("\n=== WAREHOUSE MATH (use this) ===")
  console.log(`  Total:                    ${audit.totalQty}`)
  console.log(`  − Delivered orders:       ${bs.deliveredOrderQty}`)
  console.log(`  − At branches:            ${bs.branchHoldingQty}`)
  console.log(`  = Should be in warehouse:   ${bs.calculatedWarehouseAvailable}`)
  console.log(`  Current in warehouse:       ${audit.currentAvailable}`)
  console.log(`  Gap:                        ${bs.gapVsCurrent} (${bs.gapVsCurrent < 0 ? "short by " + Math.abs(bs.gapVsCurrent) : "over by " + bs.gapVsCurrent})`)
  if (bs.approvedNotDeductedQty > 0) {
    console.log(`  Note: ${bs.approvedNotDeductedQty} pcs on approved orders not deducted yet (ORD-00026 etc.)`)
  }
  if (bs.manualSubtractStockQty > 0) {
    console.log(`  Note: ${bs.manualSubtractStockQty} pcs removed via manual −stock adjustment`)
  }

  console.log("\n=== DELIVERED ORDERS ===")
  for (const line of audit.orderLines.filter((l) => l.status === "delivered")) {
    console.log(`  ${line.orderNumber} | qty ${line.qty} | ${line.description}`)
  }

  console.log("\n=== BRANCH HOLDINGS (total " + bs.branchHoldingQty + " pcs) ===")
  for (const row of audit.branchAssignments) {
    console.log(`  ${row.quantity} pcs | ${row.productDescription}`)
  }

  console.log("\n=== RECENT MOVEMENTS (last 10) ===")
  for (const row of audit.movements.slice(-10)) {
    console.log(
      `  ${row.date.slice(0, 10)} | ${row.type} | ${row.quantity} | ${row.referenceType} | ${row.referenceNumber}`,
    )
  }

  if (!shouldFix) {
    console.log(`\nTo fix, run: npx tsx scripts/trace-lithium-stock.ts --fix --target=${fixTarget}`)
    return
  }

  const result = await correctManualInventoryAvailable({
    model: MODEL,
    targetAvailable: fixTarget,
    correctedBy: "trace-lithium-stock script",
    reason: `Reconcile warehouse stock to ${fixTarget} pcs (${audit.totalQty} total − ${bs.deliveredOrderQty} orders − ${bs.branchHoldingQty} branches)`,
  })

  console.log("\n=== FIX RESULT ===")
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
