/** Shared helpers for label QR / OCR field detection */

export function looksLikeUrlOrPath(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  return (
    /^https?:\/\//i.test(v) ||
    v.includes("/") ||
    /\.php\b/i.test(v) ||
    v.length > 120
  )
}

export function isDateSegment(value: string): boolean {
  return /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(value.trim())
}

/** Voltrix / inverter model codes on labels */
export function looksLikeProductModel(value: string): boolean {
  const v = value.trim()
  if (!v || v.length < 4 || v.length > 48) return false
  if (looksLikeUrlOrPath(v)) return false
  return (
    /^(AEP|HS|BG|LD|HSLD)-[A-Z0-9]+$/i.test(v) ||
    /^\d{1,3}A-[A-Z]-[A-Z]-[A-Z]$/i.test(v) ||
    /^[A-Z]{2,6}\d{0,3}[A-Z]{0,3}-[A-Z0-9]{2,}$/i.test(v)
  )
}

export function looksLikeSerialNumber(value: string): boolean {
  const v = value.trim()
  if (!v || v.length < 6 || v.length > 48) return false
  if (looksLikeUrlOrPath(v)) return false
  if (isDateSegment(v)) return false
  if (looksLikeProductModel(v) && !/\d{4,}/.test(v)) return false
  return /^[A-Z0-9][A-Z0-9._/-]*$/i.test(v) && /[0-9]/.test(v) && /[A-Z]/i.test(v)
}

export function scoreSerialCandidate(value: string): number {
  const v = value.trim()
  if (!looksLikeSerialNumber(v)) return -1
  let score = 10
  if (v.length >= 10 && v.length <= 24) score += 5
  if (/CEID|ID\d/i.test(v)) score += 3
  if (isDateSegment(v)) score = -1
  if (looksLikeUrlOrPath(v)) score = -1
  return score
}

export function scoreModelCandidate(value: string): number {
  const v = value.trim()
  if (!looksLikeProductModel(v)) return -1
  let score = 10
  if (/^AEP-/i.test(v)) score += 5
  if (/^BG\d+W/i.test(v)) score += 5
  if (/^HS-/i.test(v)) score += 4
  return score
}
