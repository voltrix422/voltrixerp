/**
 * Merge duplicate branch inventory rows (same branch + stock + product).
 * Run on VPS: node scripts/merge-duplicate-branch-inventory.mjs
 * Dry run (default): node scripts/merge-duplicate-branch-inventory.mjs
 * Apply:           node scripts/merge-duplicate-branch-inventory.mjs --apply
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const apply = process.argv.includes("--apply")

function groupKey(row) {
  return [row.branchId, (row.productDescription || "").trim().toLowerCase()].join("::")
}

async function main() {
  const [rows, branches] = await Promise.all([
    prisma.erpBranchInventory.findMany({
      orderBy: [{ branchId: "asc" }, { assignedAt: "asc" }],
    }),
    prisma.erpBranch.findMany({ select: { id: true, name: true, code: true } }),
  ])
  const branchById = new Map(branches.map((b) => [b.id, b]))

  const groups = new Map()
  for (const row of rows) {
    const key = groupKey(row)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  let mergeGroups = 0
  let rowsToDelete = 0

  for (const [, list] of groups) {
    if (list.length < 2) continue
    mergeGroups++

    const keep = list[0]
    const extras = list.slice(1)
    const totalQty = list.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
    rowsToDelete += extras.length

    const branch = branchById.get(keep.branchId)
    console.log(
      `\n${branch?.name || keep.branchId} (${branch?.code || "?"})`,
    )
    console.log(`  Product: ${keep.productDescription}`)
    console.log(`  Rows: ${list.length} → 1 | Qty: ${list.map((r) => r.quantity).join(" + ")} = ${totalQty}`)

    if (apply) {
      await prisma.erpBranchInventory.update({
        where: { id: keep.id },
        data: { quantity: totalQty },
      })
      for (const extra of extras) {
        await prisma.erpBranchInventory.delete({ where: { id: extra.id } })
      }
      console.log("  ✓ Merged")
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Duplicate groups: ${mergeGroups}`)
  console.log(`Rows to remove: ${rowsToDelete}`)
  if (!apply) {
    console.log(`\nDry run only. Re-run with --apply to merge.`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
