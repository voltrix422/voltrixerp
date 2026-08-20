import {
  chargeAmountPkr,
  chargeTypeLabel,
  importDisplayName,
  type CustomsDutyEntry,
  type ImportCharge,
} from "@/lib/import-shipment"

/** Categories that belong to the PSW / customs step (also matched via fromDutyId). */
const PSW_CATEGORIES = new Set([
  "customs_duty",
  "additional_customs_duty",
  "duty_tax_customs_partial",
  "sales_tax",
  "income_tax",
  "fed",
  "regulatory_fee",
  "cess",
  "psw_fee",
])

export type ImportShipmentMoneyOutRow = {
  id: string
  shipmentNumber?: string | null
  blNumber?: string | null
  supplierName?: string | null
  gdNumber?: string | null
  gdDate?: string | null
  createdAt: Date | string
  updatedAt?: Date | string | null
  fxRate?: number | null
  currency?: string | null
  charges?: unknown
  customsDuties?: unknown
}

export type ImportChargesSplit = {
  pswPkr: number
  chargesPkr: number
  combinedPkr: number
  /** Per-shipment breakdown for hover / popup — every import with amounts */
  shipments: Array<{
    id: string
    label: string
    supplier: string
    pswPkr: number
    chargesPkr: number
    combinedPkr: number
    pswLines: string[]
    chargeLines: string[]
    pswItems: { label: string; amount: number }[]
    chargeItems: { label: string; amount: number }[]
    dateIso: string
  }>
}

function asCharges(raw: unknown): ImportCharge[] {
  return Array.isArray(raw) ? (raw as ImportCharge[]) : []
}

function asDuties(raw: unknown): CustomsDutyEntry[] {
  return Array.isArray(raw) ? (raw as CustomsDutyEntry[]) : []
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Charges step + any PSW duties not yet synced into charges. */
export function effectiveImportCharges(
  sh: Pick<ImportShipmentMoneyOutRow, "charges" | "customsDuties">,
): ImportCharge[] {
  const charges = asCharges(sh.charges).filter(c => c.category !== "product")
  const syncedDutyIds = new Set(
    charges.map(c => c.fromDutyId).filter(Boolean) as string[],
  )
  const duties = asDuties(sh.customsDuties)
  const missing: ImportCharge[] = duties
    .filter(d => d.id && !syncedDutyIds.has(d.id))
    .map(d => ({
      id: `duty-${d.id}`,
      category: d.category,
      description: d.description || d.name,
      amount: Number(d.amount) || 0,
      currency: d.currency || "PKR",
      fxRate: 0,
      isShared: d.category === "cess" || !d.itemId,
      itemId: d.category === "cess" ? "" : (d.itemId || ""),
      paid: !!d.paid,
      paymentRef: d.paymentRef || "",
      notes: "",
      fromDutyId: d.id,
    }))
  return [...charges, ...missing]
}

export function isPswCharge(c: ImportCharge): boolean {
  if (c.category === "product") return false
  if (c.fromDutyId) return true
  return PSW_CATEGORIES.has(String(c.category || ""))
}

export function isImportOtherCharge(c: ImportCharge): boolean {
  if (c.category === "product") return false
  return !isPswCharge(c)
}

/**
 * Sum PSW + Charges for every import shipment that has amounts.
 * Includes the full Imported Purchases list (not period-truncated) so Finance
 * matches Purchase → Imported Purchases. start/end kept for API compatibility.
 */
export function importChargesSplitInPeriod(
  shipments: ImportShipmentMoneyOutRow[],
  _start: Date,
  _end: Date,
): ImportChargesSplit {
  let pswPkr = 0
  let chargesPkr = 0
  const rows: ImportChargesSplit["shipments"] = []

  for (const sh of shipments) {
    const createdDate = parseDate(sh.createdAt)
    const gdDate = parseDate(String(sh.gdDate || "").trim() || null)
    const fx = Number(sh.fxRate) || 0
    const charges = effectiveImportCharges(sh)
    let shPsw = 0
    let shCharges = 0
    const pswLines: string[] = []
    const chargeLines: string[] = []
    const pswItems: { label: string; amount: number }[] = []
    const chargeItems: { label: string; amount: number }[] = []

    for (const c of charges) {
      const amt = chargeAmountPkr(c, fx)
      if (amt <= 0.004) continue
      const label = chargeTypeLabel(c)
      if (isPswCharge(c)) {
        shPsw += amt
        pswLines.push(`${label}: PKR ${Math.round(amt).toLocaleString()}`)
        pswItems.push({ label, amount: amt })
      } else if (isImportOtherCharge(c)) {
        shCharges += amt
        chargeLines.push(`${label}: PKR ${Math.round(amt).toLocaleString()}`)
        chargeItems.push({ label, amount: amt })
      }
    }

    if (shPsw <= 0.004 && shCharges <= 0.004) continue

    const dateIso = (gdDate || createdDate || new Date()).toISOString()
    pswPkr += shPsw
    chargesPkr += shCharges
    rows.push({
      id: sh.id,
      label: importDisplayName({
        shipmentNumber: sh.shipmentNumber || "",
        blNumber: sh.blNumber || "",
      }),
      supplier: String(sh.supplierName || "").trim() || "—",
      pswPkr: shPsw,
      chargesPkr: shCharges,
      combinedPkr: shPsw + shCharges,
      pswLines,
      chargeLines,
      pswItems,
      chargeItems,
      dateIso,
    })
  }

  rows.sort((a, b) => b.combinedPkr - a.combinedPkr)
  return {
    pswPkr,
    chargesPkr,
    combinedPkr: pswPkr + chargesPkr,
    shipments: rows,
  }
}
