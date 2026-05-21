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

/** Normalize compact AEP codes from BarTender (no hyphens): AEP6KS48P → AEP-6KS48P */
export function normalizeAepModelCode(value: string): string {
  const v = value.trim()
  const m = v.match(/^AEP-?(\d+)KS(\d+)P(\d*)$/i)
  if (!m) return v
  return `AEP-${m[1]}KS${m[2]}P${m[3]}`
}

/**
 * BarTender often concatenates model + box number with no separator:
 *   AEP6KS48P + 2 → AEP6KS48P2  (model AEP-6KS48P, SN AEP6KS48P2)
 * Single-field models still work:
 *   AEP12KS48P3 → model AEP-12KS48P3
 */
export function parseAepModelAndSerial(glued: string): { model: string; serialNumber: string } | null {
  const trimmed = glued.trim()
  if (!/^AEP-?\d+KS48P/i.test(trimmed)) return null

  const exactPatterns: Array<{ re: RegExp; model: (m: RegExpMatchArray) => string }> = [
    { re: /^AEP-?(\d+)KS48P3$/i, model: (m) => `AEP-${m[1]}KS48P3` },
    { re: /^AEP-?(\d+)KS48P2$/i, model: (m) => `AEP-${m[1]}KS48P2` },
    { re: /^AEP-?(\d+)KS48P$/i, model: (m) => `AEP-${m[1]}KS48P` },
  ]
  for (const { re, model } of exactPatterns) {
    const m = trimmed.match(re)
    if (m) return { model: model(m), serialNumber: trimmed }
  }

  const modelPlusBox = trimmed.match(/^AEP-?(\d+)KS48P(\d{1,5})$/i)
  if (modelPlusBox) {
    return {
      model: `AEP-${modelPlusBox[1]}KS48P`,
      serialNumber: trimmed,
    }
  }

  const generic = trimmed.match(/^AEP-?(\d+)KS(\d+)P(\d*)$/i)
  if (generic) {
    return {
      model: `AEP-${generic[1]}KS${generic[2]}P${generic[3]}`,
      serialNumber: trimmed,
    }
  }

  return null
}

/** Voltrix / inverter model codes on labels */
export function looksLikeProductModel(value: string): boolean {
  const v = value.trim()
  if (!v || v.length < 4 || v.length > 48) return false
  if (looksLikeUrlOrPath(v)) return false
  return (
    /^(AEP|HS|BG|LD|HSLD)-[A-Z0-9]+$/i.test(v) ||
    /^AEP-?\d+KS\d+P\d*$/i.test(v) ||
    /^\d{1,3}A-[A-Z]-[A-Z]-[A-Z]$/i.test(v) ||
    /^[A-Z]{2,6}\d{0,3}[A-Z]{0,3}-[A-Z0-9]{2,}$/i.test(v) ||
    /^HS[-\s]?TQ[\d.A-Za-z\s]+Ah$/i.test(v) ||
    /^HS[-\s]?TQ[\d.]+V\d*Ah$/i.test(v) ||
    /^HS[-\s]?TQ/i.test(v)
  )
}

export function looksLikeSerialNumber(value: string): boolean {
  const v = value.trim()
  if (!v || v.length < 6 || v.length > 48) return false
  if (looksLikeUrlOrPath(v)) return false
  if (isDateSegment(v)) return false
  if (looksLikeProductModel(v) && !/\d{4,}/.test(v)) return false
  if (/^\d{6,24}$/.test(v)) return true
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
