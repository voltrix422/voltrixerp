import { isBranchPosOrderHiddenFromErp } from "@/lib/branch-pos"
import { isRentLedgerDbRow } from "@/lib/purchase-ledger"
import type { MoneyOutDetailLine } from "@/lib/finance-money-out-details"
import { approvedBalancePaymentAmount, orderPaidTotal, parseOrderPayments } from "@/lib/finance-overview"
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
  paidTotal: number
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
  paidTotal: number
  receivedInPeriod: number
  items: FinancePdfItem[]
}

const EXPENSE_CATEGORIES = new Set(["Expense", "Payment", "Tax", "Other", "Salary"])

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
      .join(" Â· "),
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
    const createdBy = String(r.created_by || "").trim() || "â€”"
    const receiptPerson = String(r.receipt_person_name || "").trim()
    const purpose = String(r.purpose || "").trim()
    lines.push({
      id: r.id,
      date: fmtDay(r.createdAt),
      title: purpose ? `${r.title} Â· ${purpose}` : r.title,
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
      .join(" Â· "),
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
    payments?: unknown
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
      paidTotal: total,
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
      paidTotal: orderPaidTotal({
        payments: parseOrderPayments(order.payments),
        status: order.status as Order["status"],
      }),
      items: mapOrderItems(order.items),
    })
  }

  rows.sort((a, b) => b.total - a.total)
  const total = rows.reduce((s, r) => s + r.total, 0)
  const details: MoneyOutDetailLine[] = rows.map((row) => ({
    id: `pos-${row.id}`,
    label: row.number,
    sublabel: `${row.kind} Â· ${row.customer} Â· ${row.cashier}`,
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
      paidTotal: orderPaidTotal({
        payments,
        status: order.status as Order["status"],
      }),
      receivedInPeriod,
      items: mapOrderItems(order.items),
    })
  }
  rows.sort((a, b) => (b.receivedInPeriod || b.total) - (a.receivedInPeriod || a.total))
  const details: MoneyOutDetailLine[] = rows.map((row) => ({
    id: `ord-${row.id}`,
    label: row.orderNumber,
    sublabel: `${row.clientName} Â· ${row.status} Â· ${row.createdBy}`,
    amount: row.receivedInPeriod || row.total,
    date: row.date,
    items: itemDetailLines(row.items),
  }))
  return { rows, details }
}

export type FinancePettyCashLine = {
  id: string
  date: string
  employee: string
  description: string
  category: string
  amount: number
}

export type FinancePurchaseItem = {
  description: string
  qty: number
  unit: string
  unitPrice: number
  lineTotal: number
}

export type FinancePurchaseRow = {
  id: string
  date: string
  poNumber: string
  kind: "Local" | "Imported"
  supplier: string
  status: string
  createdBy: string
  paidInPeriod: number
  items: FinancePurchaseItem[]
}

export function buildPettyCashReport(
  receipts: Array<{
    id: string
    employeeName?: string | null
    description?: string | null
    category?: string | null
    amount: number
    status: string
    submittedAt: Date | string
    reviewedAt?: Date | string | null
  }>,
  start: Date,
  end: Date,
): {
  lines: FinancePettyCashLine[]
  byPerson: FinanceExpenseByPerson[]
  total: number
} {
  const lines: FinancePettyCashLine[] = []
  for (const r of receipts) {
    if (String(r.status || "").toLowerCase() !== "approved") continue
    const amount = num(r.amount)
    if (amount <= 0) continue
    const raw = r.reviewedAt ?? r.submittedAt
    if (!raw) continue
    if (!inRange(new Date(raw), start, end)) continue
    lines.push({
      id: r.id,
      date: fmtDay(raw),
      employee: String(r.employeeName || "").trim() || "â€”",
      description: String(r.description || "").trim() || "Petty cash",
      category: String(r.category || "").trim() || "Approved",
      amount,
    })
  }
  lines.sort((a, b) => b.amount - a.amount)
  const byMap = new Map<string, FinanceExpenseByPerson>()
  for (const line of lines) {
    const row = byMap.get(line.employee) || { name: line.employee, count: 0, amount: 0 }
    row.count += 1
    row.amount += line.amount
    byMap.set(line.employee, row)
  }
  return {
    lines,
    byPerson: [...byMap.values()].sort((a, b) => b.amount - a.amount),
    total: lines.reduce((s, l) => s + l.amount, 0),
  }
}

