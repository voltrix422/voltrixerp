import type { OrderItem } from "@/lib/orders"
import {
  hasProductFilter,
  orderItemMatchesProductFilter,
  type ProductFilter,
} from "@/lib/order-product-search"
import type { PosCartItem } from "@/lib/pos"

export type PosProductRateLine = {
  unitPrice: number
  qty: number
  sellTotal: number
  unit: string
}

export type PosProductBranchSummary = {
  branchId: string
  branchName: string
  soldQty: number
  sellTotal: number
  orderCount: number
  receiptCount: number
  byRate: PosProductRateLine[]
}

export type PosProductSalesSummary = {
  query: string
  soldQty: number
  sellTotal: number
  avgUnitPrice: number
  unit: string
  orderCount: number
  receiptCount: number
  byRate: PosProductRateLine[]
  byBranch: PosProductBranchSummary[]
}

type MutableBucket = {
  soldQty: number
  sellTotal: number
  unit: string
  orderIds: Set<string>
  receiptIds: Set<string>
  byRate: Map<number, PosProductRateLine>
}

function posCartItemMatchesFilter(item: PosCartItem, filter: ProductFilter): boolean {
  return orderItemMatchesProductFilter(
    {
      id: item.stockId || "",
      description: item.description || "",
      qty: item.qty,
      unit: item.unit || "pcs",
      unitPrice: item.unitPrice,
      isCustom: false,
    },
    filter,
  )
}

function rateKey(unitPrice: number): number {
  return Math.round((Number(unitPrice) || 0) * 100) / 100
}

function ensureBucket(map: Map<string, MutableBucket>, key: string): MutableBucket {
  let bucket = map.get(key)
  if (!bucket) {
    bucket = {
      soldQty: 0,
      sellTotal: 0,
      unit: "pcs",
      orderIds: new Set(),
      receiptIds: new Set(),
      byRate: new Map(),
    }
    map.set(key, bucket)
  }
  return bucket
}

function addLine(
  bucket: MutableBucket,
  qty: number,
  unitPrice: number,
  unit: string,
  orderId?: string,
  receiptId?: string,
) {
  const q = Number(qty) || 0
  const rate = Number(unitPrice) || 0
  if (q <= 0) return

  bucket.soldQty += q
  bucket.sellTotal += q * rate
  if (unit?.trim()) bucket.unit = unit.trim()

  const key = rateKey(rate)
  const existing = bucket.byRate.get(key)
  if (existing) {
    existing.qty += q
    existing.sellTotal += q * rate
  } else {
    bucket.byRate.set(key, { unitPrice: rate, qty: q, sellTotal: q * rate, unit: unit || "pcs" })
  }

  if (orderId) bucket.orderIds.add(orderId)
  if (receiptId) bucket.receiptIds.add(receiptId)
}

function finalizeRates(byRate: Map<number, PosProductRateLine>): PosProductRateLine[] {
  return [...byRate.values()].sort((a, b) => b.qty - a.qty || b.unitPrice - a.unitPrice)
}

function finalizeBucket(bucket: MutableBucket): Omit<PosProductBranchSummary, "branchId" | "branchName"> {
  return {
    soldQty: bucket.soldQty,
    sellTotal: bucket.sellTotal,
    orderCount: bucket.orderIds.size,
    receiptCount: bucket.receiptIds.size,
    byRate: finalizeRates(bucket.byRate),
  }
}

type OrderInput = {
  id: string
  branchId: string | null
  items: unknown
}

type ReceiptInput = {
  id: string
  branchId: string | null
  items: unknown
}

export function aggregatePosProductSales(
  filter: ProductFilter,
  label: string,
  orders: OrderInput[],
  receipts: ReceiptInput[],
  branchNames: Map<string, string>,
): PosProductSalesSummary | null {
  if (!hasProductFilter(filter)) return null

  const displayLabel =
    label.trim() ||
    filter.modelKey?.trim() ||
    filter.query?.trim() ||
    filter.matchTerms?.[0]?.trim() ||
    "Product"

  const combinedKey = "__combined__"
  const buckets = new Map<string, MutableBucket>()
  const combined = ensureBucket(buckets, combinedKey)

  for (const order of orders) {
    const branchKey = order.branchId || "__unassigned__"
    const branchBucket = ensureBucket(buckets, branchKey)
    const items = Array.isArray(order.items) ? (order.items as OrderItem[]) : []
    let matched = false

    for (const item of items) {
      if (!orderItemMatchesProductFilter(item, filter)) continue
      matched = true
      const qty = Number(item.qty) || 0
      const rate = Number(item.unitPrice) || 0
      const unit = item.unit || "pcs"
      addLine(combined, qty, rate, unit, order.id)
      addLine(branchBucket, qty, rate, unit, order.id)
    }

    if (matched) {
      combined.orderIds.add(order.id)
      branchBucket.orderIds.add(order.id)
    }
  }

  for (const receipt of receipts) {
    const branchKey = receipt.branchId || "__unassigned__"
    const branchBucket = ensureBucket(buckets, branchKey)
    const items = Array.isArray(receipt.items) ? (receipt.items as PosCartItem[]) : []
    let matched = false

    for (const item of items) {
      if (!posCartItemMatchesFilter(item, filter)) continue
      matched = true
      const qty = Number(item.qty) || 0
      const rate = Number(item.unitPrice) || 0
      const unit = item.unit || "pcs"
      addLine(combined, qty, rate, unit, undefined, receipt.id)
      addLine(branchBucket, qty, rate, unit, undefined, receipt.id)
    }

    if (matched) {
      combined.receiptIds.add(receipt.id)
      branchBucket.receiptIds.add(receipt.id)
    }
  }

  const combinedFinal = finalizeBucket(combined)
  const byBranch: PosProductBranchSummary[] = []

  for (const [branchId, bucket] of buckets) {
    if (branchId === combinedKey) continue
    if (bucket.soldQty <= 0) continue
    byBranch.push({
      branchId,
      branchName:
        branchNames.get(branchId) ||
        (branchId === "__unassigned__" ? "Unassigned" : "Unknown branch"),
      ...finalizeBucket(bucket),
    })
  }

  byBranch.sort((a, b) => b.sellTotal - a.sellTotal)

  return {
    query: displayLabel,
    soldQty: combinedFinal.soldQty,
    sellTotal: combinedFinal.sellTotal,
    avgUnitPrice: combinedFinal.soldQty > 0 ? combinedFinal.sellTotal / combinedFinal.soldQty : 0,
    unit: combinedFinal.byRate[0]?.unit || combined.unit || "pcs",
    orderCount: combinedFinal.orderCount,
    receiptCount: combinedFinal.receiptCount,
    byRate: combinedFinal.byRate,
    byBranch,
  }
}

/** @deprecated use aggregatePosProductSales with ProductFilter */
export function aggregatePosProductSalesByQuery(
  query: string,
  orders: OrderInput[],
  receipts: ReceiptInput[],
  branchNames: Map<string, string>,
): PosProductSalesSummary | null {
  return aggregatePosProductSales({ query }, query, orders, receipts, branchNames)
}
