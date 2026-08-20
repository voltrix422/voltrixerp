import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Order } from "@/lib/orders"
import {
  parseOrderPayments,
  approvedBalancePaymentAmount,
} from "@/lib/finance-overview"
import { getPaymentSubmissionStatus } from "@/lib/orders"
import { getLocalPoTotal, type PurchaseOrder } from "@/lib/purchase"
import type { LandedCostSummary } from "@/lib/import-shipment"

export const dynamic = "force-dynamic"

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const PK_OFFSET = "+05:00"

function parseRange(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const fromParam = sp.get("from")
  const toParam = sp.get("to")
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

  const toDate = toParam && DATE_ONLY.test(toParam) ? toParam : today
  const fromDate =
    fromParam && DATE_ONLY.test(fromParam)
      ? fromParam
      : toDate

  const from = new Date(`${fromDate}T00:00:00${PK_OFFSET}`)
  const to = new Date(`${toDate}T23:59:59.999${PK_OFFSET}`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new Error("Invalid date range")
  }
  return { from, to, fromDate, toDate }
}

function inRange(d: Date, from: Date, to: Date) {
  return d >= from && d <= to
}

function parseDay(s: string | null | undefined, fallback: Date): Date {
  if (!s) return fallback
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return new Date(t)
  if (DATE_ONLY.test(s)) return new Date(`${s}T12:00:00${PK_OFFSET}`)
  return fallback
}

function orderDeliveredAt(row: {
  fulfillmentDate: string | null
  deliveryDate: string | null
  createdAt: Date
}): Date {
  return parseDay(row.fulfillmentDate || row.deliveryDate || null, row.createdAt)
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function supplierLabel(po: {
  supplierNames?: unknown
  importedSupplierName?: string | null
}): string {
  const names = asArray<string>(po.supplierNames).filter(Boolean)
  if (names.length) return names.join(", ")
  return (po.importedSupplierName || "").trim()
}

function calcImportedPoValue(po: {
  importedItems?: unknown
  items?: unknown
  paymentAmount?: number | null
  payments?: unknown
}): number {
  const imported = asArray<{ unitPrice?: number; qty?: number; quantity?: number }>(po.importedItems)
  if (imported.length > 0) {
    const sum = imported.reduce(
      (s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty ?? i.quantity) || 0),
      0,
    )
    if (sum > 0) return sum
  }
  const items = asArray<{ totalPrice?: number; unitPrice?: number; qty?: number }>(po.items)
  const fromItems = items.reduce(
    (s, i) => s + (Number(i.totalPrice) || (Number(i.unitPrice) || 0) * (Number(i.qty) || 0)),
    0,
  )
  if (fromItems > 0) return fromItems
  if (Number(po.paymentAmount) > 0) return Number(po.paymentAmount)
  return asArray<{ amount?: number }>(po.payments).reduce((s, p) => s + (Number(p.amount) || 0), 0)
}

function calcLocalPoValue(po: Record<string, unknown>): number {
  try {
    const mapped = {
      ...po,
      quotes: asArray(po.quotes),
      items: asArray(po.items),
      payments: asArray(po.payments),
      supplierNames: asArray(po.supplierNames),
      importedItems: asArray(po.importedItems),
    } as unknown as PurchaseOrder
    const fromQuote = getLocalPoTotal(mapped)
    if (fromQuote > 0) return fromQuote
  } catch {
    /* fall through */
  }
  const items = asArray<{ totalPrice?: number; unitPrice?: number; qty?: number }>(po.items)
  const fromItems = items.reduce(
    (s, i) => s + (Number(i.totalPrice) || (Number(i.unitPrice) || 0) * (Number(i.qty) || 0)),
    0,
  )
  if (fromItems > 0) return fromItems
  if (Number(po.paymentAmount) > 0) return Number(po.paymentAmount)
  return asArray<{ amount?: number }>(po.payments).reduce((s, p) => s + (Number(p.amount) || 0), 0)
}

function poPaymentsInRange(
  payments: unknown,
  createdAt: Date,
  from: Date,
  to: Date,
): number {
  let sum = 0
  for (const p of asArray<{ amount?: number; date?: string; paymentDate?: string }>(payments)) {
    const d = parseDay(p.date || p.paymentDate, createdAt)
    if (inRange(d, from, to)) sum += Number(p.amount) || 0
  }
  return sum
}

