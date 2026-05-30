/** Extract order number from serial unit notes/specs (e.g. ORD-00042). */
export function parseSerialOrderRef(notes?: string | null, specs?: string | null): string | null {
  const combined = `${notes ?? ""} ${specs ?? ""}`
  const match = combined.match(/\b(ORD-\d+)\b/i)
  return match ? match[1].toUpperCase() : null
}

/** Client name from dispatch note: "order:… ORD-00042 → Acme Ltd". */
export function parseSerialDispatchClient(notes?: string | null): string | null {
  const m = (notes ?? "").match(/→\s*(.+?)\s*$/)
  return m?.[1]?.trim() || null
}

export function serialStatusLabel(status: string): string {
  return status.replace(/_/g, " ")
}
