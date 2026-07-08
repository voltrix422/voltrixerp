const BILL_MARKER = "\n\n---purchase-bill---\n"

export type PurchaseBillAttachment = {
  billUrl: string
  billName: string
}

export function stripBillFromNotes(notes: string): string {
  const idx = notes.indexOf(BILL_MARKER)
  if (idx === -1) return notes.trimEnd()
  return notes.slice(0, idx).trimEnd()
}

export function extractBillFromNotes(notes: string): PurchaseBillAttachment & { notes: string } {
  const idx = notes.indexOf(BILL_MARKER)
  if (idx === -1) {
    return { notes: notes.trim(), billUrl: "", billName: "" }
  }
  const userNotes = notes.slice(0, idx).trimEnd()
  const payload = notes.slice(idx + BILL_MARKER.length).trim()
  try {
    const parsed = JSON.parse(payload) as PurchaseBillAttachment
    return {
      notes: userNotes,
      billUrl: String(parsed.billUrl ?? "").trim(),
      billName: String(parsed.billName ?? "").trim(),
    }
  } catch {
    return { notes: userNotes, billUrl: "", billName: "" }
  }
}

export function embedBillInNotes(
  notes: string,
  bill: PurchaseBillAttachment,
): string {
  const base = stripBillFromNotes(notes)
  if (!bill.billUrl.trim()) return base
  return `${base}${BILL_MARKER}${JSON.stringify({
    billUrl: bill.billUrl.trim(),
    billName: bill.billName.trim(),
  })}`
}

export function resolvePurchaseBill(entry: {
  notes?: string
  billUrl?: string
  billName?: string
}): PurchaseBillAttachment {
  if (entry.billUrl?.trim()) {
    return {
      billUrl: entry.billUrl.trim(),
      billName: entry.billName?.trim() || "Purchase bill",
    }
  }
  return extractBillFromNotes(entry.notes ?? "")
}

export function isImageBillUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(url)
}