function mapPurchaseItems(po: { type?: string | null; items?: unknown; importedItems?: unknown }): FinancePurchaseItem[] {
  const imported = Array.isArray(po.importedItems) ? po.importedItems : []
  if (String(po.type || "").toLowerCase() === "imported" && imported.length) {
    return imported.map((raw) => {
      const item = raw as { description?: string; qty?: number; unit?: string; unitPrice?: number }
      const qty = num(item.qty)
      const unitPrice = num(item.unitPrice)
      return {
        description: String(item.description || "").trim() || "Item",
        qty,
        unit: String(item.unit || "pcs").trim() || "pcs",
        unitPrice,
        lineTotal: qty * unitPrice,
      }
    })
  }
  const items = Array.isArray(po.items) ? po.items : []
  return items.map((raw) => {
    const item = raw as { description?: string; qty?: number; unit?: string; unitPrice?: number }
    const qty = num(item.qty)
    const unitPrice = num(item.unitPrice)
    return {
      description: String(item.description || "").trim() || "Item",
      qty,
      unit: String(item.unit || "pcs").trim() || "pcs",
      unitPrice,
      lineTotal: qty * unitPrice,
    }
  })
}

export function buildPurchaseReport(
  purchaseOrders: Array<{
    id: string
    poNumber?: string | null
    type?: string | null
    supplierNames?: unknown
    importedSupplierName?: string | null
    items?: unknown
    importedItems?: unknown
    payments?: unknown
    status?: string | null
    createdBy?: string | null
    createdAt: Date | string
    paymentAmount?: number | null
    paymentDate?: string | null
  }>,
  start: Date,
  end: Date,
): { local: FinancePurchaseRow[]; imported: FinancePurchaseRow[] } {
  const local: FinancePurchaseRow[] = []
  const imported: FinancePurchaseRow[] = []

  for (const po of purchaseOrders) {
    const payments = Array.isArray(po.payments) ? po.payments : []
    let paidInPeriod = 0
    for (const raw of payments) {
      const p = raw as { amount?: number; date?: string }
      const amount = num(p.amount)
      if (amount <= 0) continue
      const d = new Date(p.date || po.createdAt)
      if (inRange(d, start, end)) paidInPeriod += amount
    }
    if (paidInPeriod <= 0 && po.paymentAmount && po.paymentDate) {
      const d = new Date(po.paymentDate)
      if (inRange(d, start, end)) paidInPeriod += num(po.paymentAmount)
    }
    const createdInPeriod = inRange(new Date(po.createdAt), start, end)
    if (paidInPeriod <= 0.004 && !createdInPeriod) continue

    const names = Array.isArray(po.supplierNames)
      ? po.supplierNames.map((n) => String(n || "").trim()).filter(Boolean)
      : []
    const supplier =
      names.join(", ") || String(po.importedSupplierName || "").trim() || "â€”"
    const kind: "Local" | "Imported" =
      String(po.type || "local").toLowerCase() === "imported" ? "Imported" : "Local"
    const row: FinancePurchaseRow = {
      id: po.id,
      date: fmtDay(po.createdAt),
      poNumber: String(po.poNumber || po.id.slice(0, 8)),
      kind,
      supplier,
      status: String(po.status || "â€”"),
      createdBy: String(po.createdBy || "").trim() || "â€”",
      paidInPeriod,
      items: mapPurchaseItems(po),
    }
    if (kind === "Imported") imported.push(row)
    else local.push(row)
  }

  local.sort((a, b) => b.paidInPeriod - a.paidInPeriod)
  imported.sort((a, b) => b.paidInPeriod - a.paidInPeriod)
  return { local, imported }
}

export type FinanceLedgerItem = {
  description: string
  qty: number
  unitPrice: number
  lineTotal: number
}

export type FinanceLedgerLine = {
  id: string
  date: string
  ledgerNumber: string
  createdBy: string
  supplier: string
  project: string
  itemsLabel: string
  kind: "Purchase" | "Rent"
  total: number
  paid: number
  due: number
  itemLines: FinanceLedgerItem[]
}

function ledgerDayInRange(iso: string | null | undefined, fallback: Date | string, start: Date, end: Date) {
  const raw = String(iso || "").trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return inRange(new Date(`${raw}T12:00:00+05:00`), start, end)
  }
  return inRange(new Date(fallback), start, end)
}

