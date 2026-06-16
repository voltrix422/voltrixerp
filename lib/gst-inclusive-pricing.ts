/** Split a GST-inclusive amount into base (excl. tax) and included tax. */
export function splitGstInclusiveAmount(amount: number, gstPercent: number) {
  const safeAmount = Math.max(0, amount)
  const rate = Math.max(0, gstPercent) / 100
  if (rate <= 0 || safeAmount <= 0) {
    return { base: safeAmount, gst: 0, total: safeAmount }
  }
  const base = safeAmount / (1 + rate)
  const gst = safeAmount - base
  return { base, gst, total: safeAmount }
}
