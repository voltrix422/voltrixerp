/**
 * Backfill missing fromBranchId / toBranchId on erpBranchInventoryTransfer
 * when code or name still identifies the branch (legacy bulk branch→main returns).
 *
 *   node scripts/backfill-branch-transfer-from-ids.mjs
 *   node scripts/backfill-branch-transfer-from-ids.mjs --apply
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

async function main() {
  const branches = await prisma.erpBranch.findMany({
    select: { id: true, code: true, name: true },
  })
  const byCode = new Map(branches.filter((b) => b.code).map((b) => [b.code, b]))
  const byName = new Map(branches.filter((b) => b.name).map((b) => [b.name, b]))

  const transfers = await prisma.erpBranchInventoryTransfer.findMany({
    where: {
      OR: [{ fromBranchId: null }, { fromBranchId: "" }],
    },
    orderBy: { transferredAt: "asc" },
  })

  const updates = []
  for (const row of transfers) {
    const match =
      (row.fromBranchCode && byCode.get(row.fromBranchCode)) ||
      (row.fromBranchName && byName.get(row.fromBranchName)) ||
      null
    if (!match) continue
    if (match.id === row.fromBranchId) continue
    updates.push({
      id: row.id,
      fromBranchId: match.id,
      fromBranchCode: match.code || row.fromBranchCode,
      fromBranchName: match.name || row.fromBranchName,
      when: row.transferredAt,
      product: row.productDescription,
      qty: row.quantity,
      to: `${row.toBranchName} (${row.toBranchCode})`,
    })
  }

  console.log(`Found ${updates.length} transfer row(s) with missing fromBranchId that can be backfilled.`)
  for (const u of updates) {
    console.log(
      `  ${u.when.toISOString()} | ${u.qty} | ${u.product.slice(0, 60)} | → ${u.to} | set from=${u.fromBranchId}`,
    )
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write fromBranchId.")
    return
  }

  let n = 0
  for (const u of updates) {
    await prisma.erpBranchInventoryTransfer.update({
      where: { id: u.id },
      data: {
        fromBranchId: u.fromBranchId,
        fromBranchCode: u.fromBranchCode,
        fromBranchName: u.fromBranchName,
      },
    })
    n += 1
  }
  console.log(`\nUpdated ${n} row(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
