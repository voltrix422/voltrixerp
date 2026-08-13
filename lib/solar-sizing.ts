import type { CatalogProduct, ProductAvailability } from "@/lib/solar-product-specs"
import {
  getProductAvailability,
  getProductKwh,
  getProductKw,
  getProductWattage,
  fusionMeetsBackup,
  isFusionComboProduct,
  isInStock,
  isSolarPanelProduct,
  isBifacialPanelProduct,
  isStandaloneBatteryProduct,
  isStandaloneInverterProduct,
  isInverterProduct,
} from "@/lib/solar-product-specs"

export type SolarFormulaStep = {
  step: number
  title: string
  formula: string
  calculation: string
  result: string
}

export type SolarCalculatorInput = {
  monthlyUnits: number
  billAmountPkr?: number | null
  tariffPerUnit?: number | null
  city?: string
  phase?: "single" | "three"
  backupHours?: number
  /** Peak simultaneous load (kW) — from appliances or estimated from bill */
  peakLoadKw?: number | null
  /** When set, overrides backup kWh derived from hours */
  backupKwhOverride?: number | null
  sunHoursPerDay?: number
  /** e.g. appliance estimate mode */
  estimateSource?: "bill" | "appliances"
}

export type RecommendedPanel = {
  id: string
  name: string
  wattage: number
  quantity: number
  totalKw: number
  fromCatalog: boolean
  product?: CatalogProduct
}

export type RecommendedProductLine = {
  product: CatalogProduct
  quantity: number
  unitCapacity: number
  totalCapacity: number
  availability: ProductAvailability
}

export type SolarSizingResult = {
  monthlyUnits: number
  dailyKwh: number
  estimatedBillPkr: number | null
  tariffPerUnit: number
  requiredSystemKw: number
  rawSystemKw: number
  peakSunHours: number
  peakLoadKw: number
  recommendedPanel: RecommendedPanel
  /** Primary pick kept for backward compatibility */
  recommendedInverter: CatalogProduct | null
  recommendedBattery: CatalogProduct | null
  /** One or more inverters combined to meet kW need */
  recommendedInverterLines: RecommendedProductLine[]
  /** One or more batteries combined to meet kWh need */
  recommendedBatteryLines: RecommendedProductLine[]
  inverterAvailability: ProductAvailability
  batteryAvailability: ProductAvailability
  panelAvailability: ProductAvailability
  /** True when inverter pick is an all-in-one Fusion unit (covers battery too). */
  kitIsFusionCombo: boolean
  backupKwh: number
  backupHours: number
  estimatedMonthlySavingPkr: number | null
  offsetPercent: number
  analysisNotes: string[]
  formulaSteps: SolarFormulaStep[]
  estimateSource?: "bill" | "appliances"
}

const DEFAULT_TARIFF_PKR = 32
/** Inverter + panel losses — add ~25% to raw system size */
const SYSTEM_LOSS_FACTOR = 1.25
/** LiFePO₄ usable capacity (~80% depth of discharge) */
const LITHIUM_USABLE_FACTOR = 0.8
/** Default active load hours when peak load is estimated from bill */
const DEFAULT_USAGE_HOURS = 6

/** Peak sun hours per day — Pakistan averages ~4–5, varies by city */
export const CITY_PEAK_SUN_HOURS: Record<string, number> = {
  Islamabad: 4.5,
  Rawalpindi: 4.5,
  Lahore: 4.8,
  Karachi: 5.0,
  Peshawar: 4.6,
  Multan: 5.0,
  Faisalabad: 4.9,
  Quetta: 5.2,
  Other: 4.5,
}

export function getPeakSunHours(city?: string, override?: number): number {
  if (override && override > 0) return override
  if (city && CITY_PEAK_SUN_HOURS[city]) return CITY_PEAK_SUN_HOURS[city]
  return CITY_PEAK_SUN_HOURS.Other
}

export function estimatePeakLoadFromBill(dailyKwh: number): number {
  return Math.max(0.5, Math.round((dailyKwh / DEFAULT_USAGE_HOURS) * 10) / 10)
}

export function calculateBatteryCapacityKwh(peakLoadKw: number, backupHours: number): number {
  if (peakLoadKw <= 0 || backupHours <= 0) return 0
  return Math.round(((peakLoadKw * backupHours) / LITHIUM_USABLE_FACTOR) * 10) / 10
}

