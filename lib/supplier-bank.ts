import type { Supplier } from "@/lib/purchase"

export const SUPPLIER_TYPE_OPTIONS = [
  { value: "local", label: "Local" },
  { value: "imported", label: "Imported" },
  { value: "trade", label: "Trade" },
] as const

export type SupplierBankAccount = {
  accountTitle: string
  bankName: string
  bankIban: string
}

export function emptySupplierBankAccount(): SupplierBankAccount {
  return { accountTitle: "", bankName: "", bankIban: "" }
}

export function supplierTypeLabel(type: string): string {
  return SUPPLIER_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type
}

export function parseSupplierBankNames(
  raw: unknown,
  legacyBankAccountName?: string | null,
): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map(value => (typeof value === "string" ? value : typeof value === "object" && value && "bankName" in value ? String((value as SupplierBankAccount).bankName) : ""))
      .map(value => value.trim())
      .filter(Boolean)
  }
  if (legacyBankAccountName?.trim()) return [legacyBankAccountName.trim()]
  return []
}

export function normalizeSupplierBankNames(names: string[] | undefined): string[] {
  return (names ?? []).map(name => name.trim()).filter(Boolean)
}

function isBankAccountObject(value: unknown): value is SupplierBankAccount {
  return typeof value === "object" && value !== null && ("bankName" in value || "accountTitle" in value || "bankIban" in value)
}

export function parseSupplierBankAccounts(
  raw: unknown,
  legacy?: {
    accountTitle?: string | null
    bankAccountName?: string | null
    bankIban?: string | null
  },
): SupplierBankAccount[] {
  if (Array.isArray(raw) && raw.length > 0) {
    if (raw.every(isBankAccountObject)) {
      return raw.map(item => ({
        accountTitle: String(item.accountTitle ?? "").trim(),
        bankName: String(item.bankName ?? "").trim(),
        bankIban: String(item.bankIban ?? "").trim(),
      }))
    }

    const names = parseSupplierBankNames(raw, legacy?.bankAccountName)
    if (names.length > 0) {
      const sharedTitle = String(legacy?.accountTitle ?? "").trim()
      const sharedIban = String(legacy?.bankIban ?? "").trim()
      return names.map((bankName, index) => ({
        accountTitle: index === 0 ? sharedTitle : "",
        bankName,
        bankIban: index === 0 ? sharedIban : "",
      }))
    }
  }

  const legacyBank = String(legacy?.bankAccountName ?? "").trim()
  const legacyTitle = String(legacy?.accountTitle ?? "").trim()
  const legacyIban = String(legacy?.bankIban ?? "").trim()
  if (legacyBank || legacyTitle || legacyIban) {
    return [{ accountTitle: legacyTitle, bankName: legacyBank, bankIban: legacyIban }]
  }

  return []
}

export function coerceSupplierBankAccounts(raw: unknown): SupplierBankAccount[] {
  if (!Array.isArray(raw)) return []
  return raw.map(item => {
    const row = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>
    return {
      accountTitle: String(row.accountTitle ?? "").trim(),
      bankName: String(row.bankName ?? "").trim(),
      bankIban: String(row.bankIban ?? "").trim(),
    }
  })
}

export function normalizeSupplierBankAccounts(accounts: SupplierBankAccount[] | undefined): SupplierBankAccount[] {
  return (accounts ?? [])
    .map(account => ({
      accountTitle: account.accountTitle.trim(),
      bankName: account.bankName.trim(),
      bankIban: account.bankIban.trim(),
    }))
    .filter(account => account.accountTitle || account.bankName || account.bankIban)
}

export function getSupplierBankAccounts(
  supplier?: Pick<Supplier, "bankAccounts" | "accountTitle" | "bankNames" | "bankAccountName" | "bankIban"> | null,
): SupplierBankAccount[] {
  if (!supplier) return []
  if (supplier.bankAccounts?.length) return supplier.bankAccounts
  return parseSupplierBankAccounts(supplier.bankNames, {
    accountTitle: supplier.accountTitle,
    bankAccountName: supplier.bankAccountName,
    bankIban: supplier.bankIban,
  })
}

export function supplierBankAccountsForForm(
  supplier?: Pick<Supplier, "bankAccounts" | "accountTitle" | "bankNames" | "bankAccountName" | "bankIban"> | null,
): SupplierBankAccount[] {
  const accounts = normalizeSupplierBankAccounts(getSupplierBankAccounts(supplier))
  return accounts.length > 0 ? accounts : [emptySupplierBankAccount()]
}

export function formatSupplierBankAccount(account: SupplierBankAccount): string {
  const parts: string[] = []
  if (account.accountTitle) parts.push(account.accountTitle)
  if (account.bankName) parts.push(account.bankName)
  if (account.bankIban) parts.push(account.bankIban)
  return parts.join(" · ")
}

export function formatSupplierAccountDetails(
  supplier?: Pick<Supplier, "bankAccounts" | "accountTitle" | "bankNames" | "bankAccountName" | "bankIban"> | null,
): string {
  if (!supplier) return ""
  const accounts = normalizeSupplierBankAccounts(getSupplierBankAccounts(supplier))
  return accounts.map(formatSupplierBankAccount).filter(Boolean).join(" | ")
}
