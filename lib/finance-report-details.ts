import { isBranchPosOrderHiddenFromErp } from "@/lib/branch-pos"
import type { MoneyOutDetailLine } from "@/lib/finance-money-out-details"
import { approvedBalancePaymentAmount, parseOrderPayments } from "@/lib/finance-overview"
import { isCrmErpOrderForPaymentStats } from "@/lib/order-payment-stats"
import type { Order, OrderItem } from "@/lib/orders"
import type { PosCartItem } from "@/lib/pos"

export type FinancePdfItem = {
  description: string
  model: string
  inventory: string
  qty: number
  unit: string
  unitPrice: number
  lineTotal: number
}

export type FinanceExpenseLine = {
  id: string
  date: string
  title: string
  category: string
  amount: number
  createdBy: string
  receiptPerson: string
}

export type FinanceExpenseByPerson = {
  name: string
  count: number
  amount: number
}

export type FinancePosRow = {
  id: string
  date: string
  number: string
  customer: string
  cashier: string
  method: string
  kind: string
  total: number
  items: FinancePdfItem[]
}

export type FinanceOrderRow = {
  id: string
  date: string
  orderNumber: string
  clientName: string
  status: string
  createdBy: string
  total: number
  receivedInPeriod: number
  items: FinancePdfItem[]
}

const EXPENSE_CATEGORIES = new Set(["Expense", "Payment", "Tax", "Other"])

function inRange(d: Date, start: Date, end: Date) {
  return d >= start && d <= end
}

function fmtDay(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })
}

function num(n: unknown) {
  return Number(n) || 0
}

function inventoryLabel(item: Pick<OrderItem, "isCustom" | "inventoryItemId" | "isFreeItem">) {
  if (item.isFreeItem) return "Free"
  if (item.isCustom) return "Custom"
  const id = String(item.inventoryItemId || "").trim()
  if (!id) return "Inventory"
  if (id.startsWith("man:")) return `Manual ${id.slice(4)}`
  if (id.startsWith("wh:")) return `WH ${id.slice(3)}`
  return id
}

export function mapOrderItems(raw: unknown): FinancePdfItem[] {
  if (!Array.isArray(raw)) return []
  return (raw as OrderItem[])
    .map((item) => {
      const qty = num(item.qty)
      const unitPrice = num(item.unitPrice)
      const lineTotal = qty * unitPrice
      return {
        description: String(item.description || "").trim() || "Item",
        model: String(item.model || "").trim(),
        inventory: inventoryLabel(item),
        qty,
        unit: String(item.unit || "pcs").trim() || "pcs",
        unitPrice,
        lineTotal,
      }
    })
    .filter((item) => item.qty > 0 || item.lineTotal > 0)
}

export function mapPosItems(raw: unknown): FinancePdfItem[] {
  if (!Array.isArray(raw)) return []
  return (raw as PosCartItem[])
    .map((item) => {
      const qty = num(item.qty)
      const unitPrice = num(item.unitPrice)
      const lineTotal = num(item.lineTotal) || qty * unitPrice
      const stockId = String(item.stockId || "").trim()
      return {
        description: String(item.description || "").trim() || "Item",
        model: "",
        inventory: stockId || "POS stock",
        qty,
        unit: String(item.unit || "pcs").trim() || "pcs",
        unitPrice,
        lineTotal,
      }
    })
    .filter((item) => item.qty > 0 || item.lineTotal > 0)
}

function itemDetailLines(items: FinancePdfItem[]) {
  return items.map((item) => ({
    label: [
      item.description,
      item.model ? `Model ${item.model}` : "",
      item.inventory,
      `${item.qty} ${item.unit}`,
    ]
      .filter(Boolean)
      .join(" · "),
    amount: item.lineTotal,
  }))
}

export function buildExpenseReport(
  records: Array<{
    id: string
    title: string
    amount: number
    category: string
    createdAt: Date | string
    created_by?: string | null
    receipt_person_name?: string | null
    purpose?: string | null
  }>,
  start: Date,
  end: Date,
): {
  lines: FinanceExpenseLine[]
  byPerson: FinanceExpenseByPerson[]
  details: MoneyOutDetailLine[]
  total: number
} {
  const lines: FinanceExpenseLine[] = []
  for (const r of records) {
    if (!EXPENSE_CATEGORIES.has(r.category)) continue
    if (!inRange(new Date(r.createdAt), start, end)) continue
    const amount = num(r.amount)
    if (amount <= 0) continue
    const createdBy = String(r.created_by || "").trim() || "—"
    const receiptPerson = String(r.receipt_person_name || "").trim()
    const purpose = String(r.purpose || "").trim()
    lines.push({
      id: r.id,
      date: fmtDay(r.createdAt),
      title: purpose ? `${r.title} · ${purpose}` : r.title,
      category: r.category,
      amount,
      createdBy,
      receiptPerson,
    })
  }
  lines.sort((a, b) => b.amount - a.amount)

  const byMap = new Map<string, FinanceExpenseByPerson>()
  for (const line of lines) {
    const name = line.createdBy
    const row = byMap.get(name) || { name, count: 0, amount: 0 }
    row.count += 1
    row.amount += line.amount
    byMap.set(name, row)
  }
  const byPerson = [...byMap.values()].sort((a, b) => b.amount - a.amount)
  const total = lines.reduce((s, l) => s + l.amount, 0)
  const details: MoneyOutDetailLine[] = lines.map((line) => ({
    id: `exp-${line.id}`,
    label: line.title,
    sublabel: [line.createdBy, line.receiptPerson ? `Receipt ${line.receiptPerson}` : "", line.category]
      .filter(Boolean)
      .join(" · "),
    amount: line.amount,
    date: line.date,
  }))
  return { lines, byPerson, details, total }
}