function asArray(value: unknown): unknown[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function flattenLedgerItems(row: {
  productName?: string | null
  items?: unknown
  supplierGroups?: unknown
  quantity?: number | null
  unitPrice?: number | null
  totalAmount?: number | null
}): FinanceLedgerItem[] {
  const groups = asArray(row.supplierGroups)
  const fromGroups: FinanceLedgerItem[] = []
  for (const g of groups) {
    const items = asArray((g as { items?: unknown }).items)
    for (const raw of items) {
      const item = raw as { productName?: string; quantity?: number; unitPrice?: number; lineTotal?: number }
      const qty = num(item.quantity)
      const unitPrice = num(item.unitPrice)
      const lineTotal = num(item.lineTotal) || qty * unitPrice
      fromGroups.push({
        description: String(item.productName || "").trim() || "Item",
        qty,
        unitPrice,
        lineTotal,
      })
    }
  }
  if (fromGroups.length) return fromGroups
  const items = asArray(row.items)
  const fromItems = items.map((raw) => {
    const item = raw as { productName?: string; quantity?: number; unitPrice?: number; lineTotal?: number }
    const qty = num(item.quantity)
    const unitPrice = num(item.unitPrice)
    return {
      description: String(item.productName || "").trim() || "Item",
      qty,
      unitPrice,
      lineTotal: num(item.lineTotal) || qty * unitPrice,
    }
  })
  if (fromItems.length) return fromItems
  const name = String(row.productName || "").trim()
  if (!name) return []
  return [{
    description: name,
    qty: num(row.quantity) || 1,
    unitPrice: num(row.unitPrice),
    lineTotal: num(row.totalAmount),
  }]
}

function ledgerSupplier(row: { supplierName?: string | null; supplierGroups?: unknown }) {
  const names = asArray(row.supplierGroups)
    .map((g) => String((g as { supplierName?: string }).supplierName || "").trim())
    .filter(Boolean)
  return names.join(", ") || String(row.supplierName || "").trim() || "—"
}

export function buildLedgerReport(
  entries: Array<{
    id: string
    ledgerNumber?: string | null
    transactionDate?: string | null
    createdAt: Date | string
    createdBy?: string | null
    supplierName?: string | null
    projectName?: string | null
    productName?: string | null
    purchaseScopeId?: string | null
    transactionType?: string | null
    items?: unknown
    supplierGroups?: unknown
    payments?: unknown
    quantity?: number | null
    unitPrice?: number | null
    totalAmount?: number | null
    amountPaid?: number | null
    amountDue?: number | null
  }>,
  start: Date,
  end: Date,
): {
  lines: FinanceLedgerLine[]
  purchases: FinanceLedgerLine[]
  rents: FinanceLedgerLine[]
  byPerson: FinanceExpenseByPerson[]
  total: number
  paid: number
  due: number
} {
  const lines: FinanceLedgerLine[] = []
  for (const row of entries) {
    const scope = String(row.purchaseScopeId || "P1").trim().toUpperCase()
    if (scope && scope !== "P1") continue
    const payments = asArray(row.payments)
    const itemLines = flattenLedgerItems(row)
    const itemsLabel = itemLines.length
      ? itemLines.length === 1
        ? itemLines[0].description
        : `${itemLines[0].description} +${itemLines.length - 1} more`
      : String(row.productName || "—")
    const kind = isRentLedgerDbRow(row) ? "Rent" : "Purchase"
    const supplier = ledgerSupplier(row)
    const project = String(row.projectName || "").trim() || "—"
    const ledgerNumber = String(row.ledgerNumber || "—")
    payments.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") return
      const p = raw as { amount?: number; date?: string; createdAt?: string; createdBy?: string }
      const amount = num(p.amount)
      if (amount <= 0) return
      const payDate = String(p.date || "").trim()
      if (!payDate) return
      if (!ledgerDayInRange(payDate, row.createdAt, start, end)) return
      lines.push({
        id: `${row.id}-${index}`,
        date: payDate,
        ledgerNumber,
        createdBy: String(p.createdBy || row.createdBy || "").trim() || "—",
        supplier,
        project,
        itemsLabel,
        kind,
        total: amount,
        paid: amount,
        due: 0,
        itemLines,
      })
    })
  }
  lines.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const byMap = new Map<string, FinanceExpenseByPerson>()
  for (const line of lines) {
    if (line.paid <= 0.004) continue
    const person = byMap.get(line.createdBy) || { name: line.createdBy, count: 0, amount: 0 }
    person.count += 1
    person.amount += line.paid
    byMap.set(line.createdBy, person)
  }
  const paid = lines.reduce((s, l) => s + l.paid, 0)
  return {
    lines,
    purchases: lines.filter((l) => l.kind === "Purchase"),
    rents: lines.filter((l) => l.kind === "Rent"),
    byPerson: [...byMap.values()].sort((a, b) => b.amount - a.amount),
    total: paid,
    paid,
    due: 0,
  }
}
