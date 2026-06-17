import {
  auditManualInventoryStock,
  correctManualInventoryAvailable,
} from "@/lib/manual-inventory-reconcile"

const MODEL = "MAN-LITHIUM-IRON-PHOSPHATE-B"

async function main() {
  const args = process.argv.slice(2)
  const shouldFix = args.includes("--fix")
  const targetArg = args.find((a) => a.startsWith("--target="))
  const targetAvailable = targetArg ? Number(targetArg.split("=")[1]) : 175

  const audit = await auditManualInventoryStock(MODEL)
  if (!audit) {
    console.error("Item not found:", MODEL)
    process.exit(1)
  }

  console.log("=== MANUAL INVENTORY AUDIT ===")
  console.log("Name:", audit.name)
  console.log("Model:", audit.model)
  console.log("Total qty:", audit.totalQty)
  console.log("Current available:", audit.currentAvailable)
  console.log("Committed (total - available):", audit.committed)
  console.log("Outbound from history:", audit.totalQty - audit.expectedAvailable)
  console.log("Expected available (from history):", audit.expectedAvailable)
  console.log("Discrepancy (current - expected):", audit.discrepancy)

  console.log("\n=== MOVEMENTS ===")
  let outSum = 0
  for (const row of audit.movements) {
    const out =
      row.type === "out" ||
      row.type === "assigned_to_branch" ||
      row.type === "branch_transfer" ||
      row.type === "manual_subtract_stock"
        ? Math.abs(row.quantity)
        : 0
    if (out > 0) outSum += out
    console.log(
      [
        row.date.slice(0, 10),
        row.type,
        row.quantity,
        row.referenceType,
        row.referenceNumber,
        row.notes.slice(0, 70),
      ].join(" | "),
    )
  }
  console.log("Sum of outbound movements:", outSum)

  console.log("\n=== ORDER LINES ===")
  for (const line of audit.orderLines) {
    console.log(
      [line.orderNumber, line.status, "qty", line.qty, line.description, "deducted", line.inventoryDeductedAt].join(
        " | ",
      ),
    )
  }

  console.log("\n=== BRANCH ASSIGNMENTS ===")
  for (const row of audit.branchAssignments) {
    console.log([row.quantity, row.productDescription, row.branchId, (row.notes || "").slice(0, 60)].join(" | "))
  }

  if (!shouldFix) {
    console.log("\nRun with --fix --target=175 to correct available stock.")
    return
  }

  if (!Number.isFinite(targetAvailable)) {
    console.error("Invalid --target value")
    process.exit(1)
  }

  const result = await correctManualInventoryAvailable({
    model: MODEL,
    targetAvailable,
    correctedBy: "trace-lithium-stock script",
    reason: `Reconcile to ${targetAvailable} pcs (was ${audit.currentAvailable})`,
  })

  console.log("\n=== FIX RESULT ===")
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
