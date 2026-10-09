import {
  getOrderAmountPaid,
  getPaymentSubmissionStatus,
  isProofOnlyPayment,
  type Order,
  type OrderItem,
} from "@/lib/orders"

/** Statuses where stock is considered given / with the client. */
export const CLIENT_AUDIT_GIVEN_STATUSES = new Set([
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "finalized",
  "payment_added",
])

export type ClientAuditSoldRate = {
  id: string
  qty: number
  unitPrice: number
}

export type ClientAuditLine = {
  itemKey: string
  itemLabel: string
  unit: string
  /** Book / order unit price (weighted avg of given stock) */
  bookUnitPrice: number
  openingQty: number
  givenQty: number
  availableQty: number
  soldRates: ClientAuditSoldRate[]
  soldQty: number
  soldAmount: number
  leftQty: number
  leftAmount: number
}

export type ClientAuditRecord = {
  id: string
  clientId: string
  clientName: string
  auditDate: string
  status: "draft" | "finalized"
  notes: string
  signedByName: string
  signatureDataUrl: string | null
  createdBy: string
  createdByUserId: string | null
  lines: ClientAuditLine[]
  orderIds: string[]
  stockGivenQty: number
  stockSoldQty: number
  stockLeftQty: number
  soldAmount: number
  leftAmount: number
  creditAmount: number
  previousAuditId: string | null
  createdAt: string
  updatedAt: string
}

export type ClientAuditPaymentLine = {
  id: string
  amount: number
  date: string
  method: string
  status: string
}

export type ClientAuditOrderSummary = {
  id: string
  orderNumber: string
  status: string
  createdAt: string
  deliveryDate: string
  fulfillmentDate: string
  total: number
  paid: number
  credit: number
  itemCount: number
  /** Individual payments that count toward balance, with dates */
  payments: ClientAuditPaymentLine[]
}

export type ClientStockSnapshot = {
  clientId: string
  clientName: string
  orders: ClientAuditOrderSummary[]
  creditTotal: number
  previousAudit: ClientAuditRecord | null
  /** Working lines for a new audit (opening from last audit + given since) */
  lines: ClientAuditLine[]
  stockGivenQty: number
  stockLeftQty: number
}

function num(n: unknown) {
  return Number(n) || 0
}

export function itemKeyOf(item: Pick<OrderItem, "model" | "inventoryItemId" | "description">): string {
  const model = String(item.model || "").trim()
  if (model) return `m:${model.toUpperCase()}`
  const inv = String(item.inventoryItemId || "").trim()
  if (inv) return `i:${inv}`
  return `d:${String(item.description || "Item").trim().toLowerCase()}`
}

export function itemLabelOf(item: Pick<OrderItem, "model" | "description">): string {
  const desc = String(item.description || "").trim()
  const model = String(item.model || "").trim()
  if (desc && model && !desc.toLowerCase().includes(model.toLowerCase())) {
    return `${desc} (${model})`
  }
  return desc || model || "Item"
}