export function calculateSystemKwFromDaily(dailyKwh: number, peakSunHours: number): {
  rawSystemKw: number
  requiredSystemKw: number
} {
  const rawSystemKw = Math.round(((dailyKwh / peakSunHours) * SYSTEM_LOSS_FACTOR) * 100) / 100
  const requiredSystemKw = Math.ceil(rawSystemKw * 10) / 10
  return { rawSystemKw, requiredSystemKw }
}

export function resolveMonthlyUnits(
  units: number | null | undefined,
  billPkr: number | null | undefined,
  tariff: number | null | undefined,
): number | null {
  if (units && units > 0) return units
  if (billPkr && billPkr > 0) {
    const rate = tariff && tariff > 0 ? tariff : DEFAULT_TARIFF_PKR
    return Math.round(billPkr / rate)
  }
  return null
}

export function resolveTariff(
  billPkr: number | null | undefined,
  units: number,
  tariff: number | null | undefined,
): number {
  if (tariff && tariff > 0) return tariff
  if (billPkr && billPkr > 0 && units > 0) {
    return Math.round((billPkr / units) * 100) / 100
  }
  return DEFAULT_TARIFF_PKR
}

function pickPanel(catalog: CatalogProduct[]): { wattage: number; product?: CatalogProduct } {
  const panels = catalog
    .filter(isSolarPanelProduct)
    .map((p) => ({ p, w: getProductWattage(p) || 0 }))
    .filter((x) => x.w >= 300)
    .sort((a, b) => b.w - a.w)

  const bifacial = panels.filter((x) => isBifacialPanelProduct(x.p))
  const pool = bifacial.length ? bifacial : panels

  if (pool.length) {
    return { wattage: pool[0].w, product: pool[0].p }
  }

  // Reference wattage for sizing math only — no third-party panel SKU
  return { wattage: 620 }
}

function pickInverter(
  catalog: CatalogProduct[],
  requiredKw: number,
  phase: "single" | "three",
  options?: { preferStandalone?: boolean; excludeIds?: string[] },
): CatalogProduct | null {
  const exclude = new Set(options?.excludeIds || [])
  const filterFn = options?.preferStandalone ? isStandaloneInverterProduct : isInverterProduct

  const candidates = catalog
    .filter((p) => filterFn(p) && !exclude.has(String(p.id || "")))
    .map((p) => ({ p, kw: getProductKw(p) || 0 }))
    .filter((x) => x.kw >= requiredKw)
    .sort((a, b) => {
      const stockA = isInStock(a.p) ? 0 : 1
      const stockB = isInStock(b.p) ? 0 : 1
      if (stockA !== stockB) return stockA - stockB
      const fusionA = isFusionComboProduct(a.p) ? 1 : 0
      const fusionB = isFusionComboProduct(b.p) ? 1 : 0
      if (options?.preferStandalone && fusionA !== fusionB) return fusionA - fusionB
      return a.kw - b.kw
    })

  const phaseHint = phase === "three" ? /three|3.?phase|12\s*kw|8\s*kw/i : /single|1.?phase|6\s*kw|5\s*kw/i

  const phaseMatch = candidates.filter(({ p }) =>
    phaseHint.test(
      [p.name, p.model, p.description, p.full_desc].filter(Boolean).join(" "),
    ),
  )

  const pool = phaseMatch.length ? phaseMatch : candidates
  return pool[0]?.p ?? candidates[0]?.p ?? null
}

function pickFusionCombo(
  catalog: CatalogProduct[],
  requiredKw: number,
  backupKwh: number,
): CatalogProduct | null {
  if (backupKwh <= 0) return null

  const candidates = catalog
    .filter(isFusionComboProduct)
    .map((p) => ({ p, kw: getProductKw(p) || 0, kwh: getProductKwh(p) || 0 }))
    .filter((x) => x.kw >= requiredKw && x.kwh >= backupKwh * 0.85)
    .sort((a, b) => {
      const stockA = isInStock(a.p) ? 0 : 1
      const stockB = isInStock(b.p) ? 0 : 1
      if (stockA !== stockB) return stockA - stockB
      return a.kw - b.kw || a.kwh - b.kwh
    })

  return candidates[0]?.p ?? null
}

