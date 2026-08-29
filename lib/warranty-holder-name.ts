export function normalizeWarrantyHolderName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

export function warrantyHolderNamesMatch(typed: string, required: string): boolean {
  const a = normalizeWarrantyHolderName(typed).toLowerCase()
  const b = normalizeWarrantyHolderName(required).toLowerCase()
  return Boolean(a) && a === b
}