export function buildPosSalesReport(
  posSales: Array<{
    id: string
    receiptNumber: string
    terminalName?: string | null
    items: unknown
    total: number
    paymentMethod?: string | null
    cashierName?: string | null
    customerName?: string | null
    createdAt: Date | string
  }>,
  orders: Array<{
    id: string
    orderNumber: string
    clientName: string
    createdBy?: string | null
    createdAt: Date | string
    total: number
    status: string
    source?: string | null
    notes?: string | null
    branchId?: string | null
    items: unknown
  }>,
  start: Date,
  end: Date,
): { rows: FinancePosRow[]; details: MoneyOutDetailLine[]; total: number } {
  const rows: FinancePosRow[] = []

  for (const sale of posSales) {
    if (!inRange(new Date(sale.createdAt), start, end)) continue
    const total = num(sale.total)
    if (total <= 0) continue
    const items = mapPosItems(sale.items)
    rows.push({
      id: sale.id,
      date: fmtDay(sale.createdAt),
      number: sale.receiptNumber,
      customer: String(sale.customerName || "").trim() || "Walk-in",
      cashier: String(sale.cashierName || sale.terminalName || "").trim() || "POS",
      method: String(sale.paymentMethod || "cash"),
      kind: "POS receipt",
      total,
      items,
    })
  }

  for (const order of orders) {
    if (!isBranchPosOrderHiddenFromErp(order)) continue
    const status = String(order.status || "").toLowerCase()
    if (status === "returned" || status === "cancelled") continue
    if (!inRange(new Date(order.createdAt), start, end)) continue
    const total = num(order.total)
    if (total <= 0) continue
    rows.push({
      id: order.id,
      date: fmtDay(order.createdAt),
      number: order.orderNumber,
      customer: order.clientName || "Walk-in",
      cashier: String(order.createdBy || "").trim() || "Branch POS",
      method: "POS",
      kind: "Branch POS",
      total,
      items: mapOrderItems(order.items),
    })
  }

  rows.sort((a, b) => b.total - a.total)
  const total = rows.reduce((s, r) => s + r.total, 0)
  const details: MoneyOutDetailLine[] = rows.map((row) => ({
    id: `pos-${row.id}`,
    label: row.number,
    sublabel: `${row.kind} · ${row.customer} · ${row.cashier}`,
    amount: row.total,
    date: row.date,
    items: itemDetailLines(row.items),
  }))
  return { rows, details, total }
}

export function buildOrderReport(
  orders: Array<{
    id: string
    orderNumber: string
    clientName: string
    createdBy?: string | null
    createdAt: Date | string
    total: number
    status: string
    source?: string | null
    notes?: string | null
    branchId?: string | null
    items: unknown
    payments: unknown
  }>,
  start: Date,
  end: Date,
): { rows: FinanceOrderRow[]; details: MoneyOutDetailLine[] } {
  const rows: FinanceOrderRow[] = []
  for (const order of orders) {
    if (
      !isCrmErpOrderForPaymentStats({
        source: order.source,
        notes: order.notes,
        branchId: order.branchId,
      })
    ) {
      continue
    }
    const payments = parseOrderPayments(order.payments)
    let receivedInPeriod = 0
    for (const p of payments) {
      const amount = approvedBalancePaymentAmount(p, order.status as Order["status"])
      if (amount <= 0) continue
      const d = new Date(p.date || order.createdAt)
      if (inRange(d, start, end)) receivedInPeriod += amount
    }
    const createdInPeriod = inRange(new Date(order.createdAt), start, end)
    if (!createdInPeriod && receivedInPeriod <= 0.004) continue

    rows.push({
      id: order.id,
      date: fmtDay(order.createdAt),
      orderNumber: order.orderNumber,
      clientName: order.clientName,
      status: order.status,
      createdBy: String(order.createdBy || "").trim() || "—",
      total: num(order.total),
      receivedInPeriod,
      items: mapOrderItems(order.items),
    })
  }
  rows.sort((a, b) => (b.receivedInPeriod || b.total) - (a.receivedInPeriod || a.total))
  const details: MoneyOutDetailLine[] = rows.map((row) => ({
    id: `ord-${row.id}`,
    label: row.orderNumber,
    sublabel: `${row.clientName} · ${row.status} · ${row.createdBy}`,
    amount: row.receivedInPeriod || row.total,
    date: row.date,
    items: itemDetailLines(row.items),
  }))
  return { rows, details }
}
