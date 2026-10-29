import { prisma } from "@/lib/db"

const REF_PREFIX = "PC-"

/** Next petty cash ref: PC-00001, PC-00002, … */
export async function generatePettyCashReferenceNumber(): Promise<string> {
  const rows = await prisma.erpPettyCashAllocation.findMany({
    where: { referenceNumber: { startsWith: REF_PREFIX } },
    select: { referenceNumber: true },
  })
  let max = 0
  for (const row of rows) {
    const n = Number(String(row.referenceNumber).replace(/^PC-/i, ""))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${REF_PREFIX}${String(max + 1).padStart(5, "0")}`
}

/** Assign PC-##### to any allocations missing a reference (oldest first). */
export async function backfillPettyCashReferenceNumbers(): Promise<number> {
  const missing = await prisma.erpPettyCashAllocation.findMany({
    where: { referenceNumber: "" },
    orderBy: { allocatedAt: "asc" },
    select: { id: true },
  })
  if (missing.length === 0) return 0

  const existing = await prisma.erpPettyCashAllocation.findMany({
    where: { referenceNumber: { startsWith: REF_PREFIX } },
    select: { referenceNumber: true },
  })
  let max = 0
  for (const row of existing) {
    const n = Number(String(row.referenceNumber).replace(/^PC-/i, ""))
    if (Number.isFinite(n) && n > max) max = n
  }

  for (const row of missing) {
    max += 1
    const referenceNumber = `${REF_PREFIX}${String(max).padStart(5, "0")}`
    await prisma.erpPettyCashAllocation.update({
      where: { id: row.id },
      data: { referenceNumber },
    })
  }
  return missing.length
}