function shipmentLandedPkr(sh: {
  landedCostSummary: unknown
  items: unknown
  fxRate?: number | null
  charges?: unknown
}): number {
  const summary = (sh.landedCostSummary || {}) as Partial<LandedCostSummary>
  const grand = Number(summary.grandTotalPkr) || 0
  if (grand > 0) return grand
  const product = Number(summary.productTotalPkr) || 0
  if (product > 0) {
    return (
      product +
      (Number(summary.sharedChargesPkr) || 0) +
      (Number(summary.directChargesPkr) || 0)
    )
  }
  const fx = Number(sh.fxRate) || Number(summary.fxRate) || 0
  const items = asArray<{
    qty?: number
    unitPriceForeign?: number
    actualPrice?: number
    productCostPkr?: number
  }>(sh.items)
  const fromItems = items.reduce((s, i) => {
    if (Number(i.productCostPkr) > 0) return s + Number(i.productCostPkr)
    const unitFc = Number(i.actualPrice) || Number(i.unitPriceForeign) || 0
    const qty = Number(i.qty) || 0
    return s + unitFc * qty * (fx || 0)
  }, 0)
  if (fromItems > 0) {
    const charges = asArray<{ amountPkr?: number; amount?: number }>(sh.charges).reduce(
      (s, c) => s + (Number(c.amountPkr) || Number(c.amount) || 0),
      0,
    )
    return fromItems + charges
  }
  return 0
}

