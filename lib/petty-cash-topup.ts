export const PETTY_CASH_TOPUP_MARKER = "__petty_topup__"

export type PettyCashTopUpRecord = {
  at: string
  amount: number
  by: string
  note?: string
  proofUrl?: string
  proofName?: string
}

export function buildPettyCashTopUpMarker(record: PettyCashTopUpRecord) {
  return `${PETTY_CASH_TOPUP_MARKER}${JSON.stringify(record)}`
}

export function parsePettyCashTopUps(notes?: string): PettyCashTopUpRecord[] {
  if (!notes) return []
  const results: PettyCashTopUpRecord[] = []
  for (const line of notes.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(PETTY_CASH_TOPUP_MARKER)) continue
    try {
      const parsed = JSON.parse(trimmed.slice(PETTY_CASH_TOPUP_MARKER.length)) as PettyCashTopUpRecord
      if (parsed?.at && parsed.amount > 0 && parsed.by) {
        results.push(parsed)
      }
    } catch {
      // ignore malformed markers
    }
  }
  return results
}

export function appendPettyCashTopUpNote(existingNotes: string, record: PettyCashTopUpRecord) {
  const marker = buildPettyCashTopUpMarker(record)
  return existingNotes.trim() ? `${existingNotes.trim()}\n${marker}` : marker
}
