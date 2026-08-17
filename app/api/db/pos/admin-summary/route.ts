import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  getPosOrderCompanyAmount,
  getPosOrderProfit,
  getPosOrderSellAmount,
} from "@/lib/branch-pos-profit"
import type { OrderItem } from "@/lib/orders"
import { aggregatePosProductSales } from "@/lib/pos-product-sales"

export const dynamic = "force-dynamic"

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const PK_OFFSET = "+05:00"

type OrderRow = {
  id: string
  orderNumber: string
  clientName: string
  status: string
  total: number
  items: unknown
  notes: string | null
  branchId: string | null
  source: string | null
  createdAt: Date
  createdBy: string | null
  deliveryDate: string | null
  fulfillmentDate: string | null
  paymentTerms: string | null
}

type SaleRow = {
  id: string
  receiptNumber: string
  terminalId: string
  terminalName: string
  items: unknown
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
  cashierName: string
  customerName: string
  notes: string
  branchId: string | null
  createdAt: Date
}

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
    fromParam && DATE_ONLY.test(fromParam) ? fromParam : toDate

  const from = new Date(`${fromDate}T00:00:00${PK_OFFSET}`)
  const to = new Date(`${toDate}T23:59:59.999${PK_OFFSET}`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new Error("Invalid date range")
  }
  return { from, to, fromDate, toDate }
}

function asItems(raw: unknown): OrderItem[] {
  return Array.isArray(raw) ? (raw as OrderItem[]) : []
}

function orderSell(order: OrderRow) {
  const items = asItems(order.items)
  if (items.length > 0) return getPosOrderSellAmount({ items })
  return Number(order.total) || 0
}

function orderCompany(order: OrderRow) {
  return getPosOrderCompanyAmount({ items: asItems(order.items) })
}

function orderProfit(order: OrderRow) {
  return getPosOrderProfit({ items: asItems(order.items) })
}

function mapOrderBrief(order: OrderRow) {
  const items = asItems(order.items)
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    clientName: order.clientName,
    status: order.status,
    total: Number(order.total) || 0,
    sellAmount: orderSell(order),
    companyAmount: orderCompany(order),
    profit: orderProfit(order),
    itemCount: items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
    notes: order.notes || "",
    branchId: order.branchId,
    createdAt: order.createdAt.toISOString(),
    createdBy: order.createdBy || "",
    deliveryDate: order.deliveryDate || "",
    fulfillmentDate: order.fulfillmentDate || "",
    paymentTerms: order.paymentTerms || "full",
  }
}

