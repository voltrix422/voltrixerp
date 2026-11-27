/** Installments solar estimate worksheet math. */

export const DEFAULT_ADVANCE_PERCENT = 26
export const DEFAULT_FACTOR = 1.5
export const DEFAULT_MONTHS = 18
export const DEFAULT_PANEL_WATT = 645
export const DEFAULT_STRUCTURE_UNIT_PRICE = 4500
export const DEFAULT_STRUCTURE_RS_PER_WATT = 3.6
export const DEFAULT_RAISED_RS_PER_WATT = 13
export const DEFAULT_RAISED_MAX_FT = 8

export type EstimateCostLine = {
  id?: string
  name: string
  amount: number
  kind?: string
}

export type EstimateWorksheetMeta = {
  panelWatt?: number
  structureUnitPrice?: number
  structureRsPerWatt?: number
  raisedRsPerWatt?: number
  raisedMaxFt?: number
  advancePercent?: number
  months?: number
  transportDefault?: number
}

export type EstimateBreakdown = {
  systemWatts: number
  panelCount: number
  structureCount: number
  structureFromUnit: number
  structureFromRsPerWatt: number
  raisedStructureAmount: number
  cost: number
  advancePercent: number
  advance: number
  remainingY: number
  factor: number
  actualCost: number
  months: number
  monthlyInstallment: number
}

export function roundMoney(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export function systemWattsFromKw(systemKw: number) {
  const kw = Number(systemKw) || 0
  return Math.max(0, Math.round(kw * 1000))
}

/** Panels ≈ system watts ÷ panel watt, rounded up. */
export function calcPanelCount(systemKw: number, panelWatt: number) {
  const watts = systemWattsFromKw(systemKw)
  const watt = Number(panelWatt) || 0
  if (watts <= 0 || watt <= 0) return 0
  return Math.ceil(watts / watt)
}

/** L2 structures ≈ panels ÷ 2. */
export function calcStructureCount(panelCount: number) {
  const n = Math.max(0, Math.floor(Number(panelCount) || 0))
  return Math.ceil(n / 2)
}

export function sumCostLines(lines: Array<{ amount?: number }>) {
  return roundMoney(
    lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
  )
}

export function calcInstallmentBreakdown(input: {
  systemKw: number
  panelWatt?: number
  structureUnitPrice?: number
  structureRsPerWatt?: number
  raisedRsPerWatt?: number
  advancePercent?: number
  factor?: number
  months?: number
  lines: Array<{ amount?: number }>
}): EstimateBreakdown {
  const systemKw = Number(input.systemKw) || 0
  const panelWatt = Number(input.panelWatt) || DEFAULT_PANEL_WATT
  const structureUnitPrice =
    Number(input.structureUnitPrice) || DEFAULT_STRUCTURE_UNIT_PRICE
  const structureRsPerWatt =
    Number(input.structureRsPerWatt) || DEFAULT_STRUCTURE_RS_PER_WATT
  const raisedRsPerWatt = Number(input.raisedRsPerWatt) || DEFAULT_RAISED_RS_PER_WATT
  const advancePercent =
    Number(input.advancePercent) > 0
      ? Number(input.advancePercent)
      : DEFAULT_ADVANCE_PERCENT
  const factor =
    Number(input.factor) > 0 ? Number(input.factor) : DEFAULT_FACTOR
  const months =
    Number(input.months) > 0
      ? Math.floor(Number(input.months))
      : DEFAULT_MONTHS

  const systemWatts = systemWattsFromKw(systemKw)
  const panelCount = calcPanelCount(systemKw, panelWatt)
  const structureCount = calcStructureCount(panelCount)
  const structureFromUnit = roundMoney(structureCount * structureUnitPrice)
  const structureFromRsPerWatt = roundMoney(systemWatts * structureRsPerWatt)
  const raisedStructureAmount = roundMoney(systemWatts * raisedRsPerWatt)

  const cost = sumCostLines(input.lines)
  const advance = roundMoney((cost * advancePercent) / 100)
  const remainingY = roundMoney(Math.max(0, cost - advance))
  const actualCost = roundMoney(remainingY * factor)
  const monthlyInstallment =
    months > 0 ? roundMoney(actualCost / months) : 0

  return {
    systemWatts,
    panelCount,
    structureCount,
    structureFromUnit,
    structureFromRsPerWatt,
    raisedStructureAmount,
    cost,
    advancePercent,
    advance,
    remainingY,
    factor,
    actualCost,
    months,
    monthlyInstallment,
  }
}

export const DEFAULT_COST_LINE_NAMES = [
  "Panels",
  "BOS",
  "Installation",
  "Transportation",
  "Structure (L2/L3)",
  "Raised structure",
] as const