function pickBattery(
  catalog: CatalogProduct[],
  backupKwh: number,
  excludeIds: string[] = [],
): CatalogProduct | null {
  if (backupKwh <= 0) return null

  const exclude = new Set(excludeIds)

  const candidates = catalog
    .filter((p) => isStandaloneBatteryProduct(p) && !exclude.has(String(p.id || "")))
    .map((p) => ({ p, kwh: getProductKwh(p) || 0 }))
    .filter((x) => x.kwh >= backupKwh * 0.85)
    .sort((a, b) => {
      const stockA = isInStock(a.p) ? 0 : 1
      const stockB = isInStock(b.p) ? 0 : 1
      if (stockA !== stockB) return stockA - stockB
      return a.kwh - b.kwh
    })

  return candidates[0]?.p ?? null
}

function productLine(
  product: CatalogProduct,
  quantity: number,
  unitCapacity: number,
): RecommendedProductLine {
  return {
    product,
    quantity,
    unitCapacity,
    totalCapacity: Math.round(unitCapacity * quantity * 10) / 10,
    availability: getProductAvailability(product),
  }
}

function mergeProductLines(lines: RecommendedProductLine[]): RecommendedProductLine[] {
  const map = new Map<string, RecommendedProductLine>()
  for (const line of lines) {
    const id = String(line.product.id || "")
    const existing = map.get(id)
    if (existing) {
      existing.quantity += line.quantity
      existing.totalCapacity = Math.round(existing.unitCapacity * existing.quantity * 10) / 10
    } else {
      map.set(id, { ...line })
    }
  }
  return [...map.values()]
}

function listInverterCandidates(
  catalog: CatalogProduct[],
  phase: "single" | "three",
  preferStandalone: boolean,
): { p: CatalogProduct; kw: number }[] {
  const filterFn = preferStandalone ? isStandaloneInverterProduct : isInverterProduct
  const phaseHint =
    phase === "three" ? /three|3.?phase|12\s*kw|8\s*kw/i : /single|1.?phase|6\s*kw|5\s*kw|3\.6|4\.2/i

  const all = catalog
    .filter(filterFn)
    .map((p) => ({ p, kw: getProductKw(p) || 0 }))
    .filter((x) => x.kw > 0)
    .sort((a, b) => {
      const stockA = isInStock(a.p) ? 0 : 1
      const stockB = isInStock(b.p) ? 0 : 1
      if (stockA !== stockB) return stockA - stockB
      return b.kw - a.kw
    })

  const phaseMatch = all.filter(({ p }) =>
    phaseHint.test([p.name, p.model, p.description, p.full_desc].filter(Boolean).join(" ")),
  )

  return phaseMatch.length ? phaseMatch : all
}

function listBatteryCandidates(
  catalog: CatalogProduct[],
  excludeIds: string[] = [],
): { p: CatalogProduct; kwh: number }[] {
  const exclude = new Set(excludeIds)
  return catalog
    .filter((p) => isStandaloneBatteryProduct(p) && !exclude.has(String(p.id || "")))
    .map((p) => ({ p, kwh: getProductKwh(p) || 0 }))
    .filter((x) => x.kwh > 0)
    .sort((a, b) => {
      const stockA = isInStock(a.p) ? 0 : 1
      const stockB = isInStock(b.p) ? 0 : 1
      if (stockA !== stockB) return stockA - stockB
      return b.kwh - a.kwh
    })
}

/** Combine catalog units (e.g. 15 + 5 kWh, or 12 + 6 kW) to meet a capacity target. */
function pickCapacityCombo(
  candidates: { p: CatalogProduct; cap: number }[],
  required: number,
  maxUnits = 4,
): RecommendedProductLine[] {
  if (!candidates.length || required <= 0) return []

  const minTotal = required * 0.95

  const singles = candidates
    .filter((c) => c.cap >= minTotal)
    .sort((a, b) => a.cap - b.cap || (isInStock(a.p) ? 0 : 1) - (isInStock(b.p) ? 0 : 1))
  if (singles.length) {
    return [productLine(singles[0].p, 1, singles[0].cap)]
  }

  let bestPair: { lines: RecommendedProductLine[]; total: number } | null = null
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i; j < candidates.length; j++) {
      const qtyI = 1
      const qtyJ = i === j ? 1 : 1
      const total =
        candidates[i].cap * qtyI + (i === j ? candidates[i].cap * qtyJ : candidates[j].cap * qtyJ)
      if (i === j) {
        const t2 = candidates[i].cap * 2
        if (t2 >= minTotal && (!bestPair || t2 < bestPair.total)) {
          bestPair = {
            lines: [productLine(candidates[i].p, 2, candidates[i].cap)],
            total: t2,
          }
        }
        continue
      }
      if (total >= minTotal && (!bestPair || total < bestPair.total)) {
        bestPair = {
          lines: [
            productLine(candidates[i].p, 1, candidates[i].cap),
            productLine(candidates[j].p, 1, candidates[j].cap),
          ],
          total,
        }
      }
    }
  }
  if (bestPair) return mergeProductLines(bestPair.lines)

  const sorted = [...candidates].sort((a, b) => b.cap - a.cap)
  const lines: RecommendedProductLine[] = []
  let total = 0
  let guard = 0
  while (total < minTotal && guard++ < maxUnits) {
    const remaining = required - total
    const pick =
      sorted.find((c) => c.cap >= remaining) ??
      sorted.find((c) => c.cap >= remaining * 0.5) ??
      sorted[0]
    if (!pick) break
    const existing = lines.find((l) => l.product.id === pick.p.id)
    if (existing) {
      existing.quantity += 1
      existing.totalCapacity = Math.round(existing.unitCapacity * existing.quantity * 10) / 10
    } else {
      lines.push(productLine(pick.p, 1, pick.cap))
    }
    total += pick.cap
  }

  return total >= minTotal ? mergeProductLines(lines) : []
}

