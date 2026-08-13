export type ApplianceDefinition = {
  id: string
  label: string
  watts: number
  hoursPerDay: number
  /** Included in backup load calculation when qty > 0 */
  backupEssential: boolean
  category: "cooling" | "kitchen" | "lighting" | "entertainment" | "laundry" | "water" | "other"
}

export const HOME_APPLIANCES: ApplianceDefinition[] = [
  { id: "ac_1ton", label: "AC (1 ton)", watts: 1200, hoursPerDay: 8, backupEssential: true, category: "cooling" },
  { id: "ac_1_5ton", label: "AC (1.5 ton)", watts: 1800, hoursPerDay: 8, backupEssential: true, category: "cooling" },
  { id: "ac_2ton", label: "AC (2 ton)", watts: 2400, hoursPerDay: 8, backupEssential: true, category: "cooling" },
  { id: "fridge", label: "Refrigerator", watts: 250, hoursPerDay: 24, backupEssential: true, category: "kitchen" },
  { id: "freezer", label: "Deep freezer", watts: 200, hoursPerDay: 24, backupEssential: true, category: "kitchen" },
  { id: "led_light", label: "LED light", watts: 12, hoursPerDay: 6, backupEssential: true, category: "lighting" },
  { id: "tube_light", label: "Tube / CFL light", watts: 40, hoursPerDay: 6, backupEssential: true, category: "lighting" },
  { id: "fan", label: "Ceiling fan", watts: 75, hoursPerDay: 12, backupEssential: true, category: "cooling" },
  { id: "tv", label: "TV", watts: 120, hoursPerDay: 5, backupEssential: false, category: "entertainment" },
  { id: "computer", label: "Computer / laptop", watts: 150, hoursPerDay: 6, backupEssential: false, category: "entertainment" },
  { id: "washing_machine", label: "Washing machine", watts: 500, hoursPerDay: 1, backupEssential: false, category: "laundry" },
  { id: "iron", label: "Electric iron", watts: 1000, hoursPerDay: 0.5, backupEssential: false, category: "laundry" },
  { id: "microwave", label: "Microwave oven", watts: 1000, hoursPerDay: 0.5, backupEssential: false, category: "kitchen" },
  { id: "water_dispenser", label: "Water dispenser", watts: 500, hoursPerDay: 8, backupEssential: true, category: "kitchen" },
  { id: "water_motor", label: "Water motor / pump", watts: 750, hoursPerDay: 1.5, backupEssential: true, category: "water" },
  { id: "geyser", label: "Electric geyser", watts: 2000, hoursPerDay: 1, backupEssential: false, category: "water" },
  { id: "router", label: "Wi‑Fi router / modem", watts: 15, hoursPerDay: 24, backupEssential: true, category: "other" },
  { id: "charger", label: "Phone / device chargers", watts: 25, hoursPerDay: 4, backupEssential: true, category: "other" },
]

export type ApplianceSelection = Record<string, number>

export type ApplianceLoadBreakdown = {
  id: string
  label: string
  quantity: number
  watts: number
  hoursPerDay: number
  dailyKwh: number
  backupEssential: boolean
}

export type ApplianceEstimateResult = {
  breakdown: ApplianceLoadBreakdown[]
  dailyKwh: number
  monthlyUnits: number
  backupLoadKw: number
  backupKwh: number
  backupHours: number
  peakLoadKw: number
}

/** LiFePO₄ usable capacity (~80% depth of discharge) */
const LITHIUM_USABLE_FACTOR = 0.8

export function calculateApplianceEstimate(
  selections: ApplianceSelection,
  backupHours: number,
): ApplianceEstimateResult | null {
  const breakdown: ApplianceLoadBreakdown[] = []
  let dailyWh = 0
  let backupLoadW = 0
  let peakLoadW = 0

  for (const appliance of HOME_APPLIANCES) {
    const qty = Math.max(0, Math.floor(selections[appliance.id] || 0))
    if (qty <= 0) continue

    const itemDailyWh = appliance.watts * qty * appliance.hoursPerDay
    dailyWh += itemDailyWh
    peakLoadW += appliance.watts * qty

    if (appliance.backupEssential) {
      backupLoadW += appliance.watts * qty
    }

    breakdown.push({
      id: appliance.id,
      label: appliance.label,
      quantity: qty,
      watts: appliance.watts,
      hoursPerDay: appliance.hoursPerDay,
      dailyKwh: Math.round((itemDailyWh / 1000) * 100) / 100,
      backupEssential: appliance.backupEssential,
    })
  }

  if (breakdown.length === 0) return null

  const dailyKwh = Math.round((dailyWh / 1000) * 10) / 10
  const monthlyUnits = Math.round(dailyKwh * 30)
  const hours = Math.max(0, Math.min(24, backupHours))
  const peakLoadKw = Math.round((peakLoadW / 1000) * 10) / 10
  const backupKwh =
    hours > 0
      ? Math.round(((peakLoadKw * hours) / LITHIUM_USABLE_FACTOR) * 10) / 10
      : 0

  return {
    breakdown,
    dailyKwh,
    monthlyUnits,
    backupLoadKw: Math.round((backupLoadW / 1000) * 10) / 10,
    backupKwh,
    backupHours: hours,
    peakLoadKw,
  }
}
