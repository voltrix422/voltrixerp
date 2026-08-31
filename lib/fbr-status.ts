/** FBR Digital Invoice status stored on Branch POS orders. Empty = never attempted. */
export type FbrOrderStatus = "" | "pending" | "sent" | "failed"

export function normalizeFbrStatus(status?: string | null): FbrOrderStatus {
  const value = String(status || "").trim().toLowerCase()
  if (value === "sent" || value === "pending" || value === "failed") return value
  return ""
}

export function fbrStatusLabel(status?: string | null): string {
  switch (normalizeFbrStatus(status)) {
    case "sent":
      return "Sent"
    case "pending":
      return "Pending"
    case "failed":
      return "Failed"
    default:
      return ""
  }
}

export function canRetryFbrPost(status?: string | null): boolean {
  const value = normalizeFbrStatus(status)
  return value === "pending" || value === "failed"
}