function pickInverterLines(
  catalog: CatalogProduct[],
  requiredKw: number,
  phase: "single" | "three",
): RecommendedProductLine[] {
  const candidates = listInverterCandidates(catalog, phase, true)
  if (!candidates.length) {
    const any = listInverterCandidates(catalog, phase, false)
    return pickCapacityCombo(
      any.map((c) => ({ p: c.p, cap: c.kw })),
      requiredKw,
    )
  }
  const single = pickInverter(catalog, requiredKw, phase, { preferStandalone: true })
  if (single) {
    const kw = getProductKw(single) || 0
    return [productLine(single, 1, kw)]
  }
  return pickCapacityCombo(
    candidates.map((c) => ({ p: c.p, cap: c.kw })),
    requiredKw,
  )
}

function pickBatteryLines(
  catalog: CatalogProduct[],
  backupKwh: number,
  excludeIds: string[] = [],
): RecommendedProductLine[] {
  const candidates = listBatteryCandidates(catalog, excludeIds)
  if (!candidates.length) return []
  const single = pickBattery(catalog, backupKwh, excludeIds)
  if (single) {
    const kwh = getProductKwh(single) || 0
    return [productLine(single, 1, kwh)]
  }
  return pickCapacityCombo(
    candidates.map((c) => ({ p: c.p, cap: c.kwh })),
    backupKwh,
  )
}

function linesAvailability(lines: RecommendedProductLine[]): ProductAvailability {
  if (!lines.length) return "not_in_catalog"
  if (lines.some((l) => l.availability === "out_of_stock")) return "out_of_stock"
  if (lines.some((l) => l.availability === "low_stock")) return "low_stock"
  if (lines.every((l) => l.availability === "in_stock")) return "in_stock"
  return "not_in_catalog"
}

function totalLineCapacity(lines: RecommendedProductLine[]): number {
  return Math.round(lines.reduce((sum, l) => sum + l.totalCapacity, 0) * 10) / 10
}

function buildFormulaSteps(
  input: SolarCalculatorInput,
  monthlyUnits: number,
  dailyKwh: number,
  peakSunHours: number,
  rawSystemKw: number,
  requiredSystemKw: number,
  peakLoadKw: number,
  backupHours: number,
  backupKwh: number,
): SolarFormulaStep[] {
  const cityLabel = input.city || "Pakistan"
  const steps: SolarFormulaStep[] = []

  if (input.estimateSource === "appliances") {
    steps.push({
      step: 1,
      title: "Daily energy consumption",
      formula: "Load (kW) × Hours used per day = Daily kWh",
      calculation: `${peakLoadKw} kW peak load from appliances`,
      result: `${dailyKwh.toFixed(1)} kWh/day (${monthlyUnits.toLocaleString()} units/month)`,
    })
  } else {
    steps.push({
      step: 1,
      title: "Monthly to daily (from bill)",
      formula: "Monthly units ÷ 30 = Daily kWh",
      calculation: `${monthlyUnits.toLocaleString()} ÷ 30`,
      result: `${dailyKwh.toFixed(1)} kWh/day`,
    })
  }

  steps.push({
    step: 2,
    title: "Solar system size needed",
    formula: `Daily kWh ÷ Peak sun hours × 1.25 = kW (${cityLabel}: ~${peakSunHours}h/day)`,
    calculation: `${dailyKwh.toFixed(1)} ÷ ${peakSunHours} × ${SYSTEM_LOSS_FACTOR}`,
    result: `~${rawSystemKw} kW → ${requiredSystemKw} kW system`,
  })

  if (backupHours > 0 && backupKwh > 0) {
    steps.push({
      step: 3,
      title: "Battery sizing (backup hours)",
      formula: "Peak load (kW) × Backup hours ÷ 0.8 = LiFePO₄ battery capacity",
      calculation: `${peakLoadKw} × ${backupHours} ÷ ${LITHIUM_USABLE_FACTOR}`,
      result: `${backupKwh} kWh battery`,
    })
  }

  return steps
}

