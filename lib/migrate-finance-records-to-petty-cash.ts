import { prisma } from "@/lib/db"
import {
  PERSONAL_LEDGER_MARKER,
  PERSONAL_LEDGER_PURPOSE,
} from "@/lib/petty-cash-personal"

export const FINANCE_MIGRATION_MARKER = "__finance_migration_jun2026__"
export const OFFICE_LEDGER_EMPLOYEE_ID = "__office_expense_ledger__"
export const OFFICE_LEDGER_EMPLOYEE_NAME = "finance"
export const OFFICE_LEDGER_MIGRATION_MARKER = "__office_finance_migration_jun2026__"

/** One-time Jun 2026 finance records to move into petty cash as negative balance. */
export const FINANCE_MIGRATION_FINGERPRINTS = [
  { title: "Delivery of batteries to haseeb", amount: 500 },
  { title: "Carrier of batteries to and from haseeb", amount: 1200 },
  { title: "Delivery of stickers", amount: 300 },
  { title: "Fluid valve", amount: 300 },
  { title: "Water dispenser", amount: 35000 },
  { title: "Delivery of water dispenser to College road outlet", amount: 900 },
  { title: "Barcode stikers", amount: 740 },
  { title: "Savor foods Lunch", amount: 5560 },
  { title: "Milk", amount: 450 },
  { title: "Fruit cake, Petties", amount: 740 },
  { title: "Biscuits, fruit cake, sandwich", amount: 1980 },
  { title: "Mosquitoes Spray", amount: 2290 },
  { title: "Water bill", amount: 5390 },
  { title: "Delivery of batteries to office", amount: 500 },
  { title: "Delivery of stacker", amount: 500 },
  { title: "Rawal bolt", amount: 800 },
  { title: "Milk", amount: 260 },
  { title: "Milk and alaichi", amount: 360 },
  { title: "Transportation of batteries from lab to haseeb", amount: 500 },
  { title: "Shifting of furniture from office to warehouse", amount: 500 },
  { title: "Toner refill", amount: 500 },
  { title: "Warehouse room door key", amount: 400 },
  { title: "Delivery charges for cover", amount: 2500 },
  { title: "Catalogue design payment", amount: 6000 },
] as const

export const EXPECTED_MIGRATION_COUNT = FINANCE_MIGRATION_FINGERPRINTS.length
export const EXPECTED_MIGRATION_TOTAL = FINANCE_MIGRATION_FINGERPRINTS.reduce(
  (sum, item) => sum + item.amount,
  0,
)

