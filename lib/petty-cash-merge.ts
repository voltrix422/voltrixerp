import type { PettyCashAllocation } from "@/lib/petty-cash"

export const PETTY_CASH_MERGE_MARKER = "__petty_merge__"

export type PettyCashMergeRecord = {
  at: string
  by: string
  sourceIds: string[]
  sourceRefs: string[]
  addedAmount: number
}

export function samePettyCashEmployee(
  a: Pick<PettyCashAllocation, "employeeId" | "employeeName">,
  b: Pick<PettyCashAllocation, "employeeId" | "employeeName">,
) {
  const idA = String(a.employeeId || "").trim()
  const idB = String(b.employeeId || "").trim()
  if (idA && idB && idA === idB) return true
  return (
    String(a.employeeName || "").trim().toLowerCase() ===
    String(b.employeeName || "").trim().toLowerCase()
  )
}

export function allocationRefLabel(a: Pick<PettyCashAllocation, "id" | "referenceNumber">) {
  return String(a.referenceNumber || "").trim() || a.id.slice(0, 8)
}

export function buildPettyCashMergeMarker(record: PettyCashMergeRecord) {
  return `${PETTY_CASH_MERGE_MARKER}${JSON.stringify(record)}`
}

export function appendPettyCashMergeNote(existingNotes: string, record: PettyCashMergeRecord) {
  const marker = buildPettyCashMergeMarker(record)
  return existingNotes.trim() ? `${existingNotes.trim()}\n${marker}` : marker
}

export function mergePurposeText(targetPurpose: string, sourcePurposes: string[]) {
  const base = String(targetPurpose || "").trim()
  const extras = sourcePurposes
    .map((p) => String(p || "").trim())
    .filter((p) => p && p.toLowerCase() !== base.toLowerCase())
  if (extras.length === 0) return base
  const unique = Array.from(new Set(extras))
  const suffix = unique.join("; ")
  const combined = base ? `${base} (+ merged: ${suffix})` : `Merged: ${suffix}`
  return combined.length > 480 ? `${combined.slice(0, 477)}...` : combined
}