function orderGivenAt(order: Pick<Order, "fulfillmentDate" | "deliveryDate" | "createdAt">): Date {
  const raw = String(order.fulfillmentDate || order.deliveryDate || "").trim()
  if (raw) {
    const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00+05:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date(order.createdAt)
}

function isGivenOrder(order: Pick<Order, "status" | "source" | "returnedAt">): boolean {
  if (String(order.source || "") === "branch_pos") return false
  if (order.returnedAt) return false
  return CLIENT_AUDIT_GIVEN_STATUSES.has(String(order.status || ""))
}

export function summarizeAuditLines(lines: ClientAuditLine[]) {
  let stockGivenQty = 0
  let stockSoldQty = 0
  let stockLeftQty = 0
  let soldAmount = 0
  let leftAmount = 0
  for (const line of lines) {
    stockGivenQty += num(line.openingQty) + num(line.givenQty)
    stockSoldQty += num(line.soldQty)
    stockLeftQty += num(line.leftQty)
    soldAmount += num(line.soldAmount)
    leftAmount += num(line.leftAmount)
  }
  return { stockGivenQty, stockSoldQty, stockLeftQty, soldAmount, leftAmount }
}

/** Recalculate sold/left totals on a line from soldRates. */
export function recomputeLine(line: ClientAuditLine): ClientAuditLine {
  const openingQty = Math.max(0, num(line.openingQty))
  const givenQty = Math.max(0, num(line.givenQty))
  const availableQty = openingQty + givenQty
  const soldRates = (line.soldRates || [])
    .map((r, i) => ({
      id: r.id || `rate-${i}`,
      qty: Math.max(0, num(r.qty)),
      unitPrice: Math.max(0, num(r.unitPrice)),
    }))
    .filter((r) => r.qty > 0 || r.unitPrice > 0)
  const soldQty = soldRates.reduce((s, r) => s + r.qty, 0)
  const soldAmount = soldRates.reduce((s, r) => s + r.qty * r.unitPrice, 0)
  const leftQty = Math.max(0, availableQty - soldQty)
  const bookUnitPrice = Math.max(0, num(line.bookUnitPrice))
  const leftAmount = leftQty * bookUnitPrice
  return {
    ...line,
    openingQty,
    givenQty,
    availableQty,
    soldRates,
    soldQty,
    soldAmount,
    leftQty,
    leftAmount,
    bookUnitPrice,
  }
}

export function buildClientStockSnapshot(opts: {
  clientId: string
  clientName: string
  orders: Order[]
  previousAudit: ClientAuditRecord | null
}): ClientStockSnapshot {
  const { clientId, clientName, previousAudit } = opts
  const orders = (opts.orders || []).filter((o) => o.clientId === clientId && isGivenOrder(o))

  const since = previousAudit ? new Date(previousAudit.auditDate) : null
  const openingMap = new Map<string, ClientAuditLine>()
  if (previousAudit) {
    for (const line of previousAudit.lines || []) {
      openingMap.set(line.itemKey, {
        ...line,
        openingQty: num(line.leftQty),
        givenQty: 0,
        availableQty: num(line.leftQty),
        soldRates: [],
        soldQty: 0,
        soldAmount: 0,
        leftQty: num(line.leftQty),
        leftAmount: num(line.leftQty) * num(line.bookUnitPrice),
      })
    }
  }

  type Acc = {
    itemKey: string
    itemLabel: string
    unit: string
    givenQty: number
    valueSum: number
  }
  const givenMap = new Map<string, Acc>()

  for (const order of orders) {
    const at = orderGivenAt(order)
    if (since && at <= since) continue
    for (const item of order.items || []) {
      const qty = Math.max(0, num(item.qty))
      if (qty <= 0) continue
      const key = itemKeyOf(item)
      const prev = givenMap.get(key)
      const unitPrice = Math.max(0, num(item.unitPrice))
      if (prev) {
        prev.givenQty += qty
        prev.valueSum += qty * unitPrice
        if (!prev.itemLabel && item.description) prev.itemLabel = itemLabelOf(item)
      } else {
        givenMap.set(key, {
          itemKey: key,
          itemLabel: itemLabelOf(item),
          unit: String(item.unit || "pcs"),
          givenQty: qty,
          valueSum: qty * unitPrice,
        })
      }
    }
  }

  const keys = new Set([...openingMap.keys(), ...givenMap.keys()])
  const lines: ClientAuditLine[] = []
  for (const key of keys) {
    const open = openingMap.get(key)
    const given = givenMap.get(key)
    const openingQty = open ? num(open.openingQty) : 0
    const givenQty = given ? num(given.givenQty) : 0
    const bookFromGiven = given && given.givenQty > 0 ? given.valueSum / given.givenQty : 0
    const bookUnitPrice =
      givenQty > 0
        ? bookFromGiven
        : open
          ? num(open.bookUnitPrice)
          : 0
    lines.push(
      recomputeLine({
        itemKey: key,
        itemLabel: given?.itemLabel || open?.itemLabel || key,
        unit: given?.unit || open?.unit || "pcs",
        bookUnitPrice,
        openingQty,
        givenQty,
        availableQty: openingQty + givenQty,
        soldRates: [],
        soldQty: 0,
        soldAmount: 0,
        leftQty: openingQty + givenQty,
        leftAmount: (openingQty + givenQty) * bookUnitPrice,
      }),
    )
  }
  lines.sort((a, b) => a.itemLabel.localeCompare(b.itemLabel))

  const orderSummaries: ClientAuditOrderSummary[] = orders
    .map((o) => {
      const paid = getOrderAmountPaid(o)
      const total = num(o.total)
      const payments: ClientAuditPaymentLine[] = (o.payments || [])
        .filter((p) => {
          if (isProofOnlyPayment(p)) return false
          const st = getPaymentSubmissionStatus(p, o.status)
          return (st === "approved" || st === "pending_approval") && num(p.amount) > 0
        })
        .map((p) => ({
          id: String(p.id || ""),
          amount: num(p.amount),
          date: String(p.date || p.createdAt || ""),
          method: String(p.method || "").trim() || "—",
          status: getPaymentSubmissionStatus(p, o.status),
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        createdAt: String(o.createdAt),
        deliveryDate: String(o.deliveryDate || ""),
        fulfillmentDate: String(o.fulfillmentDate || ""),
        total,
        paid,
        credit: Math.max(0, total - paid),
        itemCount: (o.items || []).reduce((s, i) => s + Math.max(0, num(i.qty)), 0),
        payments,
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const creditTotal = orderSummaries.reduce((s, o) => s + o.credit, 0)
  const totals = summarizeAuditLines(lines)

  return {
    clientId,
    clientName,
    orders: orderSummaries,
    creditTotal,
    previousAudit,
    lines,
    stockGivenQty: totals.stockGivenQty,
    stockLeftQty: totals.stockLeftQty,
  }
}

export function mapAuditRow(row: {
  id: string
  clientId: string
  clientName: string
  auditDate: Date
  status: string
  notes: string
  signedByName: string
  signatureDataUrl: string | null
  createdBy: string
  createdByUserId: string | null
  lines: unknown
  orderIds: unknown
  stockGivenQty: number
  stockSoldQty: number
  stockLeftQty: number
  soldAmount: number
  leftAmount: number
  creditAmount: number
  previousAuditId: string | null
  createdAt: Date
  updatedAt: Date
}): ClientAuditRecord {
  const lines = Array.isArray(row.lines) ? (row.lines as ClientAuditLine[]) : []
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName,
    auditDate: row.auditDate.toISOString(),
    status: row.status === "finalized" ? "finalized" : "draft",
    notes: row.notes || "",
    signedByName: row.signedByName || "",
    signatureDataUrl: row.signatureDataUrl,
    createdBy: row.createdBy || "",
    createdByUserId: row.createdByUserId,
    lines,
    orderIds: Array.isArray(row.orderIds) ? (row.orderIds as string[]) : [],
    stockGivenQty: num(row.stockGivenQty),
    stockSoldQty: num(row.stockSoldQty),
    stockLeftQty: num(row.stockLeftQty),
    soldAmount: num(row.soldAmount),
    leftAmount: num(row.leftAmount),
    creditAmount: num(row.creditAmount),
    previousAuditId: row.previousAuditId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
