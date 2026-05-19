import type { BranchInventoryTransfer } from "@/lib/branches"

export type TransferHistoryLineItem = {
  productDescription: string
  quantity: number
  unit: string
  userNote?: string
}

export type TransferHistoryDisplayEntry = {
  id: string
  fromBranchId?: string | null
  fromBranchName: string
  fromBranchCode: string
  toBranchId: string
  toBranchName: string
  toBranchCode: string
  productDescription: string
  quantity: number
  unit: string
  note: string
  transferredBy: string
  transferredAt: string
  transferBatchId?: string | null
  isBatch: boolean
  lineItems: TransferHistoryLineItem[]
}

const BATCH_SUMMARY_RE = /^(\d+)\s+products?\s+\((\d+(?:\.\d+)?)\s+(\S+)\s+total\)$/i
const BATCH_BULLET_RE = /^•\s*(\d+(?:\.\d+)?)\s+(\S+)\s+×\s+(.+)$/

function displayLabel(description: string) {
  const trimmed = description.trim()
  if (!trimmed || trimmed.toLowerCase() === "unknown model") return "Unlabeled item"
  if (BATCH_SUMMARY_RE.test(trimmed)) return trimmed
  return trimmed
}

function formatProductCount(count: number, totalQty: number, unit: string) {
  const noun = count === 1 ? "product" : "products"
  return `${count} ${noun} (${totalQty} ${unit} total)`
}

function isCombinedBatchRecord(entry: BranchInventoryTransfer) {
  return (
    Boolean(entry.transferBatchId) ||
    BATCH_SUMMARY_RE.test(entry.productDescription.trim()) ||
    entry.note.includes("Bulk transfer")
  )
}

/** When both a combined row and legacy per-line rows share a batch id, keep the combined row only. */
function dedupeBatchRows(items: BranchInventoryTransfer[]): BranchInventoryTransfer[] {
  if (items.length <= 1) return items
  const combined = items.find(
    (row) =>
      row.note.includes("Bulk transfer") || BATCH_SUMMARY_RE.test(row.productDescription.trim()),
  )
  if (combined) return [combined]
  return items
}

export function parseBatchLineItemsFromNote(note: string): TransferHistoryLineItem[] {
  const items: TransferHistoryLineItem[] = []
  for (const rawLine of note.split("\n")) {
    const line = rawLine.trim()
    if (!line.startsWith("•")) continue
    const match = line.match(BATCH_BULLET_RE)
    if (!match) continue
    let rest = match[3].trim()
    let userNote: string | undefined
    const noteSep = rest.indexOf(" — Note:")
    if (noteSep >= 0) {
      userNote = rest.slice(noteSep + 9).trim() || undefined
      rest = rest.slice(0, noteSep).trim()
    }
    items.push({
      quantity: Number(match[1]),
      unit: match[2],
      productDescription: displayLabel(rest),
      userNote,
    })
  }
  return items
}

function groupKey(entry: BranchInventoryTransfer) {
  if (entry.transferBatchId) return `batch:${entry.transferBatchId}`
  const t = new Date(entry.transferredAt).getTime()
  const bucket = Math.floor(t / 3000)
  return `legacy:${entry.fromBranchId ?? ""}:${entry.toBranchId}:${entry.transferredBy}:${bucket}`
}

function resolveLineItems(sorted: BranchInventoryTransfer[]): TransferHistoryLineItem[] {
  if (sorted.length > 1) {
    return sorted
      .filter((item) => !BATCH_SUMMARY_RE.test(item.productDescription.trim()))
      .map((item) => ({
        productDescription: displayLabel(item.productDescription),
        quantity: item.quantity,
        unit: item.unit,
      }))
  }

  const first = sorted[0]
  const fromNote = parseBatchLineItemsFromNote(first.note)
  if (fromNote.length > 0) return fromNote

  return [
    {
      productDescription: displayLabel(first.productDescription),
      quantity: first.quantity,
      unit: first.unit,
    },
  ]
}

function resolveTitle(
  sorted: BranchInventoryTransfer[],
  lineItems: TransferHistoryLineItem[],
  totalQty: number,
  unit: string,
) {
  const first = sorted[0]
  const summaryMatch = first.productDescription.trim().match(BATCH_SUMMARY_RE)
  if (summaryMatch) {
    const count = Number(summaryMatch[1])
    return formatProductCount(count, totalQty, unit)
  }
  if (sorted.length > 1 || lineItems.length > 1) {
    const count = sorted.length > 1 ? sorted.length : lineItems.length
    return formatProductCount(count, totalQty, unit)
  }
  return displayLabel(first.productDescription)
}