export function calculateSolarSizing(
  input: SolarCalculatorInput,
  catalog: CatalogProduct[],
): SolarSizingResult | null {
  const monthlyUnits = input.monthlyUnits
  if (!monthlyUnits || monthlyUnits <= 0) return null

  const tariff = resolveTariff(input.billAmountPkr, monthlyUnits, input.tariffPerUnit ?? null)
  const dailyKwh = Math.round((monthlyUnits / 30) * 10) / 10
  const peakSunHours = getPeakSunHours(input.city, input.sunHoursPerDay)
  const { rawSystemKw, requiredSystemKw } = calculateSystemKwFromDaily(dailyKwh, peakSunHours)

  const backupHours = input.backupHours ?? 0
  const peakLoadKw =
    input.peakLoadKw && input.peakLoadKw > 0
      ? Math.round(input.peakLoadKw * 10) / 10
      : estimatePeakLoadFromBill(dailyKwh)

  const backupKwh =
    input.backupKwhOverride != null && input.backupKwhOverride > 0
      ? Math.round(input.backupKwhOverride * 10) / 10
      : calculateBatteryCapacityKwh(peakLoadKw, backupHours)

  const panelPick = pickPanel(catalog)
  const panelQty = Math.max(1, Math.ceil((requiredSystemKw * 1000) / panelPick.wattage))
  const totalPanelKw = Math.round(((panelQty * panelPick.wattage) / 1000) * 10) / 10

  const recommendedPanel: RecommendedPanel = {
    id: panelPick.product?.id || "panel-unavailable",
    name: panelPick.product?.name || "Voltrix solar panel",
    wattage: panelPick.wattage,
    quantity: panelQty,
    totalKw: totalPanelKw,
    fromCatalog: Boolean(panelPick.product),
    product: panelPick.product,
  }

  const panelAvailability = getProductAvailability(panelPick.product)

  const inverterKw = Math.max(requiredSystemKw, totalPanelKw * 0.9)
  const phase = input.phase || "single"

  let recommendedInverter: CatalogProduct | null = null
  let recommendedBattery: CatalogProduct | null = null
  let recommendedInverterLines: RecommendedProductLine[] = []
  let recommendedBatteryLines: RecommendedProductLine[] = []
  let kitIsFusionCombo = false

  if (backupKwh > 0) {
    const standaloneInvLines = pickInverterLines(catalog, inverterKw, phase)
    const standaloneInv = standaloneInvLines[0]?.product ?? null
    const standaloneBatLines = standaloneInv
      ? pickBatteryLines(catalog, backupKwh, standaloneInvLines.map((l) => String(l.product.id)))
      : pickBatteryLines(catalog, backupKwh)

    if (standaloneInvLines.length && standaloneBatLines.length) {
      recommendedInverterLines = standaloneInvLines
      recommendedBatteryLines = standaloneBatLines
      recommendedInverter = standaloneInv
      recommendedBattery = standaloneBatLines[0]?.product ?? null
    } else {
      const fusion = pickFusionCombo(catalog, inverterKw, backupKwh)
      if (fusion) {
        const fkw = getProductKw(fusion) || 0
        const fkwh = getProductKwh(fusion) || 0
        recommendedInverter = fusion
        recommendedInverterLines = [productLine(fusion, 1, fkw)]
        recommendedBattery = null
        recommendedBatteryLines = []
        kitIsFusionCombo = true
      } else {
        recommendedInverterLines = standaloneInvLines.length
          ? standaloneInvLines
          : pickInverterLines(catalog, inverterKw, phase)
        recommendedInverter = recommendedInverterLines[0]?.product ?? null

        recommendedBatteryLines = standaloneBatLines.length
          ? standaloneBatLines
          : recommendedInverter
            ? pickBatteryLines(catalog, backupKwh, recommendedInverterLines.map((l) => String(l.product.id)))
            : pickBatteryLines(catalog, backupKwh)
        recommendedBattery = recommendedBatteryLines[0]?.product ?? null

        if (
          recommendedInverter &&
          recommendedBattery &&
          String(recommendedInverter.id) === String(recommendedBattery.id)
        ) {
          recommendedBattery = null
          recommendedBatteryLines = []
          kitIsFusionCombo = isFusionComboProduct(recommendedInverter)
        } else if (
          recommendedInverter &&
          isFusionComboProduct(recommendedInverter) &&
          fusionMeetsBackup(recommendedInverter, backupKwh)
        ) {
          recommendedBattery = null
          recommendedBatteryLines = []
          kitIsFusionCombo = true
        }
      }
    }
  } else {
    recommendedInverterLines = pickInverterLines(catalog, inverterKw, phase)
    recommendedInverter = recommendedInverterLines[0]?.product ?? null
  }

  const estimatedBillPkr = input.billAmountPkr ?? Math.round(monthlyUnits * tariff)
  const offsetPercent = 85
  const estimatedMonthlySavingPkr = Math.round(estimatedBillPkr * (offsetPercent / 100))

  const formulaSteps = buildFormulaSteps(
    input,
    monthlyUnits,
    dailyKwh,
    peakSunHours,
    rawSystemKw,
    requiredSystemKw,
    peakLoadKw,
    backupHours,
    backupKwh,
  )

  const analysisNotes: string[] = []
  if (input.estimateSource === "appliances") {
    analysisNotes.push(
      `Estimated from your home appliances: ~${dailyKwh.toFixed(1)} kWh/day (${monthlyUnits.toLocaleString()} units/month).`,
    )
  } else {
    analysisNotes.push(
      `Based on ${monthlyUnits.toLocaleString()} units/month (~${dailyKwh.toFixed(1)} kWh/day).`,
    )
  }
  analysisNotes.push(
    `Recommended system size: ${requiredSystemKw} kW = ${dailyKwh.toFixed(1)} kWh/day ÷ ${peakSunHours} peak sun hours × ${SYSTEM_LOSS_FACTOR}.`,
  )
  if (backupKwh > 0) {
    analysisNotes.push(
      `Backup target: ${backupKwh} kWh LiFePO₄ capacity (${peakLoadKw} kW peak × ${backupHours}h ÷ ${LITHIUM_USABLE_FACTOR}).`,
    )
  }
  if (input.estimateSource !== "appliances" && !input.peakLoadKw) {
    analysisNotes.push(
      `Peak load estimated at ~${peakLoadKw} kW (daily use ÷ ${DEFAULT_USAGE_HOURS}h) — add appliances for a precise battery size.`,
    )
  }
  if (kitIsFusionCombo) {
    analysisNotes.push("Inverter + battery recommendation is a single Voltrix Fusion all-in-one unit.")
  }
  if (recommendedInverterLines.length > 1) {
    analysisNotes.push(
      `Inverter capacity split across ${recommendedInverterLines.length} unit type(s) — ~${totalLineCapacity(recommendedInverterLines)} kW total.`,
    )
  }
  if (recommendedBatteryLines.length > 1) {
    analysisNotes.push(
      `Battery storage split across ${recommendedBatteryLines.length} unit type(s) — ~${totalLineCapacity(recommendedBatteryLines)} kWh total.`,
    )
  }
  if (!recommendedPanel.fromCatalog) {
    analysisNotes.push("Solar panels are not listed in our store catalog right now — contact sales for panel options.")
  }

  const inverterAvailability = linesAvailability(recommendedInverterLines)
  const batteryAvailability = kitIsFusionCombo
    ? inverterAvailability
    : linesAvailability(recommendedBatteryLines)

  return {
    monthlyUnits,
    dailyKwh,
    estimatedBillPkr,
    tariffPerUnit: tariff,
    requiredSystemKw,
    rawSystemKw,
    peakSunHours,
    peakLoadKw,
    recommendedPanel,
    recommendedInverter,
    recommendedBattery,
    recommendedInverterLines,
    recommendedBatteryLines,
    inverterAvailability,
    batteryAvailability,
    panelAvailability,
    kitIsFusionCombo,
    backupKwh,
    backupHours,
    estimatedMonthlySavingPkr,
    offsetPercent,
    analysisNotes,
    formulaSteps,
    estimateSource: input.estimateSource,
  }
}
