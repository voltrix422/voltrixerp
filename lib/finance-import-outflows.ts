import {
  chargeAmountPkr,
  chargeTypeLabel,
  importDisplayName,
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
  fxRate?: number | null
  currency?: string | null
  charges?: unknown
}

export type ImportChargesSplit = {
  pswPkr: number
  chargesPkr: number
  combinedPkr: number
  /** Per-shipment breakdown for hover tooltips */
  shipments: Array<{
    id: string
    label: string
    supplier: string
    pswPkr: number
    chargesPkr: number
    combinedPkr: number
    pswLines: string[]
    chargeLines: string[]
    dateIso: string
  }>
}

function inRange(d: Date, start: Date, end: Date) {
  return d >= start && d <= end
}

function asCharges(raw: unknown): ImportCharge[] {
  return Array.isArray(raw) ? (raw as ImportCharge[]) : []
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

/** Sum PSW duties and Charges-step amounts for shipments whose GD or created date falls in period. */
export function importChargesSplitInPeriod(
  shipments: ImportShipmentMoneyOutRow[],
  start: Date,
  end: Date,
): ImportChargesSplit {
  let pswPkr = 0
  let chargesPkr = 0
  const rows: ImportChargesSplit["shipments"] = []

  for (const sh of shipments) {
    const createdIso =
      sh.createdAt instanceof Date ? sh.createdAt.toISOString() : String(sh.createdAt || "")
    const gd = String(sh.gdDate || "").trim()
    const gdDate = gd ? new Date(gd) : null
    const createdDate = createdIso ? new Date(createdIso) : null
    const inPeriod =
      (gdDate && !Number.isNaN(gdDate.getTime()) && inRange(gdDate, start, end)) ||
      (createdDate && !Number.isNaN(createdDate.getTime()) && inRange(createdDate, start, end))
    if (!inPeriod) continue

    const dateIso =
      gdDate && !Number.isNaN(gdDate.getTime()) ? gdDate.toISOString() : createdIso || new Date().toISOString()

    const fx = Number(sh.fxRate) || 0
    const charges = asCharges(sh.charges)
    let shPsw = 0
    let shCharges = 0
    const pswLines: string[] = []
    const chargeLines: string[] = []

    for (const c of charges) {
      const amt = chargeAmountPkr(c, fx)
      if (amt <= 0.004) continue
      const label = chargeTypeLabel(c)
      if (isPswCharge(c)) {
        shPsw += amt
        pswLines.push(`${label}: PKR ${Math.round(amt).toLocaleString()}`)
      } else if (isImportOtherCharge(c)) {
        shCharges += amt
        chargeLines.push(`${label}: PKR ${Math.round(amt).toLocaleString()}`)
      }
    }

    if (shPsw <= 0.004 && shCharges <= 0.004) continue

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
