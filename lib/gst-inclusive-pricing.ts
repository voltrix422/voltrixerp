export const DEFAULT_GST_PERCENT = 18

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

/** Split a GST-inclusive amount into base (excl. tax) and included tax. */
export function splitGstInclusiveAmount(amount: number, gstPercent: number) {
  const safeAmount = Math.max(0, amount)
  const rate = Math.max(0, gstPercent) / 100
  if (rate <= 0 || safeAmount <= 0) {
    return { base: safeAmount, gst: 0, total: safeAmount }
  }
  const base = roundMoney(safeAmount / (1 + rate))
  const gst = roundMoney(safeAmount - base)
  return { base, gst, total: safeAmount }
}

export type GstInclusiveTotalsInput = {
  subtotalInclGst: number
  gstPercent?: number
  discount: number
  discountIsPercentage: boolean
  transportCost?: number
  transportIsPercentage?: boolean
  otherCost?: number
  otherCostIsPercentage?: boolean
}

export type GstInclusiveTotals = {
  subtotalInclGst: number
  base: number
  gst: number
  discountOnBase: number
  discountedBase: number
  discountedSubtotalInclGst: number
  taxPercent: number
  taxAmount: number
  transportAmount: number
  otherAmount: number
  total: number
}

/**
 * GST-inclusive item prices with discount on base only.
 * Included GST stays fixed from the original subtotal; it is not recalculated after discount.
 */
export function calculateGstInclusiveTotals(input: GstInclusiveTotalsInput): GstInclusiveTotals {
  const gstPercent = input.gstPercent ?? DEFAULT_GST_PERCENT
  const subtotalInclGst = Math.max(0, input.subtotalInclGst)
  const { base, gst } = splitGstInclusiveAmount(subtotalInclGst, gstPercent)

  const rawDiscountOnBase = input.discountIsPercentage
    ? base * (Math.max(0, input.discount) / 100)
    : Math.max(0, input.discount)

  const discountOnBase = roundMoney(Math.min(rawDiscountOnBase, base))
  const discountedBase = roundMoney(base - discountOnBase)
  const discountedSubtotalInclGst = roundMoney(discountedBase + gst)

  const transportCost = Math.max(0, input.transportCost ?? 0)
  const otherCost = Math.max(0, input.otherCost ?? 0)
  const transportAmount = input.transportIsPercentage
    ? roundMoney(discountedSubtotalInclGst * (transportCost / 100))
    : transportCost
  const otherAmount = input.otherCostIsPercentage
    ? roundMoney(discountedSubtotalInclGst * (otherCost / 100))
    : otherCost

  const total = roundMoney(discountedSubtotalInclGst + transportAmount + otherAmount)

  return {
    subtotalInclGst,
    base,
    gst,
    discountOnBase,
    discountedBase,
    discountedSubtotalInclGst,
    taxPercent: gstPercent,
    taxAmount: gst,
    transportAmount,
    otherAmount,
    total,
  }
}
