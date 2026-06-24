import type { CatalogProduct } from "@/lib/solar-product-specs"
import {
  DEFAULT_SOLAR_PANELS,
  getProductKwh,
  getProductKw,
  getProductWattage,
  isBatteryProduct,
  isInStock,
  isInverterProduct,
  isSolarPanelProduct,
} from "@/lib/solar-product-specs"

export type SolarCalculatorInput = {
  monthlyUnits: number
  billAmountPkr?: number | null
  tariffPerUnit?: number | null
  city?: string
  phase?: "single" | "three"
  backupHours?: number
  sunHoursPerDay?: number
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

export type SolarSizingResult = {
  monthlyUnits: number
  dailyKwh: number
  estimatedBillPkr: number | null
  tariffPerUnit: number
  requiredSystemKw: number
  recommendedPanel: RecommendedPanel
  recommendedInverter: CatalogProduct | null
  recommendedBattery: CatalogProduct | null
  backupKwh: number
  estimatedMonthlySavingPkr: number | null
  offsetPercent: number
  analysisNotes: string[]
}

const DEFAULT_TARIFF_PKR = 32
const DEFAULT_SUN_HOURS = 4.5
const SYSTEM_OVERSIZE = 1.15

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

  if (panels.length) {
    return { wattage: panels[0].w, product: panels[0].p }
  }

  const fallback = DEFAULT_SOLAR_PANELS[0]
  return { wattage: fallback.wattage }
}

function pickInverter(
  catalog: CatalogProduct[],
  requiredKw: number,
  phase: "single" | "three",
): CatalogProduct | null {
  const candidates = catalog
    .filter(isInverterProduct)
    .map((p) => ({ p, kw: getProductKw(p) || 0 }))
    .filter((x) => x.kw >= requiredKw)
    .sort((a, b) => {
      const stockA = isInStock(a.p) ? 0 : 1
      const stockB = isInStock(b.p) ? 0 : 1
      if (stockA !== stockB) return stockA - stockB
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

function pickBattery(catalog: CatalogProduct[], backupKwh: number): CatalogProduct | null {
  if (backupKwh <= 0) return null

  const candidates = catalog
    .filter(isBatteryProduct)
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

export function calculateSolarSizing(
  input: SolarCalculatorInput,
  catalog: CatalogProduct[],
): SolarSizingResult | null {
  const monthlyUnits = input.monthlyUnits
  if (!monthlyUnits || monthlyUnits <= 0) return null

  const tariff = resolveTariff(input.billAmountPkr, monthlyUnits, input.tariffPerUnit ?? null)
  const dailyKwh = monthlyUnits / 30
  const sunHours = input.sunHoursPerDay && input.sunHoursPerDay > 0 ? input.sunHoursPerDay : DEFAULT_SUN_HOURS
  const requiredSystemKw =
    Math.round(((dailyKwh / sunHours) * SYSTEM_OVERSIZE) * 10) / 10

  const backupHours = input.backupHours ?? 0
  const backupKwh =
    backupHours > 0 ? Math.round((dailyKwh * (backupHours / 24)) * 10) / 10 : 0

  const panelPick = pickPanel(catalog)
  const panelQty = Math.max(1, Math.ceil((requiredSystemKw * 1000) / panelPick.wattage))
  const totalPanelKw = Math.round(((panelQty * panelPick.wattage) / 1000) * 10) / 10

  const recommendedPanel: RecommendedPanel = {
    id: panelPick.product?.id || DEFAULT_SOLAR_PANELS[0].id,
    name:
      panelPick.product?.name ||
      `${DEFAULT_SOLAR_PANELS[0].name}`,
    wattage: panelPick.wattage,
    quantity: panelQty,
    totalKw: totalPanelKw,
    fromCatalog: Boolean(panelPick.product),
    product: panelPick.product,
  }

  const inverterKw = Math.max(requiredSystemKw, totalPanelKw * 0.9)
  const recommendedInverter = pickInverter(catalog, inverterKw, input.phase || "single")
  const recommendedBattery = pickBattery(catalog, backupKwh)

  const estimatedBillPkr = input.billAmountPkr ?? Math.round(monthlyUnits * tariff)
  const offsetPercent = 85
  const estimatedMonthlySavingPkr = Math.round(estimatedBillPkr * (offsetPercent / 100))

  const analysisNotes: string[] = [
    `Based on ${monthlyUnits.toLocaleString()} units/month (~${dailyKwh.toFixed(1)} kWh/day).`,
    `Assuming ${sunHours} peak sun hours/day in ${input.city || "Pakistan"}.`,
    `Recommended system size: ~${requiredSystemKw} kW (with ${Math.round((SYSTEM_OVERSIZE - 1) * 100)}% safety margin).`,
  ]
  if (backupHours > 0) {
    analysisNotes.push(`Backup target: ${backupHours} hours (~${backupKwh} kWh storage).`)
  }
  if (!recommendedPanel.fromCatalog) {
    analysisNotes.push("Panel suggestion uses standard Longi 620W — add panels to website catalog for live SKU matching.")
  }

  return {
    monthlyUnits,
    dailyKwh,
    estimatedBillPkr,
    tariffPerUnit: tariff,
    requiredSystemKw,
    recommendedPanel,
    recommendedInverter,
    recommendedBattery,
    backupKwh,
    estimatedMonthlySavingPkr,
    offsetPercent,
    analysisNotes,
  }
}