export async function GET(req: NextRequest) {
  try {
    const { from, to, fromDate, toDate } = parseRange(req)

    const [orders, pos, records, pettyAllocations, pettyReceipts, posSales, shipments, ledger] =
      await Promise.all([
        prisma.erpOrder.findMany({
          select: {
            id: true,
            orderNumber: true,
            clientName: true,
            status: true,
            total: true,
            createdAt: true,
            fulfillmentDate: true,
            deliveryDate: true,
            payments: true,
            salesAgentCommissionAmount: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.erpPurchaseOrder.findMany({
          select: {
            id: true,
            poNumber: true,
            type: true,
            status: true,
            createdAt: true,
            quotes: true,
            items: true,
            importedItems: true,
            payments: true,
            paymentAmount: true,
            finalizedSupplierId: true,
            supplierNames: true,
            importedSupplierName: true,
          },
        }),
        prisma.erpFinanceRecord.findMany({
          where: { createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.erpPettyCashAllocation.findMany({
          where: {
            allocatedAt: { gte: from, lte: to },
            status: { notIn: ["rejected"] },
          },
          orderBy: { allocatedAt: "desc" },
        }),
        prisma.erpPettyCashReceipt.findMany({
          where: {
            OR: [
              { submittedAt: { gte: from, lte: to } },
              { reviewedAt: { gte: from, lte: to } },
            ],
          },
        }),
        prisma.erpPosSale.findMany({
          where: { createdAt: { gte: from, lte: to } },
        }),
        prisma.erpImportShipment.findMany({
          where: { archived: false },
          select: {
            id: true,
            shipmentNumber: true,
            status: true,
            createdAt: true,
            landedCostSummary: true,
            payments: true,
            supplierName: true,
            items: true,
            charges: true,
            fxRate: true,
          },
        }),
        prisma.erpPurchaseLedger.findMany({
          select: {
            id: true,
            ledgerNumber: true,
            category: true,
            totalAmount: true,
            amountPaid: true,
            amountDue: true,
            transactionDate: true,
            supplierName: true,
            productName: true,
            transactionType: true,
            createdBy: true,
          },
        }),
      ])

    const ledgerInRange = ledger.filter((r) => {
      const d = parseDay(r.transactionDate, new Date(0))
      return inRange(d, from, to)
    })

    // ── Orders ──────────────────────────────────────────────
    const EXCLUDE_STATUS = new Set(["draft", "cancelled", "rejected", "returned"])
    let allOrdersValue = 0
    let allOrdersCount = 0
    let deliveredRevenue = 0
    let deliveredCount = 0
    let cashReceived = 0
    let commissionOnDelivered = 0
    const deliveredOrders: Array<{
      orderNumber: string
      clientName: string
      date: string
      status: string
      total: number
      cashReceived: number
    }> = []
    const orderPayments: Array<{
      orderNumber: string
      clientName: string
      date: string
      method: string
      amount: number
      recordedBy: string
      orderStatus: string
      orderTotal: number
    }> = []
    const paymentMethods: Record<string, number> = {}

    for (const row of orders) {
      const created = new Date(row.createdAt)
      if (inRange(created, from, to) && !EXCLUDE_STATUS.has(row.status)) {
        allOrdersValue += row.total || 0
        allOrdersCount++
      }

      if (row.status === "delivered") {
        const deliveredAt = orderDeliveredAt(row)
        if (inRange(deliveredAt, from, to)) {
          deliveredRevenue += row.total || 0
          deliveredCount++
          if (row.salesAgentCommissionAmount) {
            commissionOnDelivered += row.salesAgentCommissionAmount
          }
          const payments = parseOrderPayments(row.payments)
          let orderCash = 0
          for (const p of payments) {
            const amt = approvedBalancePaymentAmount(p, row.status as Order["status"])
            if (amt > 0) orderCash += amt
          }
          deliveredOrders.push({
            orderNumber: row.orderNumber,
            clientName: row.clientName,
            date: deliveredAt.toISOString().slice(0, 10),
            status: row.status,
            total: row.total || 0,
            cashReceived: orderCash,
          })
        }
      }

      const payments = parseOrderPayments(row.payments)
      for (const p of payments) {
        const st = getPaymentSubmissionStatus(p, row.status as Order["status"])
        if (st !== "approved") continue
        const amount = approvedBalancePaymentAmount(p, row.status as Order["status"])
        if (amount <= 0) continue
        const d = parseDay(p.date, created)
        if (inRange(d, from, to)) {
          cashReceived += amount
          const method = p.method || "Other"
          paymentMethods[method] = (paymentMethods[method] || 0) + amount
          orderPayments.push({
            orderNumber: row.orderNumber,
            clientName: row.clientName,
            date: d.toISOString().slice(0, 10),
            method,
            amount,
            recordedBy: p.createdBy || "—",
            orderStatus: row.status,
            orderTotal: row.total || 0,
          })
        }
      }
    }

    deliveredOrders.sort((a, b) => b.date.localeCompare(a.date))
    orderPayments.sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)

    // ── Finance records / expenses ──────────────────────────
    let expensesTotal = 0
    let incomeRecordsTotal = 0
    const expensesByCategory: Record<string, number> = {}
    const expenseLines = records.map((r) => {
      if (["Expense", "Payment", "Tax", "Salary"].includes(r.category)) {
        expensesTotal += r.amount
        expensesByCategory[r.category] = (expensesByCategory[r.category] || 0) + r.amount
      } else if (["Invoice", "Refund"].includes(r.category)) {
        incomeRecordsTotal += r.amount
      } else {
        expensesByCategory[r.category] = (expensesByCategory[r.category] || 0) + r.amount
        expensesTotal += r.amount
      }
      return {
        id: r.id,
        date: r.createdAt.toISOString().slice(0, 10),
        title: r.title,
        category: r.category,
        tag: r.tag,
        amount: r.amount,
        createdBy: r.created_by,
        supplierName: r.supplier_name,
      }
    })

    // ── Petty cash ──────────────────────────────────────────
    const pettyAllocated = pettyAllocations.reduce((s, a) => s + a.amount, 0)
    const pettyApprovedSpent = pettyReceipts
      .filter((r) => r.status === "approved")
      .filter((r) => {
        const d = r.reviewedAt || r.submittedAt
        return d && inRange(new Date(d), from, to)
      })
      .reduce((s, r) => s + r.amount, 0)
    const pettyPending = pettyReceipts
      .filter((r) => r.status === "pending")
      .reduce((s, r) => s + r.amount, 0)

    const pettyAllocLines = pettyAllocations.map((a) => ({
      id: a.id,
      date: a.allocatedAt.toISOString().slice(0, 10),
      employeeName: a.employeeName,
      allocatedBy: a.allocatedBy || "—",
      amount: a.amount,
      status: a.status,
      purpose: a.purpose || "",
      payoutMethod: a.payoutMethod || "",
    }))
    const pettySpendLines = pettyReceipts
      .filter((r) => r.status === "approved" || r.status === "pending")
      .filter((r) => {
        const d = r.reviewedAt || r.submittedAt
        return d && inRange(new Date(d), from, to)
      })
      .map((r) => ({
        id: r.id,
        date: (r.reviewedAt || r.submittedAt)!.toISOString().slice(0, 10),
        employeeName: r.employeeName,
        description: r.description,
        amount: r.amount,
        status: r.status,
      }))

    // ── Purchases ───────────────────────────────────────────
    let localPoValue = 0
    let localPoCount = 0
    let localPaid = 0
    let importedPoValue = 0
    let importedPoCount = 0
    let importedPaid = 0
    const purchaseLines: Array<{
      poNumber: string
      type: string
      date: string
      status: string
      supplier: string
      value: number
      paidInPeriod: number
      createdInPeriod: boolean
    }> = []

    for (const po of pos) {
      const created = new Date(po.createdAt)
      const paid = poPaymentsInRange(po.payments, created, from, to)
      const type = (po.type || "local").toLowerCase()
      const value =
        type === "imported"
          ? calcImportedPoValue(po)
          : calcLocalPoValue(po as unknown as Record<string, unknown>)
      const createdInPeriod = inRange(created, from, to)

      if (createdInPeriod) {
        if (type === "imported") {
          importedPoValue += value
          importedPoCount++
        } else {
          localPoValue += value
          localPoCount++
        }
      }

      if (type === "imported") importedPaid += paid
      else localPaid += paid

      // Include if created in period OR had payment activity in period
      if (createdInPeriod || paid > 0) {
        purchaseLines.push({
          poNumber: po.poNumber || po.id.slice(0, 8),
          type,
          date: created.toISOString().slice(0, 10),
          status: po.status,
          supplier: supplierLabel(po),
          value,
          paidInPeriod: paid,
          createdInPeriod,
        })
      }
    }

    purchaseLines.sort((a, b) => b.date.localeCompare(a.date))

    // Import shipments
    let importShipmentsLanded = 0
    let importShipmentsPaid = 0
    const shipmentLines: Array<{
      shipmentNumber: string
      supplierName: string
      date: string
      status: string
      landedPkr: number
      paidInPeriod: number
    }> = []

    for (const sh of shipments) {
      const created = new Date(sh.createdAt)
      const landed = shipmentLandedPkr(sh)
      const paid = poPaymentsInRange(sh.payments, created, from, to)
      importShipmentsPaid += paid
      if (inRange(created, from, to) || paid > 0) {
        if (inRange(created, from, to)) importShipmentsLanded += landed
        shipmentLines.push({
          shipmentNumber: sh.shipmentNumber,
          supplierName: sh.supplierName || "",
          date: created.toISOString().slice(0, 10),
          status: sh.status,
          landedPkr: landed,
          paidInPeriod: paid,
        })
      }
    }

    shipmentLines.sort((a, b) => b.date.localeCompare(a.date))

    const ledgerLines = ledgerInRange
      .map((r) => ({
        ledgerNumber: r.ledgerNumber,
        date: r.transactionDate,
        supplierName: r.supplierName || "",
        productName: r.productName || "",
        category: r.category,
        transactionType: r.transactionType,
        totalAmount: Number(r.totalAmount) || 0,
        amountPaid: Number(r.amountPaid) || 0,
        amountDue: Number(r.amountDue) || 0,
        createdBy: r.createdBy || "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date))

    const ledgerSpend = ledgerLines.reduce(
      (s, r) => s + (r.amountPaid || r.totalAmount || 0),
      0,
    )
    const ledgerTotal = ledgerLines.reduce((s, r) => s + r.totalAmount, 0)
    const purchaseTotalValue = localPoValue + importedPoValue + importShipmentsLanded

    // ── POS ─────────────────────────────────────────────────
    const posSalesTotal = posSales.reduce((s, r) => s + r.total, 0)
    const posCount = posSales.length

    // ── Net ─────────────────────────────────────────────────
    const moneyIn = cashReceived + posSalesTotal + incomeRecordsTotal
    const moneyOut =
      expensesTotal + localPaid + importedPaid + importShipmentsPaid + pettyApprovedSpent
    const netCashFlow = moneyIn - moneyOut

    return NextResponse.json({
      range: { from: fromDate, to: toDate },
      currency: "PKR",
      summary: {
        allOrdersCount,
        allOrdersValue,
        deliveredCount,
        deliveredRevenue,
        cashReceived,
        orderPaymentsCount: orderPayments.length,
        commissionOnDelivered,
        expensesTotal,
        incomeRecordsTotal,
        pettyAllocated,
        pettyAllocationsCount: pettyAllocLines.length,
        pettyApprovedSpent,
        pettyPending,
        localPoCount,
        localPoValue,
        localPaid,
        importedPoCount,
        importedPoValue,
        importedPaid,
        importShipmentsLanded,
        importShipmentsPaid,
        purchaseTotalValue,
        ledgerSpend,
        ledgerTotal,
        ledgerCount: ledgerLines.length,
        posSalesTotal,
        posCount,
        moneyIn,
        moneyOut,
        netCashFlow,
      },
      expensesByCategory: Object.entries(expensesByCategory)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      paymentMethods: Object.entries(paymentMethods)
        .map(([method, amount]) => ({ method, amount }))
        .sort((a, b) => b.amount - a.amount),
      orderPayments,
      deliveredOrders,
      expenseLines,
      pettyAllocations: pettyAllocLines,
      pettySpend: pettySpendLines,
      purchases: purchaseLines,
      importShipments: shipmentLines,
      purchaseLedger: ledgerLines,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
