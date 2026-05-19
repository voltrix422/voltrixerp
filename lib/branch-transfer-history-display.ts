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

function displayLabel(description: string) {
  const trimmed = description.trim()
  if (!trimmed || trimmed.toLowerCase() === "unknown model") return "Unlabeled item"
  return trimmed
}

function groupKey(entry: BranchInventoryTransfer) {
  if (entry.transferBatchId) return `batch:${entry.transferBatchId}`
  const t = new Date(entry.transferredAt).getTime()
  const bucket = Math.floor(t / 3000)
  return `legacy:${entry.fromBranchId ?? ""}:${entry.toBranchId}:${entry.transferredBy}:${bucket}`
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
    const sorted = [...items].sort(
      (a, b) => new Date(a.transferredAt).getTime() - new Date(b.transferredAt).getTime(),
    )
    const first = sorted[0]
    const isBatch = sorted.length > 1 || Boolean(first.transferBatchId)

    const lineItems: TransferHistoryLineItem[] = sorted.map((item) => ({
      productDescription: displayLabel(item.productDescription),
      quantity: item.quantity,
      unit: item.unit,
    }))

    const totalQty = sorted.reduce((sum, item) => sum + item.quantity, 0)
    const unit = sorted.every((item) => item.unit === sorted[0].unit)
      ? sorted[0].unit
      : "pcs"

    const productDescription = isBatch
      ? `${sorted.length} products (${totalQty} ${unit} total)`
      : displayLabel(first.productDescription)

    const note = isBatch
      ? buildGroupedNote(first, sorted)
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
) {
  const header = `Bulk transfer from ${first.fromBranchName} (${first.fromBranchCode}) to ${first.toBranchName} (${first.toBranchCode}) by ${first.transferredBy}.`
  const lines = items.map(
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
