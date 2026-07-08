import type { Supplier } from "@/lib/purchase"

export const SUPPLIER_TYPE_OPTIONS = [
  { value: "local", label: "Local" },
  { value: "imported", label: "Imported" },
  { value: "trade", label: "Trade" },
] as const

export function supplierTypeLabel(type: string): string {
  return SUPPLIER_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type
}

export function parseSupplierBankNames(
  raw: unknown,
  legacyBankAccountName?: string | null,
): string[] {
  if (Array.isArray(raw)) {
    return raw.map(value => String(value).trim()).filter(Boolean)
  }
  if (legacyBankAccountName?.trim()) return [legacyBankAccountName.trim()]
  return []
}

export function normalizeSupplierBankNames(names: string[] | undefined): string[] {
  return (names ?? []).map(name => name.trim()).filter(Boolean)
}

export function formatSupplierAccountDetails(supplier?: Pick<Supplier, "accountTitle" | "bankNames" | "bankAccountName" | "bankIban"> | null): string {
  if (!supplier) return ""
  const parts: string[] = []
  if (supplier.accountTitle?.trim()) parts.push(supplier.accountTitle.trim())
  const banks = normalizeSupplierBankNames(supplier.bankNames)
  const legacyBanks = banks.length > 0 ? banks : parseSupplierBankNames(null, supplier.bankAccountName)
  if (legacyBanks.length > 0) parts.push(legacyBanks.join(", "))
  if (supplier.bankIban?.trim()) parts.push(supplier.bankIban.trim())
  return parts.join(" · ")
}
