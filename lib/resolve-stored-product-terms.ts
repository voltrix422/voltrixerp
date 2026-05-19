import { DEFAULT_PRODUCT_TERMS_CONTENT } from "@/lib/default-product-terms"

/** Detects old per-product warranty text saved before the company default. */
export function isLegacyStoredProductTerms(content: string): boolean {
  const c = content.trim().toLowerCase()
  if (!c) return false
  if (c === DEFAULT_PRODUCT_TERMS_CONTENT.trim().toLowerCase()) return false

  return (
    c.includes("wl-16 model") ||
    c.includes("5 year warranty + 5 year cell") ||
    c.includes("cell replacement") ||
    !c.includes("thorough inspection")
  )
}

/** Website + admin display: custom copy only when explicitly saved with termsUseCustom. */
export function resolveStoredProductTermsContent(
  stored: string | null | undefined,
  termsUseCustom?: boolean | null,
): string {
  const text = (stored || "").trim()
  if (termsUseCustom && text) return text
  return DEFAULT_PRODUCT_TERMS_CONTENT
}

export function productTermsPayloadFromForm(formTerms: string): {
  terms: string
  termsUseCustom: boolean
} {
  const trimmed = formTerms.trim()
  const isDefault = trimmed === DEFAULT_PRODUCT_TERMS_CONTENT.trim()
  return {
    terms: isDefault ? "" : trimmed,
    termsUseCustom: !isDefault && trimmed.length > 0,
  }
}