export function groupTransferHistoryForDisplay(
  entries: BranchInventoryTransfer[],
): TransferHistoryDisplayEntry[] {
  const map = new Map<string, BranchInventoryTransfer[]>()

  for (const entry of entries) {
    const key = groupKey(entry)
    const list = map.get(key) ?? []
    list.push(entry)
    map.set(key, list)
  }

  const grouped = Array.from(map.values()).map((items) => {
    const sorted = dedupeBatchRows(
      [...items].sort(
        (a, b) => new Date(a.transferredAt).getTime() - new Date(b.transferredAt).getTime(),
      ),
    )
    const first = sorted[0]
    const lineItems = resolveLineItems(sorted)
    const totalQty =
      lineItems.length > 0
        ? lineItems.reduce((sum, line) => sum + line.quantity, 0)
        : sorted.reduce((sum, item) => sum + item.quantity, 0)
    const unit =
      lineItems.length > 0 && lineItems.every((line) => line.unit === lineItems[0].unit)
        ? lineItems[0].unit
        : sorted.every((item) => item.unit === sorted[0].unit)
          ? sorted[0].unit
          : "pcs"

    const isBatch =
      sorted.length > 1 || isCombinedBatchRecord(first) || lineItems.length > 1

    const productDescription = isBatch
      ? resolveTitle(sorted, lineItems, totalQty, unit)
      : displayLabel(first.productDescription)

    const note =
      sorted.length === 1 && first.note.includes("Bulk transfer")
        ? first.note
        : isBatch
          ? buildGroupedNote(first, sorted, lineItems)
          : first.note

    return {
      id: first.transferBatchId || first.id,
      fromBranchId: first.fromBranchId,
      fromBranchName: first.fromBranchName,
      fromBranchCode: first.fromBranchCode,
      toBranchId: first.toBranchId,
      toBranchName: first.toBranchName,
      toBranchCode: first.toBranchCode,
      productDescription,
      quantity: isBatch ? totalQty : first.quantity,
      unit: isBatch ? unit : first.unit,
      note,
      transferredBy: first.transferredBy,
      transferredAt: first.transferredAt,
      transferBatchId: first.transferBatchId,
      isBatch,
      lineItems,
    }
  })

  return grouped.sort(
    (a, b) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime(),
  )
}

function buildGroupedNote(
  first: BranchInventoryTransfer,
  items: BranchInventoryTransfer[],
  lineItems: TransferHistoryLineItem[],
) {
  if (items.length === 1 && first.note.includes("Bulk transfer")) {
    return first.note
  }
  const header = `Bulk transfer from ${first.fromBranchName} (${first.fromBranchCode}) to ${first.toBranchName} (${first.toBranchCode}) by ${first.transferredBy}.`
  const lines =
    lineItems.length > 0
      ? lineItems.map(
          (line) =>
            `• ${line.quantity} ${line.unit} × ${line.productDescription}${
              line.userNote ? ` — Note: ${line.userNote}` : ""
            }`,
        )
      : items.map(
          (item) => `• ${item.quantity} ${item.unit} × ${displayLabel(item.productDescription)}`,
        )
  return [header, ...lines].join("\n")
}

export function buildBatchTransferSummary(params: {
  fromBranchName: string
  fromBranchCode: string
  toBranchName: string
  toBranchCode: string
  transferredBy: string
  systemNotes?: string
  lines: Array<{
    productDescription: string
    quantity: number
    unit: string
    userNote?: string
  }>
}) {
  const header = `Bulk transfer from ${params.fromBranchName} (${params.fromBranchCode}) to ${params.toBranchName} (${params.toBranchCode}) by ${params.transferredBy}.`
  const itemLines = params.lines.map((line) => {
    const label = displayLabel(line.productDescription)
    const note = line.userNote?.trim() ? ` — Note: ${line.userNote.trim()}` : ""
    return `• ${line.quantity} ${line.unit} × ${label}${note}`
  })
  const parts = [header, ...itemLines]
  if (params.systemNotes?.trim()) {
    parts.push(`Dispatch note: ${params.systemNotes.trim()}`)
  }
  return parts.join("\n")
}
