/**
 * Merge Office Back (BR003) 15.6 kWh duplicate stock rows and set qty from transfer history.
 *
 *   node scripts/reconcile-br003-156-battery.mjs
 *   node scripts/reconcile-br003-156-battery.mjs --apply
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")
const BRANCH_CODE = "BR003"
const BATCH_BULLET_RE = /^•\s*(\d+(?:\.\d+)?)\s+(\S+)\s+×\s+(.+)$/

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function is156(text) {
  const n = normalize(text)
  if (!n) return false
  if (n === "hsld15kw") return true
  if (n.includes("man-15-6") && (n.includes("battery") || n.includes("kwh"))) return true
  if ((n.includes("15.6") || n.includes("15-6")) && n.includes("kwh") && n.includes("battery")) {
    return true
  }
  return false
}

function parseBatchItems(note) {
  const items = []
  for (const raw of String(note || "").split("\n")) {
    const line = raw.trim()
    const match = line.match(BATCH_BULLET_RE)
    if (!match) continue
    let rest = match[3].trim()
    const noteSep = rest.indexOf(" — Note:")
    if (noteSep >= 0) rest = rest.slice(0, noteSep).trim()
    items.push({ quantity: Number(match[1]), productDescription: rest })
  }
  return items
}

async function main() {
  const branch = await prisma.erpBranch.findFirst({
    where: { code: BRANCH_CODE },
  })
  if (!branch) {
    throw new Error(`Branch ${BRANCH_CODE} not found`)
  }

  const inventoryRows = await prisma.erpBranchInventory.findMany({
    where: { branchId: branch.id },
    orderBy: { assignedAt: "asc" },
  })
  const batteryRows = inventoryRows.filter((row) => is156(row.productDescription))
  const currentQty = batteryRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0)

  const transfers = await prisma.erpBranchInventoryTransfer.findMany({
    where: {
      OR: [{ toBranchId: branch.id }, { fromBranchId: branch.id }],
    },
    orderBy: { transferredAt: "asc" },
  })

  let transferNet = 0
  const movements = []

  for (const row of transfers) {
    const fromHere = row.fromBranchId === branch.id || row.fromBranchCode === BRANCH_CODE
    const toHere = row.toBranchId === branch.id || row.toBranchCode === BRANCH_CODE
    if (!fromHere && !toHere) continue

    const batchItems = parseBatchItems(row.note)
    const lines =
      batchItems.length > 0
        ? batchItems
        : [{ quantity: Number(row.quantity || 0), productDescription: row.productDescription }]

    // Skip legacy per-line rows when a combined batch record exists for the same batch.
    if (
      row.transferBatchId &&
      batchItems.length === 0 &&
      transfers.some(
        (other) =>
          other.transferBatchId === row.transferBatchId &&
          parseBatchItems(other.note).length > 0,
      )
    ) {
      continue
    }

    for (const line of lines) {
      if (!is156(line.productDescription)) continue
      const qty = Number(line.quantity || 0)
      if (toHere) transferNet += qty
      if (fromHere) transferNet -= qty
      movements.push({
        at: row.transferredAt,
        dir: toHere && !fromHere ? "in" : fromHere && !toHere ? "out" : "both",
        qty,
        by: row.transferredBy,
        product: line.productDescription,
      })
    }
  }

  const posOut = await prisma.erpInventoryHistory.findMany({
    where: {
      referenceType: "pos_sale",
      OR: [
        { locationLabel: { contains: branch.name, mode: "insensitive" } },
        { notes: { contains: branch.name, mode: "insensitive" } },
        { notes: { contains: BRANCH_CODE, mode: "insensitive" } },
      ],
    },
  })
  const posQty = posOut
    .filter((row) => is156(row.itemDescription))
    .reduce((sum, row) => sum + Number(row.quantity || 0), 0)

  const expected = Math.max(0, transferNet - posQty)

  console.log("Branch:", branch.name, branch.code, branch.id)
  console.log("Inventory rows:")
  for (const row of batteryRows) {
    console.log(
      `  ${row.quantity} pcs | ${row.productDescription} | ${row.assignedAt.toISOString()} | ${row.id}`,
    )
  }
  console.log("Current inventory total:", currentQty)
  console.log("Transfer net:", transferNet)
  console.log("POS sold:", posQty)
  console.log("Expected on hand:", expected)
  console.log("Movements:")
  for (const m of movements) {
    console.log(`  ${m.at.toISOString()} ${m.dir} ${m.qty} | ${m.by} | ${m.product}`)
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to merge rows and set quantity.")
    return
  }

  if (batteryRows.length === 0) {
    throw new Error("No 15.6 kWh inventory rows found on BR003")
  }

  const keeper = batteryRows[0]
  const extraIds = batteryRows.slice(1).map((row) => row.id)

  await prisma.$transaction(async (tx) => {
    await tx.erpBranchInventory.update({
      where: { id: keeper.id },
      data: {
        quantity: expected,
        productDescription: keeper.productDescription,
      },
    })
    if (extraIds.length) {
      await tx.erpBranchInventory.deleteMany({ where: { id: { in: extraIds } } })
    }
  })

  console.log(
    `\nApplied: 1 row, ${expected} pcs. Removed ${extraIds.length} duplicate row(s).`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