function normalizeTitle(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function matchesFingerprint(
  record: { title: string; amount: number },
  fingerprint: { title: string; amount: number },
) {
  return (
    normalizeTitle(record.title) === normalizeTitle(fingerprint.title) &&
    Math.abs(record.amount - fingerprint.amount) < 0.01
  )
}

function migrationReceiptNote(recordId: string, category: string, tag: string, notes: string) {
  const parts = [
    `Category: ${category || "—"}`,
    tag ? `Tag: ${tag}` : null,
    notes ? `Notes: ${notes}` : null,
    "Migrated from Finance → Records (one-time Jun 2026)",
    `${FINANCE_MIGRATION_MARKER}:${recordId}`,
  ].filter(Boolean)
  return parts.join(" | ")
}

export async function findFinanceRecordsToMigrate() {
  const candidates = await prisma.erpFinanceRecord.findMany({
    where: {
      petty_cash_receipt_id: "",
    },
    orderBy: { createdAt: "asc" },
  })

  const matched: typeof candidates = []
  const usedIds = new Set<string>()

  for (const fingerprint of FINANCE_MIGRATION_FINGERPRINTS) {
    const record = candidates.find(
      (item) =>
        !usedIds.has(item.id) &&
        matchesFingerprint(item, fingerprint),
    )
    if (record) {
      matched.push(record)
      usedIds.add(record.id)
    }
  }

  return matched
}

async function findOfficeExpenseLedger() {
  return prisma.erpPettyCashAllocation.findFirst({
    where: {
      employeeId: OFFICE_LEDGER_EMPLOYEE_ID,
      notes: { contains: OFFICE_LEDGER_MIGRATION_MARKER },
    },
  })
}

/** Rename migrated office ledger from "Office Expenses" → "finance" (idempotent). */
export async function syncOfficeLedgerDisplayName() {
  const ledger = await findOfficeExpenseLedger()
  if (!ledger || ledger.employeeName === OFFICE_LEDGER_EMPLOYEE_NAME) {
    return { updated: false, allocationId: ledger?.id }
  }

  await prisma.$transaction([
    prisma.erpPettyCashAllocation.update({
      where: { id: ledger.id },
      data: { employeeName: OFFICE_LEDGER_EMPLOYEE_NAME },
    }),
    prisma.erpPettyCashReceipt.updateMany({
      where: { allocationId: ledger.id },
      data: { employeeName: OFFICE_LEDGER_EMPLOYEE_NAME },
    }),
  ])

  return { updated: true, allocationId: ledger.id }
}

async function ensureOfficeExpenseLedger(allocatedBy: string) {
  const existing = await findOfficeExpenseLedger()

  if (existing) {
    if (existing.employeeName !== OFFICE_LEDGER_EMPLOYEE_NAME) {
      await syncOfficeLedgerDisplayName()
      return prisma.erpPettyCashAllocation.findUniqueOrThrow({ where: { id: existing.id } })
    }
    return existing
  }

  return prisma.erpPettyCashAllocation.create({
    data: {
      employeeId: OFFICE_LEDGER_EMPLOYEE_ID,
      employeeName: OFFICE_LEDGER_EMPLOYEE_NAME,
      employeeRole: "Finance",
      amount: 0,
      purpose: PERSONAL_LEDGER_PURPOSE,
      notes: `${PERSONAL_LEDGER_MARKER} ${OFFICE_LEDGER_MIGRATION_MARKER}`,
      allocatedBy,
      status: "active",
    },
  })
}

export async function previewFinanceToPettyCashMigration() {
  const records = await findFinanceRecordsToMigrate()
  const total = records.reduce((sum, record) => sum + record.amount, 0)

  const existingLedger = await prisma.erpPettyCashAllocation.findFirst({
    where: {
      employeeId: OFFICE_LEDGER_EMPLOYEE_ID,
      notes: { contains: OFFICE_LEDGER_MIGRATION_MARKER },
    },
  })

  const migratedReceiptCount = existingLedger
    ? await prisma.erpPettyCashReceipt.count({
        where: {
          allocationId: existingLedger.id,
          notes: { contains: FINANCE_MIGRATION_MARKER },
        },
      })
    : 0

  return {
    eligibleCount: records.length,
    eligibleTotal: total,
    expectedCount: EXPECTED_MIGRATION_COUNT,
    expectedTotal: EXPECTED_MIGRATION_TOTAL,
    alreadyMigratedReceipts: migratedReceiptCount,
    records: records.map((record) => ({
      id: record.id,
      title: record.title,
      amount: record.amount,
      category: record.category,
      tag: record.tag,
      createdAt: record.createdAt.toISOString(),
    })),
    missingFingerprints: FINANCE_MIGRATION_FINGERPRINTS.filter(
      (fingerprint) =>
        !records.some((record) => matchesFingerprint(record, fingerprint)),
    ),
  }
}

export async function runFinanceToPettyCashMigration(allocatedBy: string) {
  const preview = await previewFinanceToPettyCashMigration()

  if (preview.eligibleCount === 0) {
    return {
      ok: true,
      migratedCount: 0,
      migratedTotal: 0,
      message: "No matching finance records left to migrate.",
      ...preview,
    }
  }

  const ledger = await ensureOfficeExpenseLedger(allocatedBy)
  const records = await findFinanceRecordsToMigrate()
  let migratedCount = 0
  let migratedTotal = 0
  const migrated: Array<{ id: string; title: string; amount: number; receiptId: string }> = []

  for (const record of records) {
    const marker = `${FINANCE_MIGRATION_MARKER}:${record.id}`
    const already = await prisma.erpPettyCashReceipt.findFirst({
      where: { notes: { contains: marker } },
    })
    if (already) continue

    const receipt = await prisma.erpPettyCashReceipt.create({
      data: {
        allocationId: ledger.id,
        employeeName: ledger.employeeName,
        description: record.title,
        amount: record.amount,
        receiptProof: record.proof_url || null,
        receiptProofName: record.proof_name || null,
        notes: migrationReceiptNote(record.id, record.category, record.tag, record.notes),
        status: "approved",
        submittedAt: new Date(record.createdAt),
        reviewedBy: allocatedBy,
        reviewedAt: new Date(record.createdAt),
        reviewNotes: "Auto-approved (finance records migration)",
      },
    })

    await prisma.erpFinanceRecord.delete({ where: { id: record.id } })

    migratedCount += 1
    migratedTotal += record.amount
    migrated.push({
      id: record.id,
      title: record.title,
      amount: record.amount,
      receiptId: receipt.id,
    })
  }

  return {
    ok: true,
    migratedCount,
    migratedTotal,
    allocationId: ledger.id,
    negativeBalance: -migratedTotal,
    migrated,
    missingFingerprints: preview.missingFingerprints,
    message:
      migratedCount > 0
        ? `Moved ${migratedCount} finance records to petty cash (PKR ${migratedTotal.toLocaleString()} negative balance).`
        : "All matching records were already migrated.",
  }
}