function mapSaleBrief(sale: SaleRow) {
  const items = Array.isArray(sale.items) ? sale.items : []
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    terminalId: sale.terminalId,
    terminalName: sale.terminalName,
    total: Number(sale.total) || 0,
    subtotal: Number(sale.subtotal) || 0,
    discount: Number(sale.discount) || 0,
    tax: Number(sale.tax) || 0,
    paymentMethod: sale.paymentMethod,
    cashierName: sale.cashierName,
    customerName: sale.customerName,
    notes: sale.notes,
    branchId: sale.branchId,
    itemCount: items.length,
    createdAt: sale.createdAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  try {
    const { from, to, fromDate, toDate } = parseRange(req)
    const branchIdFilter = req.nextUrl.searchParams.get("branchId")?.trim() || null
    const detail = req.nextUrl.searchParams.get("detail") === "1"
    const productQuery = req.nextUrl.searchParams.get("productQuery")?.trim() || ""
    const unassignedOnly = branchIdFilter === "__unassigned__"
    const realBranchFilter =
      branchIdFilter && !unassignedOnly ? branchIdFilter : null

    const orderBranchWhere = unassignedOnly
      ? { branchId: null }
      : realBranchFilter
        ? { branchId: realBranchFilter }
        : {}
    const saleBranchWhere = unassignedOnly
      ? { OR: [{ branchId: null }, { branchId: "" }] }
      : realBranchFilter
        ? { branchId: realBranchFilter }
        : {}

    const [branches, terminals, orders, sales, stockGroups] = await Promise.all([
      prisma.erpBranch.findMany({
        where: { status: "active" },
        orderBy: { name: "asc" },
      }),
      prisma.erpPosTerminal.findMany({ orderBy: { name: "asc" } }),
      prisma.erpOrder.findMany({
        where: {
          OR: [
            { source: "branch_pos" },
            { notes: { contains: "Branch POS ·" } },
          ],
          createdAt: { gte: from, lte: to },
          ...orderBranchWhere,
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      prisma.erpPosSale.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          ...saleBranchWhere,
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      prisma.erpBranchInventory.groupBy({
        by: ["branchId"],
        _sum: { quantity: true },
        _count: { id: true },
      }),
    ])

    const stockByBranch = new Map(
      stockGroups.map((g) => [
        g.branchId,
        {
          skuCount: g._count.id,
          totalQty: Number(g._sum.quantity) || 0,
        },
      ]),
    )

    const terminalsByBranch = new Map<string, typeof terminals>()
    for (const t of terminals) {
      const key = t.branchId || "__unassigned__"
      const list = terminalsByBranch.get(key) || []
      list.push(t)
      terminalsByBranch.set(key, list)
    }

    const ordersByBranch = new Map<string, OrderRow[]>()
    for (const o of orders as OrderRow[]) {
      const key = o.branchId || "__unassigned__"
      const list = ordersByBranch.get(key) || []
      list.push(o)
      ordersByBranch.set(key, list)
    }

    const salesByBranch = new Map<string, SaleRow[]>()
    for (const s of sales as SaleRow[]) {
      const key = s.branchId || "__unassigned__"
      const list = salesByBranch.get(key) || []
      list.push(s)
      salesByBranch.set(key, list)
    }

    const branchIdsWithPos = new Set<string>()
    for (const t of terminals) {
      if (t.branchId) branchIdsWithPos.add(t.branchId)
    }
    for (const o of orders) {
      if (o.branchId) branchIdsWithPos.add(o.branchId)
    }
    for (const s of sales) {
      if (s.branchId) branchIdsWithPos.add(s.branchId)
    }

    const relevantBranches = branches.filter(
      (b) =>
        branchIdsWithPos.has(b.id) ||
        ["outlet", "store", "branch_warehouse"].includes(b.type),
    )

    function summarizeBranch(branchId: string, branchName: string, branchCode: string) {
      const branchOrders = ordersByBranch.get(branchId) || []
      const branchSales = salesByBranch.get(branchId) || []
      const branchTerminals = terminalsByBranch.get(branchId) || []
      const stock = stockByBranch.get(branchId) || { skuCount: 0, totalQty: 0 }

      let sellTotal = 0
      let companyTotal = 0
      let profitTotal = 0
      let deliveredCount = 0
      let openCount = 0
      let cancelledCount = 0

      for (const o of branchOrders) {
        sellTotal += orderSell(o)
        companyTotal += orderCompany(o)
        profitTotal += orderProfit(o)
        const st = String(o.status || "").toLowerCase()
        if (st === "delivered") deliveredCount += 1
        else if (st === "cancelled" || st === "returned") cancelledCount += 1
        else openCount += 1
      }

      const receiptTotal = branchSales.reduce((s, r) => s + (Number(r.total) || 0), 0)

      return {
        branchId,
        branchName,
        branchCode,
        terminalCount: branchTerminals.length,
        terminals: branchTerminals.map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          location: t.location,
          isActive: t.isActive,
        })),
        orderCount: branchOrders.length,
        deliveredCount,
        openCount,
        cancelledCount,
        orderSellTotal: sellTotal,
        orderCompanyTotal: companyTotal,
        orderProfitTotal: profitTotal,
        receiptCount: branchSales.length,
        receiptTotal,
        combinedSaleTotal: sellTotal + receiptTotal,
        stockSkuCount: stock.skuCount,
        stockQty: stock.totalQty,
        ...(detail
          ? {
              orders: branchOrders.slice(0, 200).map(mapOrderBrief),
              receipts: branchSales.slice(0, 200).map(mapSaleBrief),
            }
          : {}),
      }
    }

    const byBranch = (
      realBranchFilter
        ? relevantBranches.filter((b) => b.id === realBranchFilter)
        : unassignedOnly
          ? []
          : relevantBranches
    ).map((b) => summarizeBranch(b.id, b.name, b.code))

    // Include unassigned if any (or when explicitly requested)
    if (
      unassignedOnly ||
      (!branchIdFilter &&
        (ordersByBranch.has("__unassigned__") || salesByBranch.has("__unassigned__")))
    ) {
      byBranch.push(summarizeBranch("__unassigned__", "Unassigned", "—"))
    }

    byBranch.sort((a, b) => b.combinedSaleTotal - a.combinedSaleTotal)

    const combined = byBranch.reduce(
      (acc, b) => ({
        branchCount: acc.branchCount + (b.branchId === "__unassigned__" ? 0 : 1),
        terminalCount: acc.terminalCount + b.terminalCount,
        orderCount: acc.orderCount + b.orderCount,
        deliveredCount: acc.deliveredCount + b.deliveredCount,
        openCount: acc.openCount + b.openCount,
        cancelledCount: acc.cancelledCount + b.cancelledCount,
        orderSellTotal: acc.orderSellTotal + b.orderSellTotal,
        orderCompanyTotal: acc.orderCompanyTotal + b.orderCompanyTotal,
        orderProfitTotal: acc.orderProfitTotal + b.orderProfitTotal,
        receiptCount: acc.receiptCount + b.receiptCount,
        receiptTotal: acc.receiptTotal + b.receiptTotal,
        combinedSaleTotal: acc.combinedSaleTotal + b.combinedSaleTotal,
        stockSkuCount: acc.stockSkuCount + b.stockSkuCount,
        stockQty: acc.stockQty + b.stockQty,
      }),
      {
        branchCount: 0,
        terminalCount: 0,
        orderCount: 0,
        deliveredCount: 0,
        openCount: 0,
        cancelledCount: 0,
        orderSellTotal: 0,
        orderCompanyTotal: 0,
        orderProfitTotal: 0,
        receiptCount: 0,
        receiptTotal: 0,
        combinedSaleTotal: 0,
        stockSkuCount: 0,
        stockQty: 0,
      },
    )

    const recentOrders = (orders as OrderRow[])
      .slice(0, 30)
      .map((o) => ({
        ...mapOrderBrief(o),
        branchName:
          branches.find((b) => b.id === o.branchId)?.name ||
          (o.branchId ? "Unknown branch" : "Unassigned"),
      }))

    const recentReceipts = (sales as SaleRow[])
      .slice(0, 30)
      .map((s) => ({
        ...mapSaleBrief(s),
        branchName:
          branches.find((b) => b.id === s.branchId)?.name ||
          (s.branchId ? "Unknown branch" : "Unassigned"),
      }))

    const branchNameMap = new Map<string, string>()
    for (const b of branches) branchNameMap.set(b.id, b.name)
    branchNameMap.set("__unassigned__", "Unassigned")

    const productSummary = productQuery
      ? aggregatePosProductSales(
          productQuery,
          orders as OrderRow[],
          sales as SaleRow[],
          branchNameMap,
        )
      : null

    return NextResponse.json({
      from: fromDate,
      to: toDate,
      combined,
      byBranch,
      recentOrders,
      recentReceipts,
      productSummary,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load POS admin summary"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
