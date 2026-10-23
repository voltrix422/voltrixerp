/**
 * HS-BG51100 / MAN-BATTERY-HS-BG51100 only.
 * QR is MAC-style (colon-separated). Last segment may be letters or digits.
 * Last-segment character count === 2 → this product; any other length → different product.
 * Do not use these helpers for other SKUs.
 */

export const BG51100_MODEL = "HS-BG51100"
export const BG51100_MANUAL_MODEL = "MAN-BATTERY-HS-BG51100"
/** Expected length of the final MAC segment for this battery (e.g. CB or 12). */
export const BG51100_LAST_SEGMENT_LEN = 2

export type MacStyleQr = {
  serial: string
  segments: string[]
  lastSegmentLen: number
}

function compactModelKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^man[-_\s]*/, "")
    .replace(/[^a-z0-9]/g, "")
}

/** True for HS-BG51100 / MAN-BATTERY-HS-BG51100 (and close catalog variants). */
export function isBg51100Model(model?: string | null): boolean {
  const key = compactModelKey(model || "")
  if (!key) return false
  return key === "hsbg51100" || key === "batteryhsbg51100" || key.endsWith("hsbg51100")
}

/**
 * Colon-separated alphanumeric payload (letters or digits per segment).
 * Skips URLs and labeled key:value pairs that are not MAC-like.
 */
export function parseMacStyleQr(raw: string): MacStyleQr | null {
  const trimmed = raw.trim()
  if (!trimmed || !trimmed.includes(":")) return null
  if (/^https?:\/\//i.test(trimmed)) return null
  if (/\s/.test(trimmed)) return null
  // Avoid "Model: foo" style labels
  if (/^[A-Za-z][A-Za-z0-9_\s-]{1,24}:\s+/i.test(trimmed)) return null

  const segments = trimmed.split(":")
  if (segments.length < 2) return null
  if (!segments.every((s) => /^[A-Za-z0-9]+$/.test(s))) return null
  // Real MAC-style IDs are usually 4–8 octets; require at least 3 segments
  if (segments.length < 3) return null

  return {
    serial: trimmed,
    segments,
    lastSegmentLen: segments[segments.length - 1]!.length,
  }
}

/** This battery's QR: MAC-style with last segment length 2 (letters or digits). */
export function isBg51100MacQr(raw: string): boolean {
  const mac = parseMacStyleQr(raw)
  return !!mac && mac.lastSegmentLen === BG51100_LAST_SEGMENT_LEN
}

/**
 * When the order/warranty line is BG51100 and the scan is MAC-style,
 * accept only last-segment length 2. Non-MAC scans fall through to other logic.
 */
export function bg51100MacScanAllowedForProduct(orderModel: string, rawPayload: string): boolean | null {
  if (!isBg51100Model(orderModel)) return null
  const mac = parseMacStyleQr(rawPayload)
  if (!mac) return null
  return mac.lastSegmentLen === BG51100_LAST_SEGMENT_LEN
}
