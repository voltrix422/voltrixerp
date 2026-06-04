/** Whether a product should appear on the public website catalog. */
export function isProductPublished(product: { published?: unknown }): boolean {
  const v = product.published
  if (v === false || v === "false" || v === 0 || v === "0") return false
  if (v === true || v === "true" || v === 1 || v === "1") return true
  return Boolean(v)
}
