export function formatRetailPricePkr(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `PKR ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function formatGstPercent(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${value % 1 === 0 ? value : value.toFixed(2)}%`
}

export function parseDecimalField(value: unknown): number | null {
  if (value == null || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  const n = Number(String(value).replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}
