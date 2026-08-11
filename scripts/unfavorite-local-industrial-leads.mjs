/** One-time: remove favorite flag from RWP/ISB industrial batch. */
import { createRequire } from "module"
const require = createRequire(import.meta.url)
const { PrismaClient } = require("@prisma/client")

const BATCH = "rwp-isb-industrial-2026-08-11"
const prisma = new PrismaClient()

const result = await prisma.crmLead.updateMany({
  where: { importBatchId: BATCH },
  data: { isFavorite: false },
})

console.log(`Unfavorited ${result.count} local industrial lead(s).`)
await prisma.$disconnect()
